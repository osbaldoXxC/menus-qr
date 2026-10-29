/**
 * SCHEMA AUDIT - Validates synchronization between code (init.sql) and running database
 *
 * Purpose: Verify that all 20 production tables with all columns exist in the running Docker instance
 * after schema consolidation. Reports 100% sync if successful.
 *
 * Usage: node audit-schema.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://admin:password123@postgres:5432/mexxicanmx_db',
});

// Expected schema from init.sql consolidation
const EXPECTED_SCHEMA = {
  tables: {
    restaurantes: {
      columns: [
        'id', 'nombre_negocio', 'descripcion', 'email', 'password_hash',
        'nombre_dueno', 'ubicacion_lat', 'ubicacion_lng', 'suscripcion_activa',
        'rol', 'plan', 'estado', 'suscripcion_expira_en', 'dias_licencia',
        'ultimo_pago', 'email_verificado', 'slug', 'reset_token',
        'reset_token_expires', 'fecha_vencimiento', 'dias_acceso_permitidos',
        'created_at'
      ],
      expectedDefaults: {
        estado: "'pendiente'",
        email_verificado: 'false',
        rol: "'RESTAURANTE'",
        plan: "'basico'",
        dias_licencia: '30',
        dias_acceso_permitidos: '0'
      }
    },
    configuracion_tema: {
      columns: [
        'id', 'restaurante_id', 'logo_url', 'banner_url', 'color_primario',
        'color_fondo', 'fuente_familia', 'layout_type', 'banner_promocional_activo',
        'banner_promocional_texto', 'config_diseno', 'updated_at'
      ]
    },
    refresh_tokens: {
      columns: ['id', 'restaurante_id', 'token', 'expires_at', 'created_at']
    },
    horarios_restaurante: {
      columns: ['id', 'restaurante_id', 'dia_semana', 'hora_apertura', 'hora_cierre', 'created_at']
    },
    categorias_restaurante: {
      columns: ['id', 'restaurante_id', 'nombre', 'orden', 'created_at']
    },
    platillos: {
      columns: [
        'id', 'restaurante_id', 'nombre', 'descripcion', 'precio', 'url_imagen',
        'categoria_id', 'tamano_porcion_id', 'activo', 'ingredientes_principales',
        'complementos', 'nivel_picante', 'porcion', 'etiquetas_dieteticas',
        'vector_ia', 'estado_ia', 'created_at'
      ]
    },
    ingredientes_catalogo: {
      columns: ['id', 'nombre', 'es_alergeno_comun', 'es_origen_animal']
    },
    sabores_catalogo: {
      columns: ['id', 'nombre']
    },
    usuarios_comensales: {
      columns: ['id', 'nombre', 'email', 'auth_provider', 'deleted_at', 'created_at']
    },
    receta_platillo: {
      columns: ['platillo_id', 'ingrediente_id', 'tipo_ingrediente', 'es_modificable']
    },
    perfil_sabor_platillo: {
      columns: ['platillo_id', 'sabor_id']
    },
    interacciones_feed: {
      columns: ['id', 'usuario_id', 'platillo_id', 'tipo_interaccion', 'fecha_timestamp']
    },
    historial_suscripciones: {
      columns: ['id', 'restaurante_id', 'plan_anterior', 'plan_nuevo', 'fecha_cambio', 'razon', 'created_at']
    },
    tamanos_porcion: {
      columns: ['id', 'nombre', 'created_at']
    },
    cocinas_catalogo: {
      columns: ['id', 'nombre', 'created_at']
    },
    platillo_cocina: {
      columns: ['platillo_id', 'cocina_id']
    },
    soporte_conversaciones: {
      columns: [
        'id', 'restaurante_id', 'asunto', 'comentario_calificacion', 'admin_id',
        'calificacion', 'fecha_creacion', 'fecha_cierre', 'ultima_actividad',
        'mensajes_restaurante_count', 'leido_admin', 'leido_restaurante', 'created_at'
      ]
    },
    soporte_mensajes: {
      columns: ['id', 'conversacion_id', 'remitente_tipo', 'remitente_id', 'mensaje', 'created_at']
    },
    soporte_auditoria: {
      columns: ['id', 'conversacion_id', 'accion', 'usuario_id', 'usuario_tipo', 'detalles', 'created_at']
    },
    audit_logs: {
      columns: ['id', 'usuario_id', 'accion', 'detalles', 'ip_address', 'created_at']
    }
  }
};

async function auditSchema() {
  console.log('🔍 Starting schema audit against running database...\n');

  const client = await pool.connect();
  let totalTables = 0;
  let syncedTables = 0;
  let totalColumns = 0;
  let syncedColumns = 0;
  let issues = [];

  try {
    // 1. Get all tables in database
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const dbTables = new Set(tablesResult.rows.map(r => r.table_name));
    const expectedTables = new Set(Object.keys(EXPECTED_SCHEMA.tables));

    console.log(`📊 TABLE INVENTORY`);
    console.log(`  Expected: ${expectedTables.size} tables`);
    console.log(`  Found: ${dbTables.size} tables`);
    console.log(`  Difference: ${dbTables.size - expectedTables.size}\n`);

    // Check for missing tables
    const missingTables = [...expectedTables].filter(t => !dbTables.has(t));
    if (missingTables.length > 0) {
      issues.push(`❌ Missing tables: ${missingTables.join(', ')}`);
    }

    // Check for orphaned tables
    const orphanedTables = [...dbTables].filter(t => !expectedTables.has(t));
    if (orphanedTables.length > 0) {
      console.warn(`⚠️  Orphaned tables in DB: ${orphanedTables.join(', ')}`);
    }

    // 2. Validate each expected table and its columns
    console.log(`📋 COLUMN VALIDATION\n`);

    for (const tableName of expectedTables) {
      totalTables++;

      if (!dbTables.has(tableName)) {
        console.log(`❌ TABLE MISSING: ${tableName}`);
        continue;
      }

      const columnResult = await client.query(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      const dbColumns = new Map();
      columnResult.rows.forEach(row => {
        dbColumns.set(row.column_name, {
          type: row.data_type,
          default: row.column_default,
          nullable: row.is_nullable
        });
      });

      const expectedColumns = EXPECTED_SCHEMA.tables[tableName].columns;
      let tableSync = true;

      for (const col of expectedColumns) {
        totalColumns++;
        if (dbColumns.has(col)) {
          syncedColumns++;
        } else {
          tableSync = false;
          issues.push(`❌ ${tableName}.${col} - MISSING COLUMN`);
          console.log(`  ❌ ${tableName}.${col}`);
        }
      }

      // Check for unexpected columns
      const unexpectedCols = [...dbColumns.keys()].filter(c => !expectedColumns.includes(c));
      if (unexpectedCols.length > 0) {
        console.log(`  ⚠️  ${tableName} has ${unexpectedCols.length} unexpected column(s): ${unexpectedCols.join(', ')}`);
      }

      if (tableSync) {
        syncedTables++;
        console.log(`  ✅ ${tableName} (${expectedColumns.length} columns)`);
      } else {
        console.log(`  ⚠️  ${tableName} (missing columns detected)\n`);
      }

      // Validate critical defaults for restaurantes table
      if (tableName === 'restaurantes') {
        console.log(`  📌 Checking critical defaults for restaurantes:`);

        const defaults = EXPECTED_SCHEMA.tables.restaurantes.expectedDefaults;
        for (const [col, expectedDefault] of Object.entries(defaults)) {
          const colInfo = dbColumns.get(col);
          if (colInfo) {
            const actualDefault = colInfo.default || 'NULL';
            const matches = actualDefault.toString().includes(expectedDefault.replace(/'/g, ''));
            if (matches) {
              console.log(`    ✅ ${col}: ${actualDefault}`);
            } else {
              console.log(`    ⚠️  ${col}: ${actualDefault} (expected: ${expectedDefault})`);
              issues.push(`⚠️  restaurantes.${col} default mismatch`);
            }
          }
        }
      }
    }

    // 3. Summary Report
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📈 SYNCHRONIZATION REPORT`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Tables:  ${syncedTables}/${totalTables} synchronized (${((syncedTables/totalTables)*100).toFixed(1)}%)`);
    console.log(`Columns: ${syncedColumns}/${totalColumns} synchronized (${((syncedColumns/totalColumns)*100).toFixed(1)}%)`);

    if (issues.length === 0) {
      console.log(`\n✅ AUDIT PASSED - 100% SCHEMA SYNCHRONIZATION ACHIEVED`);
      console.log(`\nAll ${totalTables} tables and ${totalColumns} columns match expected schema.`);
      console.log(`Schema consolidation is complete and verified.`);
    } else {
      console.log(`\n⚠️  AUDIT FOUND ${issues.length} ISSUE(S):`);
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    console.log(`\n${'='.repeat(60)}`);

    process.exit(issues.length > 0 ? 1 : 0);

  } catch (error) {
    console.error('❌ Audit error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

auditSchema();
