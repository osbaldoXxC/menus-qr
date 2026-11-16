'use strict';
// Synthetic-only seed. Run inside the pre-existing isolated R3 backend.
// No confirmed currency, absence, allergy or cross-contact evidence is created.
const { Pool } = require('pg');
const { createHash } = require('crypto');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const menus = [
  ['Horno de Luna DEMO','Panadería',['Concha de vainilla|harina,trigo,leche','Concha de chocolate|harina,trigo,cacao','Cuernito de mantequilla|harina,trigo,mantequilla','Oreja de hojaldre|harina,trigo,azúcar','Pan de canela|harina,trigo,canela','Bolillo tradicional|harina,trigo','Panqué de naranja|harina,trigo,naranja','Galleta de avena|avena,harina']],
  ['Dulce Comal DEMO','Postres',['Pastel de chocolate|cacao,harina,huevo','Flan de vainilla|leche,huevo,vainilla','Arroz con leche|arroz,leche,canela','Gelatina de fresa|fresa,gelatina','Brownie de nuez|cacao,nuez,huevo','Pay de limón|limón,leche,harina','Mousse de cacao|cacao,leche','Natilla de canela|leche,canela']],
  ['Rosticería Alba DEMO','Pollo',['Pollo rostizado|pollo,sal','Pollo con limón|pollo,limón','Pollo con ajo|pollo,ajo','Pechuga asada|pollo,sal','Muslo al horno|pollo,pimienta','Pollo al romero|pollo,romero','Pollo con paprika|pollo,paprika','Pollo con naranja|pollo,naranja']],
  ['Fogón de Pollo DEMO','Pollo',['Tacos de pollo|pollo,maíz','Caldo de pollo|pollo,zanahoria','Pollo con arroz|pollo,arroz','Pollo con verduras|pollo,calabaza','Ensalada de pollo|pollo,lechuga','Pollo en salsa verde|pollo,tomatillo','Pollo con champiñones|pollo,champiñón','Fajitas de pollo|pollo,pimiento']],
  ['Dragón de Jade DEMO','Comida china',['Arroz frito con verduras|arroz,zanahoria','Pollo agridulce|pollo,piña','Fideos con verduras|fideos,zanahoria','Tofu con brócoli|tofu,brócoli','Sopa de verduras china|col,zanahoria','Arroz con huevo|arroz,huevo','Pollo con jengibre|pollo,jengibre','Fideos con pollo|fideos,pollo']],
  ['Bambú Oriental DEMO','Comida oriental',['Arroz con tofu|arroz,tofu','Pollo con ajonjolí|pollo,ajonjolí','Verduras salteadas|brócoli,zanahoria','Sopa de fideos|fideos,zanahoria','Pollo con brócoli|pollo,brócoli','Arroz con champiñones|arroz,champiñón','Tofu con verduras|tofu,calabaza','Fideos con soya|fideos,soya']],
  ['Pencas del Valle DEMO','Barbacoa',['Barbacoa de borrego|borrego,agave','Taco de barbacoa|borrego,maíz','Consomé de borrego|borrego,garbanzo','Barbacoa con salsa verde|borrego,tomatillo','Barbacoa con cebolla|borrego,cebolla','Quesadilla de barbacoa|borrego,queso','Barbacoa con frijoles|borrego,frijol','Tostada de barbacoa|borrego,maíz']],
  ['Cocina de la Milpa DEMO','Tradicional',['Mole con pollo|pollo,chile,cacao','Tacos de barbacoa tradicional|borrego,maíz','Enchiladas verdes|maíz,tomatillo','Sopa de tortilla|maíz,jitomate','Chilaquiles rojos|maíz,jitomate','Frijoles de olla|frijol,cebolla','Arroz a la mexicana|arroz,jitomate','Calabacitas guisadas|calabaza,elote']],
  ['Puerto Camarón DEMO','Mariscos',['Camarones al ajo|camarón,ajo','Camarones al limón|camarón,limón','Camarones a la plancha|camarón,sal','Camarones con arroz|camarón,arroz','Camarones con verduras|camarón,zanahoria','Tacos de camarón|camarón,maíz','Camarones con chipotle|camarón,chipotle','Camarones con cilantro|camarón,cilantro']],
  ['Mar de Prueba DEMO','Mariscos',['Ceviche de pescado|pescado,limón','Filete de pescado asado|pescado,sal','Camarones en salsa verde|camarón,tomatillo','Tostada de camarón|camarón,maíz','Sopa de pescado|pescado,zanahoria','Pescado al ajo|pescado,ajo','Arroz con camarones|arroz,camarón','Camarones con naranja|camarón,naranja']],
  ['Tacos del Patio DEMO','Taquería',['Taco de res|res,maíz','Taco de pollo|pollo,maíz','Taco de champiñón|champiñón,maíz','Taco de frijol|frijol,maíz','Taco de nopales|nopal,maíz','Taco de queso|queso,maíz','Taco de papa|papa,maíz','Taco de pescado|pescado,maíz']],
  ['Huerto Verde DEMO','Vegetariana',['Ensalada de nopales|nopal,jitomate','Tazón de garbanzos|garbanzo,arroz','Tacos de champiñón|champiñón,maíz','Sopa de lentejas|lenteja,zanahoria','Calabaza asada|calabaza,aceite','Arroz con verduras|arroz,zanahoria','Ensalada de frijol|frijol,jitomate','Tostada de aguacate|aguacate,maíz']],
  ['Pizza Solar DEMO','Pizzas',['Pizza margarita|harina,queso,jitomate','Pizza de champiñón|harina,queso,champiñón','Pizza de pollo|harina,queso,pollo','Pizza de pimiento|harina,queso,pimiento','Pizza de aceitunas|harina,queso,aceituna','Pizza de espinaca|harina,queso,espinaca','Pizza de jitomate|harina,queso,jitomate','Pizza de elote|harina,queso,elote']],
  ['Hamburguesas del Parque DEMO','Hamburguesas',['Hamburguesa de res|res,pan','Hamburguesa de pollo|pollo,pan','Hamburguesa de frijol|frijol,pan','Hamburguesa con queso|res,queso,pan','Hamburguesa con champiñón|res,champiñón,pan','Hamburguesa con aguacate|res,aguacate,pan','Hamburguesa de lentejas|lenteja,pan','Hamburguesa con jitomate|res,jitomate,pan']],
  ['Café Amanecer DEMO','Desayunos',['Huevos a la mexicana|huevo,jitomate','Hotcakes con fruta|harina,huevo,plátano','Avena con manzana|avena,manzana','Pan tostado con aguacate|pan,aguacate','Omelette de champiñón|huevo,champiñón','Yogur con fruta|yogur,fresa','Chilaquiles verdes|maíz,tomatillo','Molletes de frijol|pan,frijol,queso']]
];
function id(key) { const h = createHash('sha256').update(`mexxicanmx-demo-v1:${key}`).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; }
async function main() {
  const client = await pool.connect();
  try {
    const identity = await client.query("SELECT current_database() AS name, count(*) FILTER (WHERE email NOT LIKE '%@example.invalid')::int AS unexpected FROM restaurantes");
    if (identity.rows[0].name !== 'r3_test_isolated' || identity.rows[0].unexpected !== 0) throw Error('Refusing non-synthetic database');
    await client.query('BEGIN');
    for (const [index, [name, category, dishes]] of menus.entries()) {
      const restaurantId = id(`restaurant:${index}`), categoryId = id(`category:${index}`);
      const email = `demo-${String(index + 1).padStart(2,'0')}@example.invalid`;
      const collision = await client.query('SELECT id, email FROM restaurantes WHERE id=$1 OR email=$2', [restaurantId, email]);
      if (collision.rows.some(row => row.id !== restaurantId || row.email !== email)) throw Error('Restaurant identity collision');
      await client.query("INSERT INTO restaurantes(id,nombre_negocio,descripcion,email,password_hash,nombre_dueno,slug,estado,suscripcion_activa,email_verificado) VALUES($1,$2,'Catálogo sintético DEMO, no es un establecimiento real.',$3,'!demo-login-disabled','DEMO',$4,'aprobado',true,false) ON CONFLICT (id) DO NOTHING", [restaurantId,name,email,`demo-${index + 1}`]);
      await client.query('INSERT INTO categorias_restaurante(id,restaurante_id,nombre) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [categoryId,restaurantId,category]);
      for (const [j, spec] of dishes.entries()) {
        const [dishName, raw] = spec.split('|'), dishId = id(`dish:${index}:${j}`);
        const collisionDish = await client.query('SELECT restaurante_id, nombre FROM platillos WHERE id=$1', [dishId]);
        if (collisionDish.rows.some(row => row.restaurante_id !== restaurantId || row.nombre !== dishName)) throw Error('Dish identity collision');
        await client.query("INSERT INTO platillos(id,restaurante_id,categoria_id,nombre,descripcion,precio,activo,ingredientes_principales,verification_metadata) VALUES($1,$2,$3,$4,$5,$6,true,$7::jsonb,$8::jsonb) ON CONFLICT (id) DO NOTHING", [dishId,restaurantId,categoryId,dishName,`Platillo sintético DEMO de ${category}. No representa un establecimiento real.`, 45 + j * 7, JSON.stringify(raw.split(',')), JSON.stringify({ source: 'synthetic_demo_v1', certified: false })]);
      }
    }
    await client.query('COMMIT');
    const counts = await client.query("SELECT (SELECT count(*)::int FROM restaurantes WHERE email LIKE 'demo-%@example.invalid') AS restaurants, (SELECT count(*)::int FROM platillos WHERE verification_metadata->>'source'='synthetic_demo_v1') AS dishes, (SELECT count(*)::int FROM platillos WHERE verification_metadata->>'source'='synthetic_demo_v1' AND url_imagen IS NOT NULL) AS images");
    console.log(JSON.stringify(counts.rows[0]));
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
