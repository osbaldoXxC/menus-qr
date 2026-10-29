const db = require('../config/db');
const redisClient = require('../config/redis');
const axios = require('axios');
const SubscriptionService = require('../services/subscriptionService');
const { invalidateMenuCache } = require('../services/cacheService');

const createDish = async (req, res) => {
  let { 
    nombre, descripcion, precio, precio_original, categoria_id, categoria, 
    ingredientes_principales, complementos, activo,
    nivel_picante, porcion, etiquetas_dieteticas
  } = req.body;
  const restaurante_id = req.user.id;

  const limiteCheck = await SubscriptionService.canCreatePlatillo(restaurante_id);
  if (!limiteCheck.allowed) {
    return res.status(403).json({ mensaje: limiteCheck.reason });
  }
  
  // Parsear JSON strings si vienen de FormData
  try {
    if (typeof ingredientes_principales === 'string') ingredientes_principales = JSON.parse(ingredientes_principales);
    if (typeof complementos === 'string') complementos = JSON.parse(complementos);
    if (typeof etiquetas_dieteticas === 'string') etiquetas_dieteticas = JSON.parse(etiquetas_dieteticas);
  } catch (e) {
    console.warn('Error parseando JSON en createDish:', e);
  }

  // La URL de la imagen vendrá de multer-s3 si se subió un archivo
  let url_imagen = req.file ? req.file.location : req.body.url_imagen;

  if (req.file && !req.file.isLocal && req.file.location && process.env.CLOUDFRONT_DOMAIN) {
    try {
      const s3Url = new URL(req.file.location);
      url_imagen = `${process.env.CLOUDFRONT_DOMAIN}${s3Url.pathname}`;
    } catch (e) {
      if (req.file.key) {
        url_imagen = `${process.env.CLOUDFRONT_DOMAIN}/${req.file.key}`;
      }
    }
  }

  if (!nombre || !precio) {
    return res.status(400).json({ mensaje: 'Nombre y precio son obligatorios' });
  }

  let final_categoria_id = (categoria_id && categoria_id !== 'undefined' && categoria_id !== 'null') ? categoria_id : null;

  // Si envían nombre de categoría en lugar de ID (como en el frontend actual)
  if (!final_categoria_id && categoria && typeof categoria === 'string' && categoria.trim() !== '') {
    try {
      // Buscar si ya existe la categoría
      const existsRes = await db.query('SELECT id FROM categorias_restaurante WHERE restaurante_id = $1 AND nombre = $2', [restaurante_id, categoria.trim()]);
      
      if (existsRes.rows.length > 0) {
        final_categoria_id = existsRes.rows[0].id;
      } else {
        const limitCheckCat = await SubscriptionService.canCreateCategory(restaurante_id);
        if (!limitCheckCat.allowed) {
          return res.status(403).json({ mensaje: 'No puedes crear más categorías. ' + limitCheckCat.reason });
        }
        
        // Crear la nueva categoría
        const catRes = await db.query(
          'INSERT INTO categorias_restaurante (restaurante_id, nombre) VALUES ($1, $2) RETURNING id',
          [restaurante_id, categoria.trim()]
        );
        if (catRes.rows.length > 0) {
          final_categoria_id = catRes.rows[0].id;
        }
      }
    } catch (err) {
      console.error('Error al manejar categoría:', err);
    }
  }

  const cleanPrecioOriginal = (precio_original !== undefined && precio_original !== null && precio_original !== '' && !isNaN(Number(precio_original)) && Number(precio_original) > 0)
    ? Number(precio_original)
    : null;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insertar el platillo
    const dishRes = await client.query(
      `INSERT INTO platillos (restaurante_id, nombre, descripcion, precio, precio_original, categoria_id, url_imagen, activo, estado_ia, ingredientes_principales, complementos, nivel_picante, porcion, etiquetas_dieteticas) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente', $9, $10, $11, $12, $13) 
       RETURNING id`,
      [
        restaurante_id, 
        nombre, 
        descripcion, 
        precio, 
        cleanPrecioOriginal,
        final_categoria_id, 
        url_imagen, 
        activo !== undefined ? (activo === 'true' || activo === true) : true,
        JSON.stringify(ingredientes_principales || []),
        JSON.stringify(complementos || []),
        Number(nivel_picante) || 0,
        porcion || '',
        JSON.stringify(etiquetas_dieteticas || [])
      ]
    );

    await client.query('COMMIT');

    // 2. Invalidar caché sincrónicamente (UUID y slug)
    await invalidateMenuCache(restaurante_id);
    await redisClient.del('cache:busquedas_globales');

    res.status(201).json({
      mensaje: 'Platillo creado correctamente',
      platillo_id: dishRes.rows[0].id
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear platillo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const updateDish = async (req, res) => {
  const { id } = req.params;
  let { 
    nombre, descripcion, precio, precio_original, categoria_id, categoria,
    ingredientes_principales, complementos, activo,
    nivel_picante, porcion, etiquetas_dieteticas
  } = req.body;
  const restaurante_id = req.user.id;

  // Parsear JSON strings si vienen de FormData
  try {
    if (typeof ingredientes_principales === 'string') ingredientes_principales = JSON.parse(ingredientes_principales);
    if (typeof complementos === 'string') complementos = JSON.parse(complementos);
    if (typeof etiquetas_dieteticas === 'string') etiquetas_dieteticas = JSON.parse(etiquetas_dieteticas);
  } catch (e) {
    console.warn('Error parseando JSON en updateDish:', e);
  }

  // URL de imagen (si se sube nueva)
  let url_imagen = req.file ? req.file.location : req.body.url_imagen;

  if (req.file && !req.file.isLocal && req.file.location && process.env.CLOUDFRONT_DOMAIN) {
    try {
      const s3Url = new URL(req.file.location);
      url_imagen = `${process.env.CLOUDFRONT_DOMAIN}${s3Url.pathname}`;
    } catch (e) {
      if (req.file.key) {
        url_imagen = `${process.env.CLOUDFRONT_DOMAIN}/${req.file.key}`;
      }
    }
  }

  // Manejar categoría por nombre si se envía
  let final_categoria_id = (categoria_id && categoria_id !== 'undefined' && categoria_id !== 'null') ? categoria_id : null;
  if (!final_categoria_id && categoria && typeof categoria === 'string' && categoria.trim() !== '') {
    const catRes = await db.query(
      'INSERT INTO categorias_restaurante (restaurante_id, nombre) VALUES ($1, $2) ON CONFLICT (restaurante_id, nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id',
      [restaurante_id, categoria.trim()]
    );
    if (catRes.rows.length > 0) {
      final_categoria_id = catRes.rows[0].id;
    }
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Actualizar platillo
    const updateQuery = `
      UPDATE platillos 
      SET nombre = COALESCE($1, nombre),
          descripcion = COALESCE($2, descripcion),
          precio = COALESCE($3, precio),
          precio_original = CASE WHEN $4::text = 'CLEAR' THEN NULL WHEN $4 IS NOT NULL THEN $4::numeric ELSE precio_original END,
          categoria_id = COALESCE($5, categoria_id),
          url_imagen = COALESCE($6, url_imagen),
          activo = COALESCE($7, activo),
          ingredientes_principales = COALESCE($8, ingredientes_principales),
          complementos = COALESCE($9, complementos),
          nivel_picante = COALESCE($10, nivel_picante),
          porcion = COALESCE($11, porcion),
          etiquetas_dieteticas = COALESCE($12, etiquetas_dieteticas)
      WHERE id = $13 AND restaurante_id = $14
      RETURNING id
    `;

    let precioOriginalParam = null;
    if (precio_original !== undefined) {
      if (precio_original === '' || precio_original === null || Number(precio_original) <= 0) {
        precioOriginalParam = 'CLEAR';
      } else if (!isNaN(Number(precio_original))) {
        precioOriginalParam = Number(precio_original);
      }
    }

    const updateValues = [
      nombre, 
      descripcion, 
      precio, 
      precioOriginalParam,
      final_categoria_id, 
      url_imagen, 
      activo !== undefined ? (activo === 'true' || activo === true) : undefined, 
      ingredientes_principales ? JSON.stringify(ingredientes_principales) : null,
      complementos ? JSON.stringify(complementos) : null,
      nivel_picante !== undefined ? Number(nivel_picante) : null,
      porcion !== undefined ? porcion : null,
      etiquetas_dieteticas ? JSON.stringify(etiquetas_dieteticas) : null,
      id, 
      restaurante_id
    ];
    
    const dishRes = await client.query(updateQuery, updateValues);

    if (dishRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Platillo no encontrado o no tienes permisos' });
    }

    await client.query('COMMIT');
    await invalidateMenuCache(restaurante_id);

    res.json({ mensaje: 'Platillo actualizado correctamente' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar platillo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const deleteDish = async (req, res) => {
  const { id } = req.params;
  const restaurante_id = req.user.id;

  try {
    const result = await db.query(
      'DELETE FROM platillos WHERE id = $1 AND restaurante_id = $2 RETURNING id',
      [id, restaurante_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Platillo no encontrado o no tienes permisos' });
    }

    await invalidateMenuCache(restaurante_id);

    res.json({ mensaje: 'Platillo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar platillo:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const getPublicMenu = async (req, res) => {
  const { restaurant_id } = req.params;
  const cacheKey = `cache:menu:${restaurant_id}`;

  let cachedMenu = null;
  try {
    // 1. Redis Cache - Aislado para evitar caídas si Redis no responde
    cachedMenu = await redisClient.get(cacheKey);
  } catch (redisError) {
    console.warn(`[Redis Read Error] Error al consultar caché para ${cacheKey}:`, redisError.message);
  }

  if (cachedMenu) {
    return res.json(JSON.parse(cachedMenu));
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurant_id);

    let restRes;
    if (isUuid) {
      restRes = await db.query(
        `SELECT r.id, r.nombre_negocio, r.slug, r.suscripcion_activa, r.plan,
                t.logo_url, t.banner_url, t.color_primario, t.color_fondo, 
                t.fuente_familia, t.layout_type, t.banner_promocional_activo, t.banner_promocional_texto,
                t.config_diseno
         FROM restaurantes r
         LEFT JOIN configuracion_tema t ON r.id = t.restaurante_id
         WHERE r.id = $1`,
        [restaurant_id]
      );
    } else {
      restRes = await db.query(
        `SELECT r.id, r.nombre_negocio, r.slug, r.suscripcion_activa, r.plan,
                t.logo_url, t.banner_url, t.color_primario, t.color_fondo, 
                t.fuente_familia, t.layout_type, t.banner_promocional_activo, t.banner_promocional_texto,
                t.config_diseno
         FROM restaurantes r
         LEFT JOIN configuracion_tema t ON r.id = t.restaurante_id
         WHERE r.slug = $1 OR LOWER(r.nombre_negocio) LIKE LOWER('%' || $1 || '%') OR r.id::text = $1`,
        [restaurant_id]
      );
    }

    if (restRes.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Restaurante no encontrado' });
    }

    const restInfo = restRes.rows[0];
    const realRestaurantId = restInfo.id;

    if (!restInfo.suscripcion_activa) {
      return res.status(403).json({ mensaje: 'Restaurante no disponible temporalmente' });
    }

    // 3. Obtener platillos con sus categorías ordenadas (solo activos)
    const dishesRes = await db.query(
      `SELECT p.id, p.nombre, p.descripcion, p.precio, p.precio_original, p.url_imagen, p.ingredientes_principales, p.complementos, p.nivel_picante, p.porcion, p.etiquetas_dieteticas, c.nombre as categoria_nombre, c.orden as categoria_orden
       FROM platillos p
       LEFT JOIN categorias_restaurante c ON p.categoria_id = c.id
       WHERE p.restaurante_id = $1 AND p.activo = true
       ORDER BY c.orden ASC, c.nombre ASC, p.nombre ASC`,
      [realRestaurantId]
    );

    let configDisenoObj = restInfo.config_diseno;
    if (typeof configDisenoObj === 'string') {
      try {
        configDisenoObj = JSON.parse(configDisenoObj);
      } catch (e) {
        configDisenoObj = {};
      }
    }
    
    // Fallback if not an object
    if (!configDisenoObj || typeof configDisenoObj !== 'object') {
      configDisenoObj = {};
    }

    // Sanitizar respuesta según plan del restaurante (Seguridad del backend)
    const planConfig = SubscriptionService.getPlanConfig(restInfo.plan || 'basico');
    const features = planConfig.features || {};

    if (configDisenoObj.apariencia) {
      const ap = configDisenoObj.apariencia;
      const tieneImagenes = !!(ap.fondo_imagen_horizontal_url || ap.fondo_imagen_vertical_url);

      // Si el tipo no es imagen o ambas imágenes están vacías, purgar URLs residuales
      if (ap.fondo_tipo !== 'imagen' || !tieneImagenes) {
        delete ap.fondo_imagen_url;
        if (!tieneImagenes && ap.fondo_tipo === 'imagen') {
          ap.fondo_tipo = 'solido';
        }
      }

      if (!features.imagen_fondo) {
        delete ap.fondo_imagen_url;
        delete ap.fondo_imagen_horizontal_url;
        delete ap.fondo_imagen_vertical_url;
        if (ap.fondo_tipo === 'imagen') {
          ap.fondo_tipo = 'solido';
        }
      }
      
      if (!features.configuracion_diseno) {
        delete ap.border_radius_botones;
        delete ap.border_radius_tarjetas;
      }
    }

    if (configDisenoObj.elementos_visuales && !features.configuracion_diseno) {
      delete configDisenoObj.elementos_visuales.glassmorphism;
      delete configDisenoObj.elementos_visuales.sombras_habilitadas;
    }


    // 4. Estructurar la respuesta
    const response = {
      restaurante: {
        nombre: restInfo.nombre_negocio,
        tema: {
          logo_url: restInfo.logo_url,
          banner_url: restInfo.banner_url,
          color_primario: restInfo.color_primario,
          color_fondo: restInfo.color_fondo,
          fuente_familia: restInfo.fuente_familia,
          layout_type: restInfo.layout_type,
          banner_promocional_activo: restInfo.banner_promocional_activo,
          banner_promocional_texto: restInfo.banner_promocional_texto,
          config_diseno: configDisenoObj
        }
      },
      categorias: []
    };

    // Agrupar por categorías
    const categoriesMap = {};
    dishesRes.rows.forEach(dish => {
      const catName = dish.categoria_nombre || 'General';
      if (!categoriesMap[catName]) {
        categoriesMap[catName] = {
          nombre: catName,
          platillos: []
        };
        response.categorias.push(categoriesMap[catName]);
      }
      response.categorias.find(c => c.nombre === catName).platillos.push({
        id: dish.id,
        nombre: dish.nombre,
        descripcion: dish.descripcion,
        precio: dish.precio,
        precio_original: dish.precio_original ? Number(dish.precio_original) : null,
        url_imagen: dish.url_imagen,
        ingredientes_principales: dish.ingredientes_principales,
        complementos: dish.complementos,
        nivel_picante: dish.nivel_picante || 0,
        porcion: dish.porcion || '',
        etiquetas_dieteticas: dish.etiquetas_dieteticas || []
      });
    });

    // 5. Guardar en Redis (4h) - Sincronizado para UUID y slug
    try {
      const serialized = JSON.stringify(response);
      await redisClient.setEx(cacheKey, 14400, serialized);
      if (restInfo.slug && cacheKey !== `cache:menu:${restInfo.slug}`) {
        await redisClient.setEx(`cache:menu:${restInfo.slug}`, 14400, serialized);
      }
      if (cacheKey !== `cache:menu:${realRestaurantId}`) {
        await redisClient.setEx(`cache:menu:${realRestaurantId}`, 14400, serialized);
      }
    } catch (redisError) {
      console.warn(`[Redis Write Error] Error al guardar caché para ${cacheKey}:`, redisError.message);
    }

    res.json(response);

  } catch (error) {
    console.error('Error al obtener menú público:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const getDishes = async (req, res) => {
  const restaurante_id = req.user.id;

  try {
    const result = await db.query(
      `SELECT p.id, p.nombre, p.descripcion, p.precio, p.precio_original, p.url_imagen, p.estado_ia, p.activo, p.ingredientes_principales, p.complementos, p.nivel_picante, p.porcion, p.etiquetas_dieteticas, c.nombre as categoria_nombre
       FROM platillos p
       LEFT JOIN categorias_restaurante c ON p.categoria_id = c.id
       WHERE p.restaurante_id = $1
       ORDER BY p.created_at DESC`,
      [restaurante_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener platillos:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const getPublicRecommendations = async (req, res) => {
  try {
    const { restaurant_id } = req.params;
    const { craving = {}, diet = 'none', allergies = [], socialContext = 'solo', limit = 5 } = req.body || {};

    if (!restaurant_id) {
      return res.status(400).json({ mensaje: 'ID de restaurante requerido' });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurant_id);
    let restRes;
    if (isUuid) {
      restRes = await db.query(
        `SELECT id, nombre_negocio, suscripcion_activa, slug FROM restaurantes WHERE id = $1`,
        [restaurant_id]
      );
    } else {
      restRes = await db.query(
        `SELECT id, nombre_negocio, suscripcion_activa, slug FROM restaurantes WHERE slug = $1 OR LOWER(nombre_negocio) LIKE LOWER('%' || $1 || '%') OR id::text = $1`,
        [restaurant_id]
      );
    }

    if (restRes.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Restaurante no encontrado' });
    }

    const restInfo = restRes.rows[0];
    const realRestaurantId = restInfo.id;

    if (!restInfo.suscripcion_activa) {
      return res.status(403).json({ mensaje: 'Restaurante no disponible temporalmente' });
    }

    // Obtener exclusivamente los platillos activos de ESTE restaurante
    const dishesRes = await db.query(
      `SELECT p.id, p.nombre, p.descripcion, p.precio, p.url_imagen, p.activo,
              p.ingredientes_principales, p.complementos, p.nivel_picante, p.porcion, p.etiquetas_dieteticas,
              c.nombre as categoria_nombre
       FROM platillos p
       LEFT JOIN categorias_restaurante c ON p.categoria_id = c.id
       WHERE p.restaurante_id = $1 AND p.activo = true
       ORDER BY p.nombre ASC`,
      [realRestaurantId]
    );

    const candidateDishes = dishesRes.rows;
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const menuSlug = restInfo.slug || realRestaurantId;
    const menuUrl = `${frontendBaseUrl}/menu/${menuSlug}`;

    const mlPayload = {
      restaurant_id: realRestaurantId,
      craving: craving || {},
      diet: diet || 'none',
      allergies: Array.isArray(allergies) ? allergies : [],
      socialContext: socialContext || 'solo',
      limit: parseInt(limit) || 5,
      dishes: candidateDishes,
      restaurant: {
        id: realRestaurantId,
        name: restInfo.nombre_negocio,
        slug: menuSlug,
        menuUrl: menuUrl
      }
    };

    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://ml-service:8000';
    const timeoutMs = parseInt(process.env.ML_SERVICE_TIMEOUT) || 12000;

    try {
      const mlResponse = await axios.post(`${mlServiceUrl}/recommendations`, mlPayload, { timeout: timeoutMs });
      if (mlResponse.data && Array.isArray(mlResponse.data.recommendations)) {
        return res.json(mlResponse.data);
      }
    } catch (mlErr) {
      console.warn(`[ML Service Fallback] Error llamando a Python ML (${mlServiceUrl}):`, mlErr.message);
    }

    // Fallback heurístico en JS si el microservicio Python está inaccesible
    const safeDishes = candidateDishes.filter(d => {
      const text = `${d.nombre} ${d.descripcion} ${(d.ingredientes_principales||[]).join(' ')}`.toLowerCase();
      if (allergies.some(a => text.includes(a.toLowerCase()))) return false;
      return true;
    });

    const recommendations = safeDishes.slice(0, parseInt(limit) || 5).map((d, index) => {
      const score = Math.max(0.70, Number((0.99 - (index * 0.03)).toFixed(2)));
      return {
        dish: {
          id: d.id,
          nombre: d.nombre,
          descripcion: d.descripcion || '',
          precio: parseFloat(d.precio) || 0,
          url_imagen: d.url_imagen || '',
          nivel_picante: d.nivel_picante || 0,
          porcion: d.porcion || '',
          categoria_nombre: d.categoria_nombre || '',
          etiquetas_dieteticas: d.etiquetas_dieteticas || [],
          ingredientes_principales: d.ingredientes_principales || []
        },
        restaurant: {
          id: realRestaurantId,
          name: restInfo.nombre_negocio,
          slug: menuSlug,
          menuUrl: menuUrl
        },
        matchScore: score,
        matchPercentage: Math.round(score * 100),
        reasons: ["⭐ Platillo recomendado especialmente para ti", "✅ Compatible con tus restricciones alimenticias"],
        tags: d.etiquetas_dieteticas || (d.ingredientes_principales ? d.ingredientes_principales.slice(0, 3) : [])
      };
    });

    return res.json({
      recommendations,
      meta: {
        restaurant_id: realRestaurantId,
        totalCandidates: candidateDishes.length,
        recommendedCount: recommendations.length,
        fallback: true
      }
    });

  } catch (error) {
    console.error('Error en getPublicRecommendations:', error);
    res.status(500).json({ mensaje: 'Error procesando recomendaciones' });
  }
};

const getGlobalRecommendations = async (req, res) => {
  try {
    const { craving = {}, diet = 'none', allergies = [], socialContext = 'solo', limit = 6 } = req.body || {};

    // Obtener platillos activos de TODOS los restaurantes con suscripción activa
    const dishesRes = await db.query(
      `SELECT p.id, p.nombre, p.descripcion, p.precio, p.url_imagen, p.activo,
              p.ingredientes_principales, p.complementos, p.nivel_picante, p.porcion, p.etiquetas_dieteticas,
              c.nombre as categoria_nombre,
              r.id as restaurante_id, r.nombre_negocio as restaurante_nombre, r.slug as restaurante_slug
       FROM platillos p
       JOIN restaurantes r ON p.restaurante_id = r.id
       LEFT JOIN categorias_restaurante c ON p.categoria_id = c.id
       WHERE p.activo = true AND r.suscripcion_activa = true
       ORDER BY p.created_at DESC`
    );

    const candidateDishes = dishesRes.rows;
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const dishesWithRestInfo = candidateDishes.map(d => {
      const slug = d.restaurante_slug || d.restaurante_id;
      return {
        ...d,
        restaurante_id: d.restaurante_id,
        restaurante_nombre: d.restaurante_nombre,
        restaurante_slug: slug,
        menuUrl: `${frontendBaseUrl}/menu/${slug}`
      };
    });

    const mlPayload = {
      restaurant_id: 'global',
      craving: craving || {},
      diet: diet || 'none',
      allergies: Array.isArray(allergies) ? allergies : [],
      socialContext: socialContext || 'solo',
      limit: parseInt(limit) || 6,
      dishes: dishesWithRestInfo
    };

    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://ml-service:8000';
    const timeoutMs = parseInt(process.env.ML_SERVICE_TIMEOUT) || 12000;

    try {
      const mlResponse = await axios.post(`${mlServiceUrl}/recommendations`, mlPayload, { timeout: timeoutMs });
      if (mlResponse.data && Array.isArray(mlResponse.data.recommendations)) {
        return res.json(mlResponse.data);
      }
    } catch (mlErr) {
      console.warn(`[ML Service Fallback Global] Error llamando a Python ML (${mlServiceUrl}):`, mlErr.message);
    }

    // Fallback heurístico global si el microservicio Python no responde
    const safeDishes = dishesWithRestInfo.filter(d => {
      const text = `${d.nombre} ${d.descripcion} ${(d.ingredientes_principales||[]).join(' ')}`.toLowerCase();
      if (allergies.some(a => text.includes(a.toLowerCase()))) return false;
      return true;
    });

    const recommendations = safeDishes.slice(0, parseInt(limit) || 6).map((d, index) => {
      const score = Math.max(0.70, Number((0.99 - (index * 0.03)).toFixed(2)));
      return {
        dish: {
          id: d.id,
          nombre: d.nombre,
          descripcion: d.descripcion || '',
          precio: parseFloat(d.precio) || 0,
          url_imagen: d.url_imagen || '',
          nivel_picante: d.nivel_picante || 0,
          porcion: d.porcion || '',
          categoria_nombre: d.categoria_nombre || '',
          etiquetas_dieteticas: d.etiquetas_dieteticas || [],
          ingredientes_principales: d.ingredientes_principales || []
        },
        restaurant: {
          id: d.restaurante_id,
          name: d.restaurante_nombre,
          slug: d.restaurante_slug,
          menuUrl: d.menuUrl
        },
        matchScore: score,
        matchPercentage: Math.round(score * 100),
        reasons: ["⭐ Platillo recomendado para tu antojo", "✅ Compatible con tus restricciones alimenticias"],
        tags: d.etiquetas_dieteticas || (d.ingredientes_principales ? d.ingredientes_principales.slice(0, 3) : [])
      };
    });

    return res.json({
      recommendations,
      meta: {
        restaurant_id: 'global',
        totalCandidates: candidateDishes.length,
        recommendedCount: recommendations.length,
        fallback: true
      }
    });

  } catch (error) {
    console.error('Error en getGlobalRecommendations:', error);
    res.status(500).json({ mensaje: 'Error procesando recomendaciones globales' });
  }
};

module.exports = {
  createDish,
  updateDish,
  deleteDish,
  getPublicMenu,
  getDishes,
  getPublicRecommendations,
  getGlobalRecommendations
};