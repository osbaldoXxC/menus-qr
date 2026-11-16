'use strict';
// Synthetic fixtures only; never targets the persistent Docker database.
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = process.env.RELEVANCE_OWNER || 'fb000000-0000-4000-8000-000000000001';
const email = owner.startsWith('fb') ? 'relevancia-demo@example.invalid' : 'relevancia-vacio-demo@example.invalid';
const recipes = [
  ['fb000000-0000-4000-8000-000000000004','Camarones al ajillo',['camarón','ajo','aceite','sal'],120,0,'Gambas al ajillo.jpg','Javier Lastras','https://upload.wikimedia.org/wikipedia/commons/6/65/Gambas_al_ajillo.jpg','2.0'],
  ['fb000000-0000-4000-8000-000000000005','Camarones a la diabla',['camarón','chile','jitomate','ajo'],140,3,"Don Pancho's Mexican Food - February 2023 - Sarah Stierch 07.jpg",'Sarah Stierch','https://upload.wikimedia.org/wikipedia/commons/2/21/Don_Pancho%27s_Mexican_Food_-_February_2023_-_Sarah_Stierch_07.jpg','4.0'],
  ['fb000000-0000-4000-8000-000000000006','Camarones empanizados',['camarón','pan','huevo','aceite'],130,0,'Breaded shrimp (13020170974).jpg','jeffreyw','https://upload.wikimedia.org/wikipedia/commons/d/d4/Breaded_shrimp_%2813020170974%29.jpg','2.0'],
  ['fb000000-0000-4000-8000-000000000007','Cóctel de camarones',['camarón','jitomate','limón'],110,0,'Shrimp cocktail.jpg','Didriks','https://upload.wikimedia.org/wikipedia/commons/7/70/Shrimp_cocktail.jpg','2.0'],
  ['fb000000-0000-4000-8000-000000000008','Arroz con camarones',['camarón','arroz','zanahoria'],105,0,'Shrimp fried rice (8354053447).jpg','jeffreyw','https://upload.wikimedia.org/wikipedia/commons/0/02/Shrimp_fried_rice_%288354053447%29.jpg','2.0']
];
async function main() {
  const c = await pool.connect();
  try {
    if (!['fb000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001'].includes(owner)) throw Error('Unexpected fixture owner');
    const identity = await c.query("SELECT current_database() db, count(*) FILTER (WHERE email NOT LIKE '%@example.invalid')::int unexpected FROM restaurantes");
    if (identity.rows[0].db !== 'r3_test_isolated' || identity.rows[0].unexpected !== 0) throw Error('Refusing non-synthetic database');
    await c.query('BEGIN');
    const collisions = await c.query('SELECT id,email FROM restaurantes WHERE id=$1 OR email=$2', [owner,email]);
    if (collisions.rows.some(x => x.id !== owner || x.email !== email)) throw Error('Restaurant collision');
    await c.query("INSERT INTO restaurantes(id,nombre_negocio,descripcion,email,password_hash,estado,suscripcion_activa) VALUES($1,'Relevancia DEMO','Restaurante ficticio para pruebas.',$2,'!disabled','aprobado',true) ON CONFLICT (id) DO NOTHING", [owner,email]);
    const fixtures = [
      ['fb000000-0000-4000-8000-000000000002','Pizza de champiñones',['harina','queso','champiñón'],90,0,null,null,null,null],
      ['fb000000-0000-4000-8000-000000000003','Pollo asado',['pollo'],90,0,null,null,null,null],
      ...(process.argv[2] === 'shrimp' ? recipes : [])
    ];
    if (!['baseline','shrimp'].includes(process.argv[2])) throw Error('Use baseline or shrimp');
    for (const [originalId,name,ingredients,price,spice,file,author,url,license] of fixtures) {
      const id = owner.startsWith('fc') ? originalId.replace(/^fb/, 'fc') : originalId;
      const collision = await c.query('SELECT restaurante_id,nombre FROM platillos WHERE id=$1', [id]);
      if (collision.rows.some(x => x.restaurante_id !== owner || x.nombre !== name)) throw Error('Dish collision');
      const source = file ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file).replace(/%20/g,'_')}` : '';
      const description = file ? `Platillo ficticio DEMO. Foto ilustrativa: ${author}; ${source}; licencia https://creativecommons.org/licenses/by/${license}/; sin cambios.` : 'Platillo ficticio DEMO de control.';
      await c.query("INSERT INTO platillos(id,restaurante_id,nombre,descripcion,precio,activo,ingredientes_principales,nivel_picante,url_imagen,verification_metadata) VALUES($1,$2,$3,$4,$5,true,$6::jsonb,$7,$8,$9::jsonb) ON CONFLICT (id) DO NOTHING", [id,owner,name,description,price,JSON.stringify(ingredients),spice,url,JSON.stringify({source:'synthetic_relevance_demo',certified:false})]);
    }
    await c.query('COMMIT');
    console.log(JSON.stringify({ owner, mode:process.argv[2], dishes:(await c.query('SELECT count(*)::int count FROM platillos WHERE restaurante_id=$1',[owner])).rows[0].count }));
  } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); await pool.end(); }
}
main().catch(e => { console.error(e.message); process.exitCode=1; });
