const db = require('../config/db');
const redisClient = require('../config/redis');
const axios = require('axios');
const SubscriptionService = require('../services/subscriptionService');
const { invalidateMenuCache } = require('../services/cacheService');
const {
  normalizeRecommendationRequest,
  buildValidationErrorResponse,
  buildRecommendationSuccessResponse,
  buildHttpErrorEnvelope,
  DISCLAIMER
} = require('../validators/recommendationRequest');
const { consolidateRestrictions } = require('../services/restrictionConsolidation');
const { selectRelevantFood } = require('../services/primaryFoodRelevance');
const { currencyVerified, priceCents } = require('../services/catalogEvidence');
const { enrichCandidates } = require('../repositories/catalogEvidenceRepository');
const {
  evaluateEligibility,
  localMxnBudgetEnabled,
  buildSafeFallbackRecommendations
} = require('../services/eligibilityService');
const {
  computeRecipeVersion,
  buildConservativeVerificationMetadata,
  getVerificationMetadata,
  evaluateCompleteness,
  evaluateVerificationStatus,
  evaluateCrossContamination,
  evaluateAllergenForDish,
  collectAllRelevantIngredientEntries,
  resolveCompound,
  ALLERGEN_STATES,
  COMPLETENESS_STATES,
  VERIFICATION_STATES,
  CROSS_CONTAMINATION_STATES
} = require('../services/catalogVerification');

const DISH_RECIPE_COLUMNS = [
  'id', 'restaurante_id', 'nombre', 'descripcion', 'precio', 'precio_original',
  'url_imagen', 'activo', 'ingredientes_principales', 'complementos',
  'ingredientes_secundarios', 'salsas', 'aderezos', 'condimentos', 'ingredientes_compuestos',
  'sustituciones_permitidas', 'modificadores_opcionales', 'alergenos_declarados', 'contacto_cruzado',
  'nivel_picante', 'porcion', 'etiquetas_dieteticas',
  'verification_metadata', 'verification_state', 'completeness_state', 'cross_contamination_state',
  'verified_recipe_version', 'current_recipe_version', 'verified_by', 'verified_at', 'verification_source', 'verification_updated_at'
];

function parseJsonMaybe(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return fallback;
    try { return JSON.parse(t); } catch (e) { return fallback; }
  }
  return value;
}

function normalizeDishForEvaluation(row) {
  const dish = { ...(row || {}) };
  const arrayFields = [
    'ingredientes_principales', 'complementos', 'etiquetas_dieteticas',
    'ingredientes_secundarios', 'salsas', 'aderezos', 'condimentos', 'ingredientes_compuestos',
    'sustituciones_permitidas', 'modificadores_opcionales', 'alergenos_declarados'
  ];
  arrayFields.forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(dish, f)) {
      const parsed = parseJsonMaybe(dish[f], []);
      dish[f] = Array.isArray(parsed) ? parsed : (parsed == null ? [] : [parsed]);
    }
  });
  // Object fields (not arrays)
  ['contacto_cruzado', 'verification_metadata'].forEach((f) => {
    if (Object.prototype.hasOwnProperty.call(dish, f)) {
      const parsed = parseJsonMaybe(dish[f], null);
      dish[f] = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
    } else {
      dish[f] = null;
    }
  });
  // Conservative defaults for historical records: no auto-verify, never assume completeness
  if (!dish.verification_metadata || typeof dish.verification_metadata !== 'object') {
    dish.verification_metadata = null;
  }
  return dish;
}

async function getDishColumnSet(clientOrDb) {
  const q = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'platillos'`;
  const res = await clientOrDb.query(q);
  return new Set(res.rows.map((r) => r.column_name));
}

function buildRecipeSnapshot(body, existing, verificationMeta, actor) {
  const src = { ...(existing || {}), ...(body || {}) };
  const nowVersionDish = {
    nombre: src.nombre,
    descripcion: src.descripcion,
    ingredientes_principales: src.ingredientes_principales || [],
    ingredientes_secundarios: src.ingredientes_secundarios || [],
    complementos: src.complementos || [],
    salsas: src.salsas || [],
    aderezos: src.aderezos || [],
    condimentos: src.condimentos || [],
    ingredientes_compuestos: src.ingredientes_compuestos || [],
    sustituciones_permitidas: src.sustituciones_permitidas || [],
    modificadores_opcionales: src.modificadores_opcionales || [],
    etiquetas_dieteticas: src.etiquetas_dieteticas || [],
    alergenos_declarados: src.alergenos_declarados || [],
    contacto_cruzado: src.contacto_cruzado || null,
    nivel_picante: src.nivel_picante,
    porcion: src.porcion
  };
  const previousMeta = getVerificationMetadata(existing || {});
  const previousVerifiedVersion = previousMeta ? (previousMeta.verifiedRecipeVersion || null) : null;
  const previousState = previousMeta ? (previousMeta.verificationState || existing && existing.verification_state || null) : (existing ? existing.verification_state : null);
  const { meta, currentVersion, state } = buildConservativeVerificationMetadata(verificationMeta, nowVersionDish, actor, {
    invalidatedFrom: !!previousVerifiedVersion || previousState === 'verified_approved',
    previousVerifiedRecipeVersion: previousVerifiedVersion,
    invalidationReason: 'recipe_or_catalog_data_changed'
  });
  return {
    snapshot: nowVersionDish,
    verification_metadata: meta,
    current_recipe_version: currentVersion,
    verification_state: state,
    previousVerifiedVersion,
    previousState
  };
}

async function insertVerificationAudit(client, { platilloId, restauranteId, accion, estadoAnterior, estadoNuevo, actorId, actorRol, motivo }) {
  try {
    await client.query(
      `INSERT INTO platillo_verificacion_auditoria
        (platillo_id, restaurante_id, accion, estado_anterior, estado_nuevo, actor_id, actor_rol, motivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        platilloId,
        restauranteId,
        accion,
        estadoAnterior ? JSON.stringify(estadoAnterior) : null,
        estadoNuevo ? JSON.stringify(estadoNuevo) : null,
        actorId || null,
        actorRol || null,
        motivo || null
      ]
    );
  } catch (e) {
    // Audit table may not exist yet if migration not applied; do not block core operation.
    console.warn('[B1-T04] No se pudo registrar auditorÃ­a de verificaciÃ³n:', e.message);
  }
}

const createDish = async (req, res) => {
  let { 
    nombre, descripcion, precio, precio_original, categoria_id, categoria, 
    ingredientes_principales, complementos, activo,
    nivel_picante, porcion, etiquetas_dieteticas,
    ingredientes_secundarios, salsas, aderezos, condimentos, ingredientes_compuestos,
    sustituciones_permitidas, modificadores_opcionales, alergenos_declarados, contacto_cruzado,
    verification_metadata
  } = req.body;
  const restaurante_id = req.user.id;

  const limiteCheck = await SubscriptionService.canCreatePlatillo(restaurante_id);
  if (!limiteCheck.allowed) {
    return res.status(403).json({ mensaje: limiteCheck.reason });
  }
  
  // Parsear JSON strings si vienen de FormData
  try {
    const jsonFields = [
      'ingredientes_principales','complementos','etiquetas_dieteticas',
      'ingredientes_secundarios','salsas','aderezos','condimentos','ingredientes_compuestos',
      'sustituciones_permitidas','modificadores_opcionales','alergenos_declarados','contacto_cruzado',
      'verification_metadata'
    ];
    jsonFields.forEach((f) => {
      if (typeof req.body[f] === 'string') {
        try { req.body[f] = JSON.parse(req.body[f]); } catch (e) {}
      }
    });
    ingredientes_principales = req.body.ingredientes_principales;
    complementos = req.body.complementos;
    etiquetas_dieteticas = req.body.etiquetas_dieteticas;
    ingredientes_secundarios = req.body.ingredientes_secundarios;
    salsas = req.body.salsas;
    aderezos = req.body.aderezos;
    condimentos = req.body.condimentos;
    ingredientes_compuestos = req.body.ingredientes_compuestos;
    sustituciones_permitidas = req.body.sustituciones_permitidas;
    modificadores_opcionales = req.body.modificadores_opcionales;
    alergenos_declarados = req.body.alergenos_declarados;
    contacto_cruzado = req.body.contacto_cruzado;
    verification_metadata = req.body.verification_metadata;
  } catch (e) {
    console.warn('Error parseando JSON en createDish:', e);
  }

  // La URL de la imagen vendrÃ¡ de multer-s3 si se subiÃ³ un archivo
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

  // Si envÃ­an nombre de categorÃ­a en lugar de ID (como en el frontend actual)
  if (!final_categoria_id && categoria && typeof categoria === 'string' && categoria.trim() !== '') {
    try {
      // Buscar si ya existe la categorÃ­a
      const existsRes = await db.query('SELECT id FROM categorias_restaurante WHERE restaurante_id = $1 AND nombre = $2', [restaurante_id, categoria.trim()]);
      
      if (existsRes.rows.length > 0) {
        final_categoria_id = existsRes.rows[0].id;
      } else {
        const limitCheckCat = await SubscriptionService.canCreateCategory(restaurante_id);
        if (!limitCheckCat.allowed) {
          return res.status(403).json({ mensaje: 'No puedes crear mÃ¡s categorÃ­as. ' + limitCheckCat.reason });
        }
        
        // Crear la nueva categorÃ­a
        const catRes = await db.query(
          'INSERT INTO categorias_restaurante (restaurante_id, nombre) VALUES ($1, $2) RETURNING id',
          [restaurante_id, categoria.trim()]
        );
        if (catRes.rows.length > 0) {
          final_categoria_id = catRes.rows[0].id;
        }
      }
    } catch (err) {
      console.error('Error al manejar categorÃ­a:', err);
    }
  }

  const cleanPrecioOriginal = (precio_original !== undefined && precio_original !== null && precio_original !== '' && !isNaN(Number(precio_original)) && Number(precio_original) > 0)
    ? Number(precio_original)
    : null;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const recipeBody = {
      nombre, descripcion,
      ingredientes_principales: Array.isArray(ingredientes_principales) ? ingredientes_principales : [],
      complementos: Array.isArray(complementos) ? complementos : [],
      ingredientes_secundarios: Array.isArray(ingredientes_secundarios) ? ingredientes_secundarios : [],
      salsas: Array.isArray(salsas) ? salsas : [],
      aderezos: Array.isArray(aderezos) ? aderezos : [],
      condimentos: Array.isArray(condimentos) ? condimentos : [],
      ingredientes_compuestos: Array.isArray(ingredientes_compuestos) ? ingredientes_compuestos : [],
      sustituciones_permitidas: Array.isArray(sustituciones_permitidas) ? sustituciones_permitidas : [],
      modificadores_opcionales: Array.isArray(modificadores_opcionales) ? modificadores_opcionales : [],
      etiquetas_dieteticas: Array.isArray(etiquetas_dieteticas) ? etiquetas_dieteticas : [],
      alergenos_declarados: Array.isArray(alergenos_declarados) ? alergenos_declarados : [],
      contacto_cruzado: contacto_cruzado || null,
      nivel_picante: Number(nivel_picante) || 0,
      porcion: porcion || ''
    };
    // B1-T04: never auto-verify; historical/new records start conservative
    const ver = buildRecipeSnapshot(recipeBody, null, verification_metadata, { id: req.user.id, rol: req.user.rol });

    const cols = await getDishColumnSet(client);
    const insertCols = ['restaurante_id','nombre','descripcion','precio','precio_original','categoria_id','url_imagen','activo','estado_ia','ingredientes_principales','complementos','nivel_picante','porcion','etiquetas_dieteticas'];
    const insertVals = [
      restaurante_id,
      nombre,
      descripcion,
      precio,
      cleanPrecioOriginal,
      final_categoria_id,
      url_imagen,
      activo !== undefined ? (activo === 'true' || activo === true) : true,
      'pendiente',
      JSON.stringify(recipeBody.ingredientes_principales || []),
      JSON.stringify(recipeBody.complementos || []),
      Number(nivel_picante) || 0,
      porcion || '',
      JSON.stringify(recipeBody.etiquetas_dieteticas || [])
    ];

    const addIf = (col, val) => {
      if (cols.has(col)) { insertCols.push(col); insertVals.push(val); }
    };
    addIf('ingredientes_secundarios', JSON.stringify(recipeBody.ingredientes_secundarios || []));
    addIf('salsas', JSON.stringify(recipeBody.salsas || []));
    addIf('aderezos', JSON.stringify(recipeBody.aderezos || []));
    addIf('condimentos', JSON.stringify(recipeBody.condimentos || []));
    addIf('ingredientes_compuestos', JSON.stringify(recipeBody.ingredientes_compuestos || []));
    addIf('sustituciones_permitidas', JSON.stringify(recipeBody.sustituciones_permitidas || []));
    addIf('modificadores_opcionales', JSON.stringify(recipeBody.modificadores_opcionales || []));
    addIf('alergenos_declarados', JSON.stringify(recipeBody.alergenos_declarados || []));
    addIf('contacto_cruzado', recipeBody.contacto_cruzado ? JSON.stringify(recipeBody.contacto_cruzado) : null);
    addIf('verification_metadata', JSON.stringify(ver.verification_metadata || {}));
    addIf('verification_state', ver.verification_state || 'declared_unverified');
    addIf('completeness_state', (ver.verification_metadata && ver.verification_metadata.completeness) ? 'pending_verification' : 'incomplete');
    addIf('cross_contamination_state', (ver.verification_metadata && ver.verification_metadata.crossContamination && ver.verification_metadata.crossContamination.status) ? ver.verification_metadata.crossContamination.status : 'not_assessed');
    addIf('current_recipe_version', ver.current_recipe_version || null);
    addIf('verified_recipe_version', null);
    addIf('verified_by', null);
    addIf('verified_at', null);
    addIf('verification_source', (ver.verification_metadata && ver.verification_metadata.verificationSource) ? ver.verification_metadata.verificationSource : null);
    addIf('verification_updated_at', new Date().toISOString());

    const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
    const dishRes = await client.query(
      `INSERT INTO platillos (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      insertVals
    );

    const newId = dishRes.rows[0].id;
    await insertVerificationAudit(client, {
      platilloId: newId,
      restauranteId: restaurante_id,
      accion: 'create_conservative_unverified',
      estadoAnterior: null,
      estadoNuevo: { verification_state: ver.verification_state, current_recipe_version: ver.current_recipe_version },
      actorId: req.user.id,
      actorRol: req.user.rol,
      motivo: 'CreaciÃ³n de platillo: estado de verificaciÃ³n conservador (no auto-verificado)'
    });

    await client.query('COMMIT');

    // 2. Invalidar cachÃ© sincrÃ³nicamente (UUID y slug)
    await invalidateMenuCache(restaurante_id);
    await redisClient.del('cache:busquedas_globales');

    res.status(201).json({
      mensaje: 'Platillo creado correctamente',
      platillo_id: newId
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
    nivel_picante, porcion, etiquetas_dieteticas,
    ingredientes_secundarios, salsas, aderezos, condimentos, ingredientes_compuestos,
    sustituciones_permitidas, modificadores_opcionales, alergenos_declarados, contacto_cruzado,
    verification_metadata
  } = req.body;
  const restaurante_id = req.user.id;

  // Parsear JSON strings si vienen de FormData
  try {
    const jsonFields = [
      'ingredientes_principales','complementos','etiquetas_dieteticas',
      'ingredientes_secundarios','salsas','aderezos','condimentos','ingredientes_compuestos',
      'sustituciones_permitidas','modificadores_opcionales','alergenos_declarados','contacto_cruzado',
      'verification_metadata'
    ];
    jsonFields.forEach((f) => {
      if (typeof req.body[f] === 'string') {
        try { req.body[f] = JSON.parse(req.body[f]); } catch (e) {}
      }
    });
    ingredientes_principales = req.body.ingredientes_principales;
    complementos = req.body.complementos;
    etiquetas_dieteticas = req.body.etiquetas_dieteticas;
    ingredientes_secundarios = req.body.ingredientes_secundarios;
    salsas = req.body.salsas;
    aderezos = req.body.aderezos;
    condimentos = req.body.condimentos;
    ingredientes_compuestos = req.body.ingredientes_compuestos;
    sustituciones_permitidas = req.body.sustituciones_permitidas;
    modificadores_opcionales = req.body.modificadores_opcionales;
    alergenos_declarados = req.body.alergenos_declarados;
    contacto_cruzado = req.body.contacto_cruzado;
    verification_metadata = req.body.verification_metadata;
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

  // Manejar categorÃ­a por nombre si se envÃ­a
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

    const cols = await getDishColumnSet(client);
    const existingRes = await client.query(`SELECT * FROM platillos WHERE id = $1 AND restaurante_id = $2 FOR UPDATE`, [id, restaurante_id]);
    if (existingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Platillo no encontrado o no tienes permisos' });
    }
    const existing = existingRes.rows[0];

    let precioOriginalParam = null;
    if (precio_original !== undefined) {
      if (precio_original === '' || precio_original === null || Number(precio_original) <= 0) {
        precioOriginalParam = 'CLEAR';
      } else if (!isNaN(Number(precio_original))) {
        precioOriginalParam = Number(precio_original);
      }
    }

    const mergedForVersion = {
      ...existing,
      nombre: nombre !== undefined ? nombre : existing.nombre,
      descripcion: descripcion !== undefined ? descripcion : existing.descripcion,
      ingredientes_principales: ingredientes_principales !== undefined ? ingredientes_principales : parseJsonMaybe(existing.ingredientes_principales, []),
      complementos: complementos !== undefined ? complementos : parseJsonMaybe(existing.complementos, []),
      ingredientes_secundarios: ingredientes_secundarios !== undefined ? ingredientes_secundarios : parseJsonMaybe(existing.ingredientes_secundarios, []),
      salsas: salsas !== undefined ? salsas : parseJsonMaybe(existing.salsas, []),
      aderezos: aderezos !== undefined ? aderezos : parseJsonMaybe(existing.aderezos, []),
      condimentos: condimentos !== undefined ? condimentos : parseJsonMaybe(existing.condimentos, []),
      ingredientes_compuestos: ingredientes_compuestos !== undefined ? ingredientes_compuestos : parseJsonMaybe(existing.ingredientes_compuestos, []),
      sustituciones_permitidas: sustituciones_permitidas !== undefined ? sustituciones_permitidas : parseJsonMaybe(existing.sustituciones_permitidas, []),
      modificadores_opcionales: modificadores_opcionales !== undefined ? modificadores_opcionales : parseJsonMaybe(existing.modificadores_opcionales, []),
      etiquetas_dieteticas: etiquetas_dieteticas !== undefined ? etiquetas_dieteticas : parseJsonMaybe(existing.etiquetas_dieteticas, []),
      alergenos_declarados: alergenos_declarados !== undefined ? alergenos_declarados : parseJsonMaybe(existing.alergenos_declarados, []),
      contacto_cruzado: contacto_cruzado !== undefined ? contacto_cruzado : parseJsonMaybe(existing.contacto_cruzado, null),
      nivel_picante: nivel_picante !== undefined ? Number(nivel_picante) : existing.nivel_picante,
      porcion: porcion !== undefined ? porcion : existing.porcion
    };

    // B1-T04: any recipe/catalog-relevant update invalidates previous verification (no automatic inheritance)
    const ver = buildRecipeSnapshot(mergedForVersion, existing, verification_metadata !== undefined ? verification_metadata : getVerificationMetadata(existing), { id: req.user.id, rol: req.user.rol });

    const sets = [];
    const values = [];
    let idx = 1;
    const addSet = (sqlFragment, value) => { sets.push(sqlFragment.replace(/\$\{idx\}/g, `$${idx}`)); values.push(value); idx++; };

    addSet(`nombre = COALESCE(\${idx}, nombre)`, nombre);
    addSet(`descripcion = COALESCE(\${idx}, descripcion)`, descripcion);
    addSet(`precio = COALESCE(\${idx}, precio)`, precio);
    sets.push(`precio_original = CASE WHEN $${idx}::text = 'CLEAR' THEN NULL WHEN $${idx} IS NOT NULL THEN $${idx}::numeric ELSE precio_original END`);
    values.push(precioOriginalParam); idx++;
    addSet(`categoria_id = COALESCE(\${idx}, categoria_id)`, final_categoria_id);
    addSet(`url_imagen = COALESCE(\${idx}, url_imagen)`, url_imagen);
    addSet(`activo = COALESCE(\${idx}, activo)`, activo !== undefined ? (activo === 'true' || activo === true) : undefined);
    addSet(`ingredientes_principales = COALESCE(\${idx}, ingredientes_principales)`, ingredientes_principales ? JSON.stringify(ingredientes_principales) : null);
    addSet(`complementos = COALESCE(\${idx}, complementos)`, complementos ? JSON.stringify(complementos) : null);
    addSet(`nivel_picante = COALESCE(\${idx}, nivel_picante)`, nivel_picante !== undefined ? Number(nivel_picante) : null);
    addSet(`porcion = COALESCE(\${idx}, porcion)`, porcion !== undefined ? porcion : null);
    addSet(`etiquetas_dieteticas = COALESCE(\${idx}, etiquetas_dieteticas)`, etiquetas_dieteticas ? JSON.stringify(etiquetas_dieteticas) : null);

    const addOpt = (col, val) => { if (cols.has(col)) { sets.push(`${col} = COALESCE($${idx}, ${col})`); values.push(val); idx++; } };
    addOpt('ingredientes_secundarios', ingredientes_secundarios ? JSON.stringify(ingredientes_secundarios) : null);
    addOpt('salsas', salsas ? JSON.stringify(salsas) : null);
    addOpt('aderezos', aderezos ? JSON.stringify(aderezos) : null);
    addOpt('condimentos', condimentos ? JSON.stringify(condimentos) : null);
    addOpt('ingredientes_compuestos', ingredientes_compuestos ? JSON.stringify(ingredientes_compuestos) : null);
    addOpt('sustituciones_permitidas', sustituciones_permitidas ? JSON.stringify(sustituciones_permitidas) : null);
    addOpt('modificadores_opcionales', modificadores_opcionales ? JSON.stringify(modificadores_opcionales) : null);
    addOpt('alergenos_declarados', alergenos_declarados ? JSON.stringify(alergenos_declarados) : null);
    if (cols.has('contacto_cruzado')) { sets.push(`contacto_cruzado = COALESCE($${idx}, contacto_cruzado)`); values.push(contacto_cruzado !== undefined ? JSON.stringify(contacto_cruzado) : null); idx++; }

    // Verification invalidation/versioning (conservative; no auto-verify, no inherited approval)
    if (cols.has('verification_metadata')) { sets.push(`verification_metadata = $${idx}`); values.push(JSON.stringify(ver.verification_metadata || {})); idx++; }
    if (cols.has('verification_state')) { sets.push(`verification_state = $${idx}`); values.push(ver.verification_state || 'declared_unverified'); idx++; }
    if (cols.has('current_recipe_version')) { sets.push(`current_recipe_version = $${idx}`); values.push(ver.current_recipe_version || null); idx++; }
    if (cols.has('verified_recipe_version')) { sets.push(`verified_recipe_version = $${idx}`); values.push(null); idx++; }
    if (cols.has('verified_by')) { sets.push(`verified_by = $${idx}`); values.push(null); idx++; }
    if (cols.has('verified_at')) { sets.push(`verified_at = $${idx}`); values.push(null); idx++; }
    if (cols.has('verification_updated_at')) { sets.push(`verification_updated_at = $${idx}`); values.push(new Date().toISOString()); idx++; }
    if (cols.has('cross_contamination_state')) { sets.push(`cross_contamination_state = $${idx}`); values.push((ver.verification_metadata && ver.verification_metadata.crossContamination && ver.verification_metadata.crossContamination.status) ? ver.verification_metadata.crossContamination.status : 'not_assessed'); idx++; }
    if (cols.has('completeness_state')) { sets.push(`completeness_state = $${idx}`); values.push('pending_verification'); idx++; }

    values.push(id);
    values.push(restaurante_id);
    const updateQuery = `UPDATE platillos SET ${sets.join(', ')} WHERE id = $${idx} AND restaurante_id = $${idx + 1} RETURNING id`;
    const dishRes = await client.query(updateQuery, values);

    if (dishRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Platillo no encontrado o no tienes permisos' });
    }

    await insertVerificationAudit(client, {
      platilloId: id,
      restauranteId: restaurante_id,
      accion: 'update_recipe_invalidated_verification',
      estadoAnterior: {
        verification_state: existing.verification_state || (getVerificationMetadata(existing) ? getVerificationMetadata(existing).verificationState : null),
        verified_recipe_version: existing.verified_recipe_version || null
      },
      estadoNuevo: {
        verification_state: ver.verification_state,
        current_recipe_version: ver.current_recipe_version,
        verified_recipe_version: null
      },
      actorId: req.user.id,
      actorRol: req.user.rol,
      motivo: 'ActualizaciÃ³n de receta/catÃ¡logo: verificaciÃ³n invalidada y pendiente de revisiÃ³n'
    });

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
    // 1. Redis Cache - Aislado para evitar caÃ­das si Redis no responde
    cachedMenu = await redisClient.get(cacheKey);
  } catch (redisError) {
    console.warn(`[Redis Read Error] Error al consultar cachÃ© para ${cacheKey}:`, redisError.message);
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

    // 3. Obtener platillos con sus categorÃ­as ordenadas (solo activos)
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

    // Sanitizar respuesta segÃºn plan del restaurante (Seguridad del backend)
    const planConfig = SubscriptionService.getPlanConfig(restInfo.plan || 'basico');
    const features = planConfig.features || {};

    if (configDisenoObj.apariencia) {
      const ap = configDisenoObj.apariencia;
      const tieneImagenes = !!(ap.fondo_imagen_horizontal_url || ap.fondo_imagen_vertical_url);

      // Si el tipo no es imagen o ambas imÃ¡genes estÃ¡n vacÃ­as, purgar URLs residuales
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

    // Agrupar por categorÃ­as
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
      console.warn(`[Redis Write Error] Error al guardar cachÃ© para ${cacheKey}:`, redisError.message);
    }

    res.json(response);

  } catch (error) {
    console.error('Error al obtener menÃº pÃºblico:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const getDishes = async (req, res) => {
  const restaurante_id = req.user.id;

  try {
    let result;
    try {
      result = await db.query(
        `SELECT p.*, c.nombre as categoria_nombre
         FROM platillos p
         LEFT JOIN categorias_restaurante c ON p.categoria_id = c.id
         WHERE p.restaurante_id = $1
         ORDER BY p.created_at DESC`,
        [restaurante_id]
      );
    } catch (e) {
      // Compatibilidad si migraciÃ³n B1-T04 no aplicada
      result = await db.query(
        `SELECT p.id, p.nombre, p.descripcion, p.precio, p.precio_original, p.url_imagen, p.estado_ia, p.activo, p.ingredientes_principales, p.complementos, p.nivel_picante, p.porcion, p.etiquetas_dieteticas, c.nombre as categoria_nombre
         FROM platillos p
         LEFT JOIN categorias_restaurante c ON p.categoria_id = c.id
         WHERE p.restaurante_id = $1
         ORDER BY p.created_at DESC`,
        [restaurante_id]
      );
    }

    const rows = result.rows.map((r) => {
      const n = normalizeDishForEvaluation(r);
      n.verification_summary = {
        verification_state: r.verification_state || (n.verification_metadata && n.verification_metadata.verificationState) || 'declared_unverified',
        completeness_state: r.completeness_state || null,
        cross_contamination_state: r.cross_contamination_state || null,
        current_recipe_version: r.current_recipe_version || (n.verification_metadata && n.verification_metadata.currentRecipeVersion) || null,
        verified_recipe_version: r.verified_recipe_version || null,
        verified_by: r.verified_by || null,
        verified_at: r.verified_at || null,
        auto_verified: false
      };
      return n;
    });

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener platillos:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const ML_V2_INTERPRET_PATH = '/interpret';
const ML_V2_RANK_PATH = '/rank';

function getMlServiceConfig() {
  const baseUrl = (process.env.ML_SERVICE_URL || 'http://ml-service:8000').replace(/\/+$/, '');
  const timeoutMs = parseInt(process.env.ML_SERVICE_TIMEOUT, 10) || 12000;
  // controlled retries (not unlimited): 0 by default, max 1 when explicitly enabled
  const retries = Math.max(0, Math.min(1, parseInt(process.env.ML_SERVICE_RETRIES || '0', 10) || 0));
  return { baseUrl, timeoutMs, retries };
}

async function callMlV2Post(path, payload, label) {
  const { baseUrl, timeoutMs, retries } = getMlServiceConfig();
  const url = `${baseUrl}${path}`;
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(url, payload, { timeout: timeoutMs, headers: { 'Content-Type': 'application/json' } });
      return { ok: true, data: res.data, attempt };
    } catch (err) {
      lastErr = err;
      const status = err && err.response && err.response.status;
      const retryable = !err.response || status >= 500 || status === 429;
      if (attempt >= retries || !retryable) break;
    }
  }
  console.warn(`[ML V2 ${label}] fallo controlado (${url}):`, lastErr && lastErr.message ? lastErr.message : 'unknown_error');
  return { ok: false, error: lastErr };
}

function sanitizeMlExtractionForConsolidation(extracted, structuredRestrictions, sourceText = '') {
  // Conservative mapping: only corroborate/trace user-provided info; never weaken explicit structured restrictions.
  // Ambiguous/inferred signals are passed conservatively (consolidation keeps desconocido/blocking as designed).
  if (!extracted || typeof extracted !== 'object' || Array.isArray(extracted)) return null;
  const s = structuredRestrictions && typeof structuredRestrictions === 'object' ? structuredRestrictions : {};
  const out = {};

  const sAll = Array.isArray(s.allergies) ? s.allergies.map((v) => String(v).trim().toLowerCase()).filter(Boolean) : [];
  const sDiet = (typeof s.diet === 'string' ? s.diet.trim().toLowerCase() : 'none') || 'none';

  const exAll = Array.isArray(extracted.allergies) ? extracted.allergies.filter((v) => typeof v === 'string' && v.trim()) : [];
  const exExcRaw = [
    ...(Array.isArray(extracted.excludedIngredients) ? extracted.excludedIngredients : []),
    ...(Array.isArray(extracted.exclusions) ? extracted.exclusions : []),
    ...(Array.isArray(extracted.negations) ? extracted.negations : [])
  ].filter((v) => typeof v === 'string' && v.trim());
  const exDiet = (typeof extracted.diet === 'string' ? extracted.diet.trim().toLowerCase() : null);

  // Only include categories that can corroborate structured restrictions or user text-derived explicit exclusions/negations.
  // For categories where structured already states restrictions, include matching extracted values to allow alignment trace;
  // avoid introducing different same-category values that would create false contradictions from noisy extraction.
  if (sAll.length > 0) {
    const keep = exAll.filter((v) => sAll.includes(String(v).trim().toLowerCase()));
    if (keep.length) out.allergies = keep;
  } else if (exAll.length > 0) {
    // text-inferred allergies (no structured): pass conservatively; consolidation treats inferred as verification required/desconocido
    out.allergies = exAll.map((v) => ({ value: v, ambiguous: !!extracted.ambiguous }));
  }

  if (exExcRaw.length > 0) {
    const unique = [...new Set(exExcRaw.map((v) => v.trim().toLowerCase()))];
    out.excludedIngredients = unique.map((value) => ({ value, ambiguous: !!extracted.ambiguous, sourceText }));
  }

  if (sDiet && sDiet !== 'none') {
    if (exDiet && exDiet === sDiet) out.diet = exDiet;
    // if ML extracted different diet, do NOT inject as contradiction here; structured remains authoritative/preserved
  } else if (exDiet && exDiet !== 'none') {
    out.diet = { value: exDiet, ambiguous: !!extracted.ambiguous };
  }

  if (extracted.ambiguous === true) out.ambiguous = true;
  if (extracted.budget && typeof extracted.budget === 'object' && !Array.isArray(extracted.budget)) {
    out.budget = { ...extracted.budget, sourceText };
  }
  if (Object.keys(out).length === 0) return null;
  return out;
}

async function callMlInterpret({ requestId, craving, restrictions, options }) {
  const interpretPayload = {
    requestId,
    craving: craving || { text: '', tags: [] },
    restrictions: restrictions || {},
    options: options || { limit: 5 }
  };
  const interpretRes = await callMlV2Post(ML_V2_INTERPRET_PATH, interpretPayload, 'interpret');
  if (!interpretRes.ok || !interpretRes.data || typeof interpretRes.data !== 'object' || Array.isArray(interpretRes.data)) {
    return { ok: false, extracted: null, mlExtraction: null, meta: { interpretOk: false, reason: 'unavailable_or_invalid' } };
  }
  // strict shape/requestId validation (BE authority): discard malformed or mismatched responses safely
  if (requestId && interpretRes.data.requestId != null && String(interpretRes.data.requestId) !== String(requestId)) {
    return { ok: false, extracted: null, mlExtraction: null, meta: { interpretOk: false, reason: 'request_id_mismatch' } };
  }
  const extracted = (interpretRes.data.extracted && typeof interpretRes.data.extracted === 'object' && !Array.isArray(interpretRes.data.extracted))
    ? interpretRes.data.extracted
    : null;
  if (!extracted) {
    return { ok: false, extracted: null, mlExtraction: null, meta: { interpretOk: false, reason: 'invalid_extracted' } };
  }
  const arrayFields = ['allergies', 'excludedIngredients', 'exclusions', 'negations'];
  if (arrayFields.some((key) => extracted[key] !== undefined && (!Array.isArray(extracted[key]) || extracted[key].some((value) => typeof value !== 'string')))) {
    return { ok: false, extracted: null, mlExtraction: null, meta: { interpretOk: false, reason: 'invalid_extracted' } };
  }
  if (extracted.diet !== undefined && extracted.diet !== null && typeof extracted.diet !== 'string') {
    return { ok: false, extracted: null, mlExtraction: null, meta: { interpretOk: false, reason: 'invalid_extracted' } };
  }
  const mlExtraction = sanitizeMlExtractionForConsolidation(extracted, restrictions, craving && craving.text);
  return { ok: true, extracted, mlExtraction, meta: { interpretOk: true } };
}

function hasOmittedTextExclusion(text, extraction) {
  if (typeof text !== 'string') return false;
  // A monetary phrase is not an ingredient exclusion; other clauses remain checked.
  const foodText = text.replace(/\s+y por menos de\s*\$\d+(?:\.\d{1,2})?[.!]?$/iu, ' ')
    .replace(/\b(?:sin|no\s+quiero)\s+gastar\s+m[aá]s\s+de\s+(?:\d+(?:[.,]\d{1,2})?|cien|ochenta|cincuenta)\s*(?:pesos?|pesitos|varos?|mxn)\b/giu, ' ')
    .replace(/(?<!no\s)\bsin\s+picante\b(?!\s*(?:,|y\b|ni\b|o\b))/giu, ' ');
  const marker = /\b(?:sin|evita(?:r)?|exclu(?:ir|ye)|nada\s+de|libre\s+de|no\s+(?:puedo\s+comer|(?:debe|puede)\s+(?:contener|tener|llevar)|tenga|tiene|contenga|contiene|lleve|lleva|traiga|trae|como|quiero))\s+[\p{L}]/iu;
  if (!marker.test(foodText)) return false;
  const exclusions = extraction && Array.isArray(extraction.excludedIngredients) ? extraction.excludedIngredients : [];
  const allergies = extraction && Array.isArray(extraction.allergies) ? extraction.allergies : [];
  // Compare each explicitly mentioned term with a corresponding ML proposal.
  // If a construction is more complicated than this conservative parser, keep
  // it unknown. Matching aliases are resolved later against reviewed taxonomy.
  const guardedText = foodText.replace(/\b(?:pero|con|para|tengo|cueste)\b/giu, ';');
  const mentions = [...guardedText.matchAll(/\b(?:sin|evita(?:r)?|exclu(?:ir|ye)|nada\s+de|libre\s+de|no\s+(?:puedo\s+comer|(?:debe|puede)\s+(?:contener|tener|llevar)|tenga|tiene|contenga|contiene|lleve|lleva|traiga|trae|como|quiero))\s+([^;.!?]+)/giu)]
    .flatMap(match => match[1].split(/,|\b(?:y|ni|o)\b/iu))
    .map(part => part.trim()).filter(Boolean);
  const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const proposed = [...exclusions, ...allergies].map(item => normalized(typeof item === 'string' ? item : item && item.value));
  return mentions.some(part => {
    const term = normalized(part).replace(/^(?:nada\s+de|ningun[oa]?)\s+/, '').split(/\s+/)[0];
    return !proposed.some(value => value.split(/\s+/)[0] === term);
  });
}

// Explicit "no pique" is not a graded preference: only a declared zero can
// satisfy it. Missing or invalid values are never converted to zero.
function requiresNoSpice(text) {
  return typeof text === 'string' && (/\bno\s+pique\b(?!\s+(?:mucho|demasiado|tanto|muy))/iu.test(text) ||
    /(?<!no\s)\bsin\s+picante\b(?!\s*(?:,|y\b|ni\b|o\b))/iu.test(text));
}

function filterNoSpice(dishes, text) {
  if (!requiresNoSpice(text)) return dishes;
  return dishes.filter(d => typeof d.nivel_picante === 'number' && d.nivel_picante === 0);
}

function hasOmittedTextDiet(text, restrictions, extraction) {
  if (typeof text !== 'string') return false;
  const mentions = [];
  if (/\bvegetarian[oa]s?\b/i.test(text)) mentions.push('vegetarian');
  if (/\bvegan[oa]s?\b/i.test(text)) mentions.push('vegan');
  if (!mentions.length) return false;
  const declared = restrictions && restrictions.diet;
  const proposed = extraction && extraction.diet;
  const value = typeof proposed === 'object' && proposed ? proposed.value : proposed;
  return mentions.some(diet => diet !== declared && diet !== value);
}

function hasOmittedTextAllergy(text, extraction) {
  if (typeof text !== 'string' || !/\balerg(?:ia|ias|ico|ica|icos|icas)\b/i.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return false;
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const match = /\balerg(?:ia|ias|ico|ica|icos|icas)\s+(?:a|al)\s+([^;.!?]+)/i.exec(normalized);
  if (!match) return true;
  const proposed = (extraction && Array.isArray(extraction.allergies) ? extraction.allergies : [])
    .map(item => String(typeof item === 'string' ? item : item && item.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  return match[1].split(/,|\b(?:y|ni|o|pero)\b/i).map(x => x.trim().replace(/^(?:la|el|los|las)\s+/, '').split(/\s+/)[0])
    .filter(Boolean).some(term => !proposed.includes(term));
}

function hasUnresolvedTextBudget(text, restrictions, extraction, consolidation) {
  if (restrictions && restrictions.budgetMax != null) {
    const strict = typeof text === 'string' && /\by por menos de\s*\$(\d+(?:\.\d{1,2})?)[.!]?$/i.exec(text);
    return !!strict && Number(restrictions.budgetMax) >= Number(strict[1]);
  }
  if (typeof text !== 'string' || !/(?:\$\s*\d|(?:\d[\d.,]*|un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil)(?:\s+(?:y\s+)?(?:uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa))?\s*(?:pesos?|pesitos|mxn|varos?)\b)/i.test(text)) return false;
  const budget = extraction && extraction.budget;
  // An ambiguous amount is never converted into an arbitrary maximum. If an
  // explicit maximum is also present, however, omitting it is unsafe.
  if (budget && budget.ambiguous === true) {
    if (/\b(?:no\s+(?:quiero\s+gastar\s+)?m[aá]s\s+de|m[aá]ximo|no\s+pase\s+de|hasta)\b/i.test(text)) return true;
    if (Array.isArray(budget.notes) && budget.notes.includes('approximate_budget')) return false;
    return /\b(?:tengo|traigo|presupuesto)\b/i.test(text);
  }
  return !consolidation.consolidatedRestrictions.some(r => r.category === 'budget' && r.origin === 'text_corroborated');
}

function buildRankCandidates(eligibleDishes) {
  return (Array.isArray(eligibleDishes) ? eligibleDishes : []).map((d) => ({
    id: String(d.id),
    nombre: d.nombre != null ? String(d.nombre) : '',
    descripcion: d.descripcion != null ? String(d.descripcion) : '',
    categoria_nombre: d.categoria_nombre != null ? String(d.categoria_nombre) : '',
    precio: d.precio != null ? (parseFloat(d.precio) || 0) : 0,
    ingredientes_principales: Array.isArray(d.ingredientes_principales) ? d.ingredientes_principales : [],
    complementos: Array.isArray(d.complementos) ? d.complementos : [],
    etiquetas_dieteticas: Array.isArray(d.etiquetas_dieteticas) ? d.etiquetas_dieteticas : [],
    nivel_picante: d.nivel_picante != null ? parseInt(d.nivel_picante, 10) : null
  }));
}

async function recommendWithMlV2({ requestId, scope, craving, restrictions, options, eligibleDishes, fallbackContext, extracted = null, interpretOk = false }) {
  const available = Array.isArray(eligibleDishes) ? eligibleDishes : [];
  const selected = selectRelevantFood(available, craving && craving.text);
  if (selected.constrained && available.length > 0 && selected.dishes.length === 0) {
    return { recommendations: [], mlUsed: false, fallback: false, reason: 'no_relevant_candidates', metaExtra: { interpretOk: !!interpretOk, rankOk: false } };
  }
  eligibleDishes = selected.dishes;
  const candidates = buildRankCandidates(eligibleDishes);
  const limit = (options && options.limit) || (fallbackContext && fallbackContext.limit) || 5;
  if (candidates.length === 0) {
    return { recommendations: [], mlUsed: false, fallback: true, reason: 'no_eligible_candidates', metaExtra: { interpretOk: !!interpretOk, rankOk: false } };
  }

  const allowedIds = new Set(candidates.map((c) => c.id));
  const rankPayload = {
    requestId,
    scope: scope || null,
    craving: craving || { text: '', tags: [] },
    restrictions: restrictions || {},
    options: options || { limit },
    candidates,
    ...(extracted && typeof extracted === 'object' && !Array.isArray(extracted) ? { extracted } : {})
  };
  const rankRes = await callMlV2Post(ML_V2_RANK_PATH, rankPayload, 'rank');
  if (!rankRes.ok || !rankRes.data || typeof rankRes.data !== 'object' || Array.isArray(rankRes.data) || !Array.isArray(rankRes.data.ranked)) {
    const recs = buildSafeFallbackRecommendations(eligibleDishes, fallbackContext || { limit });
    return { recommendations: recs, mlUsed: false, fallback: true, reason: 'ml_v2_unavailable_or_invalid', metaExtra: { interpretOk: !!interpretOk, rankOk: false } };
  }
  // strict requestId validation: mismatch treated as untrusted -> safe fallback on eligible only
  if (requestId && rankRes.data.requestId != null && String(rankRes.data.requestId) !== String(requestId)) {
    const recs = buildSafeFallbackRecommendations(eligibleDishes, fallbackContext || { limit });
    return { recommendations: recs, mlUsed: false, fallback: true, reason: 'ml_v2_unavailable_or_invalid', metaExtra: { interpretOk: !!interpretOk, rankOk: false, rankRequestIdMismatch: true } };
  }

  // BE validates ML rank response strictly: only known eligible ids, bounded shape
  const dishById = new Map((Array.isArray(eligibleDishes) ? eligibleDishes : []).map((d) => [String(d.id), d]));
  const ordered = [];
  const seen = new Set();
  for (const item of rankRes.data.ranked) {
    if (!item || typeof item !== 'object') continue;
    const did = item.dishId != null ? String(item.dishId) : null;
    if (!did || !allowedIds.has(did) || seen.has(did)) continue;
    const dish = dishById.get(did);
    if (!dish) continue;
    seen.add(did);
    const scoreRaw = typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : 0.7;
    const score = Math.min(0.99, Math.max(0, scoreRaw));
    const reasons = Array.isArray(item.reasons)
      ? item.reasons.filter((r) => typeof r === 'string').map((r) => r.slice(0, 240)).slice(0, 3)
      : [];
    ordered.push({
      dish: {
        id: dish.id,
        nombre: dish.nombre || '',
        descripcion: dish.descripcion || '',
        precio: dish.precio != null ? (parseFloat(dish.precio) || 0) : 0,
        url_imagen: dish.url_imagen || '',
        nivel_picante: dish.nivel_picante || 0,
        porcion: dish.porcion || '',
        categoria_nombre: dish.categoria_nombre || '',
        etiquetas_dieteticas: Array.isArray(dish.etiquetas_dieteticas) ? dish.etiquetas_dieteticas : [],
        ingredientes_principales: Array.isArray(dish.ingredientes_principales) ? dish.ingredientes_principales : []
      },
      restaurant: fallbackContext && fallbackContext.restaurantId === undefined && dish.restaurante_id ? {
        id: dish.restaurante_id,
        name: dish.restaurante_nombre || null,
        slug: dish.restaurante_slug || dish.restaurante_id,
        menuUrl: dish.menuUrl || null
      } : {
        id: (fallbackContext && fallbackContext.restaurantId) || dish.restaurante_id || null,
        name: (fallbackContext && fallbackContext.restaurantName) || dish.restaurante_nombre || null,
        slug: (fallbackContext && fallbackContext.restaurantSlug) || dish.restaurante_slug || null,
        menuUrl: (fallbackContext && fallbackContext.menuUrl) || dish.menuUrl || null
      },
      matchScore: score,
      matchPercentage: Math.round(score * 100),
      reasons: reasons.length ? reasons : ['Candidato elegible considerado según datos disponibles.'],
      tags: Array.isArray(dish.etiquetas_dieteticas) ? dish.etiquetas_dieteticas : (Array.isArray(dish.ingredientes_principales) ? dish.ingredientes_principales.slice(0, 3) : [])
    });
    if (ordered.length >= limit) break;
  }

  if (ordered.length === 0) {
    const recs = buildSafeFallbackRecommendations(eligibleDishes, fallbackContext || { limit });
    return { recommendations: recs, mlUsed: false, fallback: true, reason: 'ml_v2_empty_or_invalid_items', metaExtra: { interpretOk: !!interpretOk, rankOk: true } };
  }

  return { recommendations: ordered, mlUsed: true, fallback: false, reason: null, metaExtra: { interpretOk: !!interpretOk, rankOk: true } };
}


function addVerifiedRecommendationDetails(recommendations, evaluations, rows, restaurantId, fallback) {
  const byId = new Map(evaluations.filter((e) => e.eligible).map((e) => [String(e.dishId), e]));
  const dishes = new Map(rows.map((row) => [String(row.id), row]));
  return recommendations.filter((item) => byId.has(String(item.dish.id)) && dishes.has(String(item.dish.id))).map((item) => {
    const evaluation = byId.get(String(item.dish.id));
    const row = dishes.get(String(item.dish.id));
    const dish = { id: row.id, restaurantId: row.restaurante_id || restaurantId };
    const fields = { nombre: 'name', descripcion: 'description', url_imagen: 'imageUrl', categoria_nombre: 'category', activo: 'active', nivel_picante: null, porcion: null };
    for (const [source, target] of Object.entries(fields)) {
      if (row[source] != null) {
        dish[source] = row[source];
        if (target) dish[target] = row[source];
      }
    }
    const price = row.precio == null || String(row.precio).trim() === '' ? NaN : Number(row.precio);
    if (Number.isFinite(price)) { dish.precio = price; dish.price = price; }
    for (const [source, target] of [['ingredientes_principales', 'ingredients'], ['etiquetas_dieteticas', 'dietaryTags']]) {
      const value = parseJsonMaybe(row[source], null);
      if (Array.isArray(value)) { dish[source] = value; dish[target] = value; }
    }
    const { tags, ...rest } = item;
    return {
      ...rest,
      ...(dish.dietaryTags ? { tags: dish.dietaryTags } : {}),
      dish,
      match: { score: item.matchScore, matchPercentage: item.matchPercentage },
      reasons: [{ type: 'ranking', text: !fallback && Number(row.nivel_picante) === 0 && row.nivel_picante != null && Array.isArray(item.reasons) && item.reasons.includes('El menú declara nivel de picante 0; coincidencia parcial.')
        ? 'El menú declara nivel de picante 0; coincidencia parcial.'
        : fallback ? 'Orden determinista; la puntuacion no es confianza de ML.' : 'Seleccionado segun datos disponibles del menu.' }],
      safety: {
        overall: 'compatible_segun_datos',
        priceVerified: currencyVerified(row),
        restrictions: evaluation.evaluations.map((e) => ({ type: e.category, value: e.normalizedValue, status: e.state })),
        disclaimer: DISCLAIMER
      }
    };
  });
}

const getPublicRecommendations = async (req, res) => {
  const validation = normalizeRecommendationRequest(req.body);
  const requestId = validation.ok ? validation.requestId : (validation.requestId || 'req_unknown');
  const limitApplied = validation.ok ? validation.limitApplied : (validation.limitApplied || 5);
  try {
    if (!validation.ok) {
      return res.status(400).json(buildValidationErrorResponse(validation.details, requestId, limitApplied));
    }

    const { restaurant_id } = req.params;
    const { craving, diet, allergies, limit } = validation.legacy;

    if (!restaurant_id) {
      return res.status(400).json(buildValidationErrorResponse([{ field: 'restaurant_id', reason: 'required' }], requestId, limitApplied));
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
      return res.status(404).json(buildHttpErrorEnvelope({ requestId, errorCode: 'NOT_FOUND', statusCode: 'not_found', message: 'Restaurante no encontrado.', scope: { type: 'restaurant', restaurantId: restaurant_id }, limitApplied }));
    }

    const restInfo = restRes.rows[0];
    const realRestaurantId = restInfo.id;

    if (!restInfo.suscripcion_activa) {
      return res.status(403).json(buildHttpErrorEnvelope({ requestId, errorCode: 'RESTAURANT_UNAVAILABLE', statusCode: 'restaurant_unavailable', message: 'Restaurante no disponible temporalmente.', scope: { type: 'restaurant', restaurantId: realRestaurantId }, limitApplied }));
    }

    // Obtener exclusivamente los platillos activos de ESTE restaurante (incluye metadatos de verificaciÃ³n si existen)
    let dishesRes;
    try {
      dishesRes = await db.query(
        `SELECT p.*, c.nombre as categoria_nombre
         FROM platillos p
         LEFT JOIN categorias_restaurante c ON p.categoria_id = c.id
         WHERE p.restaurante_id = $1 AND p.activo = true
         ORDER BY p.nombre ASC`,
        [realRestaurantId]
      );
    } catch (e) {
      dishesRes = await db.query(
        `SELECT p.id, p.nombre, p.descripcion, p.precio, p.url_imagen, p.activo,
                p.ingredientes_principales, p.complementos, p.nivel_picante, p.porcion, p.etiquetas_dieteticas,
                c.nombre as categoria_nombre
         FROM platillos p
         LEFT JOIN categorias_restaurante c ON p.categoria_id = c.id
         WHERE p.restaurante_id = $1 AND p.activo = true
         ORDER BY p.nombre ASC`,
        [realRestaurantId]
      );
    }

    const candidateDishes = await enrichCandidates(db, dishesRes.rows.map(normalizeDishForEvaluation), realRestaurantId);
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const menuSlug = restInfo.slug || realRestaurantId;
    const menuUrl = `${frontendBaseUrl}/menu/${menuSlug}`;

    const canonicalCraving = (validation.canonical && validation.canonical.craving) ? validation.canonical.craving : (craving || {});
    const canonicalRestrictions = (validation.canonical && validation.canonical.restrictions) ? validation.canonical.restrictions : { allergies: Array.isArray(allergies) ? allergies : [], diet: diet || 'none', excludedIngredients: [] };
    const canonicalOptions = (validation.canonical && validation.canonical.options) ? validation.canonical.options : { limit };

    // R2 ML V2: interpret (proposal) -> consolidate (BE authority, fail-closed) -> eligibility -> rank
    const interpret = await callMlInterpret({ requestId, craving: canonicalCraving, restrictions: canonicalRestrictions, options: canonicalOptions });
    const consolidation = consolidateRestrictions({
      requestId,
      structuredRestrictions: canonicalRestrictions,
      mlExtraction: interpret.mlExtraction
    });
    const eligibility = evaluateEligibility(candidateDishes, consolidation, { limit });

    const unverifiedText = (!interpret.ok && !!canonicalCraving.text) || hasOmittedTextExclusion(canonicalCraving.text, interpret.mlExtraction) ||
      hasOmittedTextDiet(canonicalCraving.text, canonicalRestrictions, interpret.mlExtraction) || hasOmittedTextAllergy(canonicalCraving.text, interpret.mlExtraction) ||
      hasUnresolvedTextBudget(canonicalCraving.text, canonicalRestrictions, interpret.mlExtraction, consolidation);
    const mlV2 = await recommendWithMlV2({
      requestId,
      scope: 'restaurant',
      craving: canonicalCraving,
      restrictions: canonicalRestrictions,
      options: canonicalOptions,
      eligibleDishes: unverifiedText ? [] : filterNoSpice(eligibility.eligible, canonicalCraving.text),
      fallbackContext: {
        limit,
        restaurantId: realRestaurantId,
        restaurantName: restInfo.nombre_negocio,
        restaurantSlug: menuSlug,
        menuUrl
      },
      extracted: interpret.extracted,
      interpretOk: interpret.ok
    });

    const finalState = await revalidateEvidenceRecommendations(candidateDishes, consolidation, mlV2, realRestaurantId, canonicalCraving.text);
    const hasUnverifiable = unverifiedText || finalState.changed || eligibility.evaluations.some((item) => item.evaluations.some((entry) => entry.state === 'desconocido'));
    return res.json(buildRecommendationSuccessResponse({
      requestId,
      recommendations: addVerifiedRecommendationDetails(finalState.recommendations, finalState.evaluations, finalState.dishes.some(d => d.evidencia_precio_revision) ? finalState.dishes : dishesRes.rows, realRestaurantId, mlV2.fallback),
      scope: { type: 'restaurant', restaurantId: realRestaurantId },
      totalCandidates: candidateDishes.length,
      evaluatedCandidates: eligibility.totalCandidates,
      limitApplied: limit,
      fallback: !!mlV2.fallback,
      mlUsed: !!mlV2.mlUsed,
      hasUnverifiable,
      extraMeta: {
        restaurant_id: realRestaurantId,
        recommendedCount: finalState.recommendations.length,
        mlReason: mlV2.reason || null
      }
    }));

  } catch (error) {
    console.error('Error en getPublicRecommendations:', error);
    res.status(500).json(buildHttpErrorEnvelope({ requestId, errorCode: 'INTERNAL_ERROR', statusCode: 'internal_error', message: 'Error procesando recomendaciones.', limitApplied }));
  }
};

async function revalidateEvidenceRecommendations(original, consolidation, mlV2, restaurantId = null, text = '') {
  const fresh = await enrichCandidates(db, original, restaurantId);
  const previous = new Map(original.map(d => [d.id, d]));
  let currentPrices = null;
  if (localMxnBudgetEnabled() && !original.some(d => d.evidencia_precio_revision) &&
      consolidation.consolidatedRestrictions.some(r => r.category === 'budget') && original.length) {
    const result = await db.query(`SELECT p.id, p.restaurante_id, p.precio, p.activo, r.suscripcion_activa AS restaurante_activo
      FROM platillos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE p.id = ANY($1::uuid[])`, [original.map(d => d.id)]);
    currentPrices = new Map(result.rows.map(row => [row.id, row]));
  }
  const stable = fresh.filter(d => {
    const old = previous.get(d.id);
    const current = currentPrices && currentPrices.get(d.id);
    return old && (!currentPrices || (current && current.activo && current.restaurante_activo &&
      current.restaurante_id === old.restaurante_id && priceCents(current.precio) !== null &&
      priceCents(current.precio) === priceCents(old.precio))) && old.restaurante_id === d.restaurante_id &&
      old.evidencia_precio_revision === d.evidencia_precio_revision &&
      old.evidencia_receta_revision === d.evidencia_receta_revision;
  });
  const evaluated = evaluateEligibility(stable, consolidation);
  const ids = new Set(selectRelevantFood(filterNoSpice(evaluated.eligible, text), text).dishes.map(d => d.id));
  const recommendations = mlV2.recommendations.filter(r => ids.has(r.dish.id));
  return { recommendations, dishes: stable, evaluations: evaluated.evaluations,
    changed: recommendations.length !== mlV2.recommendations.length };
}

const getGlobalRecommendations = async (req, res) => {
  const validation = normalizeRecommendationRequest(req.body);
  const requestId = validation.ok ? validation.requestId : (validation.requestId || 'req_unknown');
  const limitApplied = validation.ok ? validation.limitApplied : (validation.limitApplied || 5);
  try {
    if (!validation.ok) {
      return res.status(400).json(buildValidationErrorResponse(validation.details, requestId, limitApplied));
    }

    const { craving, diet, allergies, limit } = validation.legacy;

    // Obtener platillos activos de TODOS los restaurantes con suscripciÃ³n activa (incluye metadatos de verificaciÃ³n si existen)
    let dishesRes;
    try {
      dishesRes = await db.query(
        `SELECT p.*, c.nombre as categoria_nombre,
                r.id as restaurante_id, r.nombre_negocio as restaurante_nombre, r.slug as restaurante_slug
         FROM platillos p
         JOIN restaurantes r ON p.restaurante_id = r.id
         LEFT JOIN categorias_restaurante c ON p.categoria_id = c.id
         WHERE p.activo = true AND r.suscripcion_activa = true
         ORDER BY p.created_at DESC`
      );
    } catch (e) {
      dishesRes = await db.query(
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
    }

    const candidateDishes = dishesRes.rows.map(normalizeDishForEvaluation);
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const dishesWithRestInfo = await enrichCandidates(db, candidateDishes.map(d => {
      const slug = d.restaurante_slug || d.restaurante_id;
      return {
        ...d,
        restaurante_id: d.restaurante_id,
        restaurante_nombre: d.restaurante_nombre,
        restaurante_slug: slug,
        menuUrl: `${frontendBaseUrl}/menu/${slug}`
      };
    }));
    // Enrichment obtains fresh database rows; restore the public URL from their
    // current restaurant slug rather than losing it in the snapshot projection.
    dishesWithRestInfo.forEach(d => {
      d.menuUrl = `${frontendBaseUrl}/menu/${d.restaurante_slug || d.restaurante_id}`;
    });

    const canonicalCraving = (validation.canonical && validation.canonical.craving) ? validation.canonical.craving : (craving || {});
    const canonicalRestrictions = (validation.canonical && validation.canonical.restrictions) ? validation.canonical.restrictions : { allergies: Array.isArray(allergies) ? allergies : [], diet: diet || 'none', excludedIngredients: [] };
    const canonicalOptions = (validation.canonical && validation.canonical.options) ? validation.canonical.options : { limit };

    // R2 ML V2: interpret (proposal) -> consolidate (BE authority, fail-closed) -> eligibility -> rank
    const interpret = await callMlInterpret({ requestId, craving: canonicalCraving, restrictions: canonicalRestrictions, options: canonicalOptions });
    const consolidation = consolidateRestrictions({
      requestId,
      structuredRestrictions: canonicalRestrictions,
      mlExtraction: interpret.mlExtraction
    });
    const eligibility = evaluateEligibility(dishesWithRestInfo, consolidation, { limit });

    const unverifiedText = (!interpret.ok && !!canonicalCraving.text) || hasOmittedTextExclusion(canonicalCraving.text, interpret.mlExtraction) ||
      hasOmittedTextDiet(canonicalCraving.text, canonicalRestrictions, interpret.mlExtraction) || hasOmittedTextAllergy(canonicalCraving.text, interpret.mlExtraction) ||
      hasUnresolvedTextBudget(canonicalCraving.text, canonicalRestrictions, interpret.mlExtraction, consolidation);
    const mlV2 = await recommendWithMlV2({
      requestId,
      scope: 'global',
      craving: canonicalCraving,
      restrictions: canonicalRestrictions,
      options: canonicalOptions,
      eligibleDishes: unverifiedText ? [] : filterNoSpice(eligibility.eligible, canonicalCraving.text),
      fallbackContext: { limit },
      extracted: interpret.extracted,
      interpretOk: interpret.ok
    });

    const finalState = await revalidateEvidenceRecommendations(dishesWithRestInfo, consolidation, mlV2, null, canonicalCraving.text);
    const hasUnverifiable = unverifiedText || finalState.changed || eligibility.evaluations.some((item) => item.evaluations.some((entry) => entry.state === 'desconocido'));
    return res.json(buildRecommendationSuccessResponse({
      requestId,
      recommendations: addVerifiedRecommendationDetails(finalState.recommendations, finalState.evaluations, finalState.dishes.some(d => d.evidencia_precio_revision) ? finalState.dishes : dishesRes.rows, undefined, mlV2.fallback),
      scope: { type: 'global' },
      totalCandidates: candidateDishes.length,
      evaluatedCandidates: eligibility.totalCandidates,
      limitApplied: limit,
      fallback: !!mlV2.fallback,
      mlUsed: !!mlV2.mlUsed,
      hasUnverifiable,
      extraMeta: {
        restaurant_id: 'global',
        recommendedCount: finalState.recommendations.length,
        mlReason: mlV2.reason || null
      }
    }));

  } catch (error) {
    console.error('Error en getGlobalRecommendations:', error);
    res.status(500).json(buildHttpErrorEnvelope({ requestId, errorCode: 'INTERNAL_ERROR', statusCode: 'internal_error', message: 'Error procesando recomendaciones globales.', limitApplied }));
  }
};


const approveDishVerification = async (req, res) => {
  const { id } = req.params;
  const { verification_metadata, motivo } = req.body;
  const actorId = req.user.id;
  const actorRol = req.user.rol;
  const restaurante_id = req.user.id;

  if (actorRol !== 'RESTAURANTE') {
    return res.status(403).json({ mensaje: 'Solo el propietario puede confirmar su catálogo.' });
  }

  if (!verification_metadata || typeof verification_metadata !== 'object') {
    return res.status(400).json({ mensaje: 'verification_metadata es requerido y debe ser un objeto' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // A previously issued token cannot retain confirmation privileges after
    // the account's current role changes.
    const owner = await client.query('SELECT id FROM restaurantes WHERE id = $1 AND rol = $2 FOR SHARE', [actorId, 'RESTAURANTE']);
    if (owner.rows.length !== 1) {
      await client.query('ROLLBACK');
      return res.status(403).json({ mensaje: 'Solo el propietario puede confirmar su catálogo.' });
    }
    const existingRes = await client.query(
      'SELECT * FROM platillos WHERE id = $1 AND restaurante_id = $2 FOR UPDATE',
      [id, restaurante_id]
    );
    if (existingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Platillo no encontrado' });
    }
    const existing = existingRes.rows[0];

    // No delegated superadmin confirmation; resource scope is owner-only.
    if (existing.restaurante_id !== restaurante_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ mensaje: 'No tienes permisos para aprobar este platillo' });
    }

    const dish = normalizeDishForEvaluation(existing);
    const meta = verification_metadata;

    // Validar versiÃ³n coincidente (no obsolete)
    const currentVersion = computeRecipeVersion(dish);
    const verifiedVersion = meta.verifiedRecipeVersion || meta.recipeVersion || meta.recipe_version || null;
    const existingVerifiedVersion = existing.verified_recipe_version || (existing.verification_metadata && existing.verification_metadata.verifiedRecipeVersion);
    
    if (existingVerifiedVersion && existingVerifiedVersion !== currentVersion) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        mensaje: 'La receta ha sido modificada desde la Ãºltima verificaciÃ³n. Revisa la receta y vuelve a intentar.',
        currentRecipeVersion: currentVersion,
        previousVerifiedRecipeVersion: existingVerifiedVersion,
        reason: 'verification_obsolete'
      });
    }

    // Validar que la verificaciÃ³n sea para la versiÃ³n ACTUAL (no para una versiÃ³n anterior)
    if (!verifiedVersion || verifiedVersion !== currentVersion) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        mensaje: 'La verificaciÃ³n debe corresponder a la versiÃ³n actual de la receta.',
        currentRecipeVersion: currentVersion,
        providedVerifiedVersion: verifiedVersion || null,
        reason: 'version_mismatch'
      });
    }

    // Validar receta completa
    const completeness = evaluateCompleteness(dish);
    if (!completeness.allSectionsSufficient) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        mensaje: 'La receta no estÃ¡ completa.Todos los sectores deben ser "complete" o "not_applicable_declared".',
        completenessState: completeness.sections,
        missingSections: Object.entries(completeness.sections)
          .filter(([, v]) => v.sufficient === false)
          .map(([k]) => k),
        reason: 'incomplete_recipe'
      });
    }

    // Validar compuestos resueltos
    const ingredients = collectAllRelevantIngredientEntries(dish);
    for (const ing of ingredients) {
      const compound = resolveCompound(ing);
      if (compound.unresolved) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          mensaje: 'La receta contiene ingredientes compuestos sin desglosar.',
          unresolvedCompound: { ingredient: ing.name, section: ing.section },
          reason: 'unresolved_compound'
        });
      }
    }

    // Validar contacto cruzado controlado
    const ccStatus = meta.crossContamination && (meta.crossContamination.status || meta.crossContamination.state);
    if (ccStatus !== CROSS_CONTAMINATION_STATES.VERIFIED_CONTROLLED) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        mensaje: 'El contacto cruzado debe estar evaluado como "verified_controlled".',
        actualCrossContaminationStatus: ccStatus,
        requiredStatus: CROSS_CONTAMINATION_STATES.VERIFIED_CONTROLLED,
        reason: 'cross_contamination_not_controlled'
      });
    }

    // Validar conflictos
    if (meta.conflicts && Array.isArray(meta.conflicts) && meta.conflicts.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        mensaje: 'No se puede aprobar una receta con conflictos entre fuentes de informaciÃ³n.',
        conflictCount: meta.conflicts.length,
        reason: 'has_conflicts'
      });
    }

    // Validar estados de verificaciÃ³n compatibles
    const currentVerState = existing.verification_state || (existing.verification_metadata && existing.verification_metadata.verificationState);
    const requestedVerState = meta.verificationState || meta.verification_state || meta.state;
    
    // Aprobar desde: declared_unverified (nuevo), reviewed, o reaprobar desde verified_approved con misma versiÃ³n
    const allowedFrom = [VERIFICATION_STATES.DECLARED_UNVERIFIED, VERIFICATION_STATES.REVIEWED, VERIFICATION_STATES.VERIFIED_APPROVED];
    if (!allowedFrom.includes(currentVerState)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        mensaje: 'No es posible aprobar desde el estado actual de verificaciÃ³n.',
        currentVerificationState: currentVerState,
        allowedStates: allowedFrom,
        reason: 'invalid_verification_state'
      });
    }

    // Validar que se provide asesores explÃ­citos si hay ingredientes con alÃ©rgenos conocidos
    // (por simplicidad: si hay ingredientes declarados con alÃ©rgenos, deben tener assessments)
    const ingredientTerms = collectAllRelevantIngredientEntries(dish).map(e => e.name);
    if (existing.alergenos_declarados && existing.alergenos_declarados.length > 0) {
      if (!meta.ingredientAllergenAssessments || !Array.isArray(meta.ingredientAllergenAssessments) || meta.ingredientAllergenAssessments.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          mensaje: 'La receta tiene alÃ©rgenos declarados pero no hay assessments explÃ­citos por tÃ©rmino.',
          declaredAllergens: existing.alergenos_declarados,
          required: 'ingredientAllergenAssessments',
          reason: 'missing_allergen_assessments'
        });
      }
    }

    // Construir metadatos finales para verificaciÃ³n aprobada
    const now = new Date().toISOString();
    const finalMeta = {
      ...meta,
      verificationState: VERIFICATION_STATES.VERIFIED_APPROVED,
      currentRecipeVersion: currentVersion,
      verifiedRecipeVersion: currentVersion,
      verifiedBy: actorId,
      verifiedAt: now,
      verificationSource: meta.verificationSource || meta.source || 'admin_manual_approval',
      lastModifiedBy: actorId,
      lastModifiedAt: now,
      invalidatedAt: null,
      invalidationReason: null
    };

    // Actualizar platillo con estado aprobado
    const cols = await getDishColumnSet(client);
    const sets = ['verification_metadata = $1', 'verification_state = $2', 'verified_recipe_version = $3', 'verified_by = $4', 'verified_at = $5', 'verification_source = $6', 'verification_updated_at = $7'];
    const values = [JSON.stringify(finalMeta), VERIFICATION_STATES.VERIFIED_APPROVED, currentVersion, actorId, now, finalMeta.verificationSource, now];
    
    // Update completeness_state y cross_contamination_state
    if (cols.has('completeness_state')) { sets.push('completeness_state = $' + (values.length + 1)); values.push('complete'); }
    if (cols.has('cross_contamination_state')) { sets.push('cross_contamination_state = $' + (values.length + 1)); values.push(CROSS_CONTAMINATION_STATES.VERIFIED_CONTROLLED); }

    values.push(id);
    const updateQuery = 'UPDATE platillos SET ' + sets.join(', ') + ' WHERE id = $' + values.length;
    await client.query(updateQuery, values);

    // Registrar auditorÃ­a
    await insertVerificationAudit(client, {
      platilloId: id,
      restauranteId: restaurante_id,
      accion: 'approve_verification',
      estadoAnterior: {
        verification_state: currentVerState,
        verified_recipe_version: existingVerifiedVersion || null
      },
      estadoNuevo: {
        verification_state: VERIFICATION_STATES.VERIFIED_APPROVED,
        verifiedRecipeVersion: currentVersion,
        verifiedBy: actorId,
        verifiedAt: now
      },
      actorId,
      actorRol,
      motivo: motivo || 'VerificaciÃ³n de receta aprobada manualmente'
    });

    await client.query('COMMIT');
    await invalidateMenuCache(restaurante_id);

    res.json({
      mensaje: 'VerificaciÃ³n de receta aprobada correctamente',
      platillo_id: id,
      verification_state: VERIFICATION_STATES.VERIFIED_APPROVED,
      verifiedBy: actorId,
      verifiedAt: now,
      verificationSource: finalMeta.verificationSource
    });

  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[B1-T04] Error approviing dish verification:', error);
    res.status(500).json({ mensaje: 'Error interno al aprobar verificaciÃ³n' });
  } finally {
    client.release();
  }
};


module.exports = {
  createDish,
  updateDish,
  deleteDish,
  getPublicMenu,
  getDishes,
  getPublicRecommendations,
  getGlobalRecommendations,
  approveDishVerification,
  // R2 ML V2 internal/test hooks (additive)
  callMlInterpret,
  recommendWithMlV2,
  sanitizeMlExtractionForConsolidation,
  hasOmittedTextExclusion,
  hasOmittedTextAllergy,
  requiresNoSpice,
  filterNoSpice,
  hasUnresolvedTextBudget,
  callMlV2Post
};


