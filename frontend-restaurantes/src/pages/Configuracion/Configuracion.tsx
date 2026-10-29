import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HexColorPicker } from 'react-colorful';
import { restauranteService } from '../../services/restaurante';
import { useRestaurant } from '../../context/RestaurantContext';
import { Palette, Layout, Type, Globe, CheckCircle2, AlertCircle, Upload, Image as ImageIcon, Moon, Sun, Sliders, Sparkles, Eye, EyeOff, Megaphone, Trash2, Info, X, Monitor, Smartphone, DollarSign } from 'lucide-react';
import { ResponsiveImageEditor } from './ResponsiveImageEditor';

const LAYOUTS = [
  { value: 'LISTA_SIMPLE', icon: '📋', label: 'Lista simple', desc: 'Minimalista y directo' },
  { value: 'CUADRICULA_FOTOS', icon: '🖼️', label: 'Cuadrícula', desc: 'Visual e impactante' },
  { value: 'TARJETAS_DETALLADAS', icon: '✨', label: 'Tarjetas', desc: 'Experiencia premium' },
];

const FUENTES = [
  { value: 'Sans-Serif', label: 'Sans-Serif', preview: 'Aa' },
  { value: 'Serif', label: 'Serif', preview: 'Aa' },
  { value: 'Mono', label: 'Mono', preview: 'Aa' },
  { value: 'Poppins', label: 'Poppins', preview: 'Aa' },
  { value: 'Outfit', label: 'Outfit', preview: 'Aa' },
];

// Presets de gradientes modernos
const PRESETS_GRADIENTES = [
  { name: 'Fuego Mexicano', value: 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)' },
  { name: 'Noche Oscura', value: 'linear-gradient(135deg, #111827 0%, #030712 100%)' },
  { name: 'Atardecer Dorado', value: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { name: 'Menta Fresca', value: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { name: 'Elegancia Azul', value: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)' },
  { name: 'Rosa Cacao', value: 'linear-gradient(135deg, #db2777 0%, #9d174d 100%)' },
  { name: 'Aurora Boreal', value: 'linear-gradient(135deg, #0284c7 0%, #10b981 100%)' },
  { name: 'Atardecer Morado', value: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)' },
  { name: 'Caramelo Dulce', value: 'linear-gradient(135deg, #f97316 0%, #e11d48 100%)' },
];

const extraerColoresDeGradiente = (gradientStr: string) => {
  if (!gradientStr) return { color1: '#FF416C', color2: '#FF4B2B' };
  const hexColors = gradientStr.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g);
  if (hexColors && hexColors.length >= 2) {
    return { color1: hexColors[0], color2: hexColors[1] };
  }
  return { color1: '#FF416C', color2: '#FF4B2B' };
};

function isColorDark(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return true;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

function colorWithOpacity(colorStr: string, opacity: number): string {
  if (!colorStr) return `rgba(255,255,255,${opacity})`;
  if (colorStr.startsWith('rgba')) {
    return colorStr.replace(/[\d\.]+\)$/, `${opacity})`);
  }
  if (colorStr.startsWith('rgb')) {
    return colorStr.replace('rgb', 'rgba').replace(/\)$/, `, ${opacity})`);
  }
  const clean = colorStr.replace('#', '');
  if (clean.length === 3) {
    const r = clean[0];
    const g = clean[1];
    const b = clean[2];
    return `rgba(${parseInt(r+r, 16)}, ${parseInt(g+g, 16)}, ${parseInt(b+b, 16)}, ${opacity})`;
  }
  if (clean.length === 6) {
    const r = clean.slice(0, 2);
    const g = clean.slice(2, 4);
    const b = clean.slice(4, 6);
    return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity})`;
  }
  return colorStr;
}

export function Configuracion(): JSX.Element {
  const { isPremium } = useRestaurant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingBgHorizontal, setUploadingBgHorizontal] = useState(false);
  const [uploadingBgVertical, setUploadingBgVertical] = useState(false);
  const [showPicker, setShowPicker] = useState<'primario' | 'fondo' | 'badge' | 'texto' | 'text_hover' | 'descripcion' | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string; badge?: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputHorizontalRef = useRef<HTMLInputElement>(null);
  const bgFileInputVerticalRef = useRef<HTMLInputElement>(null);
  
  const [gradienteColor1, setGradienteColor1] = useState('#FF416C');
  const [gradienteColor2, setGradienteColor2] = useState('#FF4B2B');
  const [gradienteAngulo, setGradienteAngulo] = useState('135deg');

  const handleGradientColorChange = (c1: string, c2: string, angulo: string) => {
    const nuevoGradiente = `linear-gradient(${angulo}, ${c1} 0%, ${c2} 100%)`;
    updateDisenoApariencia('fondo_valor', nuevoGradiente);
  };

  const [showFondoEditor, setShowFondoEditor] = useState(false);

  const [theme, setTheme] = useState<any>({
    plan: 'premium',
    logo_url: '',
    color_primario: '#2997FF',
    color_fondo: '#000000',
    fuente_familia: 'Sans-Serif',
    layout_type: 'TARJETAS_DETALLADAS',
    banner_promocional_activo: false,
    banner_promocional_texto: '',
    config_diseno: {
      apariencia: {
        fondo_tipo: 'solido',
        fondo_valor: '#000000',
        fondo_blur: '0px',
        fuente_familia: 'Sans-Serif',
        color_normal: '#ffffff',
        color_descripcion: '#8e8e93',
        color_hover: '#e63946',
        color_primario: '#2997FF',
        color_fondo: '#000000',
        modo_oscuro: true,
        border_radius_botones: '12px',
        border_radius_tarjetas: '24px'
      },
      layout: {
        layout_type: 'TARJETAS_DETALLADAS',
        categorias_sticky: true
      },
      elementos_visuales: {
        glassmorphism: false,
        sombras_habilitadas: true,
        badge_color: '#ffbe0b'
      },
      informacion: {
        direccion: '',
        ambiente: 'Familiar'
      }
    }
  });

  useEffect(() => {
    cargarConfiguracion();
    
    // Inyectar fuentes dinámicas en la página de admin para la vista previa
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const cargarConfiguracion = async () => {
    setLoading(true);
    try {
      const data = await restauranteService.getRestauranteInfo();
      const config = data.config_diseno || {};
      const apariencia = config.apariencia || {};
      const layout = config.layout || {};
      const elementos = config.elementos_visuales || {};

      const primario = data.color_primario || '#2997FF';
      const fondo = data.color_fondo || '#000000';
      const fuente = data.fuente_familia || 'Sans-Serif';
      const layoutType = data.layout_type || 'TARJETAS_DETALLADAS';
      const dark = apariencia.modo_oscuro !== undefined ? apariencia.modo_oscuro : isColorDark(fondo);

      setTheme({
        plan: data.plan || 'basico',
        logo_url: data.logo_url || '',
        color_primario: primario,
        color_fondo: fondo,
        fuente_familia: fuente,
        layout_type: layoutType,
        banner_promocional_activo: data.banner_promocional_activo ?? false,
        banner_promocional_texto: data.banner_promocional_texto || '',
        config_diseno: {
          apariencia: {
            ...apariencia,
            fondo_tipo: apariencia.fondo_tipo || 'solido',
            fondo_valor: apariencia.fondo_valor || fondo,
            fondo_blur: apariencia.fondo_blur || '0px',
            fuente_familia: apariencia.fuente_familia || fuente,
            color_normal: apariencia.color_normal || (dark ? '#ffffff' : '#1D1D1F'),
            color_descripcion: apariencia.color_descripcion || '#8e8e93',
            color_hover: apariencia.color_hover || '#e63946',
            color_primario: apariencia.color_primario || primario,
            color_fondo: apariencia.color_fondo || fondo,
            modo_oscuro: dark,
            border_radius_botones: apariencia.border_radius_botones || '12px',
            border_radius_tarjetas: apariencia.border_radius_tarjetas || '24px',
            fondo_imagen_url: apariencia.fondo_imagen_url || '',
            fondo_imagen_horizontal_url: apariencia.fondo_imagen_horizontal_url || '',
            fondo_imagen_vertical_url: apariencia.fondo_imagen_vertical_url || '',
            fondo_imagen_posicion: apariencia.fondo_imagen_posicion || 'center center',
            fondo_imagen_ajuste: apariencia.fondo_imagen_ajuste || 'cover',
            fondo_imagen_repetir: apariencia.fondo_imagen_repetir || 'no-repeat',
            responsive_imagen: apariencia.responsive_imagen || {}
          },
          layout: {
            layout_type_horizontal: layout.layout_type_horizontal || layout.layout_type || layoutType,
            layout_type_vertical: layout.layout_type_vertical || layout.layout_type || layoutType,
            categorias_sticky: layout.categorias_sticky !== undefined ? layout.categorias_sticky : true,
            estilo_encabezado: layout.estilo_encabezado || 'fondo_completo',
            mostrar_horario: layout.mostrar_horario !== undefined ? layout.mostrar_horario : true,
            mostrar_estado_abierto: layout.mostrar_estado_abierto !== undefined ? layout.mostrar_estado_abierto : true
          },
          elementos_visuales: {
            glassmorphism: elementos.glassmorphism || false,
            sombras_habilitadas: elementos.sombras_habilitadas !== undefined ? elementos.sombras_habilitadas : true,
            badge_color: elementos.badge_color || '#ffbe0b',
            tarjeta_estilo: elementos.tarjeta_estilo || (elementos.glassmorphism ? 'frosted' : 'solida'),
            tarjeta_opacidad: elementos.tarjeta_opacidad !== undefined ? elementos.tarjeta_opacidad : (elementos.glassmorphism ? 35 : 95),
            tarjeta_borde: elementos.tarjeta_borde !== undefined ? elementos.tarjeta_borde : true,
            tarjeta_color_fondo: elementos.tarjeta_color_fondo || ''
          },
          informacion: {
            direccion: config.informacion?.direccion || '',
            ambiente: config.informacion?.ambiente || 'Familiar'
          },
          moneda: {
            simbolo: config.moneda?.simbolo || '$',
            posicion: config.moneda?.posicion || 'prefijo'
          }
        }
      });
      // Debug log removed

      const fondoValor = apariencia.fondo_valor || fondo;
      if (apariencia.fondo_tipo === 'gradiente' && fondoValor && fondoValor.startsWith('linear-gradient')) {
        const { color1, color2 } = extraerColoresDeGradiente(fondoValor);
        setGradienteColor1(color1);
        setGradienteColor2(color2);
        const anguloMatch = fondoValor.match(/\d+deg/);
        if (anguloMatch) {
          setGradienteAngulo(anguloMatch[0]);
        }
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDisenoApariencia = (key: string, value: any) => {
    setTheme((prev: any) => {
      const config = prev.config_diseno || { apariencia: {}, layout: {}, elementos_visuales: {} };
      const apariencia = { ...config.apariencia, [key]: value };
      
      let extra: any = {};
      if (key === 'color_primario') extra.color_primario = value;
      if (key === 'color_fondo') extra.color_fondo = value;
      if (key === 'fuente_familia') extra.fuente_familia = value;
      if (key === 'fondo_valor' && apariencia.fondo_tipo === 'solido') extra.color_fondo = value;

      // Mantener sincronizado y limpio fondo_imagen_url para evitar residuos y contaminación cruzada
      if (key === 'fondo_imagen_horizontal_url' || key === 'fondo_imagen_vertical_url' || key === 'fondo_tipo') {
        const horiz = key === 'fondo_imagen_horizontal_url' ? value : apariencia.fondo_imagen_horizontal_url;
        const vert = key === 'fondo_imagen_vertical_url' ? value : apariencia.fondo_imagen_vertical_url;
        const tipo = key === 'fondo_tipo' ? value : apariencia.fondo_tipo;

        if (tipo !== 'imagen' || (!horiz && !vert)) {
          apariencia.fondo_imagen_url = '';
        } else if (horiz) {
          // Solo si hay horizontal explícita, se usa como legacy general (pantallas estándar)
          apariencia.fondo_imagen_url = horiz;
        } else {
          // Si solo hay vertical, NO asignar a fondo_imagen_url para que las pantallas horizontales no la consuman por error
          apariencia.fondo_imagen_url = '';
        }
      }

      return {
        ...prev,
        ...extra,
        config_diseno: {
          ...config,
          apariencia
        }
      };
    });
  };

  const updateDisenoLayout = (key: string, value: any) => {
    setTheme((prev: any) => {
      const config = prev.config_diseno || { apariencia: {}, layout: {}, elementos_visuales: {} };
      const layout = { ...config.layout, [key]: value };
      
      let extra: any = {};
      if (key === 'layout_type_horizontal') extra.layout_type_horizontal = value;
      if (key === 'layout_type_vertical') extra.layout_type_vertical = value;
      
      // Update global layout_type for legacy compatibility when saving
      if (key === 'layout_type_vertical') extra.layout_type = value;

      return {
        ...prev,
        ...extra,
        config_diseno: {
          ...config,
          layout
        }
      };
    });
  };

  const updateDisenoElementos = (key: string, value: any) => {
    setTheme((prev: any) => {
      const config = prev.config_diseno || { apariencia: {}, layout: {}, elementos_visuales: {} };
      const elementos = { ...config.elementos_visuales, [key]: value };

      return {
        ...prev,
        config_diseno: {
          ...config,
          elementos_visuales: elementos
        }
      };
    });
  };

  const updateInformacion = (key: string, value: any) => {
    setTheme((prev: any) => {
      const config = prev.config_diseno || { apariencia: {}, layout: {}, elementos_visuales: {}, informacion: {} };
      const informacion = { ...config.informacion, [key]: value };
      return {
        ...prev,
        config_diseno: {
          ...config,
          informacion
        }
      };
    });
  };

  const updateMoneda = (key: string, value: any) => {
    setTheme((prev: any) => {
      const config = prev.config_diseno || { apariencia: {}, layout: {}, elementos_visuales: {}, moneda: {} };
      const moneda = { ...(config.moneda || { simbolo: '$', posicion: 'prefijo' }), [key]: value };
      return {
        ...prev,
        config_diseno: {
          ...config,
          moneda
        }
      };
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const res = await restauranteService.uploadBrandingImage(file);
      if (res.url_imagen) {
        setTheme((prev: any) => ({ ...prev, logo_url: res.url_imagen }));
      }
    } catch (error) {
      console.error('Error al subir logo:', error);
      alert('Hubo un error al subir la imagen. Intenta de nuevo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBg(true);
    try {
      const res = await restauranteService.uploadBrandingImage(file);
      if (res.url_imagen) {
        updateDisenoApariencia('fondo_imagen_url', res.url_imagen);
      }
    } catch (error) {
      console.error('Error al subir imagen de fondo:', error);
      alert('Hubo un error al subir la imagen. Intenta de nuevo.');
    } finally {
      setUploadingBg(false);
    }
  };

  const handleBgUploadHorizontal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBgHorizontal(true);
    try {
      const res = await restauranteService.uploadBrandingImage(file);
      if (res.url_imagen) {
        updateDisenoApariencia('fondo_imagen_horizontal_url', res.url_imagen);
      }
    } catch (error) {
      console.error('Error al subir imagen de fondo horizontal:', error);
      alert('Hubo un error al subir la imagen horizontal. Intenta de nuevo.');
    } finally {
      setUploadingBgHorizontal(false);
    }
  };

  const handleBgUploadVertical = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBgVertical(true);
    try {
      const res = await restauranteService.uploadBrandingImage(file);
      if (res.url_imagen) {
        updateDisenoApariencia('fondo_imagen_vertical_url', res.url_imagen);
      }
    } catch (error) {
      console.error('Error al subir imagen de fondo vertical:', error);
      alert('Hubo un error al subir la imagen vertical. Intenta de nuevo.');
    } finally {
      setUploadingBgVertical(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setSaveError('');
    try {
      await restauranteService.updateTheme(theme);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      const msg = error?.response?.data?.mensaje || '';
      setSaveError(msg || 'Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="py-12 px-6 lg:px-12 max-w-[1400px] mx-auto min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary">
            <Sliders className="w-6 h-6 text-apple-blue" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-apple-text dark:text-apple-dark-text">Configuración del Menú</h1>
            <p className="text-sm text-apple-text-secondary dark:text-apple-dark-text-secondary font-medium">
              Personaliza la identidad visual y estilo de tu restaurante digital.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-apple-border dark:border-apple-dark-border mb-8 overflow-x-auto scrollbar-hide">
        <button 
          onClick={() => setShowFondoEditor(false)}
          className={`pb-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${!showFondoEditor ? 'border-apple-blue text-apple-blue' : 'border-transparent text-apple-text-secondary hover:text-apple-text'}`}
        >
          <Palette size={18} />
          Identidad & Estilos
        </button>
        {(isPremium || theme.plan === 'premium' || theme.plan === 'prueba') && (
          <button 
            onClick={() => setShowFondoEditor(true)}
            className={`pb-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${showFondoEditor ? 'border-apple-blue text-apple-blue' : 'border-transparent text-apple-text-secondary hover:text-apple-text'}`}
          >
            <ImageIcon size={18} />
            Dimensiones de Imagen
          </button>
        )}
      </div>

      {showFondoEditor && (isPremium || theme.plan === 'premium' || theme.plan === 'prueba') ? (
        <ResponsiveImageEditor
          isOpen={true}
          onClose={() => setShowFondoEditor(false)}
          imageUrl={theme.config_diseno?.apariencia?.fondo_imagen_url || ''}
          horizontalImageUrl={theme.config_diseno?.apariencia?.fondo_imagen_horizontal_url || ''}
          verticalImageUrl={theme.config_diseno?.apariencia?.fondo_imagen_vertical_url || ''}
          apariencia={theme.config_diseno?.apariencia || {}}
          onSave={async (updatedApariencia) => {
            setTheme((prev: any) => {
              const config = prev.config_diseno || { apariencia: {}, layout: {}, elementos_visuales: {}, informacion: {} };
              return {
                ...prev,
                config_diseno: {
                  ...config,
                  apariencia: updatedApariencia
                }
              };
            });

            // Guardar en el servidor y esperar respuesta
            try {
              // Obtener el estado más reciente del tema
              const newTheme = await new Promise<any>((resolve) => {
                setTheme((prev: any) => {
                  const config = prev.config_diseno || { apariencia: {}, layout: {}, elementos_visuales: {}, informacion: {} };
                  const updatedTheme = {
                    ...prev,
                    config_diseno: {
                      ...config,
                      apariencia: updatedApariencia
                    }
                  };
                  resolve(updatedTheme);
                  return updatedTheme;
                });
              });

              const result = await restauranteService.updateTheme(newTheme);

              // Actualizar con la respuesta del servidor para asegurar sincronización
              if (result.tema && result.tema.config_diseno) {
                setTheme((prev: any) => ({
                  ...prev,
                  config_diseno: result.tema.config_diseno
                }));
              }
            } catch (err) {
              console.error('Error al guardar configuración responsiva:', err);
            }
          }}
        />
      ) : (
        <div className="flex flex-col xl:flex-row gap-12">
          {/* Settings Column */}
          <div className="flex-1 max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-12">
            
            {/* Branding / Logo */}
            <section className="p-8 rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm">
              <h3 className="text-[11px] font-bold text-apple-blue tracking-[0.2em] uppercase mb-8 flex items-center gap-2">
                <ImageIcon size={16} /> Logotipo del Negocio
              </h3>
              
              <div className="flex items-center gap-8">
                <div className="relative w-32 h-32 rounded-3xl bg-apple-bg dark:bg-apple-dark-bg border-2 border-dashed border-apple-border dark:border-apple-dark-border flex items-center justify-center overflow-hidden group">
                  {theme.logo_url ? (
                    <img src={theme.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl opacity-50">🏪</span>
                  )}
                  
                  <div className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center transition-opacity ${theme.logo_url ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-sm transition-colors"
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                          <Upload size={20} />
                        </motion.div>
                      ) : (
                        <Upload size={20} />
                      )}
                    </button>
                    {!theme.logo_url && <span className="text-xs text-white font-medium mt-2">Subir logo</span>}
                  </div>
                </div>
                
                <div className="flex-1 space-y-2">
                  <h4 className="text-base font-bold">Logo principal</h4>
                  <p className="text-sm text-apple-text-secondary">Recomendado: 500x500px, formato PNG o JPG transparente. Se mostrará en el encabezado de tu menú digital.</p>
                  {theme.logo_url && (
                    <button 
                      type="button" 
                      onClick={() => setTheme((prev: any) => ({ ...prev, logo_url: '' }))}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-colors mt-2"
                    >
                      <Trash2 size={12} />
                      Eliminar logo
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Personalización Estética Avanzada */}
            
            {/* 1. Colores y Fondos */}
            <section className="p-8 rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm space-y-8">
              <div className="flex items-center justify-between border-b border-apple-border dark:border-apple-dark-border pb-4">
                <h3 className="text-[11px] font-bold text-apple-blue tracking-[0.2em] uppercase flex items-center gap-2">
                  <Palette size={16} /> Colores & Fondo
                </h3>
                {/* Switch Modo Claro / Oscuro */}
                <div className="flex items-center gap-2 bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border rounded-full p-1 shadow-apple-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const isDark = false;
                      const config = theme.config_diseno || { apariencia: {} };
                      updateDisenoApariencia('modo_oscuro', isDark);
                      updateDisenoApariencia('color_normal', '#1D1D1F');
                      if (config.apariencia?.fondo_tipo === 'solido') {
                        updateDisenoApariencia('color_fondo', '#FFFFFF');
                        updateDisenoApariencia('fondo_valor', '#FFFFFF');
                      }
                    }}
                    className={`p-2 rounded-full transition-all ${!theme.config_diseno?.apariencia?.modo_oscuro ? 'bg-apple-blue text-white shadow-apple-sm' : 'text-apple-text-secondary opacity-60'}`}
                  >
                    <Sun size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const isDark = true;
                      const config = theme.config_diseno || { apariencia: {} };
                      updateDisenoApariencia('modo_oscuro', isDark);
                      updateDisenoApariencia('color_normal', '#ffffff');
                      if (config.apariencia?.fondo_tipo === 'solido') {
                        updateDisenoApariencia('color_fondo', '#000000');
                        updateDisenoApariencia('fondo_valor', '#000000');
                      }
                    }}
                    className={`p-2 rounded-full transition-all ${theme.config_diseno?.apariencia?.modo_oscuro ? 'bg-apple-blue text-white shadow-apple-sm' : 'text-apple-text-secondary opacity-60'}`}
                  >
                    <Moon size={14} />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Color de acento */}
                <div className="relative flex flex-col justify-between p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-sm group hover:border-apple-blue/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-apple-text">Color de Acento</span>
                    <button
                      type="button"
                      onClick={() => setInfoModal({
                        title: 'Color de Acento',
                        badge: 'Botones y Acciones',
                        content: 'Define el color de los botones principales, badges destacados, llamadas a la acción e indicadores visuales de picante en tu menú.'
                      })}
                      className="p-1 rounded-full text-apple-text-tertiary hover:text-apple-blue hover:bg-apple-blue/10 transition-colors"
                      aria-label="Información sobre Color de Acento"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPicker(showPicker === 'primario' ? null : 'primario')}
                      className="w-11 h-11 rounded-xl shadow-apple-sm border border-white/20 transition-transform active:scale-95 flex-shrink-0"
                      style={{ backgroundColor: theme.color_primario }}
                      aria-label="Abrir selector de color de acento"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-xs font-bold tracking-wider uppercase truncate">{theme.color_primario}</span>
                      <span className="text-[10px] text-apple-text-tertiary truncate">Botones y destacados</span>
                    </div>
                  </div>
                  
                  {showPicker === 'primario' && (
                    <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 p-4 rounded-3xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-2xl flex flex-col items-center gap-2">
                      <HexColorPicker
                        color={theme.color_primario}
                        onChange={(color) => updateDisenoApariencia('color_primario', color)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPicker(null)}
                        className="px-4 py-1.5 bg-apple-blue text-white rounded-full text-[10px] font-bold active:scale-95 transition-transform"
                      >
                        Listo
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Color del texto principal */}
                <div className="relative flex flex-col justify-between p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-sm group hover:border-apple-blue/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-apple-text">Texto Principal</span>
                    <button
                      type="button"
                      onClick={() => setInfoModal({
                        title: 'Color del Texto Principal',
                        badge: 'Títulos y Nombres',
                        content: 'Aplica a los títulos de platillos, nombres de categorías y encabezados. Recomendado usar un color con alto contraste frente al fondo elegido.'
                      })}
                      className="p-1 rounded-full text-apple-text-tertiary hover:text-apple-blue hover:bg-apple-blue/10 transition-colors"
                      aria-label="Información sobre Texto Principal"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPicker(showPicker === 'texto' ? null : 'texto')}
                      className="w-11 h-11 rounded-xl shadow-apple-sm border border-white/20 transition-transform active:scale-95 flex-shrink-0"
                      style={{ backgroundColor: theme.config_diseno?.apariencia?.color_normal || '#ffffff' }}
                      aria-label="Abrir selector de color de texto principal"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-xs font-bold tracking-wider uppercase truncate">{theme.config_diseno?.apariencia?.color_normal || '#ffffff'}</span>
                      <span className="text-[10px] text-apple-text-tertiary truncate">Títulos y encabezados</span>
                    </div>
                  </div>

                  {showPicker === 'texto' && (
                    <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 p-4 rounded-3xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-2xl flex flex-col items-center gap-2">
                      <HexColorPicker
                        color={theme.config_diseno?.apariencia?.color_normal || '#ffffff'}
                        onChange={(color) => updateDisenoApariencia('color_normal', color)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPicker(null)}
                        className="px-4 py-1.5 bg-apple-blue text-white rounded-full text-[10px] font-bold active:scale-95 transition-transform"
                      >
                        Listo
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Color de descripciones */}
                <div className="relative flex flex-col justify-between p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-sm group hover:border-apple-blue/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-apple-text">Descripciones</span>
                    <button
                      type="button"
                      onClick={() => setInfoModal({
                        title: 'Color de Descripciones',
                        badge: 'Textos Secundarios',
                        content: 'Se utiliza para los ingredientes, notas y textos secundarios de los platillos. Conviene un tono atenuado pero legible para generar jerarquía visual.'
                      })}
                      className="p-1 rounded-full text-apple-text-tertiary hover:text-apple-blue hover:bg-apple-blue/10 transition-colors"
                      aria-label="Información sobre Color de Descripciones"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPicker(showPicker === 'descripcion' ? null : 'descripcion')}
                      className="w-11 h-11 rounded-xl shadow-apple-sm border border-white/20 transition-transform active:scale-95 flex-shrink-0"
                      style={{ backgroundColor: theme.config_diseno?.apariencia?.color_descripcion || '#8e8e93' }}
                      aria-label="Abrir selector de color de descripciones"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-xs font-bold tracking-wider uppercase truncate">{theme.config_diseno?.apariencia?.color_descripcion || '#8E8E93'}</span>
                      <span className="text-[10px] text-apple-text-tertiary truncate">Ingredientes y notas</span>
                    </div>
                  </div>

                  {showPicker === 'descripcion' && (
                    <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 p-4 rounded-3xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-2xl flex flex-col items-center gap-2">
                      <HexColorPicker
                        color={theme.config_diseno?.apariencia?.color_descripcion || '#8e8e93'}
                        onChange={(color) => updateDisenoApariencia('color_descripcion', color)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPicker(null)}
                        className="px-4 py-1.5 bg-apple-blue text-white rounded-full text-[10px] font-bold active:scale-95 transition-transform"
                      >
                        Listo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tipo de Fondo */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-apple-text-secondary ml-1">Tipo de Fondo del Menú</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      updateDisenoApariencia('fondo_tipo', 'solido');
                      updateDisenoApariencia('fondo_valor', theme.color_fondo);
                    }}
                    className={`py-3 px-3 rounded-2xl border-2 font-bold text-xs transition-all ${
                      theme.config_diseno?.apariencia?.fondo_tipo === 'solido'
                        ? 'border-apple-blue bg-apple-blue/5 text-apple-blue'
                        : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text-secondary'
                    }`}
                  >
                    Color Sólido
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateDisenoApariencia('fondo_tipo', 'gradiente');
                      updateDisenoApariencia('fondo_valor', PRESETS_GRADIENTES[0].value);
                    }}
                    className={`py-3 px-3 rounded-2xl border-2 font-bold text-xs transition-all ${
                      theme.config_diseno?.apariencia?.fondo_tipo === 'gradiente'
                        ? 'border-apple-blue bg-apple-blue/5 text-apple-blue'
                        : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text-secondary'
                    }`}
                  >
                    Degradado Premium
                  </button>
                  {(isPremium || theme.plan === 'premium' || theme.plan === 'prueba') && (
                  <button
                    type="button"
                    onClick={() => {
                      updateDisenoApariencia('fondo_tipo', 'imagen');
                    }}
                    className={`py-3 px-3 rounded-2xl border-2 font-bold text-xs transition-all ${
                      theme.config_diseno?.apariencia?.fondo_tipo === 'imagen'
                        ? 'border-apple-blue bg-apple-blue/5 text-apple-blue'
                        : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text-secondary'
                    }`}
                  >
                    Imagen de Fondo
                  </button>
                  )}
                </div>
              </div>

              {/* Selector de fondo específico */}
              {theme.config_diseno?.apariencia?.fondo_tipo === 'solido' && (
                <div className="space-y-3 relative">
                  <label className="text-sm font-bold text-apple-text-secondary ml-1 font-medium">Color de Fondo</label>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-sm group hover:border-apple-blue/50 transition-colors">
                    <button
                      type="button"
                      onClick={() => setShowPicker(showPicker === 'fondo' ? null : 'fondo')}
                      className="w-12 h-12 rounded-xl shadow-apple-md border border-white/20 transition-transform active:scale-95 flex-shrink-0"
                      style={{ backgroundColor: theme.color_fondo }}
                    />
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-bold tracking-widest uppercase">{theme.color_fondo}</span>
                      <span className="text-[10px] text-apple-text-tertiary">Color base del fondo del menú</span>
                    </div>
                  </div>

                  {showPicker === 'fondo' && (
                    <div className="absolute z-50 left-1/2 -translate-x-1/2 mt-2 p-4 rounded-3xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-2xl flex flex-col items-center gap-2">
                      <HexColorPicker
                        color={theme.color_fondo}
                        onChange={(color) => {
                          updateDisenoApariencia('color_fondo', color);
                          if (theme.config_diseno?.apariencia?.fondo_tipo === 'solido') {
                            updateDisenoApariencia('fondo_valor', color);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPicker(null)}
                        className="px-4 py-1.5 bg-apple-blue text-white rounded-full text-[10px] font-bold active:scale-95 transition-transform"
                      >
                        Listo
                      </button>
                    </div>
                  )}
                </div>
              )}

              {theme.config_diseno?.apariencia?.fondo_tipo === 'gradiente' && (
                <div className="space-y-4 pt-2">
                  <label className="text-sm font-bold text-apple-text-secondary ml-1">Degradados Predeterminados</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {PRESETS_GRADIENTES.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => updateDisenoApariencia('fondo_valor', preset.value)}
                        className={`h-16 rounded-xl border-2 transition-all text-left p-3 relative flex items-end ${
                          theme.config_diseno?.apariencia?.fondo_valor === preset.value
                            ? 'border-apple-blue ring-2 ring-apple-blue/30 scale-[1.02]'
                            : 'border-transparent hover:scale-[1.01]'
                        }`}
                        style={{ background: preset.value }}
                      >
                        <span className="text-[10px] font-black text-white bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-xs">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-apple-border dark:border-apple-dark-border mt-4">
                    <label className="text-sm font-bold text-apple-text-secondary ml-1">Diseña tu Degradado Personalizado</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-xs text-apple-text-tertiary ml-1 font-medium">Color Inicial</span>
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-sm">
                          <input 
                            type="color" 
                            value={gradienteColor1}
                            onChange={(e) => {
                              const newColor = e.target.value;
                              setGradienteColor1(newColor);
                              handleGradientColorChange(newColor, gradienteColor2, gradienteAngulo);
                            }}
                            className="w-12 h-12 rounded-xl cursor-pointer border border-apple-border dark:border-apple-dark-border bg-transparent flex-shrink-0"
                          />
                          <span className="font-mono text-sm uppercase font-bold tracking-widest">{gradienteColor1}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs text-apple-text-tertiary ml-1 font-medium">Color Final</span>
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-sm">
                          <input 
                            type="color" 
                            value={gradienteColor2}
                            onChange={(e) => {
                              const newColor = e.target.value;
                              setGradienteColor2(newColor);
                              handleGradientColorChange(gradienteColor1, newColor, gradienteAngulo);
                            }}
                            className="w-12 h-12 rounded-xl cursor-pointer border border-apple-border dark:border-apple-dark-border bg-transparent flex-shrink-0"
                          />
                          <span className="font-mono text-sm uppercase font-bold tracking-widest">{gradienteColor2}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <span className="text-xs text-apple-text-tertiary ml-1 font-medium">Dirección / Ángulo</span>
                        <select
                          value={gradienteAngulo}
                          onChange={(e) => {
                            const newAngle = e.target.value;
                            setGradienteAngulo(newAngle);
                            handleGradientColorChange(gradienteColor1, gradienteColor2, newAngle);
                          }}
                          className="w-full px-4 py-3.5 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border text-sm font-bold shadow-apple-sm outline-none focus:border-apple-blue"
                        >
                          <option value="135deg">Diagonal (Derecha abajo)</option>
                          <option value="45deg">Diagonal (Derecha arriba)</option>
                          <option value="90deg">Horizontal (Derecha)</option>
                          <option value="180deg">Vertical (Abajo)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs text-apple-text-tertiary ml-1 font-medium">Previsualización</span>
                        <div 
                          className="h-[46px] w-full rounded-2xl border border-apple-border dark:border-apple-dark-border shadow-inner"
                          style={{ background: `linear-gradient(${gradienteAngulo}, ${gradienteColor1} 0%, ${gradienteColor2} 100%)` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {theme.config_diseno?.apariencia?.fondo_tipo === 'imagen' && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 1. Imagen para Pantallas Anchas (Desktop / Laptop) */}
                    <div className="p-5 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border flex flex-col justify-between gap-4 shadow-apple-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Monitor size={15} className="text-apple-blue" />
                          <span className="text-xs font-bold text-apple-text">Pantallas Anchas (Desktop)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue uppercase tracking-wider">
                            16:9
                          </span>
                          <button
                            type="button"
                            onClick={() => setInfoModal({
                              title: 'Fondo Pantallas Anchas',
                              badge: 'Horizontal (16:9)',
                              content: 'Resolución recomendada: 1920x1080px (16:9). Se mostrará en computadoras, laptops y pantallas en formato horizontal.'
                            })}
                            className="p-1 rounded-full text-apple-text-tertiary hover:text-apple-blue hover:bg-apple-blue/10 transition-colors"
                            aria-label="Información sobre fondo horizontal"
                          >
                            <Info size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="relative w-24 h-24 rounded-xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border flex items-center justify-center overflow-hidden group flex-shrink-0">
                          {theme.config_diseno?.apariencia?.fondo_imagen_horizontal_url ? (
                            <img 
                              src={theme.config_diseno.apariencia.fondo_imagen_horizontal_url} 
                              alt="" 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <ImageIcon size={26} className="text-apple-text-tertiary/40" />
                          )}
                          <div className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center transition-opacity ${theme.config_diseno?.apariencia?.fondo_imagen_horizontal_url ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              ref={bgFileInputHorizontalRef}
                              onChange={handleBgUploadHorizontal}
                            />
                            <button 
                              type="button" 
                              onClick={() => bgFileInputHorizontalRef.current?.click()}
                              className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-sm transition-colors"
                              disabled={uploadingBgHorizontal}
                              title="Subir imagen horizontal"
                            >
                              {uploadingBgHorizontal ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                                  <Upload size={14} />
                                </motion.div>
                              ) : (
                                <Upload size={14} />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => bgFileInputHorizontalRef.current?.click()}
                            disabled={uploadingBgHorizontal}
                            className="w-full px-3.5 py-2 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary hover:bg-apple-blue/10 border border-apple-border dark:border-apple-dark-border hover:border-apple-blue text-xs font-semibold rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-xs active:scale-98"
                          >
                            <Upload size={13} className="text-apple-blue shrink-0" />
                            <span>{theme.config_diseno?.apariencia?.fondo_imagen_horizontal_url ? 'Reemplazar imagen' : 'Subir imagen'}</span>
                          </button>

                          {theme.config_diseno?.apariencia?.fondo_imagen_horizontal_url ? (
                            <button 
                              type="button" 
                              onClick={() => updateDisenoApariencia('fondo_imagen_horizontal_url', '')}
                              className="w-full px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 active:scale-98"
                            >
                              <Trash2 size={13} className="shrink-0" />
                              <span>Eliminar imagen</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-apple-text-tertiary text-center block pt-0.5">
                              Sin imagen (usa color sólido)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2. Imagen para Pantallas Verticales (Móviles / Tablets) */}
                    <div className="p-5 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border flex flex-col justify-between gap-4 shadow-apple-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone size={15} className="text-emerald-500" />
                          <span className="text-xs font-bold text-apple-text">Pantallas Verticales (Móviles)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 uppercase tracking-wider">
                            9:16
                          </span>
                          <button
                            type="button"
                            onClick={() => setInfoModal({
                              title: 'Fondo Pantallas Verticales',
                              badge: 'Vertical (9:16)',
                              content: 'Resolución recomendada: 1080x1920px (9:16). Se mostrará en teléfonos inteligentes y tablets en orientación vertical.'
                            })}
                            className="p-1 rounded-full text-apple-text-tertiary hover:text-apple-blue hover:bg-apple-blue/10 transition-colors"
                            aria-label="Información sobre fondo vertical"
                          >
                            <Info size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="relative w-24 h-24 rounded-xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border flex items-center justify-center overflow-hidden group flex-shrink-0">
                          {theme.config_diseno?.apariencia?.fondo_imagen_vertical_url ? (
                            <img 
                              src={theme.config_diseno.apariencia.fondo_imagen_vertical_url} 
                              alt="" 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <ImageIcon size={26} className="text-apple-text-tertiary/40" />
                          )}
                          <div className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center transition-opacity ${theme.config_diseno?.apariencia?.fondo_imagen_vertical_url ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              ref={bgFileInputVerticalRef}
                              onChange={handleBgUploadVertical}
                            />
                            <button 
                              type="button" 
                              onClick={() => bgFileInputVerticalRef.current?.click()}
                              className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-sm transition-colors"
                              disabled={uploadingBgVertical}
                              title="Subir imagen vertical"
                            >
                              {uploadingBgVertical ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                                  <Upload size={14} />
                                </motion.div>
                              ) : (
                                <Upload size={14} />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => bgFileInputVerticalRef.current?.click()}
                            disabled={uploadingBgVertical}
                            className="w-full px-3.5 py-2 bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary hover:bg-apple-blue/10 border border-apple-border dark:border-apple-dark-border hover:border-apple-blue text-xs font-semibold rounded-xl transition-all inline-flex items-center justify-center gap-2 shadow-xs active:scale-98"
                          >
                            <Upload size={13} className="text-apple-blue shrink-0" />
                            <span>{theme.config_diseno?.apariencia?.fondo_imagen_vertical_url ? 'Reemplazar imagen' : 'Subir imagen'}</span>
                          </button>

                          {theme.config_diseno?.apariencia?.fondo_imagen_vertical_url ? (
                            <button 
                              type="button" 
                              onClick={() => updateDisenoApariencia('fondo_imagen_vertical_url', '')}
                              className="w-full px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 active:scale-98"
                            >
                              <Trash2 size={13} className="shrink-0" />
                              <span>Eliminar imagen</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-apple-text-tertiary text-center block pt-0.5">
                              Sin imagen (usa color sólido)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 2. Estructura y Comportamiento (Layout) */}
            <section className="p-8 rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm space-y-6">
              <h3 className="text-[11px] font-bold text-apple-blue tracking-[0.2em] uppercase flex items-center gap-2 border-b border-apple-border dark:border-apple-dark-border pb-4">
                <Layout size={16} /> Estructura y Portada del Menú
              </h3>

              {/* Selector de Estilo de Portada / Encabezado */}
              <div className="space-y-3">
                <div className="flex justify-between items-center pl-2 border-l-2 border-apple-blue">
                  <h4 className="text-xs font-bold text-apple-blue">Estilo de Encabezado / Portada</h4>
                  <span className="text-[10px] text-apple-text-tertiary">Formato de bienvenida del comensal</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      id: 'fondo_completo',
                      label: 'Fondo Inmersivo Completo',
                      desc: 'Fondo completo en pantalla con cabecera flotante fija.',
                      icon: '🌌'
                    },
                    {
                      id: 'banner_hero',
                      label: 'Portada Superior (Hero Banner)',
                      desc: 'Banner panorámico arriba con logo en relieve, horarios y estado.',
                      icon: '🖼️'
                    }
                  ].map((hero) => {
                    const isSelected = (theme.config_diseno?.layout?.estilo_encabezado || 'fondo_completo') === hero.id;
                    return (
                      <button
                        key={hero.id}
                        type="button"
                        onClick={() => updateDisenoLayout('estilo_encabezado', hero.id)}
                        className={`p-5 rounded-2xl border-2 transition-all text-left flex items-start gap-4 relative active:scale-98 min-h-[110px] ${
                          isSelected
                            ? 'border-apple-blue bg-apple-blue/5 shadow-apple-glow ring-1 ring-apple-blue/20'
                            : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text-secondary hover:border-apple-blue/40'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-xl bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border flex items-center justify-center text-2xl flex-shrink-0 shadow-xs">
                          {hero.icon}
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                          <div className={`text-sm font-bold leading-tight ${isSelected ? 'text-apple-blue' : 'text-apple-text'}`}>{hero.label}</div>
                          <p className="text-xs text-apple-text-tertiary mt-1.5 leading-relaxed">{hero.desc}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-apple-blue text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Selector Pantallas Anchas (Desktop) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-apple-blue pl-2 border-l-2 border-apple-blue">Pantallas Anchas (Monitor/Laptop)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {LAYOUTS.map((layout) => {
                    const isSelected = (theme.config_diseno?.layout?.layout_type_horizontal || theme.layout_type) === layout.value;
                    return (
                      <button
                        key={`horiz-${layout.value}`}
                        type="button"
                        onClick={() => updateDisenoLayout('layout_type_horizontal', layout.value)}
                        className={`p-5 rounded-3xl border-2 transition-all text-center flex flex-col items-center gap-3 active:scale-95 ${
                          isSelected
                            ? 'border-apple-blue bg-apple-blue/5 shadow-apple-glow'
                            : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text-secondary hover:border-apple-blue/30'
                        }`}
                      >
                        <div className="text-2xl mb-1">{layout.icon}</div>
                        <div>
                          <div className={`text-xs font-bold ${isSelected ? 'text-apple-blue' : 'text-apple-text'}`}>{layout.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector Pantallas Angostas (Móvil) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-emerald-500 pl-2 border-l-2 border-emerald-500">Pantallas Angostas (Móvil/Tablet Vertical)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {LAYOUTS.map((layout) => {
                    const isSelected = (theme.config_diseno?.layout?.layout_type_vertical || theme.layout_type) === layout.value;
                    return (
                      <button
                        key={`vert-${layout.value}`}
                        type="button"
                        onClick={() => updateDisenoLayout('layout_type_vertical', layout.value)}
                        className={`p-5 rounded-3xl border-2 transition-all text-center flex flex-col items-center gap-3 active:scale-95 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/5 shadow-apple-sm'
                            : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text-secondary hover:border-emerald-500/30'
                        }`}
                      >
                        <div className="text-2xl mb-1">{layout.icon}</div>
                        <div>
                          <div className={`text-xs font-bold ${isSelected ? 'text-emerald-500' : 'text-apple-text'}`}>{layout.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Categorías Sticky */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border mt-4">
                <div className="space-y-1 pr-4">
                  <h4 className="text-sm font-bold">Barra de Categorías Flotante (Sticky)</h4>
                  <p className="text-xs text-apple-text-secondary">Permite que el menú de categorías se quede pegado arriba al hacer scroll para un rápido acceso.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateDisenoLayout('categorias_sticky', !theme.config_diseno?.layout?.categorias_sticky)}
                  className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 flex-shrink-0 ${
                    theme.config_diseno?.layout?.categorias_sticky ? 'bg-apple-blue' : 'bg-apple-border dark:bg-apple-dark-border'
                  }`}
                >
                  <motion.div
                    layout
                    className="w-6 h-6 rounded-full bg-white shadow-apple-sm"
                    animate={{ x: theme.config_diseno?.layout?.categorias_sticky ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            </section>

            {/* 3. Componentes y Bordes */}
            {isPremium && (
            <>
            <section className="p-8 rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm space-y-8">
              <h3 className="text-[11px] font-bold text-apple-blue tracking-[0.2em] uppercase flex items-center gap-2 border-b border-apple-border dark:border-apple-dark-border pb-4">
                <Sliders size={16} /> Estilo de Componentes
              </h3>

              {/* Redondeado Botones */}
              <div className="space-y-4">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-bold text-apple-text-secondary">Esquinas de Botones</label>
                  <span className="text-xs font-mono font-bold bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border px-2 py-0.5 rounded-md">
                    {theme.config_diseno?.apariencia?.border_radius_botones === '0px' ? 'Recto' :
                     theme.config_diseno?.apariencia?.border_radius_botones === '8px' ? 'Suave' :
                     theme.config_diseno?.apariencia?.border_radius_botones === '16px' ? 'Fuerte' : 'Píldora / Circular'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Recto', value: '0px' },
                    { label: 'Suave', value: '8px' },
                    { label: 'Fuerte', value: '16px' },
                    { label: 'Píldora', value: '9999px' }
                  ].map((btn) => (
                    <button
                      key={btn.value}
                      type="button"
                      onClick={() => updateDisenoApariencia('border_radius_botones', btn.value)}
                      className={`py-3.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                        theme.config_diseno?.apariencia?.border_radius_botones === btn.value
                          ? 'bg-apple-blue border-apple-blue text-white shadow-apple-xs'
                          : 'bg-apple-bg dark:bg-apple-dark-bg border-apple-border dark:border-apple-dark-border text-apple-text-secondary hover:border-apple-blue/30'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                {/* Ejemplo de Botón en Tiempo Real */}
                <div className="p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border flex flex-col items-center justify-center gap-2">
                  <span className="text-[10px] text-apple-text-tertiary uppercase tracking-wider font-bold">Ejemplo visual del botón:</span>
                  <button
                    type="button"
                    className="px-6 py-2.5 text-white font-bold text-xs transition-all shadow-md active:scale-95"
                    style={{
                      backgroundColor: theme.color_primario,
                      borderRadius: theme.config_diseno?.apariencia?.border_radius_botones || '8px'
                    }}
                  >
                    Ordenar Platillo
                  </button>
                </div>
              </div>

              {/* Redondeado Tarjetas */}
              <div className="space-y-4">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-bold text-apple-text-secondary">Esquinas de Tarjetas de Platillos</label>
                  <span className="text-xs font-mono font-bold bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border px-2 py-0.5 rounded-md">
                    {theme.config_diseno?.apariencia?.border_radius_tarjetas === '0px' ? 'Recto' :
                     theme.config_diseno?.apariencia?.border_radius_tarjetas === '12px' ? 'Suave' :
                     theme.config_diseno?.apariencia?.border_radius_tarjetas === '24px' ? 'Fuerte' : 'Circular'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Recto', value: '0px' },
                    { label: 'Suave', value: '12px' },
                    { label: 'Fuerte', value: '24px' },
                    { label: 'Circular', value: '32px' }
                  ].map((card) => (
                    <button
                      key={card.value}
                      type="button"
                      onClick={() => updateDisenoApariencia('border_radius_tarjetas', card.value)}
                      className={`py-3.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                        theme.config_diseno?.apariencia?.border_radius_tarjetas === card.value
                          ? 'bg-apple-blue border-apple-blue text-white shadow-apple-xs'
                          : 'bg-apple-bg dark:bg-apple-dark-bg border-apple-border dark:border-apple-dark-border text-apple-text-secondary hover:border-apple-blue/30'
                      }`}
                    >
                      {card.label}
                    </button>
                  ))}
                </div>
                {/* Ejemplo de Tarjeta en Tiempo Real */}
                <div className="p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border flex flex-col items-center justify-center gap-2">
                  <span className="text-[10px] text-apple-text-tertiary uppercase tracking-wider font-bold">Ejemplo visual de la tarjeta:</span>
                  <div
                    className="w-full max-w-[280px] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border p-3 flex gap-3 shadow-apple-xs transition-all"
                    style={{
                      borderRadius: theme.config_diseno?.apariencia?.border_radius_tarjetas || '24px'
                    }}
                  >
                    <div
                      className="w-12 h-12 bg-apple-border dark:bg-apple-dark-border flex items-center justify-center text-lg flex-shrink-0"
                      style={{
                        borderRadius: `calc(${theme.config_diseno?.apariencia?.border_radius_tarjetas || '24px'} - 4px)`
                      }}
                    >
                      🍕
                    </div>
                    <div className="flex-1 flex flex-col justify-center space-y-1.5">
                      <div className="h-3 w-20 rounded-full bg-apple-text-secondary opacity-30" />
                      <div className="h-2 w-28 rounded-full bg-apple-text-tertiary opacity-25" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Switches para Sombras y Glassmorphism */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Switch Glassmorphism */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold flex items-center gap-1.5"><Sparkles size={12} className="text-purple-500" /> Glassmorphism</h4>
                    <p className="text-[10px] text-apple-text-secondary">Efecto translúcido esmerilado en las tarjetas</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const active = !theme.config_diseno?.elementos_visuales?.glassmorphism;
                      updateDisenoElementos('glassmorphism', active);
                      updateDisenoApariencia('fondo_blur', active ? '12px' : '0px');
                    }}
                    className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 flex-shrink-0 ${
                      theme.config_diseno?.elementos_visuales?.glassmorphism ? 'bg-apple-blue' : 'bg-apple-border dark:bg-apple-dark-border'
                    }`}
                  >
                    <motion.div
                      layout
                      className="w-5 h-5 rounded-full bg-white shadow-apple-xs"
                      animate={{ x: theme.config_diseno?.elementos_visuales?.glassmorphism ? 20 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Switch Sombras */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold">Sombras Premium</h4>
                    <p className="text-[10px] text-apple-text-secondary">Añade volumen 3D en tarjetas y botones</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateDisenoElementos('sombras_habilitadas', !theme.config_diseno?.elementos_visuales?.sombras_habilitadas)}
                    className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 flex-shrink-0 ${
                      theme.config_diseno?.elementos_visuales?.sombras_habilitadas ? 'bg-apple-blue' : 'bg-apple-border dark:bg-apple-dark-border'
                    }`}
                  >
                    <motion.div
                      layout
                      className="w-5 h-5 rounded-full bg-white shadow-apple-xs"
                      animate={{ x: theme.config_diseno?.elementos_visuales?.sombras_habilitadas ? 20 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>

              {/* Color del Badge de Ofertas */}
              <div className="space-y-3 relative">
                <label className="text-sm font-bold text-apple-text-secondary ml-1">Color del Badge de Ofertas/Destacados</label>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-sm group hover:border-apple-blue/50 transition-colors">
                  <button
                    type="button"
                    onClick={() => setShowPicker(showPicker === 'badge' ? null : 'badge')}
                    className="w-12 h-12 rounded-xl shadow-apple-md border border-white/20 transition-transform active:scale-95 flex-shrink-0"
                    style={{ backgroundColor: theme.config_diseno?.elementos_visuales?.badge_color || '#ffbe0b' }}
                  />
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-bold tracking-widest uppercase">{theme.config_diseno?.elementos_visuales?.badge_color || '#ffbe0b'}</span>
                    <span className="text-[10px] text-apple-text-tertiary">Color usado en etiquetas de "Oferta" o "Nuevo"</span>
                  </div>
                </div>

                {showPicker === 'badge' && (
                  <div className="absolute z-50 left-1/2 -translate-x-1/2 mt-2 p-4 rounded-3xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border shadow-apple-2xl flex flex-col items-center gap-2">
                    <HexColorPicker
                      color={theme.config_diseno?.elementos_visuales?.badge_color || '#ffbe0b'}
                      onChange={(color) => updateDisenoElementos('badge_color', color)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPicker(null)}
                      className="px-4 py-1.5 bg-apple-blue text-white rounded-full text-[10px] font-bold active:scale-95 transition-transform"
                    >
                      Listo
                    </button>
                  </div>
                )}
              </div>

              {/* Contenedor y Opacidad de Tarjetas de Platillos */}
              <div className="space-y-4 pt-4 border-t border-apple-border dark:border-apple-dark-border">
                <div className="flex justify-between items-center ml-1">
                  <div>
                    <h4 className="text-sm font-bold text-apple-text">Estilo del Contenedor de Tarjetas</h4>
                    <p className="text-[11px] text-apple-text-secondary mt-0.5">Controla la solidez o transparencia de las tarjetas de comida</p>
                  </div>
                  <span className="text-xs font-mono font-bold bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border px-2.5 py-1 rounded-md">
                    {theme.config_diseno?.elementos_visuales?.tarjeta_estilo === 'solida' ? 'Sólida' :
                     theme.config_diseno?.elementos_visuales?.tarjeta_estilo === 'minimalista' ? 'Minimalista' : 'Frosted Glass'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'solida', label: 'Tarjeta Sólida', icon: '🟦', desc: 'Fondo nítido con máxima legibilidad' },
                    { id: 'frosted', label: 'Frosted Glass', icon: '🪟', desc: 'Translúcido esmerilado con desenfoque' },
                    { id: 'minimalista', label: 'Minimalista', icon: '🔲', desc: 'Sin relleno, solo borde sutil' }
                  ].map((style) => {
                    const isSelected = (theme.config_diseno?.elementos_visuales?.tarjeta_estilo || 'frosted') === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => {
                          updateDisenoElementos('tarjeta_estilo', style.id);
                          if (style.id === 'solida') {
                            updateDisenoElementos('tarjeta_opacidad', 95);
                          } else if (style.id === 'frosted') {
                            updateDisenoElementos('tarjeta_opacidad', 35);
                            updateDisenoElementos('glassmorphism', true);
                          } else if (style.id === 'minimalista') {
                            updateDisenoElementos('tarjeta_opacidad', 15);
                          }
                        }}
                        className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-1.5 active:scale-95 ${
                          isSelected
                            ? 'border-apple-blue bg-apple-blue/5 shadow-apple-glow'
                            : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text-secondary hover:border-apple-blue/30'
                        }`}
                      >
                        <span className="text-xl">{style.icon}</span>
                        <span className={`text-xs font-bold ${isSelected ? 'text-apple-blue' : 'text-apple-text'}`}>{style.label}</span>
                        <span className="text-[10px] text-apple-text-tertiary leading-tight">{style.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Slider de Opacidad de Fondo de Tarjeta */}
                <div className="p-5 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-apple-text">Opacidad del Fondo de Tarjeta</span>
                    <span className="font-mono font-bold text-apple-blue">
                      {theme.config_diseno?.elementos_visuales?.tarjeta_opacidad ?? 90}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={theme.config_diseno?.elementos_visuales?.tarjeta_opacidad ?? 90}
                    onChange={(e) => updateDisenoElementos('tarjeta_opacidad', Number(e.target.value))}
                    className="w-full accent-apple-blue cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-apple-text-tertiary">
                    <span>10% (Más transparente)</span>
                    <span>100% (Completamente sólida)</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Fuentes */}
            <section className="p-8 rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm">
              <h3 className="text-[11px] font-bold text-apple-blue tracking-[0.2em] uppercase mb-8 flex items-center gap-2 border-b border-apple-border dark:border-apple-dark-border pb-4">
                <Type size={16} /> Tipografía del Menú
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {FUENTES.map((fuente) => (
                  <button
                    key={fuente.value}
                    type="button"
                    onClick={() => {
                      setTheme((prev: any) => ({ ...prev, fuente_familia: fuente.value }));
                      updateDisenoApariencia('fuente_familia', fuente.value);
                    }}
                    className={`p-5 rounded-2xl border transition-all text-center active:scale-95 flex flex-col justify-center items-center ${
                      theme.fuente_familia === fuente.value
                        ? 'border-apple-blue bg-apple-blue/5 shadow-apple-glow text-apple-blue'
                        : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text-secondary hover:border-apple-blue/30'
                    }`}
                  >
                    <span className="text-2xl font-black block mb-1" style={{ fontFamily: fuente.value === 'Sans-Serif' ? 'Inter, sans-serif' : fuente.value }}>Aa</span>
                    <span className="text-[10px] font-black uppercase tracking-wider">{fuente.label}</span>
                  </button>
                ))}
              </div>
            </section>
            </>
            )}

            {/* 5. Banner Promocional */}
            {['premium', 'prueba'].includes(theme.plan) && (
            <section className="p-8 rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm space-y-6">
              <h3 className="text-[11px] font-bold text-apple-blue tracking-[0.2em] uppercase flex items-center gap-2 border-b border-apple-border dark:border-apple-dark-border pb-4">
                <Megaphone size={16} /> Banner Promocional
              </h3>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border">
                <div className="space-y-1 pr-4">
                  <h4 className="text-sm font-bold">Activar Banner Promocional</h4>
                  <p className="text-xs text-apple-text-secondary">Muestra un banner informativo destacado al principio del menú para avisar a tus clientes sobre ofertas especiales o anuncios.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTheme((prev: any) => ({ ...prev, banner_promocional_activo: !prev.banner_promocional_activo }))}
                  className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 flex-shrink-0 ${
                    theme.banner_promocional_activo ? 'bg-apple-blue' : 'bg-apple-border dark:bg-apple-dark-border'
                  }`}
                >
                  <motion.div
                    layout
                    className="w-6 h-6 rounded-full bg-white shadow-apple-sm"
                    animate={{ x: theme.banner_promocional_activo ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {theme.banner_promocional_activo && (
                <motion.div 
                  className="space-y-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <label className="text-sm font-bold text-apple-text-secondary ml-1">Mensaje del Banner</label>
                  <input
                    type="text"
                    value={theme.banner_promocional_texto || ''}
                    onChange={(e) => setTheme((prev: any) => ({ ...prev, banner_promocional_texto: e.target.value }))}
                    placeholder="Ej. ¡Hoy 2x1 en toda la coctelería a partir de las 6:00 PM!"
                    className="w-full px-5 py-3.5 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border text-sm font-medium focus:border-apple-blue"
                  />
                </motion.div>
              )}
            </section>
            )}

            {/* 6. Moneda y Divisa del Menú */}
            <section className="p-8 rounded-[2.5rem] bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary border border-apple-border dark:border-apple-dark-border shadow-apple-sm space-y-6">
              <h3 className="text-[11px] font-bold text-apple-blue tracking-[0.2em] uppercase flex items-center gap-2 border-b border-apple-border dark:border-apple-dark-border pb-4">
                <DollarSign size={16} /> Moneda y Formato de Precios
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-apple-text">Símbolo de Divisa</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { simbolo: '$', label: '$ (MXN/USD/CLP)' },
                      { simbolo: 'USD $', label: 'USD $' },
                      { simbolo: '€', label: '€ (EUR)' },
                      { simbolo: 'S/', label: 'S/ (PEN)' },
                      { simbolo: 'Q', label: 'Q (GTQ)' },
                      { simbolo: '₡', label: '₡ (CRC)' },
                      { simbolo: 'Bs', label: 'Bs (BOB)' },
                      { simbolo: '£', label: '£ (GBP)' }
                    ].map((m) => {
                      const isSelected = (theme.config_diseno?.moneda?.simbolo || '$') === m.simbolo;
                      return (
                        <button
                          key={m.simbolo}
                          type="button"
                          onClick={() => updateMoneda('simbolo', m.simbolo)}
                          className={`p-3 rounded-2xl border text-center transition-all active:scale-95 flex flex-col items-center justify-center gap-1 ${
                            isSelected
                              ? 'border-apple-blue bg-apple-blue/5 text-apple-blue font-black shadow-apple-glow'
                              : 'border-apple-border dark:border-apple-dark-border bg-apple-bg dark:bg-apple-dark-bg text-apple-text-secondary hover:border-apple-blue/30'
                          }`}
                        >
                          <span className="text-base font-black">{m.simbolo}</span>
                          <span className="text-[10px] font-bold opacity-75">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Posición del Símbolo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-apple-text">Ubicación del Símbolo</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'prefijo', label: 'Prefijo (Ej: $150)' },
                        { id: 'sufijo', label: 'Sufijo (Ej: 150 €)' }
                      ].map((pos) => {
                        const isSelected = (theme.config_diseno?.moneda?.posicion || 'prefijo') === pos.id;
                        return (
                          <button
                            key={pos.id}
                            type="button"
                            onClick={() => updateMoneda('posicion', pos.id)}
                            className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-apple-blue border-apple-blue text-white shadow-apple-xs'
                                : 'bg-apple-bg dark:bg-apple-dark-bg border-apple-border dark:border-apple-dark-border text-apple-text-secondary hover:border-apple-blue/30'
                            }`}
                          >
                            {pos.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ejemplo en vivo */}
                  <div className="p-4 rounded-2xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] text-apple-text-tertiary uppercase tracking-wider font-bold mb-1">Previsualización de Precio:</span>
                    <span className="text-xl font-black text-apple-blue">
                      {(theme.config_diseno?.moneda?.posicion || 'prefijo') === 'prefijo'
                        ? `${theme.config_diseno?.moneda?.simbolo || '$'} 150.00`
                        : `150.00 ${theme.config_diseno?.moneda?.simbolo || '$'}`}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Botón Guardar */}
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto flex-1 py-5 bg-apple-blue text-white rounded-full font-bold text-lg hover:bg-apple-blue-hover active:scale-95 transition-all disabled:opacity-50 shadow-apple-glow flex items-center justify-center gap-2"
                >
                  {saving ? 'Publicando cambios...' : (
                    <>
                      <Globe size={20} />
                      Guardar y Publicar Menú
                    </>
                  )}
                </button>

                <AnimatePresence>
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-2 text-green-500 font-bold"
                    >
                      <CheckCircle2 size={24} />
                      <span>¡Cambios publicados!</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {saveError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-red-500 text-sm font-medium p-4 rounded-2xl bg-red-500/5 border border-red-500/20"
                  >
                    <AlertCircle size={16} />
                    {saveError}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </div>

        {/* Real-time Preview Column */}
        <div className="flex-1 flex flex-col items-center xl:sticky xl:top-8 xl:self-start">
             
             {/* Toggle de Dispositivo */}
             <div className="mb-6 flex items-center bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary p-1 rounded-2xl border border-apple-border dark:border-apple-dark-border">
                <button 
                  type="button"
                  onClick={() => setPreviewMode('mobile')}
                  className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                    previewMode === 'mobile' 
                      ? 'bg-apple-blue text-white shadow-apple-sm' 
                      : 'text-apple-text-secondary hover:text-apple-text'
                  }`}
                >
                  Móvil
                </button>
                <button 
                  type="button"
                  onClick={() => setPreviewMode('desktop')}
                  className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                    previewMode === 'desktop' 
                      ? 'bg-apple-blue text-white shadow-apple-sm' 
                      : 'text-apple-text-secondary hover:text-apple-text'
                  }`}
                >
                  Escritorio
                </button>
             </div>

             <div className={`w-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${previewMode === 'mobile' ? 'max-w-[360px]' : 'max-w-full'}`}>
               <div className="text-center mb-6">
                 <h3 className="text-apple-text-tertiary text-[11px] font-black uppercase tracking-[0.3em] inline-flex items-center gap-2 px-4 py-2 rounded-full border border-apple-border dark:border-apple-dark-border">
                   <div className="w-1.5 h-1.5 rounded-full bg-apple-blue animate-pulse" />
                   Vista Previa {previewMode === 'mobile' ? '(Vertical)' : '(Horizontal)'}
                 </h3>
               </div>
               
               {/* Device Mockup */}
               <div className={`relative w-full overflow-hidden transition-all duration-500 ring-1 ring-white/10 shadow-apple-2xl bg-black ${
                  previewMode === 'mobile' 
                    ? 'aspect-[9/18.5] rounded-[3.5rem] border-[10px] border-[#1D1D1F]' 
                    : 'aspect-video rounded-2xl border-[8px] border-[#1D1D1F]'
               }`}
                  style={{ 
                    background: theme.config_diseno?.apariencia?.fondo_tipo === 'gradiente' 
                        ? theme.config_diseno?.apariencia?.fondo_valor 
                        : theme.color_fondo,
                    backgroundColor: theme.color_fondo,
                  }}
               >
                   {/* Device Notch (Mobile) or Camera Dot (Desktop) */}
                   {previewMode === 'mobile' ? (
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-[#1D1D1F] rounded-b-3xl z-50 shadow-sm" />
                   ) : (
                     <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1D1D1F] rounded-full z-50 shadow-sm opacity-50" />
                   )}
                   
                   {/* Mock Content */}
                   {(() => {
                     const isDark = theme.config_diseno?.apariencia?.modo_oscuro !== undefined
                       ? theme.config_diseno.apariencia.modo_oscuro
                       : isColorDark(theme.color_fondo);
                       
                     const responsiveConfig = theme.config_diseno?.apariencia?.responsive_imagen || {};
                     const imgConfig = previewMode === 'desktop' 
                        ? (responsiveConfig.desktop_large || responsiveConfig.desktop || responsiveConfig.laptop || { width: 1920, height: 1080, position_x: 0, position_y: 0, scale: 1, rotation: 0, opacity: 100, object_fit: 'cover', z_index: 0, border_radius: 0 })
                        : (responsiveConfig.mobile || responsiveConfig.mobile_small || { width: 1080, height: 1920, position_x: 0, position_y: 0, scale: 1, rotation: 0, opacity: 100, object_fit: 'cover', z_index: 0, border_radius: 0 });
                       
                      const textOpHigh = theme.config_diseno?.apariencia?.color_normal || (isDark ? 'rgba(255,255,255,0.9)' : 'rgba(29,29,31,0.9)');
                      const textOpLow  = colorWithOpacity(textOpHigh, 0.55);
                     const borderOp   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
                     const headerBg   = isDark ? 'rgba(10,10,10,0.5)' : 'rgba(255,255,255,0.5)';
                     
                     const btnRadius = theme.config_diseno?.apariencia?.border_radius_botones || '12px';
                     const cardRadius = theme.config_diseno?.apariencia?.border_radius_tarjetas || '24px';
                     const isGlass = theme.config_diseno?.elementos_visuales?.glassmorphism || false;
                     const isImageBg = theme.config_diseno?.apariencia?.fondo_tipo === 'imagen';
                     const imageBgUrl = previewMode === 'desktop'
                       ? (theme.config_diseno?.apariencia?.fondo_imagen_horizontal_url || (!theme.config_diseno?.apariencia?.fondo_imagen_vertical_url ? (theme.config_diseno?.apariencia?.fondo_imagen_url || '') : ''))
                       : (theme.config_diseno?.apariencia?.fondo_imagen_vertical_url || (!theme.config_diseno?.apariencia?.fondo_imagen_horizontal_url ? (theme.config_diseno?.apariencia?.fondo_imagen_url || '') : ''));
                     const showShadow = theme.config_diseno?.elementos_visuales?.sombras_habilitadas !== undefined
                       ? theme.config_diseno.elementos_visuales.sombras_habilitadas
                       : true;
                     const badgeColor = theme.config_diseno?.elementos_visuales?.badge_color || '#ffbe0b';
                     
                     const surfaceOp = isGlass
                       ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')
                       : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)');

                     // Tipografía y Letras reactivas en tiempo real
                     const fontFam = theme.fuente_familia || 'Sans-Serif';
                     const font = 
                       fontFam === 'Serif' ? 'Georgia, "Times New Roman", serif' :
                       fontFam === 'Mono' ? '"SF Mono", "JetBrains Mono", monospace' :
                       fontFam === 'Poppins' ? 'Poppins, sans-serif' :
                       fontFam === 'Outfit' ? 'Outfit, sans-serif' :
                       'Inter, -apple-system, BlinkMacSystemFont, sans-serif';

                     // Estilos de tarjeta y slider de opacidad reactivos
                     const tarjetaEstilo = theme.config_diseno?.elementos_visuales?.tarjeta_estilo || (isGlass ? 'frosted' : 'solida');
                     const tarjetaOpacidadPct = Math.min(Math.max(Number(theme.config_diseno?.elementos_visuales?.tarjeta_opacidad ?? (tarjetaEstilo === 'solida' ? 95 : 35)), 10), 100);
                     const tarjetaAlpha = (tarjetaOpacidadPct / 100).toFixed(2);

                     let mockCardBg = surfaceOp;
                     let mockCardBackdrop = 'none';
                     let mockCardBorder = `1px solid ${borderOp}`;

                     if (tarjetaEstilo === 'solida') {
                       mockCardBg = isDark ? `rgba(26, 26, 30, ${tarjetaAlpha})` : `rgba(255, 255, 255, ${tarjetaAlpha})`;
                       mockCardBackdrop = 'none';
                     } else if (tarjetaEstilo === 'frosted') {
                       mockCardBg = isDark ? `rgba(18, 18, 22, ${tarjetaAlpha})` : `rgba(255, 255, 255, ${tarjetaAlpha})`;
                       mockCardBackdrop = 'blur(12px)';
                     } else if (tarjetaEstilo === 'minimalista') {
                       mockCardBg = 'transparent';
                       mockCardBackdrop = 'none';
                       mockCardBorder = `1px dashed ${borderOp}`;
                     }

                     // Moneda y formato de precios
                     const simboloMoneda = theme.config_diseno?.moneda?.simbolo || '$';
                     const posicionMoneda = theme.config_diseno?.moneda?.posicion || 'prefijo';
                     const formatMockPrice = (val: number) => {
                       const formatted = val.toFixed(2);
                       return posicionMoneda === 'prefijo' ? `${simboloMoneda} ${formatted}` : `${formatted} ${simboloMoneda}`;
                     };

                     // Estilo de encabezado Hero Banner vs Fondo Completo
                     const isHeroBanner = theme.config_diseno?.layout?.estilo_encabezado === 'banner_hero';
                     const blurVal = Number(theme.config_diseno?.apariencia?.fondo_imagen_blur) || 0;

                     const currentLayoutType = previewMode === 'desktop'
                         ? (theme.config_diseno?.layout?.layout_type_horizontal || theme.layout_type || 'TARJETAS_DETALLADAS')
                         : (theme.config_diseno?.layout?.layout_type_vertical || theme.layout_type || 'TARJETAS_DETALLADAS');

                      return (
                    <div
                      className="w-full h-full overflow-y-auto scrollbar-hide flex flex-col relative transition-all duration-300"
                      style={{ fontFamily: font }}
                    >
                      {/* Fondo de imagen (Visible también en modo Hero Banner) */}
                      {isImageBg && imageBgUrl && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
                          <div 
                            className="relative flex items-center justify-center" 
                            style={{
                              width: `${imgConfig.width}px`,
                              height: `${imgConfig.height}px`,
                              transform: `translate3d(${imgConfig.position_x}px, ${imgConfig.position_y}px, 0px) scale(${imgConfig.scale}) rotate(${imgConfig.rotation}deg)`,
                              opacity: imgConfig.opacity / 100,
                              zIndex: imgConfig.z_index,
                              borderRadius: `${imgConfig.border_radius}px`,
                              transformOrigin: 'center center'
                            }}
                          >
                            <img 
                              src={imageBgUrl} 
                              alt="fondo" 
                              className="w-full h-full max-w-none"
                              style={{ 
                                objectFit: imgConfig.object_fit,
                                borderRadius: `${imgConfig.border_radius}px`,
                                filter: `blur(${blurVal}px)`
                              }} 
                            />
                          </div>
                          <div 
                            className="absolute inset-0 w-full h-full" 
                            style={{ 
                              backgroundColor: isDark ? 'rgba(10, 10, 10, 0.7)' : 'rgba(255, 255, 255, 0.75)', 
                              backdropFilter: `blur(${blurVal}px)`,
                              WebkitBackdropFilter: `blur(${blurVal}px)`
                            }} 
                          />
                        </div>
                      )}

                      <div className="relative z-10 flex flex-col w-full min-h-full">
                      {/* Banner Promocional Activo en Mockup */}
                      {theme.banner_promocional_activo && theme.banner_promocional_texto && (
                        <div 
                          className="px-3 py-1.5 text-center text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-sm sticky top-0 z-30"
                          style={{ backgroundColor: theme.color_primario, color: '#ffffff' }}
                        >
                          <span>📢</span>
                          <span className="truncate">{theme.banner_promocional_texto}</span>
                        </div>
                      )}

                      {/* HERO BANNER SUPERIOR (Si layout.estilo_encabezado === 'banner_hero') */}
                      {isHeroBanner ? (
                        <div className="relative w-full overflow-hidden mb-3">
                          <div 
                            className="h-28 sm:h-32 w-full relative overflow-hidden flex items-center justify-center shadow-md"
                            style={{ background: `linear-gradient(135deg, ${theme.color_primario} 0%, ${theme.color_fondo} 100%)` }}
                          >
                            <div className="absolute inset-0 bg-black/15 backdrop-blur-[1px]" />
                          </div>
                          
                          {/* Info de Hero en relieve centrada */}
                          <div className="px-4 -mt-8 relative z-20 flex flex-col items-center text-center gap-1.5">
                            <div 
                              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-2xl border-2 flex-shrink-0"
                              style={{ borderColor: theme.color_fondo, backgroundColor: `${theme.color_primario}25` }}
                            >
                              {theme.logo_url
                                ? <img src={theme.logo_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                                : <span style={{ color: theme.color_primario }}>🌮</span>}
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="text-[13px] font-black tracking-tight" style={{ color: textOpHigh }}>
                                Mi Restaurante
                              </h4>
                              {theme.config_diseno?.informacion?.ambiente && (
                                <p className="text-[9px] font-semibold opacity-75" style={{ color: textOpLow }}>
                                  ✨ {theme.config_diseno.informacion.ambiente}
                                </p>
                              )}
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              🟢 Abierto
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Header compacto estándar */
                        <div 
                          className="px-5 pt-10 pb-3 flex items-center justify-between gap-2.5 sticky top-0 z-10 backdrop-blur-xl transition-all" 
                          style={{ backgroundColor: 'transparent' }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: `${theme.color_primario}25` }}>
                              {theme.logo_url
                                ? <img src={theme.logo_url} alt="" className="w-full h-full object-cover rounded-xl" />
                                : <span style={{ color: theme.color_primario }}>🌮</span>}
                            </div>
                            <span className="text-[12px] font-black tracking-tight" style={{ color: textOpHigh }}>
                              Mi Restaurante
                            </span>
                          </div>
                          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.color_primario }} />
                        </div>
                      )}
  
                      {/* Nav Categorías mock */}
                      <div 
                         className="px-4 py-2 flex gap-2 overflow-x-hidden backdrop-blur-xl" 
                         style={{ 
                           position: theme.config_diseno?.layout?.categorias_sticky ? 'sticky' : 'relative',
                           top: isHeroBanner ? '0px' : '45px',
                           zIndex: 9,
                           backgroundColor: 'transparent'
                         }}
                      >
                        {['Tacos Especiales','Entradas','Bebidas'].map((n, idx) => (
                          <div 
                            key={n} 
                            className="h-7 px-3 flex-shrink-0 flex items-center gap-1.5 transition-all" 
                            style={{ 
                              backgroundColor: idx === 0 ? `${theme.color_primario}20` : mockCardBg, 
                              border: `1px solid ${idx === 0 ? theme.color_primario : borderOp}`,
                              borderRadius: btnRadius
                            }}
                          >
                            {idx === 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.color_primario }} />}
                            <span 
                              className="text-[10px] font-bold" 
                              style={{ color: idx === 0 ? theme.color_primario : textOpLow }}
                            >
                              {n}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Content Platillos */}
                      <div className="p-4 space-y-4">
                       <div className="h-5 pl-2 flex items-center" style={{ borderLeft: `3px solid ${theme.color_primario}` }}>
                         <span className="text-[12px] font-black tracking-tight uppercase" style={{ color: textOpHigh }}>Tacos Especiales</span>
                       </div>
  
                       {/* ── MOCK LISTA SIMPLE ── */}
                       {currentLayoutType === 'LISTA_SIMPLE' && (
                         <div className="space-y-3">
                           {[
                             { nombre: 'Taco de Rib Eye Prime', porcion: '3 pzas •', desc: 'Corte premium con costra de queso gouda.', precio: 135, orig: 180 },
                             { nombre: 'Guacamole Imperial', porcion: 'Para 2 •', desc: 'Aguacate hass fresco con totopos crujientes.', precio: 95, orig: null },
                             { nombre: 'Costra de Asada', porcion: '2 pzas •', desc: 'Queso dorado a la plancha con carne asada.', precio: 110, orig: null }
                           ].map((item, idx) => (
                             <div key={idx} className="flex justify-between items-center py-2.5 px-2 transition-all" style={{ borderBottom: `1px solid ${borderOp}` }}>
                               <div className="space-y-0.5 flex-1 pr-3 min-w-0">
                                 <div className="flex items-center gap-1.5">
                                   <h5 className="font-bold text-[12px] truncate" style={{ color: textOpHigh }}>{item.nombre}</h5>
                                   {item.orig && (
                                     <span className="px-1.5 py-0.5 text-[8px] font-black rounded bg-red-500/20 text-red-500">
                                       -25%
                                     </span>
                                   )}
                                 </div>
                                 <p className="text-[10px] truncate" style={{ color: textOpLow }}>
                                   <span className="text-emerald-500 font-semibold">{item.porcion} </span>
                                   {item.desc}
                                 </p>
                               </div>
                               <div className="text-right flex-shrink-0">
                                 {item.orig && (
                                   <span className="block text-[8px] line-through opacity-50" style={{ color: textOpLow }}>
                                     {formatMockPrice(item.orig)}
                                   </span>
                                 )}
                                 <span className="font-black text-[12px]" style={{ color: theme.color_primario }}>
                                   {formatMockPrice(item.precio)}
                                 </span>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
  
                       {/* ── MOCK CUADRÍCULA ── */}
                       {currentLayoutType === 'CUADRICULA_FOTOS' && (
                         <div className={`grid gap-3 ${previewMode === 'desktop' ? 'grid-cols-4' : 'grid-cols-2'}`}>
                           {[
                             { nombre: 'Taco Rib Eye Prime', precio: 135, orig: 180, icon: '🌮' },
                             { nombre: 'Guacamole Imperial', precio: 95, orig: null, icon: '🥑' },
                             { nombre: 'Costra de Asada', precio: 110, orig: null, icon: '🥩' },
                             { nombre: 'Aguachile Verde', precio: 145, orig: null, icon: '🍤' }
                           ].map((item, idx) => (
                             <div 
                               key={idx} 
                               className="space-y-1.5 p-2 rounded-2xl transition-all"
                               style={{ 
                                 backgroundColor: mockCardBg, 
                                 borderRadius: cardRadius,
                                 border: mockCardBorder,
                                 boxShadow: showShadow ? '0 4px 10px rgba(0,0,0,0.1)' : 'none',
                                 backdropFilter: mockCardBackdrop,
                                 WebkitBackdropFilter: mockCardBackdrop
                               }}
                             >
                               <div className="aspect-square relative overflow-hidden bg-black/10 flex items-center justify-center text-3xl" style={{ borderRadius: `calc(${cardRadius} - 8px)` }}>
                                 <span>{item.icon}</span>
                                 {item.orig && (
                                   <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[7px] font-black bg-red-600 text-white animate-pulse">
                                     -25%
                                   </div>
                                 )}
                                 <div 
                                   className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-full text-[8px] font-black shadow-sm flex items-center gap-1" 
                                   style={{ backgroundColor: `${theme.color_primario}ee`, color: '#fff' }}
                                 >
                                   {item.orig && (
                                     <span className="line-through opacity-75 text-[7px]">{formatMockPrice(item.orig)}</span>
                                   )}
                                   <span>{formatMockPrice(item.precio)}</span>
                                 </div>
                               </div>
                               <h5 className="font-bold text-[11px] truncate text-center" style={{ color: textOpHigh }}>{item.nombre}</h5>
                             </div>
                           ))}
                         </div>
                       )}
  
                       {/* ── MOCK TARJETAS DETALLADAS ── */}
                       {currentLayoutType === 'TARJETAS_DETALLADAS' && (
                         <div className="space-y-3.5">
                           {[
                             { 
                               nombre: 'Taco de Rib Eye Prime', 
                               porcion: '3 piezas artesanales', 
                               desc: 'Corte premium con costra de queso gouda y guacamole de la casa.', 
                               precio: 135, 
                               orig: 180, 
                               badge: 'Oferta Especial',
                               icon: '🌮' 
                             },
                             { 
                               nombre: 'Guacamole Tradicional', 
                               porcion: 'Ideal para compartir', 
                               desc: 'Aguacate hass seleccionado con pico de gallo y totopos horneados.', 
                               precio: 95, 
                               orig: null, 
                               badge: null,
                               icon: '🥑' 
                             }
                           ].map((item, idx) => (
                             <div 
                               key={idx} 
                               className="p-3.5 space-y-2.5 transition-all relative overflow-hidden" 
                               style={{ 
                                 backgroundColor: mockCardBg, 
                                 border: mockCardBorder,
                                 borderRadius: cardRadius,
                                 boxShadow: showShadow ? '0 8px 20px rgba(0,0,0,0.12)' : 'none',
                                 backdropFilter: mockCardBackdrop,
                                 WebkitBackdropFilter: mockCardBackdrop
                               }}
                             >
                               {/* Badge de Oferta */}
                               {item.badge && (
                                 <div 
                                   className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[7px] font-black text-white uppercase tracking-wider shadow-sm animate-pulse" 
                                   style={{ backgroundColor: badgeColor }}
                                 >
                                   {item.badge}
                                 </div>
                               )}
                               <div className="h-20 rounded-xl flex items-center justify-center text-3xl bg-black/10" style={{ borderRadius: `calc(${cardRadius} - 8px)` }}>
                                 {item.icon}
                               </div>
                               <div className="space-y-1">
                                 <h5 className="text-[12px] font-black tracking-tight" style={{ color: textOpHigh }}>
                                   {item.nombre}
                                 </h5>
                                 <p className="text-[9px] font-medium text-emerald-500">
                                   {item.porcion}
                                 </p>
                                 <p className="text-[10px] leading-relaxed line-clamp-2" style={{ color: textOpLow }}>
                                   {item.desc}
                                 </p>
                               </div>
                               <div className="flex justify-between items-center pt-1 border-t" style={{ borderColor: borderOp }}>
                                 <div className="flex items-baseline gap-1.5">
                                   <span className="text-[13px] font-black" style={{ color: theme.color_primario }}>
                                     {formatMockPrice(item.precio)}
                                   </span>
                                   {item.orig && (
                                     <span className="text-[9px] line-through font-medium opacity-50" style={{ color: textOpLow }}>
                                       {formatMockPrice(item.orig)}
                                     </span>
                                   )}
                                   {item.orig && (
                                     <span className="px-1.5 py-0.5 text-[8px] font-black rounded bg-red-500/15 text-red-500">
                                       -25%
                                     </span>
                                   )}
                                 </div>
                                 <span 
                                   className="px-2.5 py-1 text-[9px] font-bold rounded-full"
                                   style={{ backgroundColor: `${theme.color_primario}15`, color: theme.color_primario, borderRadius: btnRadius }}
                                 >
                                   Ver detalle
                                 </span>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
          
          <p className="mt-8 text-center text-apple-text-tertiary text-xs font-medium flex items-center justify-center gap-1.5">
            <AlertCircle size={14} />
            Esto es una representación visual aproximada.
          </p>
        </div>
      </div>
        </div>
      )}

      {/* Mini Modal / Popover Informativo Accesible */}
      <AnimatePresence>
        {infoModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent"
            onClick={() => setInfoModal(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-apple-bg dark:bg-apple-dark-bg border border-apple-border dark:border-apple-dark-border p-6 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  {infoModal.badge && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue uppercase tracking-wider">
                      {infoModal.badge}
                    </span>
                  )}
                  <h4 id="info-modal-title" className="text-sm font-bold text-apple-text">
                    {infoModal.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoModal(null)}
                  className="p-1.5 rounded-full text-apple-text-tertiary hover:text-apple-text hover:bg-apple-bg-secondary dark:hover:bg-apple-dark-bg-secondary transition-colors"
                  aria-label="Cerrar ventana informativa"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-apple-text-secondary leading-relaxed">
                {infoModal.content}
              </p>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setInfoModal(null)}
                  className="px-4 py-2 bg-apple-blue text-white rounded-xl text-xs font-bold hover:bg-blue-600 active:scale-95 transition-all shadow-apple-xs"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}