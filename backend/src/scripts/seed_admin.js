const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function main() {
  const email = 'baldo2005_@outlook.com';
  const password = 'Martinez24';
  const hash = await bcrypt.hash(password, 12);
  
  await db.query(`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN DEFAULT true;`);
  await db.query(`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS nombre_dueno VARCHAR(255) DEFAULT '';`);
  await db.query(
    `INSERT INTO restaurantes (id, nombre_negocio, email, password_hash, rol, plan, suscripcion_activa, email_verificado, estado)
     VALUES (gen_random_uuid(), 'Super Admin', $1, $2, 'SUPER_ADMIN', 'premium', true, true, 'aprobado')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, rol = 'SUPER_ADMIN', estado = 'aprobado'`,
    [email, hash]
  );
  console.log('✅ SUPER_ADMIN baldo2005_@outlook.com CREADO Y CONFIGURADO EN POSTGRESQL');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
