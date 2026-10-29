/**
 * LEGACY MIGRATION RUNNER - DEPRECATED
 *
 * This file is kept for backwards compatibility only.
 *
 * PRIMARY SCHEMA DEFINITION: backend/src/db/init.sql (Docker EntryPoint)
 * RUNTIME SAFETY NET: backend/src/config/db.js (backwards compatibility ALTERs)
 *
 * All schema definitions have been consolidated into init.sql as the single source of truth.
 * This script should not be used for new migrations.
 *
 * Execution: npm run db:migrate (if needed for legacy reasons)
 */

const db = require('../config/db');

async function runMigrations() {
  console.log('🏁 LEGACY: Iniciando migraciones de base de datos...');
  
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Asegurar columna email_verificado en la tabla restaurantes
    console.log('Migración 1: Verificando columna email_verificado...');
    await client.query('ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN DEFAULT false');

    // 2. Forzar verificación de emails de prueba en desarrollo
    console.log('Migración 2: Verificando correos de prueba...');
    const verifyRes = await client.query(
      "UPDATE restaurantes SET email_verificado = true WHERE email LIKE '%@example.com' OR email LIKE '%@test.com' OR email = 'contacto@elpaisa.com'"
    );
    if (verifyRes.rowCount > 0) {
      console.log(`- Se marcaron ${verifyRes.rowCount} correos de prueba como verificados.`);
    }

    // 3. Asegurar columna config_diseno en la tabla configuracion_tema
    console.log('Migración 3: Verificando columna config_diseno...');
    await client.query('ALTER TABLE configuracion_tema ADD COLUMN IF NOT EXISTS config_diseno TEXT');

    // 4. Tablas para sistema de Suscripciones y Soporte Premium
    console.log('Migración 4: Creando tablas de auditoría de suscripciones y soporte premium...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS historial_suscripciones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
        accion VARCHAR(100) NOT NULL,
        plan_anterior VARCHAR(50),
        plan_nuevo VARCHAR(50),
        detalles TEXT,
        admin_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS soporte_conversaciones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
        estado VARCHAR(50) DEFAULT 'abierta', -- 'abierta', 'resuelta', 'cerrada'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS soporte_mensajes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversacion_id UUID NOT NULL REFERENCES soporte_conversaciones(id) ON DELETE CASCADE,
        remitente_tipo VARCHAR(50) NOT NULL, -- 'RESTAURANTE', 'ADMIN'
        remitente_id UUID,
        mensaje TEXT NOT NULL,
        leido BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('🎉 Migraciones completadas con éxito.');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error ejecutando las migraciones:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

runMigrations();
