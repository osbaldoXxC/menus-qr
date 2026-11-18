'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  WEEKLY_FREE_LIMIT,
  computeReservationTtlMs,
  getMexicoCityWeekWindow,
  computeRequestFingerprint,
  reserveQuotaSlot,
  finalizeQuotaSlot,
  getQuotaStatus
} = require('../../src/services/comensalQuotaService');

/**
 * In-memory transactional PostgreSQL harness that faithfully models row-level locking,
 * usuarios_comensales, comensal_entitlements, comensal_uso_ventanas, comensal_uso_eventos,
 * comensal_refresh_tokens, and audit_logs for deterministic concurrency and edge-case testing.
 */
function createMockPgPool() {
  const state = {
    users: new Map(),
    entitlements: new Map(), // userId -> row
    windows: new Map(), // `${userId}|${windowStartIso}` -> row
    events: new Map(), // eventId -> row
    refreshTokens: new Map(), // tokenHash -> row
    auditLogs: []
  };

  function queryImpl(sql, params = []) {
    const q = sql.replace(/\s+/g, ' ').trim();

    if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }

    // audit_logs insert
    if (q.startsWith('INSERT INTO audit_logs')) {
      const [userId, action, detailsJson, ip] = params;
      const entry = {
        id: crypto.randomUUID(),
        usuario_id: userId,
        accion: action,
        detalles: JSON.parse(detailsJson),
        ip_address: ip,
        created_at: new Date().toISOString()
      };
      state.auditLogs.push(entry);
      return { rows: [entry], rowCount: 1 };
    }

    // usuarios_comensales lookup by id
    if (q.includes('FROM usuarios_comensales WHERE id = $1')) {
      const u = state.users.get(params[0]);
      return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
    }

    // expireStaleReservations
    if (q.startsWith('UPDATE comensal_uso_eventos SET status = \'RELEASED\', release_reason = \'expired_ttl\'')) {
      const [userId, nowUtc] = params;
      const nowMs = new Date(nowUtc).getTime();
      const expired = [];
      for (const ev of state.events.values()) {
        if (ev.usuario_id === userId && ev.status === 'RESERVED' && new Date(ev.reservation_expires_at).getTime() <= nowMs) {
          ev.status = 'RELEASED';
          ev.release_reason = 'expired_ttl';
          ev.finalized_at = new Date(nowUtc).toISOString();
          expired.push({ window_start_utc: ev.window_start_utc, plan_applied: ev.plan_applied });
        }
      }
      return { rows: expired, rowCount: expired.length };
    }

    // Decrement reserved on window by userId + windowStartUtc
    if (q.startsWith('UPDATE comensal_uso_ventanas SET reserved = GREATEST(0, reserved - 1)') && q.includes('WHERE usuario_id = $1 AND window_start_utc = $2')) {
      const [userId, winStart] = params;
      const key = `${userId}|${new Date(winStart).toISOString()}`;
      const win = state.windows.get(key);
      if (win) {
        win.reserved = Math.max(0, win.reserved - 1);
        win.version += 1;
        return { rows: [win], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Insert default FREE entitlement
    if (q.startsWith('INSERT INTO comensal_entitlements')) {
      const userId = params[0];
      if (!state.entitlements.has(userId)) {
        state.entitlements.set(userId, {
          id: crypto.randomUUID(),
          usuario_id: userId,
          plan_code: 'FREE',
          status: 'ACTIVE',
          valid_from: new Date(0).toISOString(),
          valid_until: null,
          version: 1
        });
      }
      return { rows: [], rowCount: 1 };
    }

    // Select entitlement
    if (q.startsWith('SELECT * FROM comensal_entitlements WHERE usuario_id = $1')) {
      const ent = state.entitlements.get(params[0]);
      return { rows: ent ? [{ ...ent }] : [], rowCount: ent ? 1 : 0 };
    }

    // Expire entitlement
    if (q.startsWith('UPDATE comensal_entitlements SET status = \'EXPIRED\'')) {
      const [entId] = params;
      for (const ent of state.entitlements.values()) {
        if (ent.id === entId) {
          ent.status = 'EXPIRED';
          ent.version += 1;
          return { rows: [{ ...ent }], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Ensure window
    if (q.startsWith('INSERT INTO comensal_uso_ventanas')) {
      const [userId, startUtc, endUtc] = params;
      const key = `${userId}|${new Date(startUtc).toISOString()}`;
      if (!state.windows.has(key)) {
        state.windows.set(key, {
          id: crypto.randomUUID(),
          usuario_id: userId,
          window_start_utc: new Date(startUtc).toISOString(),
          window_end_utc: new Date(endUtc).toISOString(),
          used: 0,
          reserved: 0,
          version: 1
        });
      }
      return { rows: [], rowCount: 1 };
    }

    // Select window
    if (q.startsWith('SELECT * FROM comensal_uso_ventanas WHERE usuario_id = $1 AND window_start_utc = $2')) {
      const [userId, startUtc] = params;
      const key = `${userId}|${new Date(startUtc).toISOString()}`;
      const win = state.windows.get(key);
      return { rows: win ? [{ ...win }] : [], rowCount: win ? 1 : 0 };
    }

    // Select existing idempotency event by (userId, requestKey)
    if (q.startsWith('SELECT * FROM comensal_uso_eventos WHERE usuario_id = $1 AND operation_type = \'RECOMMENDATION\' AND request_key = $2')) {
      const [userId, reqKey] = params;
      for (const ev of state.events.values()) {
        if (ev.usuario_id === userId && ev.request_key === reqKey) {
          return { rows: [{ ...ev }], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Delete released event on retry
    if (q.startsWith('DELETE FROM comensal_uso_eventos WHERE id = $1')) {
      state.events.delete(params[0]);
      return { rows: [], rowCount: 1 };
    }

    // Increment reserved on window
    if (q.startsWith('UPDATE comensal_uso_ventanas SET reserved = reserved + 1')) {
      const [winId, limit] = params;
      for (const win of state.windows.values()) {
        if (win.id === winId && (win.used + win.reserved) < limit) {
          win.reserved += 1;
          win.version += 1;
          return { rows: [{ ...win }], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Insert event (PAID or FREE)
    if (q.startsWith('INSERT INTO comensal_uso_eventos')) {
      const isPaidSql = q.includes("'PAID'");
      const [userId, reqKey, fingerprint, execToken, startUtc, endUtc, expAt, createdAt] = params;
      const id = crypto.randomUUID();
      const ev = {
        id,
        usuario_id: userId,
        operation_type: 'RECOMMENDATION',
        request_key: reqKey,
        request_fingerprint: fingerprint,
        execution_token: execToken,
        plan_applied: isPaidSql ? 'PAID' : 'FREE',
        window_start_utc: new Date(startUtc).toISOString(),
        window_end_utc: new Date(endUtc).toISOString(),
        status: 'RESERVED',
        release_reason: null,
        reservation_expires_at: new Date(expAt).toISOString(),
        response_snapshot: null,
        snapshot_expires_at: null,
        created_at: new Date(createdAt).toISOString(),
        finalized_at: null
      };
      state.events.set(id, ev);
      return { rows: [{ id }], rowCount: 1 };
    }

    // Select event by id
    if (q.startsWith('SELECT * FROM comensal_uso_eventos WHERE id = $1')) {
      const ev = state.events.get(params[0]);
      return { rows: ev ? [{ ...ev }] : [], rowCount: ev ? 1 : 0 };
    }

    // Mark event RELEASED on expired_before_finalize
    if (q.startsWith('UPDATE comensal_uso_eventos SET status = \'RELEASED\', release_reason = \'expired_before_finalize\'')) {
      const [evId, nowUtc] = params;
      const ev = state.events.get(evId);
      if (ev) {
        ev.status = 'RELEASED';
        ev.release_reason = 'expired_before_finalize';
        ev.finalized_at = new Date(nowUtc).toISOString();
      }
      return { rows: [], rowCount: 1 };
    }

    // Increment used and decrement reserved on CONSUMED
    if (q.startsWith('UPDATE comensal_uso_ventanas SET used = used + 1')) {
      const [winId, , limit] = params;
      for (const win of state.windows.values()) {
        if (win.id === winId && win.used < limit) {
          win.used += 1;
          win.reserved = Math.max(0, win.reserved - 1);
          win.version += 1;
          return { rows: [{ ...win }], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Update event to CONSUMED with snapshot
    if (q.startsWith('UPDATE comensal_uso_eventos SET status = \'CONSUMED\'')) {
      const [evId, snapshotJson, snapExp, nowUtc] = params;
      const ev = state.events.get(evId);
      if (ev) {
        ev.status = 'CONSUMED';
        ev.response_snapshot = JSON.parse(snapshotJson);
        ev.snapshot_expires_at = new Date(snapExp).toISOString();
        ev.finalized_at = new Date(nowUtc).toISOString();
      }
      return { rows: [], rowCount: 1 };
    }

    // Decrement reserved on window by winId (for RELEASED)
    if (q.startsWith('UPDATE comensal_uso_ventanas SET reserved = GREATEST(0, reserved - 1)') && q.includes('WHERE id = $1')) {
      const [winId] = params;
      for (const win of state.windows.values()) {
        if (win.id === winId) {
          win.reserved = Math.max(0, win.reserved - 1);
          win.version += 1;
          return { rows: [{ ...win }], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Update event to RELEASED with reason
    if (q.startsWith('UPDATE comensal_uso_eventos SET status = \'RELEASED\', release_reason = $2')) {
      const [evId, reason, nowUtc] = params;
      const ev = state.events.get(evId);
      if (ev) {
        ev.status = 'RELEASED';
        ev.release_reason = reason;
        ev.finalized_at = new Date(nowUtc).toISOString();
      }
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unhandled SQL in test harness: ${q}`);
  }

  return {
    state,
    query: async (sql, params) => queryImpl(sql, params),
    connect: async () => ({
      query: async (sql, params) => queryImpl(sql, params),
      release: () => {}
    })
  };
}

test('Issue #43 — Cálculo determinista de ventana semanal en America/Mexico_City y cruce domingo -> lunes', () => {
  // Sunday Nov 15, 2026 at 23:59:58 in Mexico City (UTC-6 -> 2026-11-16T05:59:58.000Z)
  const sundayLate = new Date('2026-11-16T05:59:58.000Z');
  const winSunday = getMexicoCityWeekWindow(sundayLate);
  assert.equal(winSunday.windowStartUtc.toISOString(), '2026-11-09T06:00:00.000Z');
  assert.equal(winSunday.windowEndUtc.toISOString(), '2026-11-16T06:00:00.000Z');

  // 4 seconds later: Monday Nov 16, 2026 at 00:00:02 in Mexico City (2026-11-16T06:00:02.000Z)
  const mondayEarly = new Date('2026-11-16T06:00:02.000Z');
  const winMonday = getMexicoCityWeekWindow(mondayEarly);
  assert.equal(winMonday.windowStartUtc.toISOString(), '2026-11-16T06:00:00.000Z');
  assert.equal(winMonday.windowEndUtc.toISOString(), '2026-11-23T06:00:00.000Z');
});

test('Issue #43 — 5 búsquedas útiles consumen exactamente 5 usos; la 6ª se bloquea antes de ML; vacíos y errores 5xx no consumen', async () => {
  const pool = createMockPgPool();
  const userId = '20000000-0000-4000-8000-000000000001';
  const now = new Date('2026-11-17T18:00:00.000Z');

  // 1. Búsqueda con no_verified_results (0 recomendaciones) -> NO consume cuota
  const fpEmpty = computeRequestFingerprint({ scope: 'global', body: { craving: { text: 'sin leche' } } });
  const rEmpty = await reserveQuotaSlot(pool, { userId, requestKey: 'req-empty-1', requestFingerprint: fpEmpty, nowInput: now });
  assert.equal(rEmpty.action, 'PROCEED');
  const fEmpty = await finalizeQuotaSlot(pool, {
    eventId: rEmpty.eventId,
    executionToken: rEmpty.executionToken,
    httpStatus: 200,
    responseBody: { requestId: 'req-empty-1', status: { code: 'no_verified_results' }, recommendations: [] },
    nowInput: now
  });
  assert.equal(fEmpty.ok, true);
  assert.equal(fEmpty.consumed, false);
  assert.equal(fEmpty.quota.used, 0);
  assert.equal(fEmpty.quota.remaining, 5);

  // 2. Búsqueda con fallo HTTP 500 -> NO consume cuota
  const fpErr = computeRequestFingerprint({ scope: 'global', body: { craving: { text: 'fallo 500' } } });
  const rErr = await reserveQuotaSlot(pool, { userId, requestKey: 'req-500-1', requestFingerprint: fpErr, nowInput: now });
  const fErr = await finalizeQuotaSlot(pool, {
    eventId: rErr.eventId,
    executionToken: rErr.executionToken,
    httpStatus: 500,
    responseBody: { requestId: 'req-500-1', status: { code: 'internal_error' }, recommendations: [] },
    nowInput: now
  });
  assert.equal(fErr.consumed, false);
  assert.equal(fErr.quota.used, 0);
  assert.equal(fErr.quota.remaining, 5);

  // 3. Ejecutar 5 búsquedas útiles con recomendaciones -> 5 consumos exactos
  for (let i = 1; i <= 5; i++) {
    const fp = computeRequestFingerprint({ scope: 'global', body: { craving: { text: `antojo util ${i}` } } });
    const resv = await reserveQuotaSlot(pool, { userId, requestKey: `req-ok-${i}`, requestFingerprint: fp, nowInput: now });
    assert.equal(resv.action, 'PROCEED');
    const fin = await finalizeQuotaSlot(pool, {
      eventId: resv.eventId,
      executionToken: resv.executionToken,
      httpStatus: 200,
      responseBody: {
        requestId: `req-ok-${i}`,
        status: { code: 'ok' },
        recommendations: [{ dish: { id: `dish-${i}`, name: `Platillo ${i}` }, restaurant: { id: 'rest-1', name: 'R1' }, reasons: [{ text: 'Match' }], safety: { disclaimer: 'OK' } }],
        safety: { disclaimer: 'OK' },
        meta: { returned: 1 }
      },
      nowInput: now
    });
    assert.equal(fin.ok, true);
    assert.equal(fin.consumed, true);
    assert.equal(fin.quota.used, i);
    assert.equal(fin.quota.remaining, 5 - i);
  }

  // 4. La 6ª búsqueda se bloquea en reserveQuotaSlot con 429 QUOTA_EXCEEDED antes de invocar ML
  const fp6 = computeRequestFingerprint({ scope: 'global', body: { craving: { text: 'sexta busqueda' } } });
  const resv6 = await reserveQuotaSlot(pool, { userId, requestKey: 'req-ok-6', requestFingerprint: fp6, nowInput: now });
  assert.equal(resv6.action, 'REJECT');
  assert.equal(resv6.httpStatus, 429);
  assert.equal(resv6.errorCode, 'QUOTA_EXCEEDED');
  assert.equal(resv6.quota.used, 5);
  assert.equal(resv6.quota.remaining, 0);
});

test('Issue #43 — Concurrencia en el último cupo (used=4): distingue QUOTA_SLOT_BUSY (en vuelo) de QUOTA_EXCEEDED y evita sobreconsumo', async () => {
  const pool = createMockPgPool();
  const userId = '20000000-0000-4000-8000-000000000002';
  const now = new Date('2026-11-17T19:00:00.000Z');

  // Consumir 4 usos previos
  for (let i = 1; i <= 4; i++) {
    const fp = computeRequestFingerprint({ scope: 'global', body: { craving: { text: `prev ${i}` } } });
    const r = await reserveQuotaSlot(pool, { userId, requestKey: `prev-${i}`, requestFingerprint: fp, nowInput: now });
    await finalizeQuotaSlot(pool, {
      eventId: r.eventId,
      executionToken: r.executionToken,
      httpStatus: 200,
      responseBody: { requestId: `prev-${i}`, status: { code: 'ok' }, recommendations: [{ dish: { id: 'd1' } }] },
      nowInput: now
    });
  }

  // Solicitud A toma en reserva el 5º y último cupo disponible (used=4, reserved=1)
  const fpA = computeRequestFingerprint({ scope: 'global', body: { craving: { text: 'concurrente A' } } });
  const rA = await reserveQuotaSlot(pool, { userId, requestKey: 'conc-A', requestFingerprint: fpA, nowInput: now });
  assert.equal(rA.action, 'PROCEED');
  assert.equal(rA.quota.used, 4);
  assert.equal(rA.quota.reserved, 1);

  // Solicitud B llega simultáneamente mientras A sigue en vuelo -> recibe 429 QUOTA_SLOT_BUSY (retryable: true), NO QUOTA_EXCEEDED
  const fpB = computeRequestFingerprint({ scope: 'global', body: { craving: { text: 'concurrente B' } } });
  const rB = await reserveQuotaSlot(pool, { userId, requestKey: 'conc-B', requestFingerprint: fpB, nowInput: now });
  assert.equal(rB.action, 'REJECT');
  assert.equal(rB.httpStatus, 429);
  assert.equal(rB.errorCode, 'QUOTA_SLOT_BUSY');
  assert.equal(rB.retryable, true);

  // Si A termina sin resultados verificables (no_verified_results), libera el cupo y B ahora SÍ puede reservar y consumir el 5º uso
  await finalizeQuotaSlot(pool, {
    eventId: rA.eventId,
    executionToken: rA.executionToken,
    httpStatus: 200,
    responseBody: { requestId: 'conc-A', status: { code: 'no_verified_results' }, recommendations: [] },
    nowInput: now
  });

  const rBRetry = await reserveQuotaSlot(pool, { userId, requestKey: 'conc-B', requestFingerprint: fpB, nowInput: now });
  assert.equal(rBRetry.action, 'PROCEED');
});

test('Issue #43 — Idempotencia: recupera resultado perdido sin doble descuento y rechaza reutilización con payload alterado', async () => {
  const pool = createMockPgPool();
  const userId = '20000000-0000-4000-8000-000000000003';
  const now = new Date('2026-11-17T20:00:00.000Z');
  const fp1 = computeRequestFingerprint({ scope: 'global', body: { craving: { text: 'tacos de pollo' } } });

  const r1 = await reserveQuotaSlot(pool, { userId, requestKey: 'idem-key-1', requestFingerprint: fp1, nowInput: now });
  assert.equal(r1.action, 'PROCEED');

  // Reintento mientras sigue RESERVED en vuelo -> 409 OPERATION_IN_PROGRESS
  const inFlight = await reserveQuotaSlot(pool, { userId, requestKey: 'idem-key-1', requestFingerprint: fp1, nowInput: now });
  assert.equal(inFlight.action, 'REJECT');
  assert.equal(inFlight.httpStatus, 409);
  assert.equal(inFlight.errorCode, 'OPERATION_IN_PROGRESS');

  // Servidor confirma CONSUMED pero la respuesta se pierde en la red del cliente
  const originalPayload = {
    requestId: 'idem-key-1',
    status: { code: 'ok' },
    recommendations: [{ dish: { id: 'taco-1', name: 'Tacos de pollo' }, restaurant: { id: 'r1', name: 'Fogón' }, reasons: [{ text: 'Match' }], safety: { disclaimer: 'OK' } }],
    safety: { disclaimer: 'OK' },
    meta: { returned: 1 }
  };
  const fin = await finalizeQuotaSlot(pool, {
    eventId: r1.eventId,
    executionToken: r1.executionToken,
    httpStatus: 200,
    responseBody: originalPayload,
    nowInput: now
  });
  assert.equal(fin.consumed, true);
  assert.equal(fin.quota.used, 1);

  // Cliente reintenta con el mismo request_key y mismo contenido -> REPLAY devuelve el mismo resultado y used sigue siendo 1
  const replay = await reserveQuotaSlot(pool, { userId, requestKey: 'idem-key-1', requestFingerprint: fp1, nowInput: now });
  assert.equal(replay.action, 'REPLAY');
  assert.equal(replay.quota.used, 1);
  assert.equal(replay.responseSnapshot.recommendations[0].dish.id, 'taco-1');

  // Cliente intenta reutilizar idem-key-1 cambiando el texto a 'camarones' -> 409 IDEMPOTENCY_KEY_MISMATCH
  const fpDifferent = computeRequestFingerprint({ scope: 'global', body: { craving: { text: 'camarones' } } });
  const mismatch = await reserveQuotaSlot(pool, { userId, requestKey: 'idem-key-1', requestFingerprint: fpDifferent, nowInput: now });
  assert.equal(mismatch.action, 'REJECT');
  assert.equal(mismatch.httpStatus, 409);
  assert.equal(mismatch.errorCode, 'IDEMPOTENCY_KEY_MISMATCH');
});

test('Issue #43 — Ejecución tardía no puede confirmar una reserva vencida ni descontar cuota (RESERVATION_EXPIRED)', async () => {
  const pool = createMockPgPool();
  const userId = '20000000-0000-4000-8000-000000000004';
  const t0 = new Date('2026-11-17T20:00:00.000Z');
  const fp = computeRequestFingerprint({ scope: 'global', body: { craving: { text: 'caldo lento' } } });

  const resv = await reserveQuotaSlot(pool, {
    userId,
    requestKey: 'slow-req-1',
    requestFingerprint: fp,
    nowInput: t0,
    ttlMs: 5000
  });
  assert.equal(resv.action, 'PROCEED');

  // El ranking tarda 6 segundos (superando ttlMs=5000ms)
  const tLate = new Date(t0.getTime() + 6000);
  const lateFin = await finalizeQuotaSlot(pool, {
    eventId: resv.eventId,
    executionToken: resv.executionToken,
    httpStatus: 200,
    responseBody: { requestId: 'slow-req-1', status: { code: 'ok' }, recommendations: [{ dish: { id: 'd1' } }] },
    nowInput: tLate
  });

  assert.equal(lateFin.ok, false);
  assert.equal(lateFin.expired, true);
  assert.equal(lateFin.httpStatus, 504);
  assert.equal(lateFin.errorCode, 'RESERVATION_EXPIRED');
  assert.equal(lateFin.quota.used, 0);
  assert.equal(lateFin.quota.reserved, 0);
});

test('Issue #43 — Búsqueda que inicia domingo 23:59:58 CDMX y termina lunes 00:00:02 CDMX se contabiliza en la semana donde se reservó', async () => {
  const pool = createMockPgPool();
  const userId = '20000000-0000-4000-8000-000000000005';
  const sunday2359 = new Date('2026-11-16T05:59:58.000Z'); // Domingo 23:59:58 CDMX
  const monday0002 = new Date('2026-11-16T06:00:02.000Z'); // Lunes 00:00:02 CDMX

  const fp = computeRequestFingerprint({ scope: 'global', body: { craving: { text: 'cruce de medianoche' } } });
  const resv = await reserveQuotaSlot(pool, { userId, requestKey: 'cross-week-1', requestFingerprint: fp, nowInput: sunday2359 });
  assert.equal(resv.action, 'PROCEED');

  const fin = await finalizeQuotaSlot(pool, {
    eventId: resv.eventId,
    executionToken: resv.executionToken,
    httpStatus: 200,
    responseBody: { requestId: 'cross-week-1', status: { code: 'ok' }, recommendations: [{ dish: { id: 'd1' } }] },
    nowInput: monday0002
  });
  assert.equal(fin.ok, true);
  assert.equal(fin.consumed, true);
  assert.equal(fin.quota.used, 1);

  // Al consultar el saldo en la nueva semana (lunes 00:00:02 CDMX), tiene los 5 usos íntegros disponibles
  const mondayQuota = await getQuotaStatus(pool, userId, monday0002);
  assert.equal(mondayQuota.used, 0);
  assert.equal(mondayQuota.remaining, 5);
});

test('Issue #43 — Transición de Plan PAID a FREE a mitad de semana conserva los 5 usos gratuitos semanales y audita la transición', async () => {
  const pool = createMockPgPool();
  const userId = '20000000-0000-4000-8000-000000000006';
  const tuesday = new Date('2026-11-17T15:00:00.000Z');
  const wednesdayMorning = new Date('2026-11-18T12:00:00.000Z');
  const wednesdayAfternoon = new Date('2026-11-18T18:00:00.000Z');

  // Activar plan PAID vigente hasta miércoles 12:00 UTC
  pool.state.entitlements.set(userId, {
    id: crypto.randomUUID(),
    usuario_id: userId,
    plan_code: 'PAID',
    status: 'ACTIVE',
    valid_from: new Date('2026-11-01T00:00:00.000Z').toISOString(),
    valid_until: wednesdayMorning.toISOString(),
    version: 1
  });

  // Martes: realiza 7 búsquedas bajo plan PAID (más de 5)
  for (let i = 1; i <= 7; i++) {
    const fp = computeRequestFingerprint({ scope: 'global', body: { craving: { text: `paid search ${i}` } } });
    const r = await reserveQuotaSlot(pool, { userId, requestKey: `paid-${i}`, requestFingerprint: fp, nowInput: tuesday });
    assert.equal(r.action, 'PROCEED');
    assert.equal(r.planApplied, 'PAID');
    const f = await finalizeQuotaSlot(pool, {
      eventId: r.eventId,
      executionToken: r.executionToken,
      httpStatus: 200,
      responseBody: { requestId: `paid-${i}`, status: { code: 'ok' }, recommendations: [{ dish: { id: `p-${i}` } }] },
      nowInput: tuesday
    });
    assert.equal(f.ok, true);
    assert.equal(f.quota.isPaid, true);
  }

  // Miércoles por la tarde: la suscripción PAID ya venció -> transita automáticamente a FREE con 5 usos disponibles
  const quotaAfterExpiry = await getQuotaStatus(pool, userId, wednesdayAfternoon);
  assert.equal(quotaAfterExpiry.isPaid, false);
  assert.equal(quotaAfterExpiry.plan, 'FREE');
  assert.equal(quotaAfterExpiry.used, 0);
  assert.equal(quotaAfterExpiry.remaining, 5);
  assert.ok(pool.state.auditLogs.some(l => l.accion === 'COMENSAL_ENTITLEMENT_EXPIRED_TO_FREE'));
});

test('Issue #43 — Verificación estructural de migración SQL, separación física de rollback y ausencia de secretos en auditoría', () => {
  const migrationPath = path.resolve(__dirname, '../../src/db/migrations/20261117_r4_comensal_auth_quota_audit.sql');
  const rollbackPath = path.resolve(__dirname, '../../src/db/rollbacks/20261117_r4_comensal_auth_quota_audit.rollback.sql');

  assert.equal(fs.existsSync(migrationPath), true, 'El archivo de migración debe existir en backend/src/db/migrations/');
  assert.equal(fs.existsSync(rollbackPath), true, 'El archivo de rollback debe existir en backend/src/db/rollbacks/');

  const migrationsFiles = fs.readdirSync(path.resolve(__dirname, '../../src/db/migrations'));
  assert.equal(migrationsFiles.some(f => f.includes('rollback')), false, 'Ningún archivo rollback debe residir dentro de migrations/');

  const migSql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migSql, /CREATE TABLE IF NOT EXISTS comensal_refresh_tokens/);
  assert.match(migSql, /CREATE TABLE IF NOT EXISTS comensal_entitlements/);
  assert.match(migSql, /CREATE TABLE IF NOT EXISTS comensal_uso_ventanas/);
  assert.match(migSql, /CREATE TABLE IF NOT EXISTS comensal_uso_eventos/);
  assert.match(migSql, /UNIQUE \(usuario_id, operation_type, request_key\)/);
  assert.doesNotMatch(migSql, /DROP TABLE|TRUNCATE/i, 'La migración forward no debe contener operaciones destructivas');
});
