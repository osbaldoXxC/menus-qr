const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  const hash = await bcrypt.hash('Martinez24', 12);
  const res = await db.query(
    `INSERT INTO restaurantes (id, nombre_negocio, email, password_hash, rol, plan, suscripcion_activa, email_verificado, estado, slug)
     VALUES ('f55d6131-403d-4e28-9df1-a3af6cfc5968', 'Restaurante Tehuacán Demo', 'demo@restaurante.com', $1, 'RESTAURANTE', 'premium', true, true, 'aprobado', 'restaurante-tehuacan-demo')
     ON CONFLICT (id) DO UPDATE SET password_hash = $1, email = 'demo@restaurante.com', suscripcion_activa = true, email_verificado = true, estado = 'aprobado'
     RETURNING id, email, rol, estado`,
    [hash]
  );
  console.log('RESTAURANTE DEMO LISTO:', res.rows[0]);
  process.exit(0);
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
});
