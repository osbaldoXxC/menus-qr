'use strict';

/**
 * B1-T04 bootstrap seguro de Super Admin (alternativa A).
 * - Uso exclusivo: Docker local / BD aislada autorizada para pruebas.
 * - Credenciales solo por variables de entorno.
 * - Sin credenciales hardcodeadas, sin DDL, sin sobrescritura de admins existentes.
 * - Idempotente: no crea duplicados ni modifica cuentas existentes.
 *
 * Requiere: SUPERADMIN_BOOTSTRAP_EMAIL, SUPERADMIN_BOOTSTRAP_PASSWORD
 * Requiere confirmación explícita: SUPERADMIN_BOOTSTRAP_ALLOW_LOCAL=true
 * Rechaza producción: NODE_ENV=production o DB host no local/autorizado.
 */

const bcrypt = require('bcryptjs');
const { URL } = require('url');
const db = require('../config/db');

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', 'postgres', 'db', 'host.docker.internal']);

function getDbHost(connectionString) {
  try {
    const u = new URL(connectionString);
    return (u.hostname || '').toLowerCase();
  } catch {
    return '';
  }
}

function isLocalAuthorizedDb(connectionString) {
  const host = getDbHost(connectionString);
  if (!host) return false;
  if (LOCAL_DB_HOSTS.has(host)) return true;
  // allow explicit docker-network/local hostnames only when explicitly confirmed
  return false;
}

async function main() {
  const email = (process.env.SUPERADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPERADMIN_BOOTSTRAP_PASSWORD || '';
  const nombreNegocio = (process.env.SUPERADMIN_BOOTSTRAP_NOMBRE_NEGOCIO || 'Super Admin').trim() || 'Super Admin';
  const nombreDueno = (process.env.SUPERADMIN_BOOTSTRAP_NOMBRE_DUENO || 'Super Admin').trim() || 'Super Admin';
  const allowLocal = String(process.env.SUPERADMIN_BOOTSTRAP_ALLOW_LOCAL || '').toLowerCase() === 'true';
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  const dbUrl = process.env.DATABASE_URL || '';

  if (nodeEnv === 'production') {
    console.error('[seed_superadmin] RECHAZADO: NODE_ENV=production. Uso exclusivo local/Docker.');
    process.exit(2);
  }
  if (!allowLocal) {
    console.error('[seed_superadmin] RECHAZADO: falta SUPERADMIN_BOOTSTRAP_ALLOW_LOCAL=true (confirmación explícita de entorno local/Docker).');
    process.exit(2);
  }
  if (!isLocalAuthorizedDb(dbUrl)) {
    const host = getDbHost(dbUrl) || '(desconocido)';
    console.error(`[seed_superadmin] RECHAZADO: DATABASE_URL no apunta a BD local/Docker autorizada (host="${host}").`);
    process.exit(2);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('[seed_superadmin] RECHAZADO: SUPERADMIN_BOOTSTRAP_EMAIL requerido y debe ser válido.');
    process.exit(2);
  }
  if (!password || password.length < 10) {
    console.error('[seed_superadmin] RECHAZADO: SUPERADMIN_BOOTSTRAP_PASSWORD requerido (mínimo 10 caracteres).');
    process.exit(2);
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id, rol, email FROM restaurantes WHERE email = $1 LIMIT 1',
      [email]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      await client.query('ROLLBACK');
      console.log(`[seed_superadmin] IDEMPOTENTE: ya existe cuenta con email=${row.email} (id=${row.id}, rol=${row.rol}). No se creó ni modificó nada.`);
      process.exit(0);
    }

    // No sobrescribir administradores existentes: si ya hay SUPER_ADMIN, no crear duplicado implícito ni alterar.
    const existingAdmin = await client.query(
      "SELECT id, email FROM restaurantes WHERE rol = 'SUPER_ADMIN' LIMIT 1"
    );
    if (existingAdmin.rows.length > 0) {
      const a = existingAdmin.rows[0];
      await client.query('ROLLBACK');
      console.log(`[seed_superadmin] IDEMPOTENTE: ya existe un SUPER_ADMIN (id=${a.id}, email=${a.email}). No se creó ni modificó nada.`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const insert = await client.query(
      `INSERT INTO restaurantes (nombre_negocio, nombre_dueno, email, password_hash, rol, plan, suscripcion_activa, email_verificado, estado)
       VALUES ($1, $2, $3, $4, 'SUPER_ADMIN', 'premium', true, true, 'aprobado')
       RETURNING id, email, rol, estado, suscripcion_activa, email_verificado`,
      [nombreNegocio, nombreDueno, email, passwordHash]
    );

    await client.query('COMMIT');
    const created = insert.rows[0];
    console.log(`[seed_superadmin] OK: SUPER_ADMIN creado (id=${created.id}, email=${created.email}, rol=${created.rol}, estado=${created.estado}).`);
    process.exit(0);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[seed_superadmin] ERROR:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error('[seed_superadmin] ERROR FATAL:', err && err.message ? err.message : err);
  process.exit(1);
});
