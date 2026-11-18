'use strict';

const crypto = require('node:crypto');

const WEEKLY_FREE_LIMIT = 5;
const SNAPSHOT_TTL_MS = 15 * 60 * 1000; // 15 minutes retention for idempotent replay

function computeReservationTtlMs() {
  const mlTimeout = Number(process.env.ML_SERVICE_TIMEOUT) || 5000;
  return Math.max(30000, mlTimeout * 4 + 10000);
}

/**
 * Deterministic calculation of the current Monday 00:00:00.000 -> next Monday 00:00:00.000
 * window in America/Mexico_City, converted to exact UTC Date instances.
 */
function getMexicoCityWeekWindow(nowInput = new Date()) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  function getParts(d) {
    const parts = formatter.formatToParts(d);
    const map = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    const hour = Number(map.hour) === 24 ? 0 : Number(map.hour);
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      weekday: map.weekday,
      hour,
      minute: Number(map.minute),
      second: Number(map.second)
    };
  }

  function localMidnightToUtc(year, month, day) {
    // Iterative resolution in America/Mexico_City so DST/historical offset changes are exact
    let guess = Date.UTC(year, month - 1, day, 6, 0, 0, 0);
    for (let i = 0; i < 3; i++) {
      const p = getParts(new Date(guess));
      const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
      const targetAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
      const diff = targetAsUtc - localAsUtc;
      if (diff === 0) break;
      guess += diff;
    }
    return new Date(guess);
  }

  const weekdayIndex = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const currentLocal = getParts(now);
  const daysSinceMonday = weekdayIndex[currentLocal.weekday] ?? 0;

  const mondayUtcAnchor = new Date(Date.UTC(currentLocal.year, currentLocal.month - 1, currentLocal.day) - daysSinceMonday * 86400000);
  const nextMondayUtcAnchor = new Date(mondayUtcAnchor.getTime() + 7 * 86400000);

  const windowStartUtc = localMidnightToUtc(
    mondayUtcAnchor.getUTCFullYear(),
    mondayUtcAnchor.getUTCMonth() + 1,
    mondayUtcAnchor.getUTCDate()
  );
  const windowEndUtc = localMidnightToUtc(
    nextMondayUtcAnchor.getUTCFullYear(),
    nextMondayUtcAnchor.getUTCMonth() + 1,
    nextMondayUtcAnchor.getUTCDate()
  );

  return {
    timezone: 'America/Mexico_City',
    windowStartUtc,
    windowEndUtc,
    resetsAtIso: windowEndUtc.toISOString()
  };
}

/**
 * Generates a privacy-safe SHA-256 fingerprint of the canonical recommendation request and scope.
 * Never persists raw craving text or allergies in quota/audit logs.
 */
function computeRequestFingerprint({ scope = 'global', restaurantId = null, body = {} } = {}) {
  const b = body && typeof body === 'object' ? body : {};
  const craving = b.craving && typeof b.craving === 'object' ? b.craving : {};
  const restrictions = b.restrictions && typeof b.restrictions === 'object' ? b.restrictions : {};
  const options = b.options && typeof b.options === 'object' ? b.options : {};

  const canonical = {
    scope: String(scope || 'global'),
    restaurantId: restaurantId ? String(restaurantId).trim().toLowerCase() : null,
    text: typeof craving.text === 'string' ? craving.text.trim() : '',
    tags: Array.isArray(craving.tags) ? [...craving.tags].map(t => String(t).trim()).sort() : [],
    diet: restrictions.diet || 'none',
    allergies: Array.isArray(restrictions.allergies) ? [...restrictions.allergies].map(a => String(a).trim().toLowerCase()).sort() : [],
    excludedIngredients: Array.isArray(restrictions.excludedIngredients) ? [...restrictions.excludedIngredients].map(e => String(e).trim().toLowerCase()).sort() : [],
    budgetMax: restrictions.budgetMax ?? null,
    limit: options.limit ?? 5
  };

  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

async function recordAuditLog(client, { userId, action, entityType, entityId, requestId, reason, beforeSummary, afterSummary, ipAddress = null }) {
  const safeDetails = {
    actor_id: userId,
    actor_rol: 'COMENSAL',
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    request_id: requestId || null,
    reason: reason || null,
    before_summary: beforeSummary || null,
    after_summary: afterSummary || null,
    migration_version: '20261117_r4_comensal_auth_quota_audit'
  };
  await client.query(
    `INSERT INTO audit_logs (usuario_id, accion, detalles, ip_address)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [userId, action, JSON.stringify(safeDetails), ipAddress]
  );
}

async function resolveEffectiveEntitlement(client, userId, nowUtc) {
  await client.query(
    `INSERT INTO comensal_entitlements (usuario_id, plan_code, status, source, reason)
     VALUES ($1, 'FREE', 'ACTIVE', 'system_default', 'Plan gratuito inicial')
     ON CONFLICT (usuario_id) DO NOTHING`,
    [userId]
  );

  const res = await client.query(
    `SELECT * FROM comensal_entitlements WHERE usuario_id = $1 FOR UPDATE`,
    [userId]
  );
  const ent = res.rows[0];
  if (!ent) {
    return { planCode: 'FREE', status: 'ACTIVE', activePaid: false, transitionedFromPaid: false };
  }

  if (ent.plan_code === 'PAID' && ent.status === 'ACTIVE') {
    const validFromOk = !ent.valid_from || new Date(ent.valid_from) <= nowUtc;
    const validUntilOk = !ent.valid_until || new Date(ent.valid_until) > nowUtc;
    if (validFromOk && validUntilOk) {
      return {
        planCode: 'PAID',
        status: 'ACTIVE',
        activePaid: true,
        validUntil: ent.valid_until ? new Date(ent.valid_until).toISOString() : null,
        transitionedFromPaid: false
      };
    }

    // Paid subscription expired -> automatically transition to FREE and log in audit_logs
    await client.query(
      `UPDATE comensal_entitlements
       SET status = 'EXPIRED', version = version + 1, updated_at = $2, reason = 'Suscripción vencida; transición a plan gratuito'
       WHERE id = $1`,
      [ent.id, nowUtc]
    );
    await recordAuditLog(client, {
      userId,
      action: 'COMENSAL_ENTITLEMENT_EXPIRED_TO_FREE',
      entityType: 'comensal_entitlements',
      entityId: ent.id,
      reason: 'Vencimiento de vigencia valid_until; transición automática a plan FREE',
      beforeSummary: { plan_code: 'PAID', status: 'ACTIVE', valid_until: ent.valid_until },
      afterSummary: { plan_code: 'FREE', effective_status: 'EXPIRED_FALLBACK_FREE' }
    });
  }

  return {
    planCode: 'FREE',
    status: ent.status === 'ACTIVE' && ent.plan_code === 'FREE' ? 'ACTIVE' : 'FALLBACK_FREE',
    activePaid: false,
    transitionedFromPaid: ent.plan_code === 'PAID'
  };
}

async function expireStaleReservations(client, userId, nowUtc) {
  const expiredRes = await client.query(
    `UPDATE comensal_uso_eventos
     SET status = 'RELEASED',
         release_reason = 'expired_ttl',
         finalized_at = $2
     WHERE usuario_id = $1
       AND status = 'RESERVED'
       AND reservation_expires_at <= $2
     RETURNING window_start_utc, plan_applied`,
    [userId, nowUtc]
  );

  for (const row of expiredRes.rows) {
    if (row.plan_applied === 'FREE') {
      await client.query(
        `UPDATE comensal_uso_ventanas
         SET reserved = GREATEST(0, reserved - 1),
             version = version + 1,
             updated_at = $3
         WHERE usuario_id = $1 AND window_start_utc = $2`,
        [userId, row.window_start_utc, nowUtc]
      );
    }
  }
}

async function ensureWindowLocked(client, userId, windowStartUtc, windowEndUtc) {
  await client.query(
    `INSERT INTO comensal_uso_ventanas (usuario_id, window_start_utc, window_end_utc, used, reserved)
     VALUES ($1, $2, $3, 0, 0)
     ON CONFLICT (usuario_id, window_start_utc) DO NOTHING`,
    [userId, windowStartUtc, windowEndUtc]
  );
  const winRes = await client.query(
    `SELECT * FROM comensal_uso_ventanas
     WHERE usuario_id = $1 AND window_start_utc = $2
     FOR UPDATE`,
    [userId, windowStartUtc]
  );
  return winRes.rows[0];
}

function buildQuotaSummary(entitlement, windowRow, weekWindow) {
  const used = windowRow ? Number(windowRow.used) : 0;
  const reserved = windowRow ? Number(windowRow.reserved) : 0;
  const isPaid = !!(entitlement && entitlement.activePaid);
  return {
    plan: isPaid ? 'PAID' : 'FREE',
    isPaid,
    limit: isPaid ? null : WEEKLY_FREE_LIMIT,
    used: isPaid ? 0 : used,
    reserved: isPaid ? 0 : reserved,
    remaining: isPaid ? null : Math.max(0, WEEKLY_FREE_LIMIT - used),
    availableNow: isPaid ? null : Math.max(0, WEEKLY_FREE_LIMIT - used - reserved),
    windowStartUtc: weekWindow.windowStartUtc.toISOString(),
    windowEndUtc: weekWindow.windowEndUtc.toISOString(),
    resetsAt: weekWindow.resetsAtIso,
    timezone: weekWindow.timezone
  };
}

async function getQuotaStatus(pool, userId, nowInput = new Date()) {
  const nowUtc = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const weekWindow = getMexicoCityWeekWindow(nowUtc);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await expireStaleReservations(client, userId, nowUtc);
    const entitlement = await resolveEffectiveEntitlement(client, userId, nowUtc);
    const windowRow = await ensureWindowLocked(client, userId, weekWindow.windowStartUtc, weekWindow.windowEndUtc);
    await client.query('COMMIT');
    return buildQuotaSummary(entitlement, windowRow, weekWindow);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function reserveQuotaSlot(pool, { userId, requestKey, requestFingerprint, nowInput = new Date(), ttlMs = null }) {
  const nowUtc = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const effectiveTtlMs = typeof ttlMs === 'number' && ttlMs > 0 ? ttlMs : computeReservationTtlMs();
  const reservationExpiresAt = new Date(nowUtc.getTime() + effectiveTtlMs);
  const weekWindow = getMexicoCityWeekWindow(nowUtc);
  const safeKey = String(requestKey || '').trim();

  if (!safeKey || safeKey.length > 128) {
    return {
      action: 'REJECT',
      httpStatus: 400,
      statusCode: 'invalid_request',
      errorCode: 'INVALID_REQUEST_KEY',
      retryable: false,
      message: 'Identificador de operación inválido.'
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await expireStaleReservations(client, userId, nowUtc);
    const entitlement = await resolveEffectiveEntitlement(client, userId, nowUtc);
    const windowRow = await ensureWindowLocked(client, userId, weekWindow.windowStartUtc, weekWindow.windowEndUtc);

    // Check existing idempotency event for (userId, 'RECOMMENDATION', safeKey)
    const existingRes = await client.query(
      `SELECT * FROM comensal_uso_eventos
       WHERE usuario_id = $1 AND operation_type = 'RECOMMENDATION' AND request_key = $2
       FOR UPDATE`,
      [userId, safeKey]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (existing.request_fingerprint !== requestFingerprint) {
        await client.query('COMMIT');
        return {
          action: 'REJECT',
          httpStatus: 409,
          statusCode: 'invalid_request',
          errorCode: 'IDEMPOTENCY_KEY_MISMATCH',
          retryable: false,
          message: 'La clave de operación ya fue utilizada con otra búsqueda distinta.',
          quota: buildQuotaSummary(entitlement, windowRow, weekWindow)
        };
      }

      if (existing.status === 'RESERVED' && new Date(existing.reservation_expires_at) > nowUtc) {
        await client.query('COMMIT');
        return {
          action: 'REJECT',
          httpStatus: 409,
          statusCode: 'operation_in_progress',
          errorCode: 'OPERATION_IN_PROGRESS',
          retryable: true,
          message: 'Tu búsqueda ya está en curso. Espera unos segundos.',
          quota: buildQuotaSummary(entitlement, windowRow, weekWindow)
        };
      }

      if (existing.status === 'CONSUMED' && existing.response_snapshot &&
          (!existing.snapshot_expires_at || new Date(existing.snapshot_expires_at) > nowUtc)) {
        await client.query('COMMIT');
        return {
          action: 'REPLAY',
          eventId: existing.id,
          responseSnapshot: existing.response_snapshot,
          quota: buildQuotaSummary(entitlement, windowRow, weekWindow)
        };
      }

      if (existing.status === 'CONSUMED') {
        await client.query('COMMIT');
        return {
          action: 'REJECT',
          httpStatus: 409,
          statusCode: 'operation_already_consumed',
          errorCode: 'OPERATION_ALREADY_CONSUMED',
          retryable: false,
          message: 'Esta operación ya fue procesada anteriormente.',
          quota: buildQuotaSummary(entitlement, windowRow, weekWindow)
        };
      }

      // If existing.status === 'RELEASED', remove the released row so the retry can reserve cleanly
      await client.query(`DELETE FROM comensal_uso_eventos WHERE id = $1`, [existing.id]);
    }

    const executionToken = crypto.randomUUID();

    if (entitlement.activePaid) {
      const insPaid = await client.query(
        `INSERT INTO comensal_uso_eventos (
           usuario_id, operation_type, request_key, request_fingerprint, execution_token,
           plan_applied, window_start_utc, window_end_utc, status, reservation_expires_at, created_at
         ) VALUES ($1, 'RECOMMENDATION', $2, $3, $4, 'PAID', $5, $6, 'RESERVED', $7, $8)
         RETURNING id`,
        [userId, safeKey, requestFingerprint, executionToken, weekWindow.windowStartUtc, weekWindow.windowEndUtc, reservationExpiresAt, nowUtc]
      );
      await client.query('COMMIT');
      return {
        action: 'PROCEED',
        eventId: insPaid.rows[0].id,
        executionToken,
        planApplied: 'PAID',
        windowStartUtc: weekWindow.windowStartUtc,
        windowEndUtc: weekWindow.windowEndUtc,
        quota: buildQuotaSummary(entitlement, windowRow, weekWindow)
      };
    }

    // Plan FREE: check used and reserved limits
    const used = Number(windowRow.used);
    const reserved = Number(windowRow.reserved);

    if (used >= WEEKLY_FREE_LIMIT) {
      await client.query('COMMIT');
      return {
        action: 'REJECT',
        httpStatus: 429,
        statusCode: 'quota_exceeded',
        errorCode: 'QUOTA_EXCEEDED',
        retryable: false,
        message: 'Alcanzaste tus 5 búsquedas útiles gratuitas de la semana. Tu cuota se renueva el próximo lunes a las 00:00 (hora de Ciudad de México).',
        quota: buildQuotaSummary(entitlement, windowRow, weekWindow)
      };
    }

    if (used + reserved >= WEEKLY_FREE_LIMIT) {
      await client.query('COMMIT');
      return {
        action: 'REJECT',
        httpStatus: 429,
        statusCode: 'quota_slot_busy',
        errorCode: 'QUOTA_SLOT_BUSY',
        retryable: true,
        message: 'Tu último uso disponible de la semana está procesándose en otra solicitud en curso. Espera unos segundos e inténtalo de nuevo.',
        quota: buildQuotaSummary(entitlement, windowRow, weekWindow)
      };
    }

    const updatedWin = await client.query(
      `UPDATE comensal_uso_ventanas
       SET reserved = reserved + 1,
           version = version + 1,
           updated_at = $3
       WHERE id = $1 AND (used + reserved) < $2
       RETURNING *`,
      [windowRow.id, WEEKLY_FREE_LIMIT, nowUtc]
    );

    if (updatedWin.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        action: 'REJECT',
        httpStatus: 429,
        statusCode: 'quota_slot_busy',
        errorCode: 'QUOTA_SLOT_BUSY',
        retryable: true,
        message: 'No hay cupos libres en este instante. Intenta nuevamente en unos segundos.',
        quota: buildQuotaSummary(entitlement, windowRow, weekWindow)
      };
    }

    const insFree = await client.query(
      `INSERT INTO comensal_uso_eventos (
         usuario_id, operation_type, request_key, request_fingerprint, execution_token,
         plan_applied, window_start_utc, window_end_utc, status, reservation_expires_at, created_at
       ) VALUES ($1, 'RECOMMENDATION', $2, $3, $4, 'FREE', $5, $6, 'RESERVED', $7, $8)
       RETURNING id`,
      [userId, safeKey, requestFingerprint, executionToken, weekWindow.windowStartUtc, weekWindow.windowEndUtc, reservationExpiresAt, nowUtc]
    );

    await client.query('COMMIT');
    return {
      action: 'PROCEED',
      eventId: insFree.rows[0].id,
      executionToken,
      planApplied: 'FREE',
      windowStartUtc: weekWindow.windowStartUtc,
      windowEndUtc: weekWindow.windowEndUtc,
      quota: buildQuotaSummary(entitlement, updatedWin.rows[0], weekWindow)
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function isUsefulRecommendationResponse(httpStatus, body) {
  if (httpStatus !== 200 || !body || typeof body !== 'object') return false;
  const code = body.status && body.status.code;
  if (!['ok', 'partial_results_sanitized'].includes(code)) return false;
  return Array.isArray(body.recommendations) && body.recommendations.length >= 1;
}

async function finalizeQuotaSlot(pool, { eventId, executionToken, httpStatus, responseBody, nowInput = new Date() }) {
  const nowUtc = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const evRes = await client.query(
      `SELECT * FROM comensal_uso_eventos WHERE id = $1 FOR UPDATE`,
      [eventId]
    );

    if (evRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, expired: true, reason: 'reservation_not_found' };
    }

    const ev = evRes.rows[0];
    const windowStartUtc = new Date(ev.window_start_utc);
    const windowEndUtc = new Date(ev.window_end_utc);
    const fixedWeekWindow = {
      timezone: 'America/Mexico_City',
      windowStartUtc,
      windowEndUtc,
      resetsAtIso: windowEndUtc.toISOString()
    };

    const winRes = await client.query(
      `SELECT * FROM comensal_uso_ventanas
       WHERE usuario_id = $1 AND window_start_utc = $2
       FOR UPDATE`,
      [ev.usuario_id, ev.window_start_utc]
    );
    let winRow = winRes.rows[0];

    // Verify ownership, active RESERVED state, and unexpired reservation TTL
    const isExpired = new Date(ev.reservation_expires_at) <= nowUtc;
    if (ev.status !== 'RESERVED' || String(ev.execution_token) !== String(executionToken) || isExpired) {
      if (ev.status === 'RESERVED') {
        await client.query(
          `UPDATE comensal_uso_eventos
           SET status = 'RELEASED', release_reason = 'expired_before_finalize', finalized_at = $2
           WHERE id = $1`,
          [ev.id, nowUtc]
        );
        if (ev.plan_applied === 'FREE' && winRow) {
          const r = await client.query(
            `UPDATE comensal_uso_ventanas
             SET reserved = GREATEST(0, reserved - 1), version = version + 1, updated_at = $2
             WHERE id = $1 RETURNING *`,
            [winRow.id, nowUtc]
          );
          winRow = r.rows[0] || winRow;
        }
      }
      await client.query('COMMIT');
      return {
        ok: false,
        expired: true,
        httpStatus: 504,
        statusCode: 'reservation_expired',
        errorCode: 'RESERVATION_EXPIRED',
        message: 'El tiempo de reserva de la búsqueda expiró antes de confirmar el resultado. No se descontó ningún uso.',
        quota: buildQuotaSummary({ activePaid: ev.plan_applied === 'PAID' }, winRow, fixedWeekWindow)
      };
    }

    const useful = isUsefulRecommendationResponse(httpStatus, responseBody);

    if (useful) {
      if (ev.plan_applied === 'FREE' && winRow) {
        const updWin = await client.query(
          `UPDATE comensal_uso_ventanas
           SET used = used + 1,
               reserved = GREATEST(0, reserved - 1),
               version = version + 1,
               updated_at = $2
           WHERE id = $1 AND used < $3
           RETURNING *`,
          [winRow.id, nowUtc, WEEKLY_FREE_LIMIT]
        );
        winRow = updWin.rows[0] || winRow;
      }

      const quotaSummary = buildQuotaSummary({ activePaid: ev.plan_applied === 'PAID' }, winRow, fixedWeekWindow);
      const snapshot = {
        ...responseBody,
        meta: {
          ...(responseBody.meta || {}),
          quota: quotaSummary
        }
      };
      const snapshotExpiresAt = new Date(nowUtc.getTime() + SNAPSHOT_TTL_MS);

      await client.query(
        `UPDATE comensal_uso_eventos
         SET status = 'CONSUMED',
             response_snapshot = $2::jsonb,
             snapshot_expires_at = $3,
             finalized_at = $4
         WHERE id = $1`,
        [ev.id, JSON.stringify(snapshot), snapshotExpiresAt, nowUtc]
      );

      await recordAuditLog(client, {
        userId: ev.usuario_id,
        action: 'COMENSAL_QUOTA_CONSUMED',
        entityType: 'comensal_uso_eventos',
        entityId: ev.id,
        requestId: responseBody.requestId || null,
        reason: 'Búsqueda útil con recomendaciones verificadas',
        beforeSummary: { plan: ev.plan_applied, used: ev.plan_applied === 'FREE' ? Math.max(0, quotaSummary.used - 1) : 0 },
        afterSummary: { plan: ev.plan_applied, used: quotaSummary.used, remaining: quotaSummary.remaining }
      });

      await client.query('COMMIT');
      return { ok: true, consumed: true, quota: quotaSummary, payload: snapshot };
    }

    // Not useful (no_verified_results, 0 items, validation error, or 5xx): release without consuming
    const releaseReason = httpStatus >= 500
      ? 'http_5xx_error'
      : (httpStatus >= 400 ? 'http_4xx_validation' : (responseBody?.status?.code || 'empty_recommendations'));

    if (ev.plan_applied === 'FREE' && winRow) {
      const updWin = await client.query(
        `UPDATE comensal_uso_ventanas
         SET reserved = GREATEST(0, reserved - 1),
             version = version + 1,
             updated_at = $2
         WHERE id = $1
         RETURNING *`,
        [winRow.id, nowUtc]
      );
      winRow = updWin.rows[0] || winRow;
    }

    await client.query(
      `UPDATE comensal_uso_eventos
       SET status = 'RELEASED',
           release_reason = $2,
           finalized_at = $3
       WHERE id = $1`,
      [ev.id, releaseReason, nowUtc]
    );

    const quotaSummary = buildQuotaSummary({ activePaid: ev.plan_applied === 'PAID' }, winRow, fixedWeekWindow);
    const enrichedPayload = responseBody && typeof responseBody === 'object'
      ? {
          ...responseBody,
          meta: {
            ...(responseBody.meta || {}),
            quota: quotaSummary
          }
        }
      : responseBody;

    await client.query('COMMIT');
    return { ok: true, consumed: false, quota: quotaSummary, payload: enrichedPayload };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  WEEKLY_FREE_LIMIT,
  computeReservationTtlMs,
  getMexicoCityWeekWindow,
  computeRequestFingerprint,
  recordAuditLog,
  resolveEffectiveEntitlement,
  getQuotaStatus,
  reserveQuotaSlot,
  finalizeQuotaSlot,
  isUsefulRecommendationResponse
};
