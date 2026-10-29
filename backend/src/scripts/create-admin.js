const db = require('../config/db');
const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const createAdmin = async () => {
  rl.question('Email del administrador: ', async (email) => {
    rl.question('Nombre del administrador: ', async (nombre) => {
      rl.question('Contraseña: ', async (password) => {
        try {
          const hash = await bcrypt.hash(password, 12);
          await db.query(
            `INSERT INTO restaurantes (id, nombre_negocio, email, password_hash, rol, plan, suscripcion_activa, email_verificado, estado)
             VALUES (gen_random_uuid(), $1, $2, $3, 'SUPER_ADMIN', 'premium', true, true, 'aprobado')`,
            [nombre, email, hash]
          );
          console.log('✅ SUPER_ADMIN creado correctamente');
        } catch (err) {
          console.error('❌ Error al crear admin:', err.message);
        } finally {
          rl.close();
          process.exit(0);
        }
      });
    });
  });
};

createAdmin();
