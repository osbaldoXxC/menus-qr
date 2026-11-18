'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const db = require('../config/db');
const redisClient = require('../config/redis');
const { enviarCorreoResend } = require('../config/mailer');
const { getQuotaStatus, recordAuditLog } = require('../services/comensalQuotaService');

// Pre-computed dummy hash (12 rounds) to prevent timing-based user enumeration when email does not exist
const DUMMY_BCRYPT_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setComensalAuthCookies(res, accessToken, refreshToken) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('comensal_access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  res.cookie('comensal_refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

function clearComensalAuthCookies(res) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('comensal_access_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/'
  });
  res.clearCookie('comensal_refresh_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Strict',
    path: '/api/auth'
  });
}

function issueComensalTokens(userId, familyId) {
  const jti = crypto.randomUUID();
  const accessToken = jwt.sign(
    { id: userId, rol: 'COMENSAL', type: 'comensal_access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { id: userId, rol: 'COMENSAL', type: 'comensal_refresh', jti, familyId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { accessToken, refreshToken, refreshHash, expiresAt, familyId };
}

const registerComensal = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!nombre || nombre.length < 2 || nombre.length > 120) {
    return res.status(400).json({ mensaje: 'Ingresa tu nombre (entre 2 y 120 caracteres).', code: 'INVALID_NAME' });
  }
  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
    return res.status(400).json({ mensaje: 'Ingresa un correo electrónico válido.', code: 'INVALID_EMAIL' });
  }
  if (!password || password.length < 8 || password.length > 128) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres.', code: 'WEAK_PASSWORD' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, password_hash, deleted_at FROM usuarios_comensales WHERE LOWER(email) = LOWER($1) FOR UPDATE`,
      [email]
    );

    if (existing.rows.length > 0 && existing.rows[0].deleted_at === null && existing.rows[0].password_hash) {
      await client.query('ROLLBACK');
      // Generic message to prevent account enumeration
      return res.status(409).json({
        mensaje: 'No fue posible completar el registro con ese correo. Si ya tienes cuenta, inicia sesión.',
        code: 'REGISTRATION_CONFLICT'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    let userId;
    if (existing.rows.length > 0) {
      // Upgrade existing historical/social/soft-deleted row safely while preserving FK history
      const upd = await client.query(
        `UPDATE usuarios_comensales
         SET nombre = $2,
             password_hash = $3,
             rol = 'COMENSAL',
             auth_provider = 'Email',
             estado = 'activo',
             email_verificado = true,
             deleted_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, nombre, email, rol, estado`,
        [existing.rows[0].id, nombre, passwordHash]
      );
      userId = upd.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO usuarios_comensales (nombre, email, password_hash, rol, auth_provider, estado, email_verificado)
         VALUES ($1, $2, $3, 'COMENSAL', 'Email', 'activo', true)
         RETURNING id, nombre, email, rol, estado`,
        [nombre, email, passwordHash]
      );
      userId = ins.rows[0].id;
    }

    await client.query(
      `INSERT INTO comensal_entitlements (usuario_id, plan_code, status, source, reason)
       VALUES ($1, 'FREE', 'ACTIVE', 'registration', 'Registro de cuenta de comensal con plan gratuito 5/semana')
       ON CONFLICT (usuario_id) DO NOTHING`,
      [userId]
    );

    const familyId = crypto.randomUUID();
    const tokens = issueComensalTokens(userId, familyId);

    await client.query(
      `INSERT INTO comensal_refresh_tokens (usuario_id, family_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, familyId, tokens.refreshHash, tokens.expiresAt]
    );

    await recordAuditLog(client, {
      userId,
      action: 'COMENSAL_REGISTER',
      entityType: 'usuarios_comensales',
      entityId: userId,
      reason: 'Registro de nuevo comensal con rol COMENSAL y plan FREE',
      beforeSummary: null,
      afterSummary: { rol: 'COMENSAL', plan_code: 'FREE', estado: 'activo' },
      ipAddress: req.ip || null
    });

    await client.query('COMMIT');

    const quota = await getQuotaStatus(db.pool, userId);
    setComensalAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return res.status(201).json({
      mensaje: 'Cuenta creada con éxito.',
      user: { id: userId, nombre, email, rol: 'COMENSAL' },
      quota
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en registerComensal:', err.message);
    return res.status(500).json({ mensaje: 'Error interno al registrar la cuenta.', code: 'INTERNAL_ERROR' });
  } finally {
    client.release();
  }
};

const loginComensal = async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return res.status(400).json({ mensaje: 'Ingresa tu correo y contraseña.', code: 'MISSING_CREDENTIALS' });
  }

  const lockedKey = `locked:comensal:${email}`;
  const failedKey = `failed:comensal:${email}`;

  try {
    if (redisClient && typeof redisClient.get === 'function') {
      const locked = await redisClient.get(lockedKey).catch(() => null);
      if (locked) {
        return res.status(423).json({
          mensaje: 'Tu cuenta está bloqueada temporalmente por intentos fallidos. Intenta de nuevo en 15 minutos.',
          code: 'ACCOUNT_LOCKED'
        });
      }
    }

    const userRes = await db.query(
      `SELECT id, nombre, email, password_hash, rol, estado
       FROM usuarios_comensales
       WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL
       LIMIT 1`,
      [email]
    );

    const user = userRes.rows[0];
    const hashToCompare = (user && user.password_hash) ? user.password_hash : DUMMY_BCRYPT_HASH;
    const passwordValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.password_hash || !passwordValid) {
      if (redisClient && typeof redisClient.incr === 'function') {
        const attempts = await redisClient.incr(failedKey).catch(() => 1);
        if (attempts >= 5) {
          await redisClient.setEx(lockedKey, 900, 'locked').catch(() => {});
          await redisClient.del(failedKey).catch(() => {});
        } else {
          await redisClient.expire(failedKey, 3600).catch(() => {});
        }
      }
      return res.status(401).json({
        mensaje: 'Correo o contraseña incorrectos.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (user.estado !== 'activo') {
      return res.status(403).json({
        mensaje: 'Tu cuenta se encuentra bloqueada o suspendida.',
        code: 'ACCOUNT_LOCKED'
      });
    }

    if (redisClient && typeof redisClient.del === 'function') {
      await redisClient.del(failedKey).catch(() => {});
    }

    const familyId = crypto.randomUUID();
    const tokens = issueComensalTokens(user.id, familyId);

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO comensal_refresh_tokens (usuario_id, family_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [user.id, familyId, tokens.refreshHash, tokens.expiresAt]
      );
      await recordAuditLog(client, {
        userId: user.id,
        action: 'COMENSAL_LOGIN',
        entityType: 'usuarios_comensales',
        entityId: user.id,
        reason: 'Inicio de sesión exitoso de comensal',
        beforeSummary: null,
        afterSummary: { rol: 'COMENSAL', family_id: familyId },
        ipAddress: req.ip || null
      });
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    const quota = await getQuotaStatus(db.pool, user.id);
    setComensalAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return res.json({
      mensaje: 'Sesión iniciada correctamente.',
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: 'COMENSAL' },
      quota
    });
  } catch (err) {
    console.error('Error en loginComensal:', err.message);
    return res.status(500).json({ mensaje: 'Error interno al iniciar sesión.', code: 'INTERNAL_ERROR' });
  }
};

const refreshComensal = async (req, res) => {
  const refreshToken = req.cookies && req.cookies.comensal_refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ mensaje: 'Sesión expirada. Inicia sesión nuevamente.', code: 'SESSION_EXPIRED' });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    if (decoded.rol !== 'COMENSAL' || decoded.type !== 'comensal_refresh') {
      throw new Error('invalid_token_type');
    }
  } catch (_) {
    clearComensalAuthCookies(res);
    return res.status(401).json({ mensaje: 'Sesión expirada. Inicia sesión nuevamente.', code: 'SESSION_EXPIRED' });
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    const rowRes = await client.query(
      `SELECT rt.*, u.nombre, u.email, u.rol, u.estado, u.deleted_at
       FROM comensal_refresh_tokens rt
       JOIN usuarios_comensales u ON u.id = rt.usuario_id
       WHERE rt.token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );

    if (rowRes.rows.length === 0) {
      await client.query('ROLLBACK');
      clearComensalAuthCookies(res);
      return res.status(401).json({ mensaje: 'Sesión no válida o expirada.', code: 'SESSION_EXPIRED' });
    }

    const tokenRow = rowRes.rows[0];

    // Reuse detection: if an already revoked refresh token is presented again, revoke the entire token family!
    if (tokenRow.revoked_at !== null) {
      await client.query(
        `UPDATE comensal_refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP,
             revoke_reason = 'refresh_token_reuse_detected'
         WHERE family_id = $1 AND revoked_at IS NULL`,
        [tokenRow.family_id]
      );
      await recordAuditLog(client, {
        userId: tokenRow.usuario_id,
        action: 'COMENSAL_REFRESH_REUSE_REVOKED',
        entityType: 'comensal_refresh_tokens',
        entityId: tokenRow.family_id,
        reason: 'Detección de reutilización de refresh token; familia de sesión revocada por seguridad',
        beforeSummary: { family_id: tokenRow.family_id },
        afterSummary: { family_revoked: true },
        ipAddress: req.ip || null
      });
      await client.query('COMMIT');
      clearComensalAuthCookies(res);
      return res.status(401).json({ mensaje: 'Sesión revocada por seguridad. Inicia sesión nuevamente.', code: 'SESSION_EXPIRED' });
    }

    if (new Date(tokenRow.expires_at) <= new Date() || tokenRow.deleted_at !== null || tokenRow.estado !== 'activo') {
      await client.query(
        `UPDATE comensal_refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'expired_or_inactive'
         WHERE id = $1`,
        [tokenRow.id]
      );
      await client.query('COMMIT');
      clearComensalAuthCookies(res);
      return res.status(401).json({ mensaje: 'Tu sesión ha expirado.', code: 'SESSION_EXPIRED' });
    }

    // Rotate refresh token within the same family
    const nextTokens = issueComensalTokens(tokenRow.usuario_id, tokenRow.family_id);
    await client.query(
      `UPDATE comensal_refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP,
           revoke_reason = 'rotated',
           replaced_by_hash = $2
       WHERE id = $1`,
      [tokenRow.id, nextTokens.refreshHash]
    );
    await client.query(
      `INSERT INTO comensal_refresh_tokens (usuario_id, family_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [tokenRow.usuario_id, tokenRow.family_id, nextTokens.refreshHash, nextTokens.expiresAt]
    );

    await client.query('COMMIT');

    const quota = await getQuotaStatus(db.pool, tokenRow.usuario_id);
    setComensalAuthCookies(res, nextTokens.accessToken, nextTokens.refreshToken);

    return res.json({
      user: { id: tokenRow.usuario_id, nombre: tokenRow.nombre, email: tokenRow.email, rol: 'COMENSAL' },
      quota
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en refreshComensal:', err.message);
    return res.status(500).json({ mensaje: 'Error al renovar la sesión.', code: 'INTERNAL_ERROR' });
  } finally {
    client.release();
  }
};

const logoutComensal = async (req, res) => {
  const refreshToken = req.cookies && req.cookies.comensal_refresh_token;
  try {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query(
          `UPDATE comensal_refresh_tokens
           SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'user_logout'
           WHERE token_hash = $1
           RETURNING usuario_id, family_id`,
          [tokenHash]
        );
        if (found.rows.length > 0) {
          const { usuario_id, family_id } = found.rows[0];
          await client.query(
            `UPDATE comensal_refresh_tokens
             SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'user_logout_family'
             WHERE family_id = $1 AND revoked_at IS NULL`,
            [family_id]
          );
          await recordAuditLog(client, {
            userId: usuario_id,
            action: 'COMENSAL_LOGOUT',
            entityType: 'comensal_refresh_tokens',
            entityId: family_id,
            reason: 'Cierre de sesión explícito del comensal',
            beforeSummary: { session_active: true },
            afterSummary: { session_revoked: true },
            ipAddress: req.ip || null
          });
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }
  } finally {
    clearComensalAuthCookies(res);
  }
  return res.json({ mensaje: 'Sesión cerrada exitosamente.' });
};

const getComensalMe = async (req, res) => {
  const token = (req.cookies && req.cookies.comensal_access_token) ||
    (req.header('Authorization')?.startsWith('Bearer ') ? req.header('Authorization').split(' ')[1] : null);

  if (!token) {
    return res.status(401).json({ mensaje: 'No has iniciado sesión.', code: 'AUTH_REQUIRED' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ mensaje: 'Sesión expirada.', code: 'SESSION_EXPIRED' });
  }

  if (!decoded || decoded.rol !== 'COMENSAL') {
    return res.status(403).json({ mensaje: 'Esta sesión no corresponde a una cuenta de comensal.', code: 'FORBIDDEN_ROLE' });
  }

  // Anti-IDOR check if client passes target userId param or query
  const requestedUserId = req.params.userId || req.query.userId;
  if (requestedUserId && String(requestedUserId) !== String(decoded.id)) {
    return res.status(403).json({ mensaje: 'No tienes permiso para consultar la cuota de otra cuenta.', code: 'FORBIDDEN_RESOURCE' });
  }

  try {
    const userRes = await db.query(
      `SELECT id, nombre, email, rol, estado
       FROM usuarios_comensales
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [decoded.id]
    );
    if (userRes.rows.length === 0) {
      clearComensalAuthCookies(res);
      return res.status(401).json({ mensaje: 'Cuenta no disponible.', code: 'AUTH_REQUIRED' });
    }
    const user = userRes.rows[0];
    if (user.estado !== 'activo') {
      return res.status(403).json({ mensaje: 'Cuenta bloqueada o suspendida.', code: 'ACCOUNT_LOCKED' });
    }

    const quota = await getQuotaStatus(db.pool, user.id);
    return res.json({
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: 'COMENSAL' },
      quota
    });
  } catch (err) {
    console.error('Error en getComensalMe:', err.message);
    return res.status(500).json({ mensaje: 'Error al consultar la sesión.', code: 'INTERNAL_ERROR' });
  }
};

const forgotComensalPassword = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ mensaje: 'Ingresa un correo electrónico válido.', code: 'INVALID_EMAIL' });
  }
  try {
    const result = await db.query(
      `SELECT id FROM usuarios_comensales WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [email]
    );
    if (result.rows.length > 0 && redisClient && typeof redisClient.setEx === 'function') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await redisClient.setEx(`otp:recuperacion:comensal:${email}`, 300, otp).catch(() => {});
      if (typeof enviarCorreoResend === 'function') {
        await enviarCorreoResend(email, 'Recuperación de contraseña - MexxicanMX Comensales', `<p>Tu código de recuperación es: <strong>${otp}</strong> (válido por 5 minutos).</p>`).catch(() => {});
      }
    }
    // Always return identical neutral response to prevent enumeration
    return res.json({ mensaje: 'Si el correo está registrado, enviaremos un código de recuperación.' });
  } catch (err) {
    return res.status(500).json({ mensaje: 'Error interno al procesar la solicitud.', code: 'INTERNAL_ERROR' });
  }
};

const resetComensalPassword = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!email || !codigo || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ mensaje: 'Correo, código y nueva contraseña (mín. 8 caracteres) son obligatorios.', code: 'INVALID_INPUT' });
  }

  try {
    const otpGuardado = redisClient && typeof redisClient.get === 'function'
      ? await redisClient.get(`otp:recuperacion:comensal:${email}`).catch(() => null)
      : null;

    if (!otpGuardado || otpGuardado !== codigo) {
      return res.status(400).json({ mensaje: 'El código de verificación es inválido o ha expirado.', code: 'INVALID_OTP' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const upd = await client.query(
        `UPDATE usuarios_comensales
         SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
         WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL
         RETURNING id`,
        [email, passwordHash]
      );
      if (upd.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ mensaje: 'No fue posible restablecer la contraseña.', code: 'RESET_FAILED' });
      }
      const userId = upd.rows[0].id;
      await client.query(
        `UPDATE comensal_refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'password_reset'
         WHERE usuario_id = $1 AND revoked_at IS NULL`,
        [userId]
      );
      await recordAuditLog(client, {
        userId,
        action: 'COMENSAL_PASSWORD_RESET',
        entityType: 'usuarios_comensales',
        entityId: userId,
        reason: 'Restablecimiento de contraseña con revocación de sesiones previas',
        beforeSummary: null,
        afterSummary: { sessions_revoked: true },
        ipAddress: req.ip || null
      });
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    if (redisClient && typeof redisClient.del === 'function') {
      await redisClient.del(`otp:recuperacion:comensal:${email}`).catch(() => {});
    }

    return res.json({ mensaje: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' });
  } catch (err) {
    return res.status(500).json({ mensaje: 'Error al restablecer la contraseña.', code: 'INTERNAL_ERROR' });
  }
};

module.exports = {
  registerComensal,
  loginComensal,
  refreshComensal,
  logoutComensal,
  getComensalMe,
  forgotComensalPassword,
  resetComensalPassword,
  issueComensalTokens
};
