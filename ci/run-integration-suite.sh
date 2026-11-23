#!/bin/sh
set -eu

echo "=== Validando autorizacion y base sintetica ==="
node <<'NODE'
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const databaseUrl = process.env.DATABASE_URL;
const r3DatabaseUrl = process.env.R3_TEST_DATABASE_URL;
if (process.env.R3_INTEGRATION_AUTHORIZED !== 'yes') throw Error('R3 integration authorization is required');
if (!databaseUrl || !r3DatabaseUrl) throw Error('DATABASE_URL and R3_TEST_DATABASE_URL are required');
const database = new URL(databaseUrl);
const r3Database = new URL(r3DatabaseUrl);
for (const url of [database, r3Database]) {
  if (url.hostname !== 'postgres' || url.username !== 'ci_test' || url.password !== 'ci_synthetic_only') {
    throw Error('Refusing database URL outside the isolated CI PostgreSQL service');
  }
}
if (database.pathname !== '/r3_test_isolated' || r3Database.pathname !== '/r3_test_isolated') {
  throw Error('Refusing database outside r3_test_isolated');
}
(async () => {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const identity = await pool.query('SELECT current_database() AS database, current_user AS username');
    assert.deepEqual(identity.rows[0], { database: 'r3_test_isolated', username: 'ci_test' });
  } finally {
    await pool.end();
  }
  console.log('Autorizacion R3 y destino sintetico: OK');
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
NODE

echo "=== Asegurando fixtures deterministas ==="
node /app/tests/integration/r3-isolated/critical-recommendations.cjs setup
node /app/tests/integration/r3-isolated/critical-recommendations.cjs setup
node /app/tests/integration/r3-isolated/relevance-seed.cjs shrimp
node /app/tests/integration/r3-isolated/relevance-seed.cjs shrimp

PIDS=""
cleanup() {
  result=$?
  trap - EXIT INT TERM
  for pid in $PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
      if kill -TERM "$pid"; then
        :
      else
        echo "ERROR: no se pudo terminar el proceso $pid"
        result=1
      fi
    fi
  done
  exit "$result"
}
trap cleanup EXIT INT TERM

echo "=== Iniciando backends auxiliares aislados ==="
node /app/tests/integration/r3-isolated/critical-omission-proxy.cjs &
PIDS="$PIDS $!"
node /app/tests/integration/r3-isolated/relevance-rank-failure.cjs &
PIDS="$PIDS $!"

PORT=4013 ML_SERVICE_URL=http://ml:8003 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4014 ML_SERVICE_URL=http://ml:8004 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4020 ML_SERVICE_URL=http://ml:8005 DISABLE_PRIMARY_FOOD_RELEVANCE=true node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4021 ML_SERVICE_URL=http://127.0.0.1:8015 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4022 ML_SERVICE_URL=http://127.0.0.1:1 ML_SERVICE_TIMEOUT=1000 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4028 ML_SERVICE_URL=http://ml:8005 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4029 ML_SERVICE_URL=http://ml:8005 MEXXICAN_VOCAB_PATH=disabled DISABLE_PRIMARY_FOOD_RELEVANCE=true LOCAL_MXN_BUDGET=true node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4030 ML_SERVICE_URL=http://127.0.0.1:1 ML_SERVICE_TIMEOUT=1000 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4031 ML_SERVICE_URL=http://127.0.0.1:8025 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4039 ML_SERVICE_URL=http://ml:8013 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4041 ML_SERVICE_URL=http://ml:8000 LOCAL_MXN_BUDGET=true node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4044 ML_SERVICE_URL=http://127.0.0.1:8019 LOCAL_MXN_BUDGET=true DATABASE_URL=postgresql://ci_test:ci_synthetic_only@postgres:5432/r3_test_rollback node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4050 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4051 ML_SERVICE_URL=http://ml-proxy:8010 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4052 ML_SERVICE_URL=http://ml:8000 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4053 ML_SERVICE_URL=http://ml:8000 node /app/src/index.js &
PIDS="$PIDS $!"
PORT=4054 ML_SERVICE_URL=http://ml:8000 node /app/src/index.js &
PIDS="$PIDS $!"

echo "=== Esperando disponibilidad de backends ==="
for port in 4013 4014 4020 4021 4022 4028 4029 4030 4031 4039 4041 4044 4050 4051 4052 4053 4054; do
  ready=0
  for i in $(seq 1 120); do
    if node -e "require('http').get('http://127.0.0.1:$port/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" 2>/dev/null; then
      ready=1
      break
    fi
    sleep 0.5
  done
  if [ "$ready" -ne 1 ]; then
    echo "ERROR: Backend en puerto $port no respondio a /health tras 60 segundos"
    exit 1
  fi
done

echo "=== Ejecutando contrato DEC-012 antes de evidencias del owner ==="
node --test --test-concurrency=1 /app/tests/integration/dec012-isolated/http.test.js

echo "=== Ejecutando R3 real antes de evidencias globales de otros fixtures ==="
R3_REAL_BACKEND_URL=http://127.0.0.1:4051 \
  node --test --test-concurrency=1 /app/tests/integration/r3-isolated/real.test.cjs

echo "=== Sembrando evidencia de precio mediante API autenticada ==="
node <<'NODE'
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const owner = '10000000-0000-4000-8000-000000000001';
const dish = '30000000-0000-4000-8000-000000000001';
const base = 'http://127.0.0.1:4053';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function request(path, body, token, method = 'POST') {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}
async function seedPriceEvidence() {
  const current = await pool.query(`SELECT 1 FROM platillos d
    JOIN confirmacion_precio_platillo p
      ON p.platillo_id=d.id AND p.restaurante_id=d.restaurante_id
      AND p.version_precio::text=d.evidencia_precio_revision::text
      AND p.precio_confirmado=d.precio
    JOIN confirmacion_moneda_restaurante c
      ON c.id=p.confirmacion_id AND c.restaurante_id=p.restaurante_id
    WHERE d.id=$1 AND c.moneda='MXN' AND c.revocado_en IS NULL`, [dish]);
  if (current.rowCount) {
    console.log('La evidencia vigente del fixture ya existe');
    return;
  }
  const session = await request('/api/auth/login', {
    email: 'uno@example.invalid',
    password: 'Synthetic-only-123!'
  });
  const snapshot = await request(`/api/menu/platillos/${dish}/evidence`, undefined, session.access_token, 'GET');
  await request('/api/menu/evidence/currency', {
    currency: 'MXN',
    source: 'Revisión sintética autorizada en CI',
    catalogFingerprint: snapshot.catalogFingerprint,
    dishes: [{
      id: dish,
      price: String(snapshot.dish.precio),
      priceRevision: snapshot.dish.evidencia_precio_revision
    }]
  }, session.access_token);
  console.log('Evidencia de precio creada y verificada por el flujo real');
}
(async () => {
  try {
    await seedPriceEvidence();
    await seedPriceEvidence();
  } finally {
    await pool.end();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
NODE

echo "=== Ejecutando suite de integracion serializada ==="
find /app/tests/integration -type f \( -name "*.test.js" -o -name "*.test.cjs" \) \
  ! -path "/app/tests/integration/dec012-isolated/http.test.js" \
  ! -name "real.test.cjs" ! -name "owner-flow.test.cjs" \
  ! -name "relevance-http.test.cjs" ! -name "single-message.test.cjs" -print \
  | sort | xargs -r node --test --test-concurrency=1
R3_OWNER_BACKEND_URL=http://127.0.0.1:4052 \
  node --test --test-concurrency=1 /app/tests/integration/r3-isolated/owner-flow.test.cjs
R3_SINGLE_BACKEND_URL=http://127.0.0.1:4054 \
  node --test --test-concurrency=1 /app/tests/integration/r3-isolated/single-message.test.cjs
RELEVANCE_PORT=4028 RELEVANCE_STAGE=with \
  node --test --test-concurrency=1 /app/tests/integration/r3-isolated/relevance-http.test.cjs

echo "=== Verificando limites de tasa HTTP ==="
node <<'NODE'
const assert = require('node:assert/strict');
(async () => {
  const url = 'http://127.0.0.1:4050/api/public/menu/rate-limit-probe';
  for (let request = 1; request <= 100; request += 1) {
    const response = await fetch(url);
    assert.notEqual(response.status, 429, `rate limit rejected request ${request}`);
  }
  const limited = await fetch(url);
  assert.equal(limited.status, 429, `expected HTTP 429 after 100 requests, received ${limited.status}`);
  console.log('Public menu limiter: 100 requests accepted; request 101 rejected with HTTP 429');
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
NODE

echo "=== Verificando triggers R3 activos ==="
node <<'NODE'
const assert = require('node:assert/strict');
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const disabled = await pool.query(`SELECT tgname FROM pg_trigger
      WHERE tgname LIKE 'r3_%' AND NOT tgisinternal AND tgenabled <> 'O'`);
    const guards = await pool.query(`SELECT tgname, tgenabled FROM pg_trigger
      WHERE tgname IN ('r3_moneda_guard','r3_precio_guard','r3_ausencia_guard')
        AND NOT tgisinternal ORDER BY tgname`);
    assert.deepEqual(disabled.rows, []);
    assert.deepEqual(guards.rows, [
      { tgname: 'r3_ausencia_guard', tgenabled: 'O' },
      { tgname: 'r3_moneda_guard', tgenabled: 'O' },
      { tgname: 'r3_precio_guard', tgenabled: 'O' }
    ]);
    console.log('R3 evidence guards and all named triggers: enabled');
  } finally {
    await pool.end();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
NODE
