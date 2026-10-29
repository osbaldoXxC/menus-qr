const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function run() {
  const hash = await bcrypt.hash('Martinez24', 12);
  const res = await db.query(
    `INSERT INTO restaurantes (nombre_negocio, email, password_hash, rol, plan, suscripcion_activa, email_verificado, estado, slug)
     VALUES ('Mi Restaurante Campus', 'a3523110279@alumno.uttehuacan.edu.mx', $1, 'RESTAURANTE', 'premium', true, true, 'aprobado', 'mi-restaurante-campus')
     ON CONFLICT (email) DO UPDATE SET password_hash = $1, suscripcion_activa = true, email_verificado = true, estado = 'aprobado'
     RETURNING id, email, rol, estado`,
    [hash]
  );
  
  // Asegurar tema
  await db.query(
    'INSERT INTO configuracion_tema (restaurante_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [res.rows[0].id]
  );

  console.log('USUARIO CREADO CON ÉXITO:', res.rows[0]);
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
