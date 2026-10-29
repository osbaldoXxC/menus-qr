import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { comensalService } from '../../services/comensal';
import { getBreakpointFromWidth, getResolvedBreakpointConfig, BREAKPOINTS_LIST } from '../../utils/responsiveImageUtils';

export interface ComplementoObj {
  nombre: string;
  precio: number;
}

export interface Platillo {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  precio_original?: number | null;
  url_imagen: string;
  activo: boolean;
  porcion?: string;
  nivel_picante?: number;
  etiquetas_dieteticas?: string[];
  ingredientes_principales?: string[];
  complementos?: (string | ComplementoObj)[];
}

export function formatPrice(val: number | string, simbolo = '$', posicion = 'prefijo') {
  const num = Number(val) || 0;
  const formatted = num.toFixed(2);
  return posicion === 'prefijo' ? `${simbolo}${formatted}` : `${formatted} ${simbolo}`;
}

interface Categoria {
  id: string;
  nombre: string;
  orden: number;
  platillos: Platillo[];
}

interface RestaurantInfo {
  nombre: string;
  logo_url: string;
  color_primario: string;
  color_fondo: string;
  fuente_familia: string;
  layout_type: 'LISTA_SIMPLE' | 'CUADRICULA_FOTOS' | 'TARJETAS_DETALLADAS';
  fondo_url?: string;
  fondo_posicion?: string;
  fondo_ajuste?: string;
  fondo_repetir?: string;
  fondo_tipo?: 'solido' | 'gradiente' | 'imagen';
  fondo_valor?: string;
  config_diseno?: any;
}

// Detecta si un color hex es oscuro o claro
function isColorDark(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return true;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Luminancia relativa (fórmula WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

const MENU_DUMMY: { restaurante: RestaurantInfo; categorias: Categoria[] } = {
  restaurante: {
    nombre: 'La Taquería Imperial',
    logo_url: '',
    color_primario: '#FF4A00',
    color_fondo: '#0A0A0A',
    fuente_familia: 'Sans-Serif',
    layout_type: 'TARJETAS_DETALLADAS',
  },
  categorias: [
    {
      id: 'c1', nombre: 'Entradas', orden: 1,
      platillos: [
        { id: 'p1', nombre: 'Guacamole Tradicional', descripcion: 'Aguacate hass con pico de gallo y totopos crujientes.', precio: 85, url_imagen: '', activo: true },
        { id: 'p2', nombre: 'Queso Fundido', descripcion: 'Mezcla de quesos con chorizo o champiñones al horno.', precio: 110, url_imagen: '', activo: true },
      ],
    },
    {
      id: 'c2', nombre: 'Tacos Especiales', orden: 2,
      platillos: [
        { id: 'p3', nombre: 'Taco de Rib Eye', descripcion: 'Corte premium con cebolla caramelizada y salsa verde.', precio: 65, url_imagen: '', activo: true },
        { id: 'p4', nombre: 'Taco de Camarón', descripcion: 'Camarón tempura con aderezo chipotle y aguacate.', precio: 75, url_imagen: '', activo: true },
      ],
    },
  ],
};

const CHINA_MENU_DUMMY: { restaurante: RestaurantInfo; categorias: Categoria[] } = {
  restaurante: {
    nombre: 'Gran Dragón Dorado',
    logo_url: '',
    color_primario: '#D92B2B',
    color_fondo: '#0F0A0A',
    fuente_familia: 'Serif',
    layout_type: 'TARJETAS_DETALLADAS',
    fondo_url: '/comidaChina.jpg',
  },
  categorias: [
    {
      id: 'cc1', nombre: 'Entradas Tradicionales', orden: 1,
      platillos: [
        { id: 'pc1', nombre: 'Dumplings al Vapor (Jiaozi)', descripcion: 'Empanadillas rellenas de cerdo molido finamente y cebollín con un toque de jengibre y soya.', precio: 125, url_imagen: '/images/china1.jpg', activo: true },
        { id: 'pc2', nombre: 'Sopa Wonton Tradicional', descripcion: 'Caldo aromático de ave con wontons caseros rellenos de camarón, cerdo y aceite de sésamo.', precio: 110, url_imagen: '/images/china4.jpg', activo: true },
      ],
    },
    {
      id: 'cc2', nombre: 'Especialidades al Wok', orden: 2,
      platillos: [
        { id: 'pc3', nombre: 'Pato Pekín Laminado', descripcion: 'Pato laqueado y crujiente al estilo imperial, servido con crepas delgadas y salsa hoisin.', precio: 450, url_imagen: '/images/china2.jpg', activo: true },
        { id: 'pc4', nombre: 'Cerdo Agridulce Clásico', descripcion: 'Trozos crujientes de cerdo salteados al wok con pimientos, cebolla y piña en salsa agridulce.', precio: 165, url_imagen: '/images/china3.jpg', activo: true },
        { id: 'pc5', nombre: 'Pollo Kung Pao', descripcion: 'Cubos de pechuga salteados con cacahuates, chiles secos y pimientos en una salsa picante especial.', precio: 180, url_imagen: '/images/china5.jpg', activo: true },
        { id: 'pc6', nombre: 'Ternera en Salsa de Ostras', descripcion: 'Láminas tiernas de ternera salteadas al wok con brócoli fresco en salsa de ostión tradicional.', precio: 195, url_imagen: '/images/china8.jpg', activo: true },
      ],
    },
    {
      id: 'cc3', nombre: 'Arroces y Fideos', orden: 3,
      platillos: [
        { id: 'pc7', nombre: 'Arroz Frito Tres Delicias', descripcion: 'Arroz salteado al wok con camarones, cerdo char siu, huevo y vegetales selectos.', precio: 140, url_imagen: '/images/china6.jpg', activo: true },
        { id: 'pc8', nombre: 'Fideos Chow Mein al Carbón', descripcion: 'Fideos salteados a fuego alto con juliana de verduras y pechuga de pollo deshebrada.', precio: 155, url_imagen: '/images/china7.jpg', activo: true },
      ],
    },
  ],
};

const GOURMET_MENU_DUMMY: { restaurante: RestaurantInfo; categorias: Categoria[] } = {
  restaurante: {
    nombre: "L'Étoile Gourmet",
    logo_url: '',
    color_primario: '#D4AF37',
    color_fondo: '#0A0D10',
    fuente_familia: 'Serif',
    layout_type: 'TARJETAS_DETALLADAS',
    fondo_url: '/ComidaHurmet.jpg',
  },
  categorias: [
    {
      id: 'cg1', nombre: 'Entradas Exclusivas', orden: 1,
      platillos: [
        { id: 'pg1', nombre: 'Tártara de Atún Aleta Azul', descripcion: 'Atún fresco de ensenada marinado en cítricos y soya, rábano sandía y aderezo de sésamo.', precio: 285, url_imagen: '/images/gourmet1.jpg', activo: true },
        { id: 'pg2', nombre: 'Carpaccio de Pulpo del Atlántico', descripcion: 'Finas láminas de pulpo con aceite de oliva extra virgen, alcaparras baby y arúgula orgánica.', precio: 260, url_imagen: '/images/gourmet6.jpg', activo: true },
        { id: 'pg3', nombre: 'Crema de Langosta al Coñac', descripcion: 'Sopa aterciopelada de langosta de California aromatizada con coñac y crema fresca.', precio: 220, url_imagen: '/images/gourmet7.jpg', activo: true },
      ],
    },
    {
      id: 'cg2', nombre: 'Platos Fuertes de Autor', orden: 2,
      platillos: [
        { id: 'pg4', nombre: 'Filete Mignon al Oporto', descripcion: 'Corte premium tierno a la parrilla con reducción de vino de Oporto y puré de papa trufado.', precio: 480, url_imagen: '/images/gourmet2.jpg', activo: true },
        { id: 'pg5', nombre: 'Salmón en Costra de Pistaches', descripcion: 'Salmón fresco sellado al horno con costra crujiente de pistaches y quinoa orgánica.', precio: 360, url_imagen: '/images/gourmet3.jpg', activo: true },
        { id: 'pg6', nombre: 'Risotto de Hongos Silvestres', descripcion: 'Arroz arborio cocinado a fuego lento con boletus, portobellos y parmesano Reggiano.', precio: 290, url_imagen: '/images/gourmet4.jpg', activo: true },
        { id: 'pg7', nombre: 'Magret de Pato a la Naranja', descripcion: 'Pechuga de pato sellada a término medio, bañada en una sutil salsa dulce de cítricos.', precio: 390, url_imagen: '/images/gourmet5.jpg', activo: true },
      ],
    },
    {
      id: 'cg3', nombre: 'Postres de Autor', orden: 3,
      platillos: [
        { id: 'pg8', nombre: 'Volcán de Chocolate Belga', descripcion: 'Bizcocho húmedo de cacao con interior líquido fundido, servido con helado artesanal de vainilla.', precio: 145, url_imagen: '/images/gourmet8.jpg', activo: true },
      ],
    },
  ],
};

function hexToRgbStr(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgba(10, 13, 16, ${opacity})`;
}

export function PublicMenu() {
  const { restaurant_id } = useParams<{ restaurant_id: string }>();
  const [loading, setLoading] = useState(true);
  const [menuData, setMenuData] = useState<{ restaurante: RestaurantInfo; categorias: Categoria[] } | null>(null);
  const [selectedPlatillo, setSelectedPlatillo] = useState<Platillo | null>(null);

  // Algoritmo de breakpoints inteligentes y escalado proporcional
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 390);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determinar baseWidth según el rango de resolución inteligente
  let baseWidth = 390;
  if (windowWidth >= 320 && windowWidth <= 375) baseWidth = 350;
  else if (windowWidth >= 376 && windowWidth <= 430) baseWidth = 400;
  else if (windowWidth >= 431 && windowWidth <= 480) baseWidth = 450;
  else if (windowWidth >= 481 && windowWidth <= 768) baseWidth = 600;
  else if (windowWidth >= 769 && windowWidth <= 1024) baseWidth = 900;
  else if (windowWidth >= 1025 && windowWidth <= 1440) baseWidth = 1200;
  else if (windowWidth > 1440) baseWidth = 1600;

  const rawFactor = windowWidth / baseWidth;
  // Regla: Diferencias menores al 10% del ancho no alterarán la composición (compensación automática)
  const scalingFactor = Math.abs(rawFactor - 1) < 0.1 ? 1 : rawFactor;

  useEffect(() => {
    async function fetchMenu() {
      if (!restaurant_id) return;

      try {
        const data = await comensalService.getMenuByQR(restaurant_id);
        if (!data?.categorias) throw new Error('No data');

        const temaBackend = data.restaurante?.tema || {};
        const configDisenoParsed = typeof temaBackend.config_diseno === 'string'
          ? (() => { try { return JSON.parse(temaBackend.config_diseno); } catch { return {}; } })()
          : (temaBackend.config_diseno || {});

        const aparienciaBackend = configDisenoParsed.apariencia || {};
        const restaurante: RestaurantInfo = {
          nombre: data.restaurante?.nombre || MENU_DUMMY.restaurante.nombre,
          logo_url: temaBackend.logo_url || '',
          color_primario: temaBackend.color_primario || MENU_DUMMY.restaurante.color_primario,
          color_fondo: temaBackend.color_fondo || '#0A0A0A',
          fuente_familia: temaBackend.fuente_familia || 'Sans-Serif',
          layout_type: temaBackend.layout_type || MENU_DUMMY.restaurante.layout_type,
          fondo_url: aparienciaBackend.fondo_imagen_url || temaBackend.fondo_url || temaBackend.banner_url || '',
          fondo_posicion: aparienciaBackend.fondo_imagen_posicion || 'center center',
          fondo_ajuste: aparienciaBackend.fondo_imagen_ajuste || 'cover',
          fondo_repetir: aparienciaBackend.fondo_imagen_repetir || 'no-repeat',
          fondo_tipo: aparienciaBackend.fondo_tipo || 'solido',
          fondo_valor: aparienciaBackend.fondo_valor || '',
          config_diseno: configDisenoParsed
        };

        const cleanCategorias = data.categorias
          .map((cat: any) => ({ ...cat, platillos: (cat.platillos || []).filter((p: any) => p.activo !== false) }))
          .filter((cat: any) => cat.platillos.length > 0)
          .sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0));

        setMenuData({ restaurante, categorias: cleanCategorias });
      } catch (err) {
        console.warn('Error al cargar menú del backend, usando fallback offline:', err);
        // Fallback a los menús mock correspondientes
        if (restaurant_id === 'china' || restaurant_id === 'china-123' || restaurant_id === '22222222-2222-2222-2222-222222222222') {
          setMenuData(CHINA_MENU_DUMMY);
        } else if (restaurant_id === 'gourmet' || restaurant_id === 'gourmet-123' || restaurant_id === '33333333-3333-3333-3333-333333333333') {
          setMenuData(GOURMET_MENU_DUMMY);
        } else {
          setMenuData(MENU_DUMMY);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, [restaurant_id]);


  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-16 h-16 p-2 rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_35px_rgba(210,35,35,0.4)] flex items-center justify-center"
        >
          <img src="/favicon.svg" alt="MexxicanMX" className="w-12 h-12 object-contain" />
        </motion.div>
      </div>
    );
  }

  if (!menuData) return null;

  const { restaurante, categorias } = menuData;

  // Paleta adaptativa basada en el color de fondo elegido
  const dark = isColorDark(restaurante.color_fondo);
  const primary = restaurante.color_primario || '#FF4A00';
  const bg = restaurante.color_fondo || '#0A0A0A';

  // Fallbacks de colores por defecto
  const defaultTextMain = dark ? 'rgba(245,245,247,1)' : 'rgba(29,29,31,1)';
  const defaultTextSub  = dark ? 'rgba(161,161,166,1)' : 'rgba(134,134,139,1)';

  // Validaciones hexadecimales de color
  const hexRegex = /^#[0-9a-fA-F]{3,8}$/;
  const colorNormal = restaurante.config_diseno?.apariencia?.color_normal;
  const colorDescripcion = restaurante.config_diseno?.apariencia?.color_descripcion;

  const textMain = (colorNormal && hexRegex.test(colorNormal)) ? colorNormal : defaultTextMain;
  const textSub  = (colorDescripcion && hexRegex.test(colorDescripcion)) ? colorDescripcion : defaultTextSub;

  // Colores de texto, bordes y superficies derivados del modo
  const textMuted   = dark ? 'rgba(110,110,115,1)'   : 'rgba(174,174,178,1)';
  const surface     = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const surfaceHover= dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
  const border      = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const headerBg    = dark ? `${bg}cc`               : `${bg}cc`;
  const priceBadge  = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // Configuración de bordes, sombras y diseño
  const configVisuales = restaurante.config_diseno?.elementos_visuales || {};
  const configApariencia = restaurante.config_diseno?.apariencia || {};

  const fontFamily =
    restaurante.fuente_familia === 'Serif' ? 'Georgia, "Times New Roman", serif' :
    restaurante.fuente_familia === 'Mono'  ? '"SF Mono", "JetBrains Mono", monospace' :
    restaurante.fuente_familia === 'Poppins' ? 'Poppins, sans-serif' :
    restaurante.fuente_familia === 'Outfit' ? 'Outfit, sans-serif' :
    'Inter, -apple-system, BlinkMacSystemFont, sans-serif';

  const css = { 
    '--bg': bg, 
    '--primary': primary, 
    '--text': textMain, 
    '--text-sub': textSub, 
    '--text-muted': textMuted, 
    '--surface': surface, 
    '--surface-hover': surfaceHover, 
    '--border': border,
    '--scale-factor': scalingFactor
  } as React.CSSProperties;

  // Resolver la configuración del breakpoint activo según el ancho de pantalla
  const activeBpKey = getBreakpointFromWidth(windowWidth);
  const { config: bpConfig } = getResolvedBreakpointConfig(
    configApariencia.responsive_imagen,
    activeBpKey,
    configApariencia
  );

  const isHorizontalBp = ['desktop_large', 'desktop', 'laptop'].includes(activeBpKey);
  const layoutType = isHorizontalBp 
    ? (restaurante.config_diseno?.layout?.layout_type_horizontal || restaurante.layout_type || 'TARJETAS_DETALLADAS')
    : (restaurante.config_diseno?.layout?.layout_type_vertical || restaurante.layout_type || 'TARJETAS_DETALLADAS');

  // Selección dinámica de imagen de fondo: Horizontal vs Vertical estrictamente desacoplada
  const rawFondoUrl = isHorizontalBp
    ? (configApariencia.fondo_imagen_horizontal_url || (!configApariencia.fondo_imagen_vertical_url ? (configApariencia.fondo_imagen_url || restaurante.fondo_url) : ''))
    : (configApariencia.fondo_imagen_vertical_url || (!configApariencia.fondo_imagen_horizontal_url ? (configApariencia.fondo_imagen_url || restaurante.fondo_url) : ''));

  // Blindaje estricto: Si el tipo configurado es 'solido' o 'gradiente', NUNCA renderizar imagen de fondo
  const fondoTipo = restaurante.fondo_tipo || configApariencia.fondo_tipo || 'solido';
  const isImageBg = (fondoTipo === 'imagen') && !!rawFondoUrl;
  const fondoUrl = isImageBg ? rawFondoUrl : '';

  const borderRadiusBotones = configApariencia.border_radius_botones || '12px';
  const borderRadiusTarjetas = configApariencia.border_radius_tarjetas || '24px';
  const sombrasHabilitadas = configVisuales.sombras_habilitadas !== undefined ? configVisuales.sombras_habilitadas : true;
  
  // Condicional crítico: glassmorphism solo si existe imagen de fondo configurada
  const glassmorphismActivo = !!(configVisuales.glassmorphism && isImageBg && fondoUrl);

  // Nuevas opciones de personalización total (Alternativa 1)
  const estiloEncabezado = restaurante.config_diseno?.layout?.estilo_encabezado || 'fondo_completo';
  const isHeroBanner = estiloEncabezado === 'banner_hero';
  const tarjetaEstilo = configVisuales.tarjeta_estilo || (configVisuales.glassmorphism ? 'frosted' : 'solida');
  const tarjetaOpacidad = configVisuales.tarjeta_opacidad ?? (configVisuales.glassmorphism ? 35 : 95);
  const simboloMoneda = restaurante.config_diseno?.moneda?.simbolo || '$';
  const posicionMoneda = restaurante.config_diseno?.moneda?.posicion || 'prefijo';

  const isSticky = restaurante.config_diseno?.layout?.categorias_sticky !== false;

  const isGradientBg = restaurante.fondo_tipo === 'gradiente';

  const blurVal = Math.min(Math.max(Number(configApariencia.fondo_imagen_blur) || 0, 0), 100);
  const brightness = Math.min(Math.max(Number(configApariencia.fondo_imagen_brightness) || 100, 0), 300);
  const contrast = Math.min(Math.max(Number(configApariencia.fondo_imagen_contrast) || 100, 0), 300);
  const saturate = Math.min(Math.max(Number(configApariencia.fondo_imagen_saturate) || 100, 0), 300);

  // Validación de color hexadecimal
  const overlayColor = hexRegex.test(configApariencia.fondo_overlay_color) 
    ? configApariencia.fondo_overlay_color 
    : '#000000';

  const overlayOpacity = Math.min(Math.max(Number(configApariencia.fondo_overlay_opacity) ?? 0.5, 0), 1);
  const gradientActive = !!configApariencia.fondo_overlay_gradient_active;
  
  let gradientVal = '';
  if (gradientActive && typeof configApariencia.fondo_overlay_gradient === 'string') {
    const cleanGrad = configApariencia.fondo_overlay_gradient;
    if (cleanGrad.startsWith('linear-gradient') && !cleanGrad.includes('javascript:') && !cleanGrad.includes('<script>')) {
      gradientVal = cleanGrad;
    }
  }

  // Obtener metadata del breakpoint activo para escalar el lienzo de forma proporcional
  const activeBpMeta = BREAKPOINTS_LIST.find(b => b.key === activeBpKey) || BREAKPOINTS_LIST[1];
  const viewportScale = windowWidth / (activeBpMeta.defaultW || 1920);

  return (
    <div
      style={{
        ...css,
        color: textMain,
        fontFamily,
      }}
      className="min-h-screen pb-24 transition-all duration-500 relative overflow-x-clip"
    >
      {/* Fondo fijo e independiente */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none w-full h-full overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: bg }}
      >
        {isImageBg && fondoUrl && (
          <div 
            className="relative flex items-center justify-center origin-center flex-shrink-0"
            style={{ 
              width: `${activeBpMeta.defaultW}px`, 
              height: `${activeBpMeta.defaultH}px`,
              transform: `scale(${viewportScale})`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <div
              className="absolute flex items-center justify-center origin-center transition-all duration-200"
              style={{
                width: `${bpConfig.width}px`,
                height: `${bpConfig.height}px`,
                transform: `translate3d(${bpConfig.position_x}px, ${bpConfig.position_y}px, 0px) scale(${bpConfig.scale}) rotate(${bpConfig.rotation}deg)`,
                transformOrigin: 'center center',
                zIndex: bpConfig.z_index,
                opacity: bpConfig.opacity / 100,
                borderRadius: `${bpConfig.border_radius}px`,
              }}
            >
              <img 
                src={fondoUrl} 
                alt=""
                className="w-full h-full max-w-none select-none"
                style={{
                  objectFit: bpConfig.object_fit as any,
                  borderRadius: `${bpConfig.border_radius}px`,
                  filter: `blur(${blurVal}px) brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`,
                  transition: 'filter 0.3s ease',
                }}
              />
              {/* Overlay de color u opacidad */}
              <div 
                className="absolute inset-0 w-full h-full"
                style={{
                  backgroundColor: overlayColor,
                  opacity: overlayOpacity,
                  backgroundImage: gradientActive ? gradientVal : 'none',
                  borderRadius: `${bpConfig.border_radius}px`
                }}
              />
            </div>
          </div>
        )}
        
        {isGradientBg && restaurante.fondo_valor && (
          <div 
            className="absolute inset-0 w-full h-full"
            style={{ background: restaurante.fondo_valor }}
          />
        )}
      </div>

      {/* Contenedor del contenido (con z-10 relativo) */}
      {/* NOTA: se eliminó transform:scale() de este contenedor porque rompía position:sticky del header */}
      {/* Ver: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context */}
      <div 
        className="relative z-10 flex flex-col w-full h-full min-h-screen"
      >

      {/* ── HERO BANNER SUPERIOR (Si layout.estilo_encabezado === 'banner_hero') ── */}
      {isHeroBanner && (
        <div className="relative w-full overflow-hidden mb-6">
          {/* Cabecera superior con el color de marca elegido arriba */}
          <div 
            className="h-44 sm:h-56 md:h-64 w-full relative overflow-hidden flex items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${primary} 0%, ${bg} 100%)`
            }}
          >
            {/* Overlay sutil de luminosidad y contraste */}
            <div className="absolute inset-0 bg-black/15 backdrop-blur-[1px]" />
          </div>

          {/* Tarjeta de Información en relieve sobre el Hero - Centrado armónico */}
          <div className="max-w-[900px] mx-auto px-5 -mt-16 sm:-mt-20 relative z-20 flex flex-col items-center text-center gap-3">
            {restaurante.logo_url ? (
              <img
                src={restaurante.logo_url}
                alt={restaurante.nombre}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover shadow-2xl border-4 ring-2 ring-black/5"
                style={{ borderColor: surface, backgroundColor: surface }}
              />
            ) : (
              <div
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex items-center justify-center font-black text-3xl shadow-2xl border-4 ring-2 ring-black/5"
                style={{ borderColor: surface, backgroundColor: `${primary}20`, color: primary }}
              >
                {restaurante.nombre.charAt(0)}
              </div>
            )}
            <div className="space-y-1.5 max-w-xl">
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight" style={{ color: textMain }}>
                {restaurante.nombre}
              </h1>
              {restaurante.config_diseno?.informacion?.ambiente && (
                <p className="text-xs sm:text-sm font-semibold opacity-85" style={{ color: textSub }}>
                  ✨ {restaurante.config_diseno.informacion.ambiente}
                </p>
              )}
              {restaurante.config_diseno?.informacion?.direccion && (
                <p className="text-xs opacity-75 max-w-md mx-auto line-clamp-1" style={{ color: textSub }}>
                  📍 {restaurante.config_diseno.informacion.direccion}
                </p>
              )}
            </div>

            {/* Badges de estado centrados */}
            {restaurante.config_diseno?.layout?.mostrar_estado_abierto !== false && (
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Abierto ahora
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HEADER (Solo para formato compacto cuando no hay Hero Banner) ── */}
      {!isHeroBanner && (
        <header
          className="sticky top-0 z-50 px-5 py-3.5 flex items-center justify-between backdrop-blur-xl"
          style={{ backgroundColor: 'transparent' }}
        >
          <div className="flex items-center gap-3">
            {restaurante.logo_url ? (
              <img src={restaurante.logo_url} alt={restaurante.nombre} className="h-9 w-9 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0"
                style={{ backgroundColor: `${primary}20`, color: primary }}
              >
                {restaurante.nombre.charAt(0)}
              </div>
            )}
            <span className="font-bold text-[15px] tracking-tight" style={{ color: textMain }}>
              {restaurante.nombre}
            </span>
          </div>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primary, boxShadow: `0 0 8px ${primary}` }} />
        </header>
      )}

      {/* ── NAV CATEGORÍAS (Centrado armónico con el menú) ── */}
      <nav
        className={`${isSticky ? 'sticky top-0' : 'relative'} z-40 px-5 py-3 backdrop-blur-xl`}
        style={{ backgroundColor: 'transparent' }}
      >
        <div className="max-w-[900px] mx-auto flex items-center justify-center overflow-x-auto scrollbar-hide py-1">
          <div className="flex gap-2 w-max">
          {categorias.map(cat => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              className="px-4 py-1.5 text-[13px] font-semibold transition-all whitespace-nowrap"
              style={{ 
                backgroundColor: surface, 
                color: textSub, 
                border: `1px solid ${border}`,
                borderRadius: borderRadiusBotones
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.backgroundColor = surfaceHover; (e.target as HTMLElement).style.color = textMain; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = surface; (e.target as HTMLElement).style.color = textSub; }}
            >
              {cat.nombre}
            </a>
          ))}
        </div>
        </div>
      </nav>

      {/* ── CONTENIDO ── */}
      <main className="max-w-[900px] mx-auto px-5 pt-10 space-y-16">
        {categorias.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`}>
            <motion.h2
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-[1.6rem] font-black tracking-tight mb-7 pl-4"
              style={{ color: textMain, borderLeft: `4px solid ${primary}` }}
            >
              {cat.nombre}
            </motion.h2>

            <div className={
              layoutType === 'LISTA_SIMPLE'       ? 'flex flex-col' :
              layoutType === 'CUADRICULA_FOTOS'   ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4' :
              'flex flex-col gap-5'
            }>
              {cat.platillos.map((p, i) => (
                <PlatilloCard
                  key={p.id}
                  platillo={p}
                  layout={layoutType}
                  index={i}
                  onSelect={() => setSelectedPlatillo(p)}
                  colors={{ 
                    primary, textMain, textSub, textMuted, surface, surfaceHover, border, priceBadge, dark,
                    borderRadiusBotones, borderRadiusTarjetas, sombrasHabilitadas, glassmorphismActivo,
                    tarjetaEstilo, tarjetaOpacidad, simboloMoneda, posicionMoneda
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* ── FOOTER ── */}
      <footer className="mt-20 py-10 text-center space-y-4" style={{ borderTop: `1px solid ${border}` }}>
        <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3" style={{ color: textMuted }}>
          Menú digital por MexxicanMX
        </p>
        
        {/* Información del Establecimiento */}
        {(restaurante.config_diseno?.informacion?.direccion || restaurante.config_diseno?.informacion?.ambiente) && (
          <div className="text-[12px] space-y-1.5 opacity-70" style={{ color: textSub }}>
            {restaurante.config_diseno.informacion.ambiente && (
              <p className="font-bold">✨ Ambiente / Concepto: <span className="font-normal">{restaurante.config_diseno.informacion.ambiente}</span></p>
            )}
            {restaurante.config_diseno.informacion.direccion && (
              <p className="max-w-[450px] mx-auto px-5 leading-relaxed">📍 Dirección: {restaurante.config_diseno.informacion.direccion}</p>
            )}
          </div>
        )}

        <div className="flex justify-center gap-3 text-xl opacity-40">
          <span>🌮</span><span>⚡</span><span>🤖</span>
        </div>
      </footer>
      </div>

      {/* ── MODAL DE DETALLE DE PLATILLO (CAPA 2) ── */}
      <AnimatePresence>
        {selectedPlatillo && (
          <PlatilloDetailModal
            platillo={selectedPlatillo}
            onClose={() => setSelectedPlatillo(null)}
            colors={{ 
              primary, textMain, textSub, textMuted, surface, surfaceHover, border, priceBadge, dark,
              borderRadiusBotones, borderRadiusTarjetas, sombrasHabilitadas, glassmorphismActivo,
              tarjetaEstilo, tarjetaOpacidad, simboloMoneda, posicionMoneda
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface CardColors {
  primary: string; textMain: string; textSub: string; textMuted: string;
  surface: string; surfaceHover: string; border: string; priceBadge: string; dark: boolean;
  borderRadiusBotones: string; borderRadiusTarjetas: string; sombrasHabilitadas: boolean;
  glassmorphismActivo: boolean;
  tarjetaEstilo?: string;
  tarjetaOpacidad?: number;
  simboloMoneda?: string;
  posicionMoneda?: string;
}

function PlatilloCard({ platillo, layout, index, colors, onSelect }: {
  platillo: Platillo; layout: string; index: number; colors: CardColors; onSelect: () => void;
}) {
  const { 
    primary, textMain, textSub, surface, surfaceHover, border, priceBadge, dark,
    borderRadiusBotones, borderRadiusTarjetas, sombrasHabilitadas, glassmorphismActivo,
    tarjetaEstilo, tarjetaOpacidad, simboloMoneda, posicionMoneda
  } = colors;

  const estilo = tarjetaEstilo || (glassmorphismActivo ? 'frosted' : 'solida');
  const opacidadPct = Math.min(Math.max(Number(tarjetaOpacidad ?? (estilo === 'solida' ? 95 : 35)), 10), 100);
  const alpha = (opacidadPct / 100).toFixed(2);
  const simbolo = simboloMoneda || '$';
  const posicion = posicionMoneda || 'prefijo';

  const hasDiscount = !!(platillo.precio_original && Number(platillo.precio_original) > Number(platillo.precio));
  const discountPct = hasDiscount 
    ? Math.round(((Number(platillo.precio_original) - Number(platillo.precio)) / Number(platillo.precio_original)) * 100) 
    : 0;

  // Fallbacks de border-radius nativos para no alterar la apariencia por defecto
  const radiusTarjetas = borderRadiusTarjetas || (
    layout === 'LISTA_SIMPLE' ? '12px' :
    layout === 'CUADRICULA_FOTOS' ? '22px' : '24px'
  );

  const radiusBotones = borderRadiusBotones || '9999px';

  const radiusImagenes = borderRadiusBotones || (
    layout === 'LISTA_SIMPLE' ? '12px' :
    layout === 'CUADRICULA_FOTOS' ? '22px' : '16px'
  );

  const anim = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { delay: index * 0.05, duration: 0.45 } },
  };

  const Placeholder = () => (
    <div className="w-full h-full flex items-center justify-center text-4xl" style={{ backgroundColor: `${primary}12` }}>
      🍽️
    </div>
  );

  const renderPicante = (num?: number) => {
    if (!num || num <= 0) return null;
    return '🌶️'.repeat(Math.min(num, 4));
  };

  const tagLabels: Record<string, { label: string; icon: string }> = {
    sin_gluten: { label: 'Sin Gluten', icon: '🌾' },
    vegano: { label: 'Vegano', icon: '🌱' },
    vegetariano: { label: 'Vegetariano', icon: '🥗' },
    sin_lactosa: { label: 'Sin Lactosa', icon: '🥛' },
    keto: { label: 'Keto', icon: '🥑' },
  };

  // ── LISTA SIMPLE ──
  if (layout === 'LISTA_SIMPLE') {
    return (
      <motion.div
        variants={anim} initial="hidden" whileInView="visible" viewport={{ once: true }}
        onClick={onSelect}
        className="flex items-center justify-between py-4 px-3 transition-colors cursor-pointer group"
        style={{ color: textMain, borderBottom: `1px solid ${border}`, borderRadius: radiusTarjetas }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = surface)}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {platillo.url_imagen && (
          <img 
            src={platillo.url_imagen} 
            alt={platillo.nombre} 
            className="w-14 h-14 object-cover flex-shrink-0 mr-4" 
            style={{ borderRadius: radiusImagenes }}
          />
        )}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[15px] truncate group-hover:text-apple-blue transition-colors" style={{ color: textMain }}>{platillo.nombre}</h3>
            {platillo.nivel_picante ? <span className="text-xs flex-shrink-0">{renderPicante(platillo.nivel_picante)}</span> : null}
            {hasDiscount && (
              <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-red-500/15 text-red-500 border border-red-500/30">
                -{discountPct}%
              </span>
            )}
          </div>
          <p className="text-[12px] mt-0.5 truncate" style={{ color: textSub }}>
            {platillo.porcion && <span className="font-semibold text-emerald-500 mr-1.5">{platillo.porcion} •</span>}
            {platillo.descripcion}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {hasDiscount && (
            <span className="block text-[11px] line-through opacity-50 font-medium" style={{ color: textSub }}>
              {formatPrice(platillo.precio_original!, simbolo, posicion)}
            </span>
          )}
          <span className="font-black text-[16px]" style={{ color: primary }}>
            {formatPrice(platillo.precio, simbolo, posicion)}
          </span>
        </div>
      </motion.div>
    );
  }

  // ── CUADRÍCULA ──
  if (layout === 'CUADRICULA_FOTOS') {
    return (
      <motion.div
        variants={anim} initial="hidden" whileInView="visible" viewport={{ once: true }}
        onClick={onSelect}
        className="group flex flex-col gap-2.5 cursor-pointer"
      >
        <div className="aspect-square overflow-hidden relative" style={{ borderRadius: radiusTarjetas, border: `1px solid ${border}` }}>
          {platillo.url_imagen
            ? <img src={platillo.url_imagen} alt={platillo.nombre} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            : <Placeholder />
          }
          {platillo.nivel_picante ? (
            <div className="absolute top-2 left-2 px-2 py-0.5 text-xs bg-black/60 backdrop-blur-md rounded-full shadow-md">
              {renderPicante(platillo.nivel_picante)}
            </div>
          ) : null}
          {hasDiscount && (
            <div className="absolute top-2 right-2 px-2 py-0.5 text-[11px] font-black bg-red-600 text-white rounded-md shadow-md animate-pulse">
              -{discountPct}%
            </div>
          )}
          <div
            className="absolute bottom-2.5 right-2.5 px-2.5 py-1 text-[12px] font-bold backdrop-blur-md shadow-md flex items-center gap-1.5"
            style={{ backgroundColor: `${primary}dd`, color: '#fff', borderRadius: radiusBotones }}
          >
            {hasDiscount && (
              <span className="line-through opacity-75 text-[10px] font-normal">
                {formatPrice(platillo.precio_original!, simbolo, posicion)}
              </span>
            )}
            <span>{formatPrice(platillo.precio, simbolo, posicion)}</span>
          </div>
        </div>
        <div className="text-center px-1">
          <h3 className="font-bold text-[14px] line-clamp-1 group-hover:opacity-80 transition-opacity" style={{ color: textMain }}>{platillo.nombre}</h3>
          {platillo.porcion && <p className="text-[11px] opacity-70 mt-0.5">{platillo.porcion}</p>}
        </div>
      </motion.div>
    );
  }

  // ── TARJETAS DETALLADAS ──
  let cardBg = surface;
  let cardBackdrop = 'none';
  let cardBorder = `1px solid ${border}`;

  if (estilo === 'solida') {
    cardBg = dark ? `rgba(26, 26, 30, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
    cardBackdrop = 'none';
  } else if (estilo === 'frosted') {
    cardBg = dark ? `rgba(18, 18, 22, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
    cardBackdrop = 'blur(16px)';
  } else if (estilo === 'minimalista') {
    cardBg = 'transparent';
    cardBackdrop = 'none';
    cardBorder = `1px dashed ${border}`;
  }

  return (
    <motion.div
      variants={anim} initial="hidden" whileInView="visible" viewport={{ once: true }}
      onClick={onSelect}
      className="flex flex-col sm:flex-row gap-5 p-5 group transition-all duration-300 relative cursor-pointer"
      style={{ 
        backgroundColor: cardBg,
        backdropFilter: cardBackdrop,
        WebkitBackdropFilter: cardBackdrop,
        border: cardBorder,
        borderRadius: radiusTarjetas,
        boxShadow: sombrasHabilitadas ? (dark ? '0 10px 30px -10px rgba(0,0,0,0.6)' : '0 10px 30px -10px rgba(0,0,0,0.08)') : 'none'
      }}
      onMouseEnter={e => {
        if (estilo !== 'minimalista') {
          e.currentTarget.style.backgroundColor = dark ? `rgba(38, 38, 44, ${Math.min(Number(alpha) + 0.1, 1)})` : `rgba(245, 245, 247, ${Math.min(Number(alpha) + 0.05, 1)})`;
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = cardBg;
      }}
    >
      <div
        className="w-full sm:w-44 h-44 overflow-hidden flex-shrink-0 relative"
        style={{ border: `1px solid ${border}`, borderRadius: radiusImagenes }}
      >
        {platillo.url_imagen
          ? <img src={platillo.url_imagen} alt={platillo.nombre} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <Placeholder />
        }
      </div>

      <div className="flex-1 flex flex-col justify-between py-1">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <h3 className="text-[1.15rem] font-black tracking-tight flex items-center gap-2" style={{ color: textMain }}>
              <span>{platillo.nombre}</span>
              {platillo.nivel_picante ? <span className="text-sm">{renderPicante(platillo.nivel_picante)}</span> : null}
            </h3>
          </div>

          {platillo.porcion && (
            <p className="text-[12px] font-medium text-emerald-500 mb-2">
              {platillo.porcion}
            </p>
          )}

          {/* Badges dietéticos */}
          {Array.isArray(platillo.etiquetas_dieteticas) && platillo.etiquetas_dieteticas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {platillo.etiquetas_dieteticas.map((tagKey) => {
                const info = tagLabels[tagKey];
                if (!info) return null;
                return (
                  <span
                    key={tagKey}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  >
                    <span>{info.icon}</span>
                    <span>{info.label}</span>
                  </span>
                );
              })}
            </div>
          )}

          <p className="text-[13px] leading-relaxed line-clamp-2" style={{ color: textSub }}>
            {platillo.descripcion}
          </p>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="text-[1.3rem] font-black"
              style={{ color: primary }}
            >
              {formatPrice(platillo.precio, simbolo, posicion)}
            </span>
            {hasDiscount && (
              <span className="text-[12px] line-through font-medium opacity-50" style={{ color: textSub }}>
                {formatPrice(platillo.precio_original!, simbolo, posicion)}
              </span>
            )}
            {hasDiscount && (
              <span className="px-2 py-0.5 text-[10px] font-black rounded bg-red-500/15 text-red-500 border border-red-500/30">
                -{discountPct}% OFF
              </span>
            )}
          </div>
          <span
            className="px-3 py-1 text-[11px] font-bold transition-all group-hover:scale-105"
            style={{ 
              backgroundColor: priceBadge, 
              color: textSub, 
              border: `1px solid ${border}`,
              borderRadius: radiusBotones
            }}
          >
            Ver detalle
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function PlatilloDetailModal({ platillo, onClose, colors }: {
  platillo: Platillo;
  onClose: () => void;
  colors: CardColors;
}) {
  const { primary, textMain, textSub, surface, border, dark, simboloMoneda, posicionMoneda } = colors;
  const simbolo = simboloMoneda || '$';
  const posicion = posicionMoneda || 'prefijo';

  const [selectedExtras, setSelectedExtras] = useState<Record<number, boolean>>({});

  const complementosList: ComplementoObj[] = (platillo.complementos || []).map((c: any) => {
    if (typeof c === 'string') {
      return { nombre: c, precio: 0 };
    }
    return { nombre: c.nombre || '', precio: Number(c.precio) || 0 };
  });

  const basePrice = Number(platillo.precio) || 0;
  const extrasTotal = complementosList.reduce((acc, comp, idx) => {
    return acc + (selectedExtras[idx] ? comp.precio : 0);
  }, 0);
  const totalPrice = basePrice + extrasTotal;

  const renderPicante = (num?: number) => {
    if (!num || num <= 0) return null;
    return '🌶️'.repeat(Math.min(num, 4));
  };

  const tagLabels: Record<string, { label: string; icon: string }> = {
    sin_gluten: { label: 'Sin Gluten', icon: '🌾' },
    vegano: { label: 'Vegano', icon: '🌱' },
    vegetariano: { label: 'Vegetariano', icon: '🥗' },
    sin_lactosa: { label: 'Sin Lactosa', icon: '🥛' },
    keto: { label: 'Keto', icon: '🥑' },
  };

  const hasDiscount = !!(platillo.precio_original && Number(platillo.precio_original) > Number(platillo.precio));
  const discountPct = hasDiscount 
    ? Math.round(((Number(platillo.precio_original) - Number(platillo.precio)) / Number(platillo.precio_original)) * 100) 
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl flex flex-col"
        style={{ backgroundColor: dark ? '#121212' : '#ffffff', borderColor: border, color: textMain }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Image Banner */}
        <div className="relative w-full h-64 flex-shrink-0 bg-black/20 overflow-hidden">
          {platillo.url_imagen ? (
            <img src={platillo.url_imagen} alt={platillo.nombre} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">
              🍽️
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center font-bold backdrop-blur-md hover:bg-black/80 transition-all z-10"
          >
            ✕
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 flex-1 space-y-5">
          {/* Header Title & Price */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-2" style={{ color: textMain }}>
                <span>{platillo.nombre}</span>
                {platillo.nivel_picante ? <span className="text-base">{renderPicante(platillo.nivel_picante)}</span> : null}
              </h2>
              {platillo.porcion && (
                <p className="text-xs font-semibold mt-1 text-emerald-500">
                  ⚖️ {platillo.porcion}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              {hasDiscount && (
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <span className="text-xs line-through opacity-50 font-medium" style={{ color: textSub }}>
                    {formatPrice(platillo.precio_original!, simbolo, posicion)}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-red-500/20 text-red-500">
                    -{discountPct}% OFF
                  </span>
                </div>
              )}
              <span className="text-2xl font-black" style={{ color: primary }}>
                {formatPrice(totalPrice, simbolo, posicion)}
              </span>
            </div>
          </div>

          {/* Dietary Badges */}
          {Array.isArray(platillo.etiquetas_dieteticas) && platillo.etiquetas_dieteticas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {platillo.etiquetas_dieteticas.map((tagKey) => {
                const info = tagLabels[tagKey];
                if (!info) return null;
                return (
                  <span
                    key={tagKey}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  >
                    <span>{info.icon}</span>
                    <span>{info.label}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Complete Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-1.5 opacity-60" style={{ color: textSub }}>
              Descripción Completa
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: textSub }}>
              {platillo.descripcion}
            </p>
          </div>

          {/* Ingredientes Principales */}
          {Array.isArray(platillo.ingredientes_principales) && platillo.ingredientes_principales.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2 opacity-60 flex items-center gap-1" style={{ color: textSub }}>
                <span>🥬 Ingredientes Principales</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {platillo.ingredientes_principales.map((ing, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: surface, border: `1px solid ${border}`, color: textSub }}
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Complementos / Extras */}
          {complementosList.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5 opacity-60" style={{ color: textSub }}>
                Complementos y Opciones
              </h4>
              <div className="space-y-2">
                {complementosList.map((comp, idx) => {
                  const isChecked = !!selectedExtras[idx];
                  return (
                    <label
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all"
                      style={{
                        backgroundColor: isChecked ? `${primary}12` : surface,
                        borderColor: isChecked ? primary : border,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedExtras({ ...selectedExtras, [idx]: e.target.checked })
                          }
                          className="w-4 h-4 rounded text-apple-blue focus:ring-apple-blue cursor-pointer"
                        />
                          <span className="text-sm font-bold">{comp.nombre}</span>
                      </div>
                      {comp.precio > 0 && (
                        <span className="text-xs font-black text-emerald-500">
                          + {formatPrice(comp.precio, simbolo, posicion)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-4">
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-full font-bold text-white text-sm shadow-md transition-all active:scale-[0.98]"
              style={{ backgroundColor: primary }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
