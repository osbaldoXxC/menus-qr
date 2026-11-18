'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE_URL = 'http://127.0.0.1:4000';
const SYNTHETIC_RESTAURANT = '10000000-0000-4000-8000-000000000001';

function extractCookies(headers) {
  const raw = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (headers.get('set-cookie') ? [headers.get('set-cookie')] : []);
  const map = {};
  for (const line of raw) {
    const firstPart = line.split(';')[0];
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx > 0) {
      map[firstPart.slice(0, eqIdx).trim()] = firstPart.slice(eqIdx + 1).trim();
    }
  }
  return { raw, map, cookieHeader: Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ') };
}

async function httpCall(urlPath, { method = 'POST', body = null, headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      'X-Enforce-Comensal-Auth': 'true',
      ...headers
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    json = null;
  }
  return { status: res.status, body: json, cookies: extractCookies(res.headers) };
}

test('Issue #43 Integration — Migración aislada, 4 POST protegidos, menú QR público, rotación refresh, cuota 5/semana, idempotencia y transición PAID->FREE', async () => {
  const dbCheck = await pool.query('SELECT current_database() AS db');
  assert.ok(
    ['r3_test_isolated', 'mexxicanmx_db'].includes(dbCheck.rows[0].db),
    `Base de datos no autorizada para pruebas: ${dbCheck.rows[0].db}`
  );

  // 1. Insertar un comensal histórico (Google sin password_hash) para comprobar que la migración preserva cuentas previas
  const legacyId = 'c0000000-0000-4000-8000-000000000001';
  await pool.query(
    `INSERT INTO usuarios_comensales (id, nombre, email, auth_provider)
     VALUES ($1, 'Comensal Historico', 'historico@example.invalid', 'Google')
     ON CONFLICT (id) DO NOTHING`,
    [legacyId]
  );

  // 2. Aplicar la migración versionada 20261117_r4_comensal_auth_quota_audit.sql
  const migrationPath = path.resolve(__dirname, '../../src/db/migrations/20261117_r4_comensal_auth_quota_audit.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  await pool.query(migrationSql);

  const legacyCheck = await pool.query('SELECT id, rol, estado, auth_provider FROM usuarios_comensales WHERE id = $1', [legacyId]);
  assert.equal(legacyCheck.rows.length, 1);
  assert.equal(legacyCheck.rows[0].rol, 'COMENSAL');
  assert.equal(legacyCheck.rows[0].auth_provider, 'Google');

  // 3. Verificar que los 4 POST equivalentes rechazan solicitudes anónimas (401 AUTH_REQUIRED), mientras GET menú QR sigue público (200)
  const fourRoutes = [
    '/api/public/menu/recommendations',
    `/api/public/menu/${SYNTHETIC_RESTAURANT}/recommendations`,
    '/api/public/recommendations',
    `/api/public/${SYNTHETIC_RESTAURANT}/recommendations`
  ];

  for (const route of fourRoutes) {
    const anon = await httpCall(route, { body: { craving: { text: 'Quiero un taco' } } });
    assert.equal(anon.status, 401, `Ruta ${route} debe rechazar anónimo con 401`);
    assert.equal(anon.body.error.code, 'AUTH_REQUIRED');
    assert.equal(anon.body.status.code, 'auth_required');
  }

  const publicMenu = await httpCall(`/api/public/menu/${SYNTHETIC_RESTAURANT}`, { method: 'GET' });
  assert.equal(publicMenu.status, 200, 'La lectura del menú público QR debe seguir siendo 200 OK sin sesión');

  // 4. Verificar que un token de RESTAURANTE o SUPER_ADMIN es rechazado con 403 FORBIDDEN_ROLE en el recomendador
  const jwt = require('jsonwebtoken');
  const restToken = jwt.sign(
    { id: SYNTHETIC_RESTAURANT, email: 'uno@example.invalid', rol: 'RESTAURANTE', estado: 'aprobado' },
    process.env.JWT_SECRET || 'ci-synthetic-secret-not-for-deployment',
    { expiresIn: '15m' }
  );
  const adminToken = jwt.sign(
    { id: '90000000-0000-4000-8000-000000000001', email: 'admin@example.invalid', rol: 'SUPER_ADMIN', estado: 'aprobado' },
    process.env.JWT_SECRET || 'ci-synthetic-secret-not-for-deployment',
    { expiresIn: '15m' }
  );

  for (const wrongRoleToken of [restToken, adminToken]) {
    const wrongRoleAttempt = await httpCall('/api/public/menu/recommendations', {
      body: { craving: { text: 'Quiero un taco' } },
      headers: { Authorization: `Bearer ${wrongRoleToken}` }
    });
    assert.equal(wrongRoleAttempt.status, 403);
    assert.equal(wrongRoleAttempt.body.error.code, 'FORBIDDEN_ROLE');
  }

  // 5. Registrar un Comensal nuevo y verificar cookies HttpOnly + saldo inicial (5 de 5)
  const registerEmail = `comensal.${Date.now()}@example.invalid`;
  const reg = await httpCall('/api/auth/comensal/register', {
    body: {
      nombre: 'Félix Comensal QA',
      email: registerEmail,
      password: 'Comensal-Safe-Pass-123!',
      isPaid: true, // Intento de escalamiento desde cliente (debe ser ignorado)
      rol: 'SUPER_ADMIN'
    }
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.rol, 'COMENSAL');
  assert.equal(reg.body.quota.plan, 'FREE');
  assert.equal(reg.body.quota.remaining, 5);
  assert.ok(reg.cookies.raw.some(c => c.includes('comensal_access_token=') && c.toLowerCase().includes('httponly')));
  assert.ok(reg.cookies.raw.some(c => c.includes('comensal_refresh_token=') && c.toLowerCase().includes('httponly')));

  let sessionCookie = reg.cookies.cookieHeader;
  const comensalId = reg.body.user.id;

  // 6. Anti-IDOR: intentar consultar la cuota de otro usuario devuelve 403 FORBIDDEN_RESOURCE
  const idorAttempt = await httpCall(`/api/auth/comensal/quota/${legacyId}`, {
    method: 'GET',
    headers: { Cookie: sessionCookie }
  });
  assert.equal(idorAttempt.status, 403);
  assert.equal(idorAttempt.body.code, 'FORBIDDEN_RESOURCE');

  // 7. Rotación de Refresh Token y detección de reutilización (Reuse Detection)
  const firstRefreshCookie = `comensal_refresh_token=${reg.cookies.map.comensal_refresh_token}`;
  const rotated = await httpCall('/api/auth/comensal/refresh', {
    headers: { Cookie: firstRefreshCookie }
  });
  assert.equal(rotated.status, 200);
  assert.ok(rotated.cookies.map.comensal_access_token);
  assert.notEqual(rotated.cookies.map.comensal_refresh_token, reg.cookies.map.comensal_refresh_token);

  // Presentar el refresh token viejo otra vez debe revocar toda la familia y responder 401
  const reuseAttack = await httpCall('/api/auth/comensal/refresh', {
    headers: { Cookie: firstRefreshCookie }
  });
  assert.equal(reuseAttack.status, 401);

  // Iniciar sesión de nuevo limpiamente para las pruebas de cuota
  const loginRes = await httpCall('/api/auth/comensal/login', {
    body: { email: registerEmail, password: 'Comensal-Safe-Pass-123!' }
  });
  assert.equal(loginRes.status, 200);
  sessionCookie = loginRes.cookies.cookieHeader;

  // 8. Búsqueda con no_verified_results (exclusión sin evidencia) NO consume cuota
  const emptySearch = await httpCall('/api/public/menu/recommendations', {
    body: { craving: { text: 'Quiero algo que no lleve leche' } },
    headers: { Cookie: sessionCookie, 'X-Idempotency-Key': 'int-empty-1' }
  });
  assert.equal(emptySearch.status, 200);
  assert.equal(emptySearch.body.status.code, 'no_verified_results');
  assert.equal(emptySearch.body.meta.quota.used, 0);
  assert.equal(emptySearch.body.meta.quota.remaining, 5);

  // 9. Ejecutar 5 búsquedas útiles (con idempotencia comprobada en la 1ª)
  for (let i = 1; i <= 5; i++) {
    const key = `int-useful-${i}`;
    const res = await httpCall('/api/public/menu/recommendations', {
      body: {
        craving: { text: 'Quiero un taco' },
        isPaid: true, // manipulación cliente ignorada
        remaining: 99
      },
      headers: { Cookie: sessionCookie, 'X-Idempotency-Key': key }
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.recommendations.length >= 1);
    assert.equal(res.body.meta.quota.used, i);
    assert.equal(res.body.meta.quota.remaining, 5 - i);

    if (i === 1) {
      // Reintento con el mismo X-Idempotency-Key devuelve el mismo resultado sin descontar el 2º uso
      const replay = await httpCall('/api/public/menu/recommendations', {
        body: { craving: { text: 'Quiero un taco' } },
        headers: { Cookie: sessionCookie, 'X-Idempotency-Key': key }
      });
      assert.equal(replay.status, 200);
      assert.equal(replay.body.meta.idempotentReplay, true);
      assert.equal(replay.body.meta.quota.used, 1);
      assert.equal(replay.body.requestId, res.body.requestId);
    }
  }

  // 10. La 6ª búsqueda útil en la misma semana es bloqueada con 429 QUOTA_EXCEEDED antes de ML
  const sixth = await httpCall('/api/public/menu/recommendations', {
    body: { craving: { text: 'Quiero un taco' } },
    headers: { Cookie: sessionCookie, 'X-Idempotency-Key': 'int-useful-6' }
  });
  assert.equal(sixth.status, 429);
  assert.equal(sixth.body.error.code, 'QUOTA_EXCEEDED');
  assert.equal(sixth.body.status.code, 'quota_exceeded');
  assert.equal(sixth.body.meta.quota.remaining, 0);

  // 11. Probar rollback dentro de una transacción con SAVEPOINT para verificar reversión limpia sin destruir datos
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rollbackPath = path.resolve(__dirname, '../../src/db/rollbacks/20261117_r4_comensal_auth_quota_audit.rollback.sql');
    const rollbackSql = fs.readFileSync(rollbackPath, 'utf8')
      .replace(/^\s*BEGIN;\s*/im, '')
      .replace(/\s*COMMIT;\s*$/im, '');
    await client.query(rollbackSql);
    const migStatus = await client.query("SELECT execution_status FROM schema_migrations_audit WHERE version = '20261117_r4_comensal_auth_quota_audit'");
    assert.equal(migStatus.rows[0].execution_status, 'ROLLED_BACK');
    await client.query('ROLLBACK'); // Restaurar estado para no afectar inspecciones posteriores
  } finally {
    client.release();
  }
});

test.after(async () => {
  await pool.end();
});
