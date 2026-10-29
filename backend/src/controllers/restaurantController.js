const db = require('../config/db');
const redisClient = require('../config/redis');
const QRCode = require('qrcode');
const SubscriptionService = require('../services/subscriptionService');
const { obtenerSlugUnico } = require('../services/slugService');
const { invalidateMenuCache } = require('../services/cacheService');

const generateQR = async (req, res) => {
  try {
    // 1. Obtener restaurante_id del token (inyectado por authMiddleware)
    const restaurante_id = req.user.id;

    // 2. Obtener o generar slug amigable del restaurante
    const restRes = await db.query('SELECT id, nombre_negocio, slug FROM restaurantes WHERE id = $1', [restaurante_id]);
    if (restRes.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Restaurante no encontrado' });
    }

    let slug = restRes.rows[0].slug;
    if (!slug) {
      slug = await obtenerSlugUnico(restRes.rows[0].nombre_negocio, restaurante_id);
      await db.query('UPDATE restaurantes SET slug = $1 WHERE id = $2', [slug, restaurante_id]);
    }

    // 3. Construir URL pública del menú usando el slug amigable
    const rawBaseUrl = process.env.PUBLIC_MENU_URL || 'https://mexxican.mx/menu/';
    const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`;
    const url_menu = `${baseUrl}${slug}`;

    // 4. Generar imagen QR en Base64
    const qr_base64 = await QRCode.toDataURL(url_menu, {
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      width: 500,
      margin: 2
    });

    // 5. Responder
    res.json({
      url_menu,
      qr_base64,
      slug
    });

  } catch (error) {
    console.error('Error al generar QR:', error);
    res.status(500).json({ mensaje: 'Error interno al generar el código QR' });
  }
};

const sanitizarConfigDiseno = (config) => {
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch (e) {
      return {};
    }
  }
  
  if (typeof config !== 'object' || config === null) {
    return {};
  }

  const result = {
    apariencia: {},
    layout: {},
    elementos_visuales: {},
    informacion: {},
    moneda: {}
  };

  const { apariencia, layout, elementos_visuales, informacion, moneda } = config;

  // 1. Sanitizar Apariencia
  if (apariencia && typeof apariencia === 'object') {
    const fitWhitelist = ['cover', 'contain', 'fill', 'none', 'scale-down'];
    const tipoWhitelist = ['solido', 'gradiente', 'imagen'];
    const hexRegex = /^#[0-9a-fA-F]{3,8}$/;

    if (tipoWhitelist.includes(apariencia.fondo_tipo)) {
      result.apariencia.fondo_tipo = apariencia.fondo_tipo;
    }
    if (typeof apariencia.fondo_valor === 'string') {
      result.apariencia.fondo_valor = apariencia.fondo_valor.substring(0, 500);
    }
    if (typeof apariencia.fondo_blur === 'string' && /^\d+px$/.test(apariencia.fondo_blur)) {
      result.apariencia.fondo_blur = apariencia.fondo_blur;
    }
    if (typeof apariencia.fuente_familia === 'string') {
      result.apariencia.fuente_familia = apariencia.fuente_familia.substring(0, 50);
    }
    
    // Validar colores hex
    ['color_normal', 'color_descripcion', 'color_primario', 'color_fondo', 'fondo_overlay_color'].forEach(colorKey => {
      if (typeof apariencia[colorKey] === 'string' && hexRegex.test(apariencia[colorKey])) {
        result.apariencia[colorKey] = apariencia[colorKey];
      }
    });

    if (typeof apariencia.modo_oscuro === 'boolean') {
      result.apariencia.modo_oscuro = apariencia.modo_oscuro;
    }

    const radiusRegex = /^\d+(\.\d+)?(px|rem|em|%)$/;
    if (typeof apariencia.border_radius_botones === 'string' && radiusRegex.test(apariencia.border_radius_botones)) {
      result.apariencia.border_radius_botones = apariencia.border_radius_botones;
    }
    if (typeof apariencia.border_radius_tarjetas === 'string' && radiusRegex.test(apariencia.border_radius_tarjetas)) {
      result.apariencia.border_radius_tarjetas = apariencia.border_radius_tarjetas;
    }

    // Campos de imagen de fondo (con soporte dual horizontal/vertical y limpieza estricta de residuos)
    const horizUrl = typeof apariencia.fondo_imagen_horizontal_url === 'string' ? apariencia.fondo_imagen_horizontal_url.trim() : '';
    const vertUrl = typeof apariencia.fondo_imagen_vertical_url === 'string' ? apariencia.fondo_imagen_vertical_url.trim() : '';
    const legacyUrl = typeof apariencia.fondo_imagen_url === 'string' ? apariencia.fondo_imagen_url.trim() : '';

    result.apariencia.fondo_imagen_horizontal_url = horizUrl.substring(0, 2000);
    result.apariencia.fondo_imagen_vertical_url = vertUrl.substring(0, 2000);

    // Si el fondo no es de tipo imagen, o ambas imágenes horizontal y vertical fueron eliminadas (vacías),
    // limpiar forzosamente fondo_imagen_url para evitar fallbacks fantasma hacia URLs residuales
    if (result.apariencia.fondo_tipo !== 'imagen' || (!horizUrl && !vertUrl)) {
      result.apariencia.fondo_imagen_url = '';
      if (!horizUrl && !vertUrl && result.apariencia.fondo_tipo === 'imagen') {
        result.apariencia.fondo_tipo = 'solido';
      }
    } else {
      result.apariencia.fondo_imagen_url = horizUrl || vertUrl || legacyUrl.substring(0, 2000);
    }
    
    result.apariencia.fondo_imagen_zoom = Number(apariencia.fondo_imagen_zoom) || 1;
    result.apariencia.fondo_imagen_x = Number(apariencia.fondo_imagen_x) || 0;
    result.apariencia.fondo_imagen_y = Number(apariencia.fondo_imagen_y) || 0;
    result.apariencia.fondo_imagen_rotate = Number(apariencia.fondo_imagen_rotate) || 0;

    if (fitWhitelist.includes(apariencia.fondo_imagen_fit)) {
      result.apariencia.fondo_imagen_fit = apariencia.fondo_imagen_fit;
    }

    result.apariencia.fondo_imagen_blur = Math.min(Math.max(Number(apariencia.fondo_imagen_blur) || 0, 0), 100);
    result.apariencia.fondo_imagen_brightness = Math.min(Math.max(Number(apariencia.fondo_imagen_brightness) || 100, 0), 300);
    result.apariencia.fondo_imagen_contrast = Math.min(Math.max(Number(apariencia.fondo_imagen_contrast) || 100, 0), 300);
    result.apariencia.fondo_imagen_saturate = Math.min(Math.max(Number(apariencia.fondo_imagen_saturate) || 100, 0), 300);
    result.apariencia.fondo_imagen_opacity = Math.min(Math.max(Number(apariencia.fondo_imagen_opacity) || 100, 0), 100);

    result.apariencia.fondo_overlay_opacity = Math.min(Math.max(Number(apariencia.fondo_overlay_opacity) ?? 0.5, 0), 1);
    result.apariencia.fondo_overlay_gradient_active = !!apariencia.fondo_overlay_gradient_active;
    
    if (typeof apariencia.fondo_overlay_gradient === 'string') {
      result.apariencia.fondo_overlay_gradient = apariencia.fondo_overlay_gradient.substring(0, 1000);
    }

    // Sanitizar Configuración de Imagen Responsiva por Breakpoints
    if (apariencia.responsive_imagen && typeof apariencia.responsive_imagen === 'object') {
      result.apariencia.responsive_imagen = {};
      const validBreakpoints = ['mobile_small', 'mobile', 'tablet', 'laptop', 'desktop', 'desktop_large'];
      const validFits = ['cover', 'contain', 'fill', 'none'];

      validBreakpoints.forEach(bp => {
        const bpConf = apariencia.responsive_imagen[bp];
        if (bpConf && typeof bpConf === 'object') {
          result.apariencia.responsive_imagen[bp] = {
            width: Math.max(10, Math.min(5000, isNaN(Number(bpConf.width)) ? 300 : Number(bpConf.width))),
            height: Math.max(10, Math.min(5000, isNaN(Number(bpConf.height)) ? 300 : Number(bpConf.height))),
            position_x: isNaN(Number(bpConf.position_x ?? bpConf.x)) ? 0 : Number(bpConf.position_x ?? bpConf.x),
            position_y: isNaN(Number(bpConf.position_y ?? bpConf.y)) ? 0 : Number(bpConf.position_y ?? bpConf.y),
            scale: Math.max(0.1, Math.min(10, isNaN(Number(bpConf.scale)) ? 1 : Number(bpConf.scale))),
            rotation: isNaN(Number(bpConf.rotation)) ? 0 : Number(bpConf.rotation),
            object_fit: validFits.includes(bpConf.object_fit) ? bpConf.object_fit : 'cover',
            border_radius: Math.max(0, Math.min(500, isNaN(Number(bpConf.border_radius)) ? 0 : Number(bpConf.border_radius))),
            opacity: Math.max(0, Math.min(100, isNaN(Number(bpConf.opacity)) ? 100 : Number(bpConf.opacity))),
            z_index: Math.round(isNaN(Number(bpConf.z_index)) ? 0 : Number(bpConf.z_index)),
            custom: !!bpConf.custom
          };
        }
      });
    }
  }

  // 2. Sanitizar Layout
  if (layout && typeof layout === 'object') {
    const layoutWhitelist = ['LISTA_SIMPLE', 'CUADRICULA_FOTOS', 'TARJETAS_DETALLADAS'];
    const encabezadoWhitelist = ['banner_hero', 'fondo_completo'];

    if (layoutWhitelist.includes(layout.layout_type)) {
      result.layout.layout_type = layout.layout_type;
    }
    if (layoutWhitelist.includes(layout.layout_type_horizontal)) {
      result.layout.layout_type_horizontal = layout.layout_type_horizontal;
    }
    if (layoutWhitelist.includes(layout.layout_type_vertical)) {
      result.layout.layout_type_vertical = layout.layout_type_vertical;
    }
    if (typeof layout.categorias_sticky === 'boolean') {
      result.layout.categorias_sticky = layout.categorias_sticky;
    }
    if (encabezadoWhitelist.includes(layout.estilo_encabezado)) {
      result.layout.estilo_encabezado = layout.estilo_encabezado;
    }
    if (typeof layout.mostrar_horario === 'boolean') {
      result.layout.mostrar_horario = layout.mostrar_horario;
    }
    if (typeof layout.mostrar_estado_abierto === 'boolean') {
      result.layout.mostrar_estado_abierto = layout.mostrar_estado_abierto;
    }
  }

  // 3. Sanitizar Elementos Visuales
  if (elementos_visuales && typeof elementos_visuales === 'object') {
    const hexRegex = /^#[0-9a-fA-F]{3,8}$/;
    const estiloTarjetaWhitelist = ['solida', 'frosted', 'minimalista'];

    if (typeof elementos_visuales.glassmorphism === 'boolean') {
      result.elementos_visuales.glassmorphism = elementos_visuales.glassmorphism;
    }
    if (typeof elementos_visuales.sombras_habilitadas === 'boolean') {
      result.elementos_visuales.sombras_habilitadas = elementos_visuales.sombras_habilitadas;
    }
    if (estiloTarjetaWhitelist.includes(elementos_visuales.tarjeta_estilo)) {
      result.elementos_visuales.tarjeta_estilo = elementos_visuales.tarjeta_estilo;
    }
    if (typeof elementos_visuales.tarjeta_opacidad === 'number') {
      result.elementos_visuales.tarjeta_opacidad = Math.min(Math.max(Number(elementos_visuales.tarjeta_opacidad) || 90, 10), 100);
    }
    if (typeof elementos_visuales.tarjeta_borde === 'boolean') {
      result.elementos_visuales.tarjeta_borde = elementos_visuales.tarjeta_borde;
    }
    if (typeof elementos_visuales.tarjeta_color_fondo === 'string' && hexRegex.test(elementos_visuales.tarjeta_color_fondo)) {
      result.elementos_visuales.tarjeta_color_fondo = elementos_visuales.tarjeta_color_fondo;
    }
  }

  // 4. Sanitizar Informacion
  if (informacion && typeof informacion === 'object') {
    if (typeof informacion.direccion === 'string') {
      result.informacion.direccion = informacion.direccion.substring(0, 500);
    }
    if (typeof informacion.ambiente === 'string') {
      result.informacion.ambiente = informacion.ambiente.substring(0, 100);
    }
  }

  // 5. Sanitizar Moneda
  if (moneda && typeof moneda === 'object') {
    const simbolosWhitelist = ['$', 'USD', 'MXN', '€', 'S/', 'Q', '₡', 'Bs', '£'];
    const posicionesWhitelist = ['prefijo', 'sufijo'];

    if (typeof moneda.simbolo === 'string' && (simbolosWhitelist.includes(moneda.simbolo) || moneda.simbolo.length <= 6)) {
      result.moneda.simbolo = moneda.simbolo.trim();
    } else {
      result.moneda.simbolo = '$';
    }

    if (posicionesWhitelist.includes(moneda.posicion)) {
      result.moneda.posicion = moneda.posicion;
    } else {
      result.moneda.posicion = 'prefijo';
    }
  } else {
    result.moneda = { simbolo: '$', posicion: 'prefijo' };
  }

  return result;
};

const updateTheme = async (req, res) => {
  const restaurante_id = req.user.id;
  let {
    logo_url,
    banner_url,
    color_primario,
    color_fondo,
    fuente_familia,
    layout_type,
    banner_promocional_activo,
    banner_promocional_texto,
    config_diseno
  } = req.body;

  try {
    // ABAC - Validar restricciones de plan
    const hasBanner = await SubscriptionService.hasFeature(restaurante_id, 'banner_promocional');
    const hasFondo = await SubscriptionService.hasFeature(restaurante_id, 'imagen_fondo');
    const hasDiseno = await SubscriptionService.hasFeature(restaurante_id, 'configuracion_diseno');

    if (!hasBanner) {
      banner_promocional_activo = false;
      banner_promocional_texto = null;
    }

    let configSanitizada = sanitizarConfigDiseno(config_diseno);

    if (!hasFondo) {
      if (configSanitizada.apariencia) {
        configSanitizada.apariencia.fondo_imagen_url = null;
        configSanitizada.apariencia.fondo_imagen_horizontal_url = null;
        configSanitizada.apariencia.fondo_imagen_vertical_url = null;
        if (configSanitizada.apariencia.fondo_tipo === 'imagen') {
          configSanitizada.apariencia.fondo_tipo = 'solido';
        }
      }
    }

    if (!hasDiseno) {
      // Bloquear configuraciones avanzadas si no tiene acceso
      configSanitizada.elementos_visuales = {};
      configSanitizada.apariencia.modo_oscuro = false;
    }

    // Validación de colores directos contra inyección CSS / estilo inline
    const hexRegex = /^#[0-9a-fA-F]{3,8}$/;
    const cleanColorPrimario = hexRegex.test(color_primario) ? color_primario : '#FF4A00';
    const cleanColorFondo = hexRegex.test(color_fondo) ? color_fondo : '#0A0A0A';

    // 2. Upsert (Insertar o Actualizar) la configuración del tema
    const query = `
      INSERT INTO configuracion_tema (
        restaurante_id, logo_url, banner_url, color_primario, color_fondo, 
        fuente_familia, layout_type, banner_promocional_activo, banner_promocional_texto, config_diseno
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (restaurante_id) DO UPDATE SET
        logo_url = EXCLUDED.logo_url,
        banner_url = EXCLUDED.banner_url,
        color_primario = EXCLUDED.color_primario,
        color_fondo = EXCLUDED.color_fondo,
        fuente_familia = EXCLUDED.fuente_familia,
        layout_type = EXCLUDED.layout_type,
        banner_promocional_activo = EXCLUDED.banner_promocional_activo,
        banner_promocional_texto = EXCLUDED.banner_promocional_texto,
        config_diseno = EXCLUDED.config_diseno,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      restaurante_id, logo_url, banner_url, cleanColorPrimario, cleanColorFondo,
      fuente_familia, layout_type, banner_promocional_activo, banner_promocional_texto,
      JSON.stringify(configSanitizada)
    ];

    const result = await db.query(query, values);

    // 3. Invalidar caché del menú sincrónicamente (UUID y slug amigable)
    await invalidateMenuCache(restaurante_id);

    res.json({
      mensaje: 'Configuración de marca actualizada correctamente',
      tema: result.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar tema:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor al guardar la configuración' });
  }
};

const getRestaurantInfo = async (req, res) => {
  const restaurante_id = req.user.id;

  try {
    const result = await db.query(
      `SELECT r.id, r.nombre_negocio, r.slug, r.email, r.plan, r.suscripcion_activa, r.nombre_dueno as "nombre_dueño",
              t.logo_url, t.banner_url, t.color_primario, t.color_fondo, 
              t.fuente_familia, t.layout_type, t.banner_promocional_activo, t.banner_promocional_texto,
              t.config_diseno
       FROM restaurantes r
       LEFT JOIN configuracion_tema t ON r.id = t.restaurante_id
       WHERE r.id = $1`,
      [restaurante_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Restaurante no encontrado' });
    }

    const restInfo = result.rows[0];

    // Asegurar que el restaurante tenga un slug amigable asignado
    if (!restInfo.slug && restInfo.nombre_negocio) {
      restInfo.slug = await obtenerSlugUnico(restInfo.nombre_negocio, restaurante_id);
      await db.query('UPDATE restaurantes SET slug = $1 WHERE id = $2', [restInfo.slug, restaurante_id]);
    }

    restInfo.stats = await SubscriptionService.getUsageStats(restaurante_id);

    // Sanitizar config_diseno en base al plan para el admin panel
    if (restInfo.config_diseno) {
      let configDisenoObj = restInfo.config_diseno;
      if (typeof configDisenoObj === 'string') {
        try { configDisenoObj = JSON.parse(configDisenoObj); } catch (e) { configDisenoObj = {}; }
      }
      
      const planConfig = SubscriptionService.getPlanConfig(restInfo.plan || 'basico');
      const features = planConfig.features || {};

      if (configDisenoObj.apariencia) {
        if (!features.imagen_fondo) {
          delete configDisenoObj.apariencia.fondo_imagen_url;
          delete configDisenoObj.apariencia.fondo_imagen_horizontal_url;
          delete configDisenoObj.apariencia.fondo_imagen_vertical_url;
          if (configDisenoObj.apariencia.fondo_tipo === 'imagen') {
            configDisenoObj.apariencia.fondo_tipo = 'solido';
          }
        }
        if (!features.configuracion_diseno) {
          delete configDisenoObj.apariencia.border_radius_botones;
          delete configDisenoObj.apariencia.border_radius_tarjetas;
        }
      }

      if (configDisenoObj.elementos_visuales && !features.configuracion_diseno) {
        delete configDisenoObj.elementos_visuales.glassmorphism;
        delete configDisenoObj.elementos_visuales.sombras_habilitadas;
      }
      
      restInfo.config_diseno = configDisenoObj;
    }

    res.json(restInfo);
  } catch (error) {
    console.error('Error al obtener info del restaurante:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const uploadBrandingImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: 'No se subió ninguna imagen' });
    }

    let url_imagen = req.file.location;

    if (!req.file.isLocal && process.env.CLOUDFRONT_DOMAIN && req.file.location) {
      try {
        const s3Url = new URL(req.file.location);
        url_imagen = `${process.env.CLOUDFRONT_DOMAIN}${s3Url.pathname}`;
      } catch (e) {
        if (req.file.key) {
          url_imagen = `${process.env.CLOUDFRONT_DOMAIN}/${req.file.key}`;
        }
      }
    }

    res.json({
      mensaje: 'Imagen subida correctamente',
      url_imagen
    });
  } catch (error) {
    console.error('Error al procesar la imagen de branding:', error);
    res.status(500).json({ mensaje: 'Error interno al procesar la imagen' });
  }
};

module.exports = {
  generateQR,
  updateTheme,
  getRestaurantInfo,
  uploadBrandingImage
};
