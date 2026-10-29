const { Pool } = require('pg');
require('dotenv').config();

// En Docker, DATABASE_URL debe apuntar al nombre del servicio (postgres)
// Para pruebas locales fuera de Docker, usaría localhost
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin:password123@localhost:5432/mexxicanmx_db',
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

// Runtime schema safety net - defensive ALTER TABLE for backwards compatibility
// NOTE: Primary schema definition is in init.sql (single source of truth)
// These migrations handle edge cases where old DB instances might be missing columns
async function runMigrations() {
  try {
    await pool.query('BEGIN');

    // 1. All Table Creations (Idempotent)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS historial_suscripciones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
        plan_anterior VARCHAR(50),
        plan_nuevo VARCHAR(50) NOT NULL,
        fecha_cambio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        razon VARCHAR(255),
        accion VARCHAR(100),
        admin_id UUID,
        detalles TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS soporte_conversaciones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
        asunto VARCHAR(255) DEFAULT 'Asunto General',
        comentario_calificacion TEXT,
        admin_id UUID,
        calificacion INTEGER,
        fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        fecha_cierre TIMESTAMP WITH TIME ZONE,
        ultima_actividad TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        mensajes_restaurante_count INTEGER DEFAULT 0,
        leido_admin BOOLEAN DEFAULT false,
        leido_restaurante BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS soporte_mensajes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversacion_id UUID NOT NULL REFERENCES soporte_conversaciones(id) ON DELETE CASCADE,
        remitente_id UUID,
        tipo_remitente VARCHAR(50),
        contenido TEXT NOT NULL,
        fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS soporte_auditoria (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversacion_id UUID NOT NULL REFERENCES soporte_conversaciones(id) ON DELETE CASCADE,
        accion VARCHAR(255) NOT NULL,
        usuario_id UUID,
        usuario_tipo VARCHAR(50),
        detalles TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id UUID NOT NULL,
        accion VARCHAR(100) NOT NULL,
        detalles JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. All Defensive Column Alterations (Idempotent)
    await pool.query(`
      ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN DEFAULT false;
      ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS nombre_dueno VARCHAR(255) DEFAULT '';
      ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
      ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
      ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;
      ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMP WITH TIME ZONE;
      ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS dias_acceso_permitidos INTEGER DEFAULT 0;

      ALTER TABLE platillos ADD COLUMN IF NOT EXISTS ingredientes_principales JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE platillos ADD COLUMN IF NOT EXISTS complementos JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE platillos ADD COLUMN IF NOT EXISTS nivel_picante INTEGER DEFAULT 0;
      ALTER TABLE platillos ADD COLUMN IF NOT EXISTS porcion VARCHAR(100) DEFAULT '';
      ALTER TABLE platillos ADD COLUMN IF NOT EXISTS etiquetas_dieteticas JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE platillos ADD COLUMN IF NOT EXISTS tamano_porcion_id UUID;
      ALTER TABLE platillos ADD COLUMN IF NOT EXISTS precio_original DECIMAL(10, 2) DEFAULT NULL;

      ALTER TABLE usuarios_comensales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

      ALTER TABLE configuracion_tema ADD COLUMN IF NOT EXISTS config_diseno JSONB DEFAULT '{}'::jsonb;

      ALTER TABLE soporte_conversaciones ADD COLUMN IF NOT EXISTS asunto VARCHAR(255) DEFAULT 'Asunto General';
      ALTER TABLE soporte_conversaciones ADD COLUMN IF NOT EXISTS comentario_calificacion TEXT;
      ALTER TABLE soporte_conversaciones ADD COLUMN IF NOT EXISTS admin_id UUID;
      ALTER TABLE soporte_conversaciones ADD COLUMN IF NOT EXISTS calificacion INTEGER;
      ALTER TABLE soporte_conversaciones ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE soporte_conversaciones ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMP WITH TIME ZONE;
      ALTER TABLE soporte_conversaciones ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE soporte_conversaciones ADD COLUMN IF NOT EXISTS mensajes_restaurante_count INTEGER DEFAULT 0;
      ALTER TABLE soporte_conversaciones ADD COLUMN IF NOT EXISTS leido_admin BOOLEAN DEFAULT false;
      ALTER TABLE soporte_conversaciones ADD COLUMN IF NOT EXISTS leido_restaurante BOOLEAN DEFAULT true;

      ALTER TABLE historial_suscripciones ADD COLUMN IF NOT EXISTS accion VARCHAR(100);
      ALTER TABLE historial_suscripciones ADD COLUMN IF NOT EXISTS admin_id UUID;
      ALTER TABLE historial_suscripciones ADD COLUMN IF NOT EXISTS detalles TEXT;
    `);

    await pool.query('COMMIT');
    console.log('[DB Migration] Full schema auto-synchronization completed successfully.');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.warn('[DB Migration Warning] Error during schema verification:', err.message);
  }
}

// Solo ejecuta auto-migración al arrancar el servidor normal, no en entorno de tests
if (process.env.NODE_ENV !== 'test') {
  runMigrations();
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
