export type BreakpointKey =
  | 'mobile_small'
  | 'mobile'
  | 'tablet'
  | 'laptop'
  | 'desktop'
  | 'desktop_large';

export type ObjectFitValue = 'cover' | 'contain' | 'fill' | 'none';

export interface ImageBreakpointConfig {
  width: number;        // px
  height: number;       // px
  position_x: number;   // px
  position_y: number;   // px
  scale: number;        // decimal (e.g. 1.0)
  rotation: number;     // degrees (0-360)
  object_fit: ObjectFitValue;
  border_radius: number;// px
  opacity: number;      // 0 - 100
  z_index: number;      // integer
  custom?: boolean;     // true if explicitly edited for this breakpoint
}

export type ResponsiveImageMap = {
  [K in BreakpointKey]?: ImageBreakpointConfig;
};

export interface BreakpointMeta {
  key: BreakpointKey;
  label: string;
  minWidth: number;
  maxWidth: number | null;
  defaultW: number;
  defaultH: number;
  icon: string;
  aspectRatio: string;
}

export const BREAKPOINTS_LIST: BreakpointMeta[] = [
  { key: 'desktop_large', label: 'Desktop XL',     minWidth: 1536, maxWidth: null, defaultW: 2560, defaultH: 1440, icon: '🖥️', aspectRatio: '16:9' },
  { key: 'desktop',       label: 'Desktop',        minWidth: 1280, maxWidth: 1535, defaultW: 1920, defaultH: 1080, icon: '💻', aspectRatio: '16:9' },
  { key: 'laptop',        label: 'Laptop',         minWidth: 1024, maxWidth: 1279, defaultW: 1366, defaultH: 768,  icon: '💻', aspectRatio: '16:9' },
  { key: 'tablet',        label: 'Tablet',         minWidth: 640,  maxWidth: 1023, defaultW: 768,  defaultH: 1024, icon: '📟', aspectRatio: '3:4' },
  { key: 'mobile',        label: 'Móvil Standard', minWidth: 375,  maxWidth: 639,  defaultW: 390,  defaultH: 844,  icon: '📱', aspectRatio: '9:19' },
  { key: 'mobile_small',  label: 'Móvil Pequeño',  minWidth: 0,    maxWidth: 374,  defaultW: 320,  defaultH: 568,  icon: '📲', aspectRatio: '9:16' },
];

export const BREAKPOINT_GROUPS = {
  HORIZONTAL: ['desktop_large', 'desktop', 'laptop'] as BreakpointKey[],
  VERTICAL: ['tablet', 'mobile', 'mobile_small'] as BreakpointKey[]
};

export const BREAKPOINT_ORDER: BreakpointKey[] = [
  ...BREAKPOINT_GROUPS.HORIZONTAL,
  ...BREAKPOINT_GROUPS.VERTICAL
];

/**
 * Normaliza y valida una configuración de breakpoint individual
 */
export function sanitizeBreakpointConfig(
  raw: Partial<ImageBreakpointConfig> | undefined,
  bp: BreakpointKey
): ImageBreakpointConfig {
  const meta = BREAKPOINTS_LIST.find(b => b.key === bp) || BREAKPOINTS_LIST[1];
  const conf = raw || {};

  const width = (conf.width !== undefined && !isNaN(Number(conf.width))) ? Number(conf.width) : meta.defaultW;
  const height = (conf.height !== undefined && !isNaN(Number(conf.height))) ? Number(conf.height) : meta.defaultH;
  const position_x = isNaN(Number(conf.position_x)) ? 0 : Number(conf.position_x);
  const position_y = isNaN(Number(conf.position_y)) ? 0 : Number(conf.position_y);
  const scale = Math.max(0.1, Math.min(10, isNaN(Number(conf.scale)) ? 1 : Number(conf.scale)));
  const rotation = isNaN(Number(conf.rotation)) ? 0 : Number(conf.rotation);
  
  const validFits: ObjectFitValue[] = ['cover', 'contain', 'fill', 'none'];
  const object_fit = validFits.includes(conf.object_fit as any) ? (conf.object_fit as ObjectFitValue) : 'cover';
  
  const border_radius = Math.max(0, Math.min(500, isNaN(Number(conf.border_radius)) ? 0 : Number(conf.border_radius)));
  const opacity = Math.max(0, Math.min(100, isNaN(Number(conf.opacity)) ? 100 : Number(conf.opacity)));
  const z_index = Math.round(isNaN(Number(conf.z_index)) ? 0 : Number(conf.z_index));

  return {
    width,
    height,
    position_x,
    position_y,
    scale,
    rotation,
    object_fit,
    border_radius,
    opacity,
    z_index,
    custom: !!conf.custom
  };
}

/**
 * Detecta la resolución activa según el ancho de pantalla
 */
export function getBreakpointFromWidth(width: number): BreakpointKey {
  if (width >= 1536) return 'desktop_large';
  if (width >= 1280) return 'desktop';
  if (width >= 1024) return 'laptop';
  if (width >= 640) return 'tablet';
  if (width >= 375) return 'mobile';
  return 'mobile_small';
}

/**
 * Obtiene la configuración resuelta para un breakpoint aplicando la regla de herencia separada por orientación.
 * Si el breakpoint no tiene custom=true, hereda de la resolución inmediatamente superior DENTRO DE SU GRUPO (Horizontal o Vertical).
 * Si ninguna resolución superior tiene custom=true, se usa la configuración legacy/global o por defecto.
 */
export function getResolvedBreakpointConfig(
  responsiveMap: ResponsiveImageMap | undefined,
  targetBp: BreakpointKey,
  legacyApariencia?: any
): { config: ImageBreakpointConfig; inheritedFrom: BreakpointKey | 'legacy' | 'default' } {
  const map = responsiveMap || {};

  // 1. Verificación directa si el breakpoint tiene configuración propia
  if (map[targetBp] && map[targetBp]?.custom) {
    return {
      config: sanitizeBreakpointConfig(map[targetBp], targetBp),
      inheritedFrom: targetBp
    };
  }

  // 2. Buscar hacia arriba en la jerarquía de herencia (resoluciones superiores DENTRO DEL MISMO GRUPO)
  const isHorizontal = BREAKPOINT_GROUPS.HORIZONTAL.includes(targetBp);
  const group = isHorizontal ? BREAKPOINT_GROUPS.HORIZONTAL : BREAKPOINT_GROUPS.VERTICAL;
  const targetIndex = group.indexOf(targetBp);
  
  for (let i = targetIndex - 1; i >= 0; i--) {
    const higherBp = group[i];
    if (map[higherBp] && map[higherBp]?.custom) {
      const inherited = sanitizeBreakpointConfig(map[higherBp], higherBp);
      return {
        config: { ...inherited, custom: false },
        inheritedFrom: higherBp
      };
    }
  }

  // 3. Fallback a configuración legacy o por defecto
  const meta = BREAKPOINTS_LIST.find(b => b.key === targetBp) || BREAKPOINTS_LIST[1];
  const legacyScale = Number(legacyApariencia?.fondo_imagen_zoom) || 1;
  const legacyX = Number(legacyApariencia?.fondo_imagen_x) || 0;
  const legacyY = Number(legacyApariencia?.fondo_imagen_y) || 0;
  const legacyRotate = Number(legacyApariencia?.fondo_imagen_rotate) || 0;
  const legacyFit = legacyApariencia?.fondo_imagen_fit || 'cover';
  const legacyOpacity = Number(legacyApariencia?.fondo_imagen_opacity) ?? 100;

  const fallback: ImageBreakpointConfig = {
    width: meta.defaultW,
    height: meta.defaultH,
    position_x: legacyX,
    position_y: legacyY,
    scale: legacyScale,
    rotation: legacyRotate,
    object_fit: ['cover', 'contain', 'fill', 'none'].includes(legacyFit) ? legacyFit : 'cover',
    border_radius: 0,
    opacity: legacyOpacity,
    z_index: 1,
    custom: false
  };

  return {
    config: sanitizeBreakpointConfig(fallback, targetBp),
    inheritedFrom: 'legacy'
  };
}

/**
 * Retorna las propiedades CSS optimizadas para transform / hardware acceleration
 */
export function getBreakpointCSSStyles(config: ImageBreakpointConfig): React.CSSProperties {
  return {
    width: `${config.width}px`,
    height: `${config.height}px`,
    objectFit: config.object_fit,
    borderRadius: `${config.border_radius}px`,
    opacity: config.opacity / 100,
    zIndex: config.z_index,
    transform: `translate3d(${config.position_x}px, ${config.position_y}px, 0px) scale(${config.scale}) rotate(${config.rotation}deg)`,
    transformOrigin: 'center center',
    transition: 'transform 0.05s ease-out, width 0.05s ease-out, height 0.05s ease-out',
    willChange: 'transform, width, height',
  };
}
