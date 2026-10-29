const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.POSTGRES_USER || 'admin_mexx',
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'mexxicanmx_db'
});

async function auditDatabase() {
  try {
    await client.connect();
    console.log('✅ Conexión exitosa a la base de datos\n');

    // 1. Listar todas las tablas
    console.log('📊 === TABLAS EN LA BASE DE DATOS ===\n');
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public'
      ORDER BY table_name
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('Tablas encontradas:', tables.length);
    tables.forEach(t => console.log(`  • ${t}`));

    // 2. Para cada tabla, extraer estructura completa
    console.log('\n\n🔍 === ESTRUCTURA DETALLADA DE CADA TABLA ===\n');

    for (const tableName of tables) {
      console.log(`\n── ${tableName.toUpperCase()} ──`);

      // Columnas
      const columnsRes = await client.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      columnsRes.rows.forEach(col => {
        let type = col.data_type;
        if (col.character_maximum_length) type += `(${col.character_maximum_length})`;
        if (col.numeric_precision) type += `(${col.numeric_precision},${col.numeric_scale})`;
        if (col.udt_name && col.data_type === 'USER-DEFINED') type = col.udt_name;

        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
        console.log(`  • ${col.column_name}: ${type} ${nullable} ${defVal}`.trim());
      });

      // Primary keys
      const pkRes = await client.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelname = $1 AND i.indisprimary
      `, [`${tableName}_pkey`]);

      if (pkRes.rows.length > 0) {
        console.log(`  🔑 PRIMARY KEY: (${pkRes.rows.map(r => r.attname).join(', ')})`);
      }

      // Foreign keys
      const fkRes = await client.query(`
        SELECT
          constraint_name,
          column_name,
          foreign_table_name,
          foreign_column_name
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.referential_constraints rc ON rc.constraint_name = kcu.constraint_name
        WHERE kcu.table_name = $1 AND kcu.table_schema = 'public'
      `, [tableName]);

      if (fkRes.rows.length > 0) {
        console.log(`  🔗 FOREIGN KEYS:`);
        fkRes.rows.forEach(fk => {
          console.log(`     • ${fk.column_name} → ${fk.foreign_table_name}(${fk.foreign_column_name})`);
        });
      }

      // Indices
      const indexRes = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1 AND schemaname = 'public'
      `, [tableName]);

      if (indexRes.rows.length > 0) {
        console.log(`  📑 INDICES:`);
        indexRes.rows.forEach(idx => {
          console.log(`     • ${idx.indexname}`);
        });
      }

      // Constraints
      const constraintsRes = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = $1 AND table_schema = 'public'
      `, [tableName]);

      if (constraintsRes.rows.length > 0) {
        console.log(`  ✓ CONSTRAINTS:`);
        constraintsRes.rows.forEach(c => {
          if (!['PRIMARY KEY', 'FOREIGN KEY'].includes(c.constraint_type)) {
            console.log(`     • ${c.constraint_name} (${c.constraint_type})`);
          }
        });
      }
    }

    // 3. Extensions
    console.log('\n\n⚙️  === EXTENSIONES ===\n');
    const extRes = await client.query(`
      SELECT extname, extversion FROM pg_extension WHERE extname != 'plpgsql'
    `);
    if (extRes.rows.length > 0) {
      extRes.rows.forEach(ext => {
        console.log(`  • ${ext.extname} v${ext.extversion}`);
      });
    } else {
      console.log('  (sin extensiones adicionales)');
    }

    // 4. Tipos de datos customizados (ENUM, etc)
    console.log('\n\n🏷️  === TIPOS DE DATOS CUSTOMIZADOS ===\n');
    const typesRes = await client.query(`
      SELECT typname, typtype, enum_range(t.*)::text[] as values
      FROM pg_type t
      WHERE typnamespace = 'public'::regnamespace
      ORDER BY typname
    `);

    if (typesRes.rows.length > 0) {
      typesRes.rows.forEach(type => {
        console.log(`  • ${type.typname} (${type.typtype === 'e' ? 'ENUM' : 'COMPOSITE'})`);
      });
    } else {
      console.log('  (sin tipos customizados)');
    }

    // 5. Row counts
    console.log('\n\n📈 === CONTEO DE REGISTROS ===\n');
    for (const tableName of tables) {
      const countRes = await client.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
      console.log(`  • ${tableName}: ${countRes.rows[0].cnt} registros`);
    }

    console.log('\n✅ Auditoría completada');

  } catch (error) {
    console.error('❌ Error durante la auditoría:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

auditDatabase();
