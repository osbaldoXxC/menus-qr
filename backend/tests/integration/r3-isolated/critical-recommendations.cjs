'use strict';
// Same synthetic restaurant for before/after HTTP checks. Never use persistent DB.
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = 'fa000000-0000-4000-8000-000000000001';
const dishes = [
  ['fa000000-0000-4000-8000-000000000002', 'Licuado de fresa', ['leche','fresa'], 0],
  ['fa000000-0000-4000-8000-000000000003', 'Camarones al limón', ['camarones','limón'], 0],
  ['fa000000-0000-4000-8000-000000000004', 'Pollo asado', ['pollo'], 0],
  ['fa000000-0000-4000-8000-000000000005', 'Caldo picante de pollo', ['pollo','chile'], 4]
];
async function main() {
  if ((await pool.query('SELECT current_database() db')).rows[0].db !== 'r3_test_isolated') throw Error('Wrong database');
  if (process.argv[2] === 'setup') {
    const existing = await pool.query('SELECT id FROM restaurantes WHERE id=$1 OR email=$2', [owner,'critical-test@example.invalid']);
    if (existing.rows.length) throw Error('Fixture already exists; refusing changes');
    await pool.query('BEGIN');
    try {
      await pool.query("INSERT INTO restaurantes(id,nombre_negocio,email,password_hash,estado,suscripcion_activa) VALUES($1,'Prueba critica sintetica',$2,'!disabled','aprobado',true)", [owner,'critical-test@example.invalid']);
      for (const [id,name,ingredients,spice] of dishes) await pool.query("INSERT INTO platillos(id,restaurante_id,nombre,precio,activo,ingredientes_principales,nivel_picante) VALUES($1,$2,$3,90,true,$4::jsonb,$5)", [id,owner,name,JSON.stringify(ingredients),spice]);
      await pool.query('COMMIT');
    } catch (e) { await pool.query('ROLLBACK'); throw e; }
  }
  const rows = await pool.query('SELECT id,nombre,ingredientes_principales,nivel_picante FROM platillos WHERE restaurante_id=$1 ORDER BY nombre', [owner]);
  if (rows.rowCount !== 4) throw Error('Fixture not found or has changed');
  const base = `http://127.0.0.1:${process.argv[3] || 4000}`;
  const output = [];
  for (const text of ['Quiero algo que no lleve leche', 'Quiero camarones', 'Quiero algo que no pique']) {
    const req = { craving: { text, tags: [] }, restrictions: {}, options: { limit: 5, locale: 'es-MX' } };
    const response = await fetch(`${base}/api/public/menu/${owner}/recommendations`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(req) });
    const body = await response.json();
    output.push({ text, http:response.status, body });
  }
  console.log(JSON.stringify({ database:'r3_test_isolated', owner, candidates:rows.rows, output }));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
