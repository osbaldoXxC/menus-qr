import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Sparkles, ArrowRight, X, ExternalLink } from 'lucide-react';
import { recommendationService, RecommendationItem, RecommendationResponse } from './recommendationService';
import { CuestionarioState } from './CuestionarioWizard';
import { ThemeContext } from '../../context/ThemeContext';
import { Logo } from '../../pages/components/Logo';
import { BouncyLoadingScreen } from './BouncyLoadingScreen';

interface DescubrirResultadosProps {
  onRefine?: () => void;
}

const FALLBACK_RECOMMENDATIONS: RecommendationItem[] = [
  {
    dish: {
      id: 'f1',
      nombre: 'Dumplings al Vapor (Jiaozi)',
      descripcion: 'Tu antojo de sabores auténticos coincide al 99% con esta receta tradicional preparada al vapor con cebollín fresco y salsa de soya.',
      precio: 125,
      url_imagen: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80',
      nivel_picante: 1,
      porcion: '6 piezas',
      categoria_nombre: 'Oriental',
      etiquetas_dieteticas: [],
      ingredientes_principales: ['Cerdo molido', 'Cebollín chino', 'Jengibre fresco', 'Salsa de soya', 'Masa artesanal']
    },
    restaurant: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Gran Dragón Dorado',
      slug: 'gran-dragon-dorado',
      menuUrl: '/menu/22222222-2222-2222-2222-222222222222'
    },
    matchScore: 0.99,
    matchPercentage: 99,
    reasons: ['🍜 Coincide con tu antojo de comida Oriental'],
    tags: ['Cerdo molido', 'Cebollín chino', 'Jengibre fresco']
  },
  {
    dish: {
      id: 'f2',
      nombre: 'Filete Mignon al Oporto',
      descripcion: 'Ideal para una ocasión especial. La reducción al Oporto y el puré trufado ofrecen una experiencia inigualable.',
      precio: 480,
      url_imagen: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80',
      nivel_picante: 0,
      porcion: '300g',
      categoria_nombre: 'Gourmet',
      etiquetas_dieteticas: ['sin_gluten'],
      ingredientes_principales: ['Corte Filete Mignon', 'Vino Oporto', 'Mantequilla trufada']
    },
    restaurant: {
      id: '55555555-5555-5555-5555-555555555555',
      name: "L'Étoile Gourmet",
      slug: 'letoile-gourmet',
      menuUrl: '/menu/55555555-5555-5555-5555-555555555555'
    },
    matchScore: 0.97,
    matchPercentage: 97,
    reasons: ['🥩 Coincide con tu gusto por cortes premium'],
    tags: ['sin_gluten', 'gourmet']
  },
  {
    dish: {
      id: 'f3',
      nombre: 'Pato Pekín Laminado',
      descripcion: 'Un clásico de la cocina tradicional. Su piel laqueada ultra crujiente te fascinará al primer bocado.',
      precio: 450,
      url_imagen: 'https://images.unsplash.com/photo-1514944288352-fffac99f0bdf?auto=format&fit=crop&w=800&q=80',
      nivel_picante: 1,
      porcion: 'Para compartir',
      categoria_nombre: 'Oriental',
      etiquetas_dieteticas: [],
      ingredientes_principales: ['Pato entero', 'Crepas chinas', 'Salsa Hoisin']
    },
    restaurant: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Gran Dragón Dorado',
      slug: 'gran-dragon-dorado',
      menuUrl: '/menu/22222222-2222-2222-2222-222222222222'
    },
    matchScore: 0.95,
    matchPercentage: 95,
    reasons: ['🦆 Receta icónica del chef'],
    tags: ['imperial']
  }
];

export const DescubrirResultados: React.FC<DescubrirResultadosProps> = ({ onRefine }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState<boolean>(true);
  const [showBouncyScreen, setShowBouncyScreen] = useState<boolean>(true);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isRestaurantDrawerOpen, setIsRestaurantDrawerOpen] = useState<boolean>(false);
  const [sessionRestaurants, setSessionRestaurants] = useState<any[]>([]);

  // Framer Motion Swipe Values for Tinder Effect
  const dragX = useMotionValue(0);
  const cardRotate = useTransform(dragX, [-150, 150], [-15, 15]);
  const likeOpacity = useTransform(dragX, [20, 100], [0, 1]);
  const nopeOpacity = useTransform(dragX, [-100, -20], [1, 0]);

  const fetchRecommendations = async () => {
    setLoading(true);

    let cravingText = 'Algo delicioso';
    let cravingTags: string[] = [];
    let diet = 'none';
    let allergies: string[] = [];
    let socialContext = 'solo';

    const savedState = localStorage.getItem('mexxicanmx_cuestionario_state');
    if (savedState) {
      try {
        const parsed: CuestionarioState = JSON.parse(savedState);
        cravingText = parsed.cravingText || cravingText;
        cravingTags = parsed.cravingTags || cravingTags;
        diet = parsed.diet || diet;
        allergies = parsed.allergies || allergies;
        socialContext = parsed.socialContext || socialContext;
      } catch (e) {
        console.warn('Error parseando cuestionario state:', e);
      }
    }

    try {
      const res: RecommendationResponse = await recommendationService.getGlobalRecommendations({
        craving: { text: cravingText, tags: cravingTags },
        diet,
        allergies,
        socialContext,
        limit: 8
      });

      if (res && res.recommendations && res.recommendations.length > 0) {
        setRecommendations(res.recommendations);
        setSelectedIndex(0);

        const uniqueRestMap = new Map();
        res.recommendations.forEach(item => {
          if (item.restaurant && item.restaurant.id && !uniqueRestMap.has(item.restaurant.id)) {
            uniqueRestMap.set(item.restaurant.id, {
              ...item.restaurant,
              topDish: item.dish.nombre,
              topScore: item.matchPercentage
            });
          }
        });

        setSessionRestaurants(Array.from(uniqueRestMap.values()));
      } else {
        setRecommendations(FALLBACK_RECOMMENDATIONS);
        setSelectedIndex(0);
      }
    } catch (err) {
      console.warn('Error en recomendador, usando catálogo de respaldo:', err);
      setRecommendations(FALLBACK_RECOMMENDATIONS);
      setSelectedIndex(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const currentItem = recommendations[selectedIndex] || FALLBACK_RECOMMENDATIONS[0];
  const remainingDishesCount = Math.max(0, recommendations.length - (selectedIndex + 1));

  // Pasar al siguiente platillo (Acción del botón 👎 o Swipe Left o Flecha Izq)
  const handleNextDish = useCallback(() => {
    dragX.set(0);
    setSelectedIndex(prev => (prev < recommendations.length - 1 ? prev + 1 : 0));
  }, [dragX, recommendations.length]);

  // Abrir menú del restaurante en nueva pestaña (Acción ❤️ o Swipe Right o Enter)
  const handleOpenCurrentRestaurantMenu = useCallback(() => {
    dragX.set(0);
    if (!currentItem || !currentItem.restaurant) return;
    const url = currentItem.restaurant.menuUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [dragX, currentItem]);

  // Soporte de navegación por Teclado Accesible (WCAG 2.1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRestaurantDrawerOpen) {
        if (e.key === 'Escape') setIsRestaurantDrawerOpen(false);
        return;
      }
      if (e.key === 'ArrowLeft') {
        handleNextDish();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleOpenCurrentRestaurantMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextDish, handleOpenCurrentRestaurantMenu, isRestaurantDrawerOpen]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100 || info.velocity.x > 400) {
      handleOpenCurrentRestaurantMenu();
    } else if (info.offset.x < -100 || info.velocity.x < -400) {
      handleNextDish();
    }
  };

  const handleOpenRestaurantFromDrawer = (menuUrl: string) => {
    if (menuUrl) {
      window.open(menuUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const upcomingDishes = recommendations.filter((_, idx) => idx !== selectedIndex);

  return (
    <div
      data-testid="recommendation-card"
      className="min-h-screen bg-white dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] font-sans flex flex-col justify-between relative overflow-hidden transition-colors duration-500"
    >
      {/* ── PANTALLA DE CARGA BOUNCY CON FÍSICA NATURAL Y TRANSICIÓN INMEDIATA ── */}
      <AnimatePresence>
        {showBouncyScreen && (
          <BouncyLoadingScreen
            isReady={!loading}
            minDurationMs={1800}
            onComplete={() => setShowBouncyScreen(false)}
          />
        )}
      </AnimatePresence>
      {/* ── Fondo con difusión cálida de marca ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-br from-[#FF2A54]/[0.07] via-[#FF4A00]/[0.05] to-[#FF8C00]/[0.07] blur-[140px] rounded-full pointer-events-none -z-10" />

      {/* ── NAVBAR FIJO Y COHERENTE CON EL LANDING ── */}
      <header className="w-full border-b border-black/[0.06] dark:border-white/[0.06] backdrop-blur-xl bg-white/80 dark:bg-black/80 sticky top-0 z-30 transition-colors duration-300">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex items-center justify-between h-[60px]">
          
          {/* Logo y Enlace a Home */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer select-none group"
            role="button"
            tabIndex={0}
            aria-label="Ir a la página principal de comensales"
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/'); }}
          >
            <Logo size={22} className="group-hover:rotate-12 transition-transform duration-300" />
            <span className="text-[15px] font-semibold tracking-tight">MexxicanMX</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] font-bold bg-[#FF4A00]/10 dark:bg-[#FF4A00]/20 text-[#FF4A00] rounded-full uppercase tracking-wide">Descubrir</span>
          </div>

          {/* Contador de platillos restantes */}
          <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-[13px] font-semibold text-[#86868B] dark:text-[#A1A1A6]" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-[#FF4A00] animate-pulse" />
            <span>{loading ? 'Buscando platillos...' : `${remainingDishesCount} platillos sugeridos`}</span>
          </div>

          {/* Acciones del Header */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="refine-search"
              onClick={onRefine || (() => navigate('/cuestionario'))}
              aria-label="Refinar preferencias en el cuestionario IA"
              className="py-1.5 px-3.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.07] dark:hover:bg-white/[0.10] transition flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FF4A00]" />
              <span className="hidden sm:inline">Refinar antojo</span>
            </button>
            <button
              onClick={toggleTheme}
              aria-label="Alternar tema claro y oscuro"
              className="p-2 text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>

        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL EN 3 COLUMNAS (MAQUETADO INMEDIATO) ── */}
      <main className="w-full max-w-[1200px] mx-auto px-5 md:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        
        {/* 1. COLUMNA IZQUIERDA: Detalles del Platillo */}
        <div className="lg:col-span-4 space-y-6">
          <div>
            <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] to-[#FF8C00]">
              RECOMENDADO POR IA
            </span>

            <h1 className="text-[34px] sm:text-[40px] font-black leading-[1.08] tracking-tight mt-2">
              {currentItem.dish.nombre}
            </h1>

            <p className="text-[15px] font-normal text-[#86868B] dark:text-[#A1A1A6] leading-relaxed mt-3">
              {currentItem.dish.descripcion}
            </p>
          </div>

          {/* Lista de Detalles */}
          <div className="space-y-3.5 pt-1">
            <div className="flex items-center gap-3 text-[14px] font-medium text-[#4B5563] dark:text-[#D1D5DB]">
              <span className="w-7 h-7 rounded-full bg-[#FF4A00]/10 text-[#FF4A00] flex items-center justify-center text-xs">📍</span>
              <span>Restaurante verificado en MexxicanMX</span>
            </div>

            <div
              data-testid="recommended-restaurant"
              className="flex items-center gap-3 text-[14px] font-semibold"
            >
              <span className="w-7 h-7 rounded-full bg-[#FF2A54]/10 text-[#FF2A54] flex items-center justify-center text-xs">🏬</span>
              <span className="font-bold text-[#1D1D1F] dark:text-white">{currentItem.restaurant.name}</span>
            </div>

            <div className="flex items-center gap-3 text-[22px] font-black text-[#FF4A00]">
              <span className="w-7 h-7 rounded-full bg-[#FF8C00]/10 text-[#FF8C00] flex items-center justify-center text-xs">💰</span>
              <span>${currentItem.dish.precio} <span className="text-xs font-bold text-[#86868B]">MXN</span></span>
            </div>
          </div>

          {/* Píldoras de Ingredientes */}
          <div className="pt-2">
            <div className="flex flex-wrap gap-2">
              {(currentItem.dish.ingredientes_principales && currentItem.dish.ingredientes_principales.length > 0
                ? currentItem.dish.ingredientes_principales
                : ['Receta del chef', 'Ingredientes frescos', 'Especialidad']
              ).map((ing, i) => (
                <span
                  key={i}
                  className="py-1.5 px-3.5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-[#4B5563] dark:text-[#D1D5DB] font-medium text-[13px]"
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* 2. COLUMNA CENTRAL: Tarjeta Principal con Controles */}
        <div className="lg:col-span-5 flex flex-col items-center">
          
          <motion.div
            style={{ x: dragX, rotate: cardRotate }}
            drag={loading ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            className="max-w-[420px] w-full bg-white dark:bg-[#161617] rounded-[28px] shadow-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden cursor-grab active:cursor-grabbing select-none relative"
          >
            {/* Tinder Overlays */}
              <motion.div
                style={{ opacity: likeOpacity }}
                className="absolute top-6 left-6 z-30 px-4 py-1.5 rounded-xl border-[3px] border-emerald-500 text-emerald-500 font-black text-sm uppercase tracking-wider rotate-[-12deg] bg-white/95 shadow-md pointer-events-none"
              >
                VER MENÚ
              </motion.div>

              <motion.div
                style={{ opacity: nopeOpacity }}
                className="absolute top-6 right-6 z-30 px-4 py-1.5 rounded-xl border-[3px] border-rose-500 text-rose-500 font-black text-sm uppercase tracking-wider rotate-[12deg] bg-white/95 shadow-md pointer-events-none"
              >
                SIGUIENTE
              </motion.div>

              {/* Imagen de la Tarjeta */}
              <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-gradient-to-br from-[#FF2A54]/10 via-[#FF4A00]/10 to-[#FF8C00]/10 dark:from-white/[0.03] dark:to-white/[0.06]">
                <img
                  src={currentItem.dish.url_imagen || 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80'}
                  alt={currentItem.dish.nombre}
                  className="w-full h-full object-cover pointer-events-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

                {/* Badges superiores */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
                  <span className="px-3.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#1D1D1F] text-[12px] font-bold shadow-sm">
                    {currentItem.dish.categoria_nombre || 'Especialidad'}
                  </span>
                  <span
                    data-testid="recommendation-score"
                    className="px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[12px] font-bold flex items-center gap-1.5 border border-white/20"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#FF4A00]" />
                    <span>{currentItem.matchPercentage}% match</span>
                  </span>
                </div>

                {/* Nombre en la base de la imagen */}
                <div className="absolute bottom-4 left-4 right-4 text-white z-10 pointer-events-none">
                  <h2 className="text-[22px] font-extrabold leading-tight drop-shadow-sm">
                    {currentItem.dish.nombre}
                  </h2>
                  <p className="text-[12px] font-bold text-gray-200 mt-1 flex items-center gap-1">
                    <span>📍</span>
                    <span>{currentItem.restaurant.name}</span>
                  </p>
                </div>
              </div>

              {/* Cuerpo de la Tarjeta */}
              <div className="p-6 space-y-4">
                <p className="text-[13px] font-medium text-[#86868B] dark:text-[#A1A1A6] leading-relaxed line-clamp-2">
                  {currentItem.dish.descripcion}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {(currentItem.dish.ingredientes_principales || ['Especialidad']).slice(0, 2).map((tag, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.06] text-[12px] font-semibold text-[#4B5563] dark:text-[#D1D5DB]">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="text-[20px] font-black text-[#FF4A00]">
                    ${currentItem.dish.precio}
                  </div>
                </div>

                {/* Botón Principal Píldora de Marca */}
                <button
                  type="button"
                  data-testid="recommendation-heart"
                  onClick={handleOpenCurrentRestaurantMenu}
                  disabled={loading}
                  aria-label={`Ver menú completo de ${currentItem?.dish?.nombre || 'platillo'}`}
                  className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] hover:opacity-95 text-white font-bold text-[14px] transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_12px_24px_rgba(255,74,0,0.25)] hover:shadow-[0_16px_32px_rgba(255,74,0,0.35)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none disabled:opacity-50"
                >
                  <span>Ver menú del restaurante</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </motion.div>

          {/* ── BOTONES DE CONTROL REDONDOS (CON ACCESIBILIDAD ARIA & FOCO) ── */}
          <div className="flex flex-col items-center mt-6 space-y-2">
            <div className="flex items-center gap-5">
              
              {/* 👎 Botón Descartar */}
              <button
                type="button"
                onClick={handleNextDish}
                disabled={loading}
                aria-label="Descartar platillo y ver siguiente recomendación (Flecha izquierda)"
                className="w-14 h-14 rounded-full bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] shadow-sm hover:scale-105 active:scale-95 transition flex items-center justify-center text-xl cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none disabled:opacity-40"
              >
                <span>👎</span>
              </button>

              {/* 📋 Botón Drawer de Restaurantes */}
              <button
                type="button"
                data-testid="recommendation-list"
                onClick={() => setIsRestaurantDrawerOpen(true)}
                disabled={loading}
                aria-label="Abrir lista de restaurantes recomendados"
                className="w-14 h-14 rounded-full bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] shadow-sm hover:scale-105 active:scale-95 transition flex items-center justify-center text-xl cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none disabled:opacity-40"
              >
                <span>📋</span>
              </button>

              {/* ❤️ Botón Abrir Menú */}
              <button
                type="button"
                onClick={handleOpenCurrentRestaurantMenu}
                disabled={loading}
                aria-label="Me gusta: Abrir menú del restaurante (Flecha derecha o Enter)"
                className="w-14 h-14 rounded-full bg-gradient-to-r from-[#FF2A54] to-[#FF4A00] border border-[#FF4A00] shadow-lg shadow-rose-500/25 hover:scale-105 active:scale-95 transition flex items-center justify-center text-xl cursor-pointer text-white focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none disabled:opacity-40"
              >
                <span>❤️</span>
              </button>

            </div>

            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B] dark:text-[#A1A1A6]">
              Arrastra o usa las flechas ⬅️ ➡️
            </span>
          </div>

        </div>

        {/* 3. COLUMNA DERECHA: Próximos Platillos */}
        <div className="lg:col-span-3 space-y-6">
          
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B] dark:text-[#A1A1A6] mb-4">
              PRÓXIMOS PLATILLOS
            </h3>

            <div className="space-y-3">
              {upcomingDishes.slice(0, 3).map(item => {
                const actualIndex = recommendations.findIndex(r => r.dish.id === item.dish.id);
                return (
                  <div
                    key={item.dish.id}
                    onClick={() => setSelectedIndex(actualIndex)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver recomendación de ${item.dish.nombre}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedIndex(actualIndex); }}
                    className="bg-white dark:bg-[#161617] p-3.5 rounded-[18px] border border-black/[0.06] dark:border-white/[0.08] shadow-sm hover:border-[#FF4A00]/40 transition cursor-pointer flex items-center gap-3.5 group focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
                  >
                    <img
                      src={item.dish.url_imagen || 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80'}
                      alt={item.dish.nombre}
                      className="w-11 h-11 rounded-[12px] object-cover flex-shrink-0 group-hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-bold text-[#1D1D1F] dark:text-white truncate">
                        {item.dish.nombre}
                      </h4>
                      <p className="text-[12px] font-medium text-[#86868B] truncate mt-0.5">
                        {item.restaurant.name}
                      </p>
                    </div>
                    <span className="text-[13px] font-black text-[#FF4A00] flex-shrink-0">
                      {item.matchPercentage}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Refinar Búsqueda */}
          <div className="bg-[#FF4A00]/[0.04] dark:bg-[#FF4A00]/[0.06] border border-[#FF4A00]/20 rounded-[22px] p-5 space-y-2">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[#FF4A00]">
              <span>💡</span>
              <span>¿No es lo que buscas?</span>
            </div>
            <p className="text-[12px] text-[#4B5563] dark:text-[#D1D5DB] leading-relaxed">
              Prueba un nuevo antojo con nuestro cuestionario de sabores y texturas.
            </p>
            <button
              type="button"
              onClick={onRefine || (() => navigate('/cuestionario'))}
              className="text-[13px] font-extrabold text-[#FF4A00] hover:underline flex items-center gap-1 pt-1 focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
            >
              <span>Refinar ahora</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </main>

      {/* ── MODAL DRAWER DE RESTAURANTES (CON TRAP & ESCAPE) ── */}
      <AnimatePresence>
        {isRestaurantDrawerOpen && (
          <div
            data-testid="recommended-restaurants-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-lg bg-white dark:bg-[#161617] rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl border border-black/[0.08] dark:border-white/[0.10] max-h-[85vh] flex flex-col text-[#1D1D1F] dark:text-white"
            >
              <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div>
                  <h3 id="drawer-title" className="text-xl font-black">Restaurantes Recomendados</h3>
                  <p className="text-xs text-[#86868B]">Locales con platillos recomendados para ti</p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar ventana de restaurantes recomendados"
                  onClick={() => setIsRestaurantDrawerOpen(false)}
                  className="p-2 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[#86868B] transition focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {sessionRestaurants.map(rest => (
                  <div
                    key={rest.id}
                    data-testid="recommended-restaurant-item"
                    className="p-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.04] flex items-center justify-between gap-4"
                  >
                    <div>
                      <h4 className="font-extrabold text-base">{rest.name}</h4>
                      <p className="text-xs text-[#86868B] mt-0.5">
                        Sugerido: <span className="font-bold text-[#FF4A00]">{rest.topDish}</span> ({rest.topScore}% match)
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="open-restaurant-menu"
                      onClick={() => handleOpenRestaurantFromDrawer(rest.menuUrl)}
                      aria-label={`Ver menú de ${rest.name}`}
                      className="py-2 px-4 rounded-full bg-[#FF4A00] text-white text-xs font-bold hover:bg-[#FF5722] transition flex items-center gap-1.5 flex-shrink-0 shadow-sm focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
                    >
                      <span>Ver menú</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] text-center">
                <button
                  type="button"
                  onClick={() => setIsRestaurantDrawerOpen(false)}
                  className="w-full py-3.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] font-bold text-sm text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/[0.08] transition focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
