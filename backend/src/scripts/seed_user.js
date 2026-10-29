const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function run() {
  await db.query(`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN DEFAULT true;`);
  const hash = await bcrypt.hash('Martinez24', 12);
  const res = await db.query(
    `INSERT INTO restaurantes (id, nombre_negocio, email, password_hash, rol, plan, suscripcion_activa, estado)
     VALUES (gen_random_uuid(), 'Super Admin', 'baldo2005_@outlook.com', $1, 'SUPER_ADMIN', 'premium', true, 'aprobado')
     ON CONFLICT (email) DO UPDATE SET password_hash = $1, rol = 'SUPER_ADMIN', estado = 'aprobado'
     RETURNING id, email, rol, estado`,
    [hash]
  );
  console.log('✅ USUARIO CREADO EN POSTGRESQL:', res.rows[0]);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
