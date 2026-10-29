import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Sparkles, MapPin, Store, DollarSign, X, List, Heart, ArrowRight, ExternalLink } from 'lucide-react';
import { recommendationService, RecommendationItem, RecommendationResponse } from './recommendationService';
import { CuestionarioState } from './CuestionarioWizard';
import { ThemeContext } from '../../context/ThemeContext';
import { Logo } from '../../pages/components/Logo';

interface DescubrirResultadosProps {
  onRefine?: () => void;
}

const FALLBACK_RECOMMENDATIONS: RecommendationItem[] = [
  {
    dish: {
      id: 'f1',
      nombre: 'Dumplings al Vapor (Jiaozi)',
      descripcion: 'Tu antojo de comida oriental y sabores auténticos coincide al 99% con esta receta tradicional del chef.',
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
      descripcion: 'Un clásico de la cocina imperial. Su piel laqueada ultra crujiente te fascinará al primer bocado.',
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
  },
  {
    dish: {
      id: 'f4',
      nombre: 'Tártara de Atún Aleta Azul',
      descripcion: 'Frescura y sofisticación. El marinado cítrico resalta la textura premium del atún fresco.',
      precio: 285,
      url_imagen: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
      nivel_picante: 0,
      porcion: '200g',
      categoria_nombre: 'Gourmet',
      etiquetas_dieteticas: ['sin_gluten', 'keto'],
      ingredientes_principales: ['Atún fresco', 'Aguacate', 'Aceite de sésamo']
    },
    restaurant: {
      id: '55555555-5555-5555-5555-555555555555',
      name: "L'Étoile Gourmet",
      slug: 'letoile-gourmet',
      menuUrl: '/menu/55555555-5555-5555-5555-555555555555'
    },
    matchScore: 0.93,
    matchPercentage: 93,
    reasons: ['🐟 Opción fresca e ideal para el verano'],
    tags: ['sin_gluten', 'keto']
  }
];

export const DescubrirResultados: React.FC<DescubrirResultadosProps> = ({ onRefine }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState<boolean>(true);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isRestaurantDrawerOpen, setIsRestaurantDrawerOpen] = useState<boolean>(false);
  const [sessionRestaurants, setSessionRestaurants] = useState<any[]>([]);

  // Framer Motion Swipe Values for Tinder Effect
  const dragX = useMotionValue(0);
  const cardRotate = useTransform(dragX, [-150, 150], [-15, 15]);
  const likeOpacity = useTransform(dragX, [20, 100], [0, 1]);
  const nopeOpacity = useTransform(dragX, [-100, -20], [1, 0]);

  useEffect(() => {
    fetchRecommendations();
  }, []);

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
        setRecommendations([]);
        setSessionRestaurants([]);
      }
    } catch (err) {
      console.warn('Error en recomendador:', err);
      setRecommendations([]);
      setSessionRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  const useFallback = () => {
    setRecommendations(FALLBACK_RECOMMENDATIONS);
    setSelectedIndex(0);
    setSessionRestaurants([
      { id: FALLBACK_RECOMMENDATIONS[0].restaurant.id, name: FALLBACK_RECOMMENDATIONS[0].restaurant.name, topDish: FALLBACK_RECOMMENDATIONS[0].dish.nombre, topScore: 99, menuUrl: FALLBACK_RECOMMENDATIONS[0].restaurant.menuUrl },
      { id: FALLBACK_RECOMMENDATIONS[1].restaurant.id, name: FALLBACK_RECOMMENDATIONS[1].restaurant.name, topDish: FALLBACK_RECOMMENDATIONS[1].dish.nombre, topScore: 97, menuUrl: FALLBACK_RECOMMENDATIONS[1].restaurant.menuUrl }
    ]);
  };

  const currentItem = recommendations[selectedIndex] || FALLBACK_RECOMMENDATIONS[0];
  const remainingDishesCount = Math.max(0, recommendations.length - (selectedIndex + 1));

  // Pasar al siguiente platillo (Acción del botón 👎 / X o Swipe Left)
  const handleNextDish = () => {
    dragX.set(0);
    if (selectedIndex < recommendations.length - 1) {
      setSelectedIndex(prev => prev + 1);
    } else {
      setSelectedIndex(0);
    }
  };

  // Abrir menú del restaurante en NUEVA PESTAÑA (Acción del botón ❤️ o Swipe Right)
  const handleOpenCurrentRestaurantMenu = () => {
    dragX.set(0);
    if (!currentItem || !currentItem.restaurant) return;
    const url = currentItem.restaurant.menuUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Manejar el final del arrastre de la tarjeta (Tinder Swipe Gesture)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F3] dark:bg-[#0f0f10] text-[#1a1a1a] dark:text-[#f5f5f7] flex flex-col items-center justify-center p-6 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-[#ff6b35] border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-2xl font-black">Analizando tus preferencias...</h2>
          <p className="text-sm text-[#737373]">
            Buscando los mejores platillos en nuestros restaurantes 🤖✨
          </p>
        </div>
      </div>
    );
  }

  if (!loading && recommendations.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF6F3] dark:bg-[#0f0f10] text-[#1a1a1a] dark:text-[#f5f5f7] flex flex-col items-center justify-center p-6 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="text-center space-y-5 max-w-md bg-white dark:bg-[#18181a] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl">
          <div className="w-16 h-16 bg-[#ff6b35]/10 text-[#ff6b35] rounded-full flex items-center justify-center mx-auto text-3xl">
            🌮
          </div>
          <h2 className="text-2xl font-black">No encontramos coincidencias</h2>
          <p className="text-sm text-[#737373] leading-relaxed">
            No tenemos registrados platillos que coincidan con tu búsqueda en este momento. ¡Prueba buscando otro antojo como tacos, pizza o hamburguesas!
          </p>
          <button
            onClick={onRefine || (() => navigate('/cuestionario'))}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#ff6b35] hover:bg-[#e05a2b] text-white font-bold transition shadow-lg shadow-[#ff6b35]/25 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            <span>Probar otro antojo</span>
          </button>
        </div>
      </div>
    );
  }

  const upcomingDishes = recommendations.filter((_, idx) => idx !== selectedIndex);

  return (
    <div
      data-testid="recommendation-card"
      className="min-h-screen bg-[#FAF6F3] dark:bg-[#0c0c0d] text-[#1a1a1a] dark:text-[#f5f5f7] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col justify-between relative overflow-hidden"
    >
      {/* ── Soft Warm Orange Ambient Diffusion Gradient ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[480px] bg-[#FF6B35]/[0.08] blur-[150px] rounded-full pointer-events-none -z-10" />

      {/* ── TOP HEADER BAR (With Official Logo + Original Font) ── */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-10">
        
        {/* Official Brand Logo */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <Logo size={24} className="group-hover:rotate-12 transition-transform duration-300" />
          <span className="text-[17px] font-extrabold tracking-tight text-[#1a1a1a] dark:text-white">
            MexxicanMX
          </span>
        </div>

        {/* Center Pill: • N platillos restantes */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 dark:bg-[#1a1a1c]/90 border border-gray-200/80 dark:border-gray-800 text-[13px] font-semibold text-[#6b7280] dark:text-[#a3a3a3] shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#ff6b35]" />
          <span>{remainingDishesCount} platillos restantes</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="refine-search"
            onClick={onRefine || (() => navigate('/cuestionario'))}
            className="py-2 px-4 rounded-full bg-white dark:bg-[#1e1e20] border border-gray-200/80 dark:border-gray-800 text-[13px] font-semibold text-[#1a1a1a] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center gap-2 shadow-2xs"
          >
            <Sparkles className="w-4 h-4 text-[#ff6b35]" />
            <span>Refinar búsqueda</span>
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-white dark:bg-[#1e1e20] border border-gray-200/80 dark:border-gray-800 text-sm hover:bg-gray-50 transition"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

      </header>

      {/* ── 3-COLUMN MAIN LAYOUT (Exact Screenshot 2026-08-09 152718.png Design) ── */}
      <main className="w-full max-w-7xl mx-auto px-6 py-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        
        {/* 1. LEFT COLUMN: Text Details & Ingredients */}
        <div className="lg:col-span-4 space-y-6">
          
          <div>
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#ff6b35]">
              RECOMENDADO POR IA
            </span>
            <h1 className="text-[36px] sm:text-[42px] font-extrabold leading-[1.12] tracking-[-0.02em] text-[#1a1a1a] dark:text-white mt-2">
              {currentItem.dish.nombre}
            </h1>
            <p className="text-[15px] font-medium text-[#6b7280] dark:text-[#a3a3a3] leading-[1.6] mt-3">
              {currentItem.dish.descripcion}
            </p>
          </div>

          {/* Info List with Icons */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center gap-3 text-[14px] font-semibold text-[#374151] dark:text-[#d4d4d4]">
              <span className="w-7 h-7 rounded-full bg-[#FFEAE0] dark:bg-orange-950/40 text-[#ff6b35] flex items-center justify-center text-xs">📍</span>
              <span>Barrio Chino, Centro Histórico, CDMX</span>
            </div>

            <div
              data-testid="recommended-restaurant"
              className="flex items-center gap-3 text-[14px] font-semibold text-[#1a1a1a] dark:text-white"
            >
              <span className="w-7 h-7 rounded-full bg-[#FFEAE0] dark:bg-rose-950/40 text-rose-600 flex items-center justify-center text-xs">🏬</span>
              <span className="font-extrabold">{currentItem.restaurant.name}</span>
            </div>

            <div className="flex items-center gap-3 text-[22px] font-black text-[#ff6b35]">
              <span className="w-7 h-7 rounded-full bg-[#FFF0E6] dark:bg-amber-950/40 text-amber-600 flex items-center justify-center text-xs">💰</span>
              <span>${currentItem.dish.precio} <span className="text-xs font-bold text-[#9ca3af]">MXN</span></span>
            </div>
          </div>

          {/* Ingredient Pills */}
          <div className="pt-2">
            <div className="flex flex-wrap gap-2">
              {(currentItem.dish.ingredientes_principales && currentItem.dish.ingredientes_principales.length > 0
                ? currentItem.dish.ingredientes_principales
                : ['Cerdo molido', 'Cebollín chino', 'Jengibre fresco', 'Salsa de soya', 'Masa artesanal']
              ).map((ing, i) => (
                <span
                  key={i}
                  className="py-1.5 px-3.5 rounded-full bg-white dark:bg-[#1e1e20] border border-[#e5e7eb] dark:border-gray-800 text-[#374151] dark:text-[#d4d4d4] font-medium text-[13px] shadow-2xs"
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* 2. CENTER COLUMN: Main Hero Card with Tinder Swipe Animation & Control Buttons */}
        <div className="lg:col-span-5 flex flex-col items-center">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentItem.dish.id}
              style={{ x: dragX, rotate: cardRotate }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={handleDragEnd}
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="max-w-[420px] w-full bg-white dark:bg-[#1a1a1c] rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-gray-100/80 dark:border-gray-800 overflow-hidden cursor-grab active:cursor-grabbing select-none relative"
            >
              {/* Tinder Overlay: LIKE (Swipe Right) */}
              <motion.div
                style={{ opacity: likeOpacity }}
                className="absolute top-6 left-6 z-30 px-4 py-1.5 rounded-xl border-[3px] border-emerald-500 text-emerald-500 font-black text-sm uppercase tracking-wider rotate-[-12deg] bg-white/90 shadow-md"
              >
                VER MENÚ
              </motion.div>

              {/* Tinder Overlay: NOPE (Swipe Left) */}
              <motion.div
                style={{ opacity: nopeOpacity }}
                className="absolute top-6 right-6 z-30 px-4 py-1.5 rounded-xl border-[3px] border-rose-500 text-rose-500 font-black text-sm uppercase tracking-wider rotate-[12deg] bg-white/90 shadow-md"
              >
                SIGUIENTE
              </motion.div>

              {/* Card Image Header with Orange Diffused Vignette & Overlays */}
              <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-gradient-to-br from-[#FFE8DD] via-[#FDF0E9] to-[#FDE8DF] dark:from-gray-900 dark:to-black">
                <img
                  src={currentItem.dish.url_imagen || 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80'}
                  alt={currentItem.dish.nombre}
                  className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal opacity-95 pointer-events-none"
                />

                {/* Dark Gradient Overlay at Bottom of Image */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

                {/* Top Badges */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
                  <span className="px-3.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#1a1a1a] text-[12px] font-bold shadow-xs">
                    {currentItem.dish.categoria_nombre || 'Oriental'}
                  </span>
                  <span
                    data-testid="recommendation-score"
                    className="px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[12px] font-bold flex items-center gap-1.5 border border-white/20"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#ff6b35]" />
                    <span>{currentItem.matchPercentage}% match</span>
                  </span>
                </div>

                {/* Card Image Bottom Title */}
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

              {/* Card Body */}
              <div className="p-6 space-y-4">
                <p className="text-[13px] font-medium text-[#6b7280] dark:text-[#a3a3a3] leading-relaxed">
                  {currentItem.dish.descripcion}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {(currentItem.dish.ingredientes_principales || ['Cerdo molido', 'Cebollín chino']).slice(0, 2).map((tag, idx) => (
                      <span key={idx} className="px-3 py-1 rounded-full bg-[#F3F4F6] dark:bg-gray-800 text-[12px] font-semibold text-[#374151] dark:text-gray-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="text-[20px] font-black text-[#ff6b35]">
                    ${currentItem.dish.precio}
                  </div>
                </div>

                {/* Main Dark Action Button: Ver menú completo → */}
                <button
                  type="button"
                  data-testid="recommendation-heart"
                  onClick={handleOpenCurrentRestaurantMenu}
                  className="w-full py-3.5 px-6 rounded-[14px] bg-[#141d23] hover:bg-black text-white font-extrabold text-[14px] transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <span>Ver menú completo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </motion.div>
          </AnimatePresence>

          {/* ── CONTROL BUTTONS BELOW CARD (Exact Screenshot Design) ── */}
          <div className="flex flex-col items-center mt-6 space-y-2.5">
            <div className="flex items-center gap-5">
              
              {/* 👎 / ❌ DISCARD / NEXT DISH BUTTON */}
              <button
                type="button"
                onClick={handleNextDish}
                className="w-14 h-14 rounded-full bg-[#FFF4E5] border border-[#FFE0C2] shadow-md hover:scale-105 transition flex items-center justify-center text-xl cursor-pointer text-[#D97706]"
                title="Siguiente platillo (Descartar)"
              >
                <span>👎</span>
              </button>

              {/* 📋 RESTAURANTS DRAWER BUTTON */}
              <button
                type="button"
                data-testid="recommendation-list"
                onClick={() => setIsRestaurantDrawerOpen(true)}
                className="w-14 h-14 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] shadow-md hover:scale-105 transition flex items-center justify-center text-xl cursor-pointer text-[#4B5563]"
                title="Ver restaurantes recomendados"
              >
                <span>📋</span>
              </button>

              {/* ❤️ HEART / OPEN MENU BUTTON */}
              <button
                type="button"
                onClick={handleOpenCurrentRestaurantMenu}
                className="w-14 h-14 rounded-full bg-gradient-to-b from-[#FF4D4D] to-[#FF2A2A] border border-[#FF6B6B] shadow-lg shadow-rose-500/30 hover:scale-105 transition flex items-center justify-center text-xl cursor-pointer text-white"
                title="Abrir restaurante en nueva pestaña"
              >
                <span>❤️</span>
              </button>

            </div>

            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
              ARRASTRA O USA LOS BOTONES
            </span>
          </div>

        </div>

        {/* 3. RIGHT COLUMN: Upcoming Dishes & Refine Callout */}
        <div className="lg:col-span-3 space-y-6">
          
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] mb-4">
              PRÓXIMOS PLATILLOS
            </h3>

            <div className="space-y-3">
              {upcomingDishes.slice(0, 3).map(item => {
                const actualIndex = recommendations.findIndex(r => r.dish.id === item.dish.id);
                return (
                  <div
                    key={item.dish.id}
                    onClick={() => setSelectedIndex(actualIndex)}
                    className="bg-white dark:bg-[#1a1a1c] p-3.5 rounded-[18px] border border-gray-100/80 dark:border-gray-800 shadow-2xs hover:border-[#ff6b35]/40 transition cursor-pointer flex items-center gap-3.5 group"
                  >
                    <img
                      src={item.dish.url_imagen || 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80'}
                      alt={item.dish.nombre}
                      className="w-11 h-11 rounded-[12px] object-cover flex-shrink-0 group-hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-bold text-[#1a1a1a] dark:text-white truncate">
                        {item.dish.nombre}
                      </h4>
                      <p className="text-[12px] font-medium text-[#9CA3AF] truncate mt-0.5">
                        {item.restaurant.name}
                      </p>
                    </div>
                    <span className="text-[13px] font-black text-[#ff6b35] flex-shrink-0">
                      {item.matchPercentage}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Refine Search Soft Box */}
          <div className="bg-[#FFF4EE] dark:bg-[#26150e] border border-[#ff6b35]/20 rounded-[20px] p-5 space-y-2">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[#ff6b35]">
              <span>💡</span>
              <span>¿No es lo que buscas?</span>
            </div>
            <p className="text-[12px] text-[#6b7280] dark:text-[#d4d4d4] leading-relaxed">
              Afina tu búsqueda con el cuestionario IA.
            </p>
            <button
              type="button"
              onClick={onRefine || (() => navigate('/cuestionario'))}
              className="text-[13px] font-extrabold text-[#ff6b35] hover:underline flex items-center gap-1 pt-1"
            >
              <span>Refinar ahora</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </main>

      {/* RESTAURANTES RECOMENDADOS DRAWER / MODAL */}
      <AnimatePresence>
        {isRestaurantDrawerOpen && (
          <div
            data-testid="recommended-restaurants-drawer"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-lg bg-white dark:bg-[#1a1a1c] rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[85vh] flex flex-col text-[#1a1a1a] dark:text-white"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="text-xl font-black">Restaurantes Recomendados</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Restaurantes sugeridos en tu sesión</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRestaurantDrawerOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {sessionRestaurants.map(rest => (
                  <div
                    key={rest.id}
                    data-testid="recommended-restaurant-item"
                    className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-4"
                  >
                    <div>
                      <h4 className="font-extrabold text-base">{rest.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Platillo sugerido: <span className="font-bold text-[#ff6b35]">{rest.topDish}</span> ({rest.topScore}% match)
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="open-restaurant-menu"
                      onClick={() => handleOpenRestaurantFromDrawer(rest.menuUrl)}
                      className="py-2 px-4 rounded-xl bg-[#ff6b35] text-white text-xs font-bold hover:bg-[#e05624] transition flex items-center gap-1.5 flex-shrink-0 shadow-sm"
                    >
                      <span>Ver menú</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-center">
                <button
                  type="button"
                  onClick={() => setIsRestaurantDrawerOpen(false)}
                  className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 transition"
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
