const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');
const crypto = require('crypto');
const { enviarCorreoResend } = require('../config/mailer');
const logger = require('../config/logger');
const { obtenerSlugUnico } = require('../services/slugService');


const register = async (req, res) => {
  const { nombre_negocio, email, password, plan, nombre_dueño } = req.body;

  if (!nombre_negocio || !email || !password) {
    return res.status(400).json({ mensaje: 'Nombre de negocio, email y contraseña son requeridos' });
  }

  try {
    // 1. Validar email único
    const userCheck = await db.query('SELECT id FROM restaurantes WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ mensaje: 'El email ya está registrado' });
    }

    // 2. Hashear password - A02 Criptografía: 12 rounds recomendado por OWASP
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // 3. Generar slug amigable único para la URL del menú
    const slug = await obtenerSlugUnico(nombre_negocio);

    // 4. Insertar restaurante (email_verificado queda en false por defecto, suscripcion_activa = false, estado = 'pendiente')
    const newRest = await db.query(
      `INSERT INTO restaurantes (nombre_negocio, slug, email, password_hash, plan, nombre_dueno, email_verificado, suscripcion_activa, estado) 
       VALUES ($1, $2, $3, $4, $5, $6, false, false, 'pendiente') RETURNING id`,
      [nombre_negocio, slug, email, password_hash, plan || 'basico', nombre_dueño || '']
    );

    const restId = newRest.rows[0].id;

    // 4. Crear registro en la tabla de configuración de tema (obligatorio)
    await db.query(
      'INSERT INTO configuracion_tema (restaurante_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [restId]
    );

    // 5. Generar OTP de 6 dígitos
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 6. Guardar OTP en Redis (expira en 5 minutos = 300s)
    await redisClient.setEx(`otp:registro:${email}`, 300, otp);

    // 7. Enviar OTP por correo con Resend
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 12px;">
        <h2 style="color: #2997FF; text-align: center;">¡Te damos la bienvenida a MexxicanMX!</h2>
        <p>Gracias por registrar tu restaurante. Para completar el registro y verificar tu dirección de correo electrónico, utiliza el siguiente código de un solo uso (OTP):</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background-color: #f5f5f7; padding: 10px 20px; border-radius: 8px; border: 1px solid #d2d2d7; color: #1d1d1f;">${otp}</span>
        </div>
        <p style="font-size: 12px; color: #86868b; text-align: center;">Este código es válido por 5 minutos. Si no solicitaste este código, puedes ignorar este correo de forma segura.</p>
      </div>
    `;
    await enviarCorreoResend(email, 'Verifica tu cuenta - MexxicanMX', htmlContent);

    res.status(201).json({
      mensaje: 'Registrado con éxito. Por favor verifica tu correo con el código enviado.',
      requiereVerificacion: true,
      email
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ mensaje: 'Email y contraseña son requeridos' });
  }

  try {
    // Verificar si la cuenta está bloqueada
    const lockedKey = `locked:${email}`;
    const locked = await redisClient.get(lockedKey);
    if (locked) {
      logger.warn('Intento de login en cuenta bloqueada', { email });
      return res.status(403).json({
        mensaje: 'Cuenta bloqueada temporalmente por seguridad. Intenta más tarde.'
      });
    }

    // 1. Buscar usuario
    const result = await db.query('SELECT id, password_hash, rol, suscripcion_activa, email_verificado, estado FROM restaurantes WHERE email = $1 LIMIT 1', [email]);
    if (result.rows.length === 0) {
      // Incrementar contador de intentos fallidos
      const attempts = await redisClient.incr(`failed:${email}`);
      if (attempts >= 5) {
        await redisClient.setEx(lockedKey, 900, 'locked'); // 15 minutos
        await redisClient.del(`failed:${email}`);
        logger.warn('Cuenta bloqueada por múltiples intentos fallidos', { email });
      } else {
        await redisClient.expire(`failed:${email}`, 3600); // 1 hora
      }
      logger.warn('Intento de login fallido (credenciales incorrectas)', { email, attempts });
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    // 2. Comparar password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const attempts = await redisClient.incr(`failed:${email}`);
      if (attempts >= 5) {
        await redisClient.setEx(lockedKey, 900, 'locked');
        await redisClient.del(`failed:${email}`);
      } else {
        await redisClient.expire(`failed:${email}`, 3600);
      }
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    // Resetear contador en login exitoso
    await redisClient.del(`failed:${email}`);
    logger.info('Usuario autenticado', { email, userId: user.id, rol: user.rol });

    // 3. Verificar si el correo electrónico ha sido verificado (excluyendo SUPER_ADMIN)
    if (!user.email_verificado && user.rol !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        mensaje: 'Tu correo electrónico no ha sido verificado.',
        requiereVerificacion: true,
        email
      });
    }

    // 4. Verificar suscripción y aprobación por Super Admin (Solo para restaurantes)
    if (!user.suscripcion_activa && user.rol !== 'SUPER_ADMIN') {
      const msg = user.estado === 'pendiente'
        ? 'Tu correo ya fue verificado. Tu cuenta está en espera de aprobación por el Super Admin.'
        : 'Suscripción inactiva o suspendida. Contacte al administrador.';
      return res.status(403).json({ mensaje: msg });
    }

    // 5. Generar tokens en paralelo
    const [accessToken, refreshToken] = await Promise.all([
      jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '15m' }),
      jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' })
    ]);

    // OWASP A02: Criptografía - Hashear el Refresh Token antes de guardarlo en la base de datos
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // 6. Guardar Refresh Token de forma asíncrona
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    db.query(
      'INSERT INTO refresh_tokens (restaurante_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    ).catch(err => console.error('Error guardando refresh token hash (background):', err));

    // 7. Responder inmediatamente
    const cookieName = user.rol === 'SUPER_ADMIN' ? 'admin_refreshToken' : 'refreshToken';
    res.cookie(cookieName, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      access_token: accessToken,
      rol: user.rol,
      restaurante_id: user.id
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// POST /api/auth/verify-email
const verifyEmail = async (req, res) => {
  const { email, codigo } = req.body;

  if (!email || !codigo) {
    return res.status(400).json({ mensaje: 'Email y código son requeridos' });
  }

  try {
    // 1. Obtener código OTP desde Redis
    const otpGuardado = await redisClient.get(`otp:registro:${email}`);
    
    if (!otpGuardado) {
      return res.status(400).json({ mensaje: 'El código OTP ha expirado o es inválido' });
    }

    if (otpGuardado !== codigo) {
      return res.status(400).json({ mensaje: 'El código OTP ingresado es incorrecto' });
    }

    // 2. Actualizar email_verificado en la base de datos
    const result = await db.query(
      'UPDATE restaurantes SET email_verificado = true WHERE email = $1 RETURNING id',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Restaurante no encontrado' });
    }

    // 3. Eliminar OTP de Redis
    await redisClient.del(`otp:registro:${email}`);

    res.json({ mensaje: 'Correo electrónico verificado con éxito. Tu cuenta ha sido enviada al Super Admin para su aprobación.' });
  } catch (error) {
    console.error('Error en verificación de email:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// POST /api/auth/resend-verification
const resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ mensaje: 'El email es requerido' });
  }

  try {
    const result = await db.query('SELECT email_verificado FROM restaurantes WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'El email no está registrado' });
    }

    if (result.rows[0].email_verificado) {
      return res.status(400).json({ mensaje: 'Este correo electrónico ya está verificado' });
    }

    // Generar nuevo OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redisClient.setEx(`otp:registro:${email}`, 300, otp);

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 12px;">
        <h2 style="color: #2997FF; text-align: center;">Tu nuevo código de verificación</h2>
        <p>Has solicitado un nuevo código de verificación para tu cuenta. Utiliza el siguiente código OTP:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background-color: #f5f5f7; padding: 10px 20px; border-radius: 8px; border: 1px solid #d2d2d7; color: #1d1d1f;">${otp}</span>
        </div>
        <p style="font-size: 12px; color: #86868b; text-align: center;">Este código es válido por 5 minutos.</p>
      </div>
    `;
    await enviarCorreoResend(email, 'Código de verificación - MexxicanMX', htmlContent);

    res.json({ mensaje: 'Código de verificación reenviado con éxito.' });
  } catch (error) {
    console.error('Error al reenviar código:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ mensaje: 'El email es requerido' });
  }

  try {
    // Verificar si el email existe
    const result = await db.query('SELECT id FROM restaurantes WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Por seguridad no confirmamos si existe, sólo indicamos que se ha enviado si el correo está registrado
      return res.json({ mensaje: 'Si el correo está registrado, se enviará un código de verificación.' });
    }

    // Generar OTP de recuperación
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redisClient.setEx(`otp:recuperacion:${email}`, 300, otp);

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 12px;">
        <h2 style="color: #FF3B30; text-align: center;">Recuperación de Contraseña</h2>
        <p>Has solicitado restablecer la contraseña de tu cuenta en MexxicanMX. Utiliza el siguiente código OTP de seguridad:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background-color: #fff2f2; padding: 10px 20px; border-radius: 8px; border: 1px solid #ffb3b3; color: #ff3b30;">${otp}</span>
        </div>
        <p>Si no has solicitado restablecer tu contraseña, te recomendamos verificar la seguridad de tu cuenta de inmediato.</p>
        <p style="font-size: 12px; color: #86868b; text-align: center;">Este código expira en 5 minutos.</p>
      </div>
    `;
    await enviarCorreoResend(email, 'Restablecer contraseña - MexxicanMX', htmlContent);

    res.json({ mensaje: 'Si el correo está registrado, se enviará un código de verificación.' });
  } catch (error) {
    console.error('Error en recuperar contraseña:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  const { email, codigo, newPassword } = req.body;

  if (!email || !codigo || !newPassword) {
    return res.status(400).json({ mensaje: 'Email, código y nueva contraseña son requeridos' });
  }

  try {
    // 1. Obtener OTP de Redis
    const otpGuardado = await redisClient.get(`otp:recuperacion:${email}`);

    if (!otpGuardado) {
      return res.status(400).json({ mensaje: 'El código OTP ha expirado o es inválido' });
    }

    if (otpGuardado !== codigo) {
      return res.status(400).json({ mensaje: 'El código OTP ingresado es incorrecto' });
    }

    // 2. Hashear nueva contraseña - A02 Criptografía: 12 rounds recomendado por OWASP
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(newPassword, salt);

    // 3. Actualizar la contraseña en la base de datos
    const result = await db.query(
      'UPDATE restaurantes SET password_hash = $1 WHERE email = $2 RETURNING id',
      [password_hash, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Restaurante no encontrado' });
    }

    // 4. Eliminar OTP de Redis
    await redisClient.del(`otp:recuperacion:${email}`);

    res.json({ mensaje: 'Contraseña restablecida con éxito. Ya puedes iniciar sesión con tu nueva contraseña.' });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// POST /api/auth/refresh (Flujo de sesión OWASP A07)
const refresh = async (req, res) => {
  const origin = req.headers.origin || req.headers.referer || '';
  const isAdminOrigin = origin.includes(':3001') || origin.includes('admin');
  
  let refreshToken;
  
  if (isAdminOrigin) {
    refreshToken = req.cookies.admin_refreshToken;
  } else {
    refreshToken = req.cookies.refreshToken;
  }

  if (!refreshToken) {
    return res.status(401).json({ mensaje: 'Acceso denegado. Token de actualización no proporcionado.' });
  }

  try {
    // 1. Verificar la firma del JWT
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // 2. Hashear el token enviado para buscarlo en la base de datos de forma segura
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // 3. Buscar el hash en la base de datos y que no esté vencido
    const result = await db.query(
      'SELECT restaurante_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW() LIMIT 1',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Token de actualización inválido o revocado.' });
    }

    const restId = result.rows[0].restaurante_id;

    // Obtener rol del restaurante para incluirlo en el nuevo access token
    const userRes = await db.query('SELECT rol FROM restaurantes WHERE id = $1 LIMIT 1', [restId]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Usuario no encontrado.' });
    }
    const userRole = userRes.rows[0].rol;

    // 4. Generar nuevo Access Token (15 minutos)
    const newAccessToken = jwt.sign(
      { id: restId, rol: userRole },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ access_token: newAccessToken });
  } catch (error) {
    console.error('Error en refresh token:', error.message);
    res.status(401).json({ mensaje: 'Token de actualización no válido.' });
  }
};

// POST /api/auth/logout (Flujo de sesión OWASP A07)
const logout = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  const adminRefreshToken = req.cookies.admin_refreshToken;
  const tokenToRevoke = refreshToken || adminRefreshToken;

  try {
    if (tokenToRevoke) {
      // Hashear el token para buscar y borrar de forma segura
      const tokenHash = crypto.createHash('sha256').update(tokenToRevoke).digest('hex');
      await db.query('DELETE FROM refresh_tokens WHERE token = $1', [tokenHash]);
    }

    // Limpiar las cookies en el cliente
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    });
    res.clearCookie('admin_refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    });

    res.json({ mensaje: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ mensaje: 'Error al cerrar sesión' });
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  refresh,
  logout
};
