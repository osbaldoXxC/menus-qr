import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Heart,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  X,
  UtensilsCrossed
} from 'lucide-react';
import {
  recommendationService,
  RecommendationItem,
  CravingInput
} from '../../services/recommendation';

interface RecommendationWizardProps {
  restaurantId: string;
  restaurantName?: string;
  restaurantLogoUrl?: string;
  primaryColor?: string;
  isOpen: boolean;
  onClose: () => void;
}

const CRAVING_CHIPS = [
  { id: 'picante', label: '🌶️ Picante' },
  { id: 'caldosito', label: '🍜 Caldosito' },
  { id: 'italiana', label: '🍕 Italiana' },
  { id: 'japonesa', label: '🍣 Japonesa' },
  { id: 'mexicana', label: '🌮 Mexicana' },
  { id: 'rapida', label: '🍔 Rápida' }
];

const DIET_OPTIONS = [
  { id: 'none', label: '🍽️ Sin restricciones', desc: 'Como de todo' },
  { id: 'vegetariana', label: '🥬 Vegetariana', desc: 'Sin carne' },
  { id: 'vegana', label: '🌱 Vegana', desc: 'Sin productos animales' },
  { id: 'sin_gluten', label: '🌾 Sin gluten', desc: 'Libre de trigo/gluten' },
  { id: 'keto', label: '🥑 Keto', desc: 'Baja en carbohidratos' }
];

const ALLERGY_OPTIONS = [
  { id: 'cacahuate', label: '🥜 Cacahuate' },
  { id: 'camaron', label: '🍤 Camarón' },
  { id: 'lacteos', label: '🥛 Lácteos' },
  { id: 'gluten', label: '🌾 Gluten' },
  { id: 'huevo', label: '🥚 Huevo' },
  { id: 'pescado', label: '🐟 Pescado' },
  { id: 'nueces', label: '🌰 Nueces' },
  { id: 'mariscos', label: '🦀 Mariscos' }
];

const SOCIAL_OPTIONS = [
  { id: 'solo', label: '🧑 Solo', desc: 'Comida personal' },
  { id: 'pareja', label: '💑 En pareja', desc: 'Ocasión especial' },
  { id: 'familia', label: '👨‍👩‍👧‍👦 Familia', desc: 'Platillos para compartir' },
  { id: 'amigos', label: '🎉 Con amigos', desc: 'Ambiente festivo' }
];

export const RecommendationWizard: React.FC<RecommendationWizardProps> = ({
  restaurantId,
  restaurantName = 'Restaurante',
  restaurantLogoUrl,
  primaryColor = '#E63946',
  isOpen,
  onClose
}) => {
  // Wizard Step: 1=Craving, 2=Diet, 3=Allergies, 4=Social, 5=Ready, 6=Results
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [cravingText, setCravingText] = useState<string>('');
  const [selectedCravingTags, setSelectedCravingTags] = useState<string[]>([]);
  const [selectedDiet, setSelectedDiet] = useState<string>('none');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedSocial, setSelectedSocial] = useState<string>('solo');

  // Results State
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [selectedDishIndex, setSelectedDishIndex] = useState<number>(0);

  if (!isOpen) return null;

  const toggleCravingTag = (tagId: string) => {
    setSelectedCravingTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const toggleAllergy = (allergyId: string) => {
    setSelectedAllergies(prev =>
      prev.includes(allergyId) ? prev.filter(a => a !== allergyId) : [...prev, allergyId]
    );
  };

  const handleFetchRecommendations = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const cravingPayload: CravingInput = {
        text: cravingText.trim(),
        tags: selectedCravingTags
      };

      const res = await recommendationService.getRecommendations(restaurantId, {
        craving: cravingPayload,
        diet: selectedDiet,
        allergies: selectedAllergies,
        socialContext: selectedSocial,
        limit: 6
      });

      if (res.recommendations && res.recommendations.length > 0) {
        setRecommendations(res.recommendations);
        setSelectedDishIndex(0);
        setStep(6);
      } else {
        setRecommendations([]);
        setStep(6);
      }
    } catch (err) {
      console.error('Error al generar recomendaciones:', err);
      setErrorMessage('No pudimos generar recomendaciones en este momento. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMenuNewTab = (menuUrl?: string) => {
    const targetUrl = menuUrl || `/menu/${restaurantId}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const currentRecommendation = recommendations[selectedDishIndex] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-gray-900 text-white rounded-3xl border border-gray-800 shadow-2xl overflow-hidden my-8">
        
        {/* Header / Progress Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/60">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
            >
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Recomendador IA</h3>
              <p className="text-xs text-gray-400">{restaurantName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {step < 6 && (
              <div className="hidden sm:flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      s === step
                        ? 'w-6 bg-amber-500'
                        : s < step
                        ? 'w-2 bg-emerald-500'
                        : 'w-2 bg-gray-700'
                    }`}
                  />
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition"
              aria-label="Cerrar modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 min-h-[420px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: CRAVING */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center md:text-left">
                  <span className="text-4xl">🤤</span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
                    ¿Qué antojo tienes hoy?
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Describe con tus propias palabras lo que se te antoja comer
                  </p>
                </div>

                <textarea
                  value={cravingText}
                  onChange={e => setCravingText(e.target.value)}
                  placeholder="Ej: Quiero algo mexicano, picante y caldosito..."
                  rows={3}
                  className="w-full p-4 bg-gray-800/80 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none text-base"
                />

                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                    Opciones rápidas (Selección múltiple)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CRAVING_CHIPS.map(chip => {
                      const isSelected = selectedCravingTags.includes(chip.id);
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => toggleCravingTag(chip.id)}
                          className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/10'
                              : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: DIET */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <span className="text-4xl">🥗</span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
                    Preferencias Alimenticias
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    ¿Sigues algún tipo de dieta u opción alimenticia?
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DIET_OPTIONS.map(opt => {
                    const isSelected = selectedDiet === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedDiet(opt.id)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg'
                            : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        <div className="font-bold text-base">{opt.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 3: ALLERGIES */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <span className="text-4xl">⚠️</span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
                    Alergias e Intolerancias
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Selecciona si tienes alguna. Serán excluidas de las recomendaciones.
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-200">
                    <strong>🤖 Tus alergias son prioridad #1.</strong> Los platillos incompatibles quedarán estrictamente excluidos.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ALLERGY_OPTIONS.map(opt => {
                    const isSelected = selectedAllergies.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleAllergy(opt.id)}
                        className={`p-3 rounded-xl border text-center font-semibold text-sm transition-all ${
                          isSelected
                            ? 'bg-rose-500/20 border-rose-500 text-rose-200'
                            : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 4: SOCIAL CONTEXT */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <span className="text-4xl">🎯</span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
                    ¿Con quién comes hoy?
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Nos ayuda a ajustar porciones y ambiente
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {SOCIAL_OPTIONS.map(opt => {
                    const isSelected = selectedSocial === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedSocial(opt.id)}
                        className={`p-4 rounded-2xl border text-center transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg'
                            : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        <div className="text-xl font-bold">{opt.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 5: READY / PRE-FETCH */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-8 space-y-6"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center text-4xl border border-amber-500/40 animate-pulse">
                  ✨
                </div>

                <div>
                  <h2 className="text-3xl font-extrabold text-white">¡Todo listo!</h2>
                  <p className="text-gray-400 mt-2 max-w-md mx-auto">
                    Tu motor de recomendaciones de IA ha procesado tus preferencias y filtrado las alergias.
                  </p>
                </div>

                {errorMessage && (
                  <div className="bg-rose-500/20 text-rose-300 p-4 rounded-2xl text-sm border border-rose-500/40">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleFetchRecommendations}
                  disabled={loading}
                  className="w-full max-w-sm mx-auto py-4 px-8 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold text-lg shadow-xl hover:shadow-amber-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Sparkles className="w-5 h-5 animate-spin" />
                      <span>Analizando antojos...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀 Descubrir platillos</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* STEP 6: RESULTS VIEW */}
            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Header Action / Refine */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-950/60 p-4 rounded-2xl border border-gray-800">
                  <div>
                    <span className="text-xs font-semibold text-amber-400 tracking-wider uppercase flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Recomendaciones Personalizadas
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      Encontramos {recommendations.length} platillos ideales
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition border border-gray-700"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Refinar ahora →</span>
                  </button>
                </div>

                {recommendations.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <UtensilsCrossed className="w-16 h-16 mx-auto text-gray-600" />
                    <h3 className="text-xl font-bold text-white">😕 No encontramos platillos compatibles</h3>
                    <p className="text-gray-400 text-sm max-w-md mx-auto">
                      Intenta modificar alguna preferencia o quitar restricciones de alergias en el asistente.
                    </p>
                    <button
                      onClick={() => setStep(1)}
                      className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm"
                    >
                      Refinar búsqueda
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* MAIN RECOMMENDED DISH (8 Columns on desktop) */}
                    {currentRecommendation && (
                      <div className="lg:col-span-7 bg-gray-800/60 border border-gray-700/80 rounded-3xl p-6 flex flex-col justify-between space-y-6">
                        <div>
                          {/* Top Badge & Match Score */}
                          <div className="flex items-center justify-between mb-4">
                            <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" /> Recomendado por IA
                            </span>
                            <span className="text-2xl font-black text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-xl">
                              {currentRecommendation.matchPercentage}% match
                            </span>
                          </div>

                          {/* Image */}
                          {currentRecommendation.dish.url_imagen && (
                            <div className="relative w-full h-52 rounded-2xl overflow-hidden mb-4 border border-gray-700">
                              <img
                                src={currentRecommendation.dish.url_imagen}
                                alt={currentRecommendation.dish.nombre}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          {/* Category & Name */}
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {currentRecommendation.dish.categoria_nombre || 'Especialidad'}
                          </p>
                          <h2 className="text-2xl font-extrabold text-white mt-1">
                            {currentRecommendation.dish.nombre}
                          </h2>
                          <p className="text-gray-300 text-sm mt-2 leading-relaxed">
                            {currentRecommendation.dish.descripcion}
                          </p>

                          {/* Price */}
                          <div className="mt-4 text-3xl font-black text-amber-400">
                            ${currentRecommendation.dish.precio.toFixed(2)}
                          </div>

                          {/* Reasons */}
                          {currentRecommendation.reasons && currentRecommendation.reasons.length > 0 && (
                            <div className="mt-4 space-y-1.5 bg-gray-900/80 p-3.5 rounded-2xl border border-gray-800">
                              <p className="text-xs font-bold text-gray-400 uppercase">¿Por qué este platillo?</p>
                              {currentRecommendation.reasons.map((r, i) => (
                                <p key={i} className="text-xs text-emerald-300 flex items-center gap-2">
                                  <span>{r}</span>
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Tags & Ingredients */}
                          {currentRecommendation.tags && currentRecommendation.tags.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {currentRecommendation.tags.map((t, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg font-medium"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Interactive Buttons: Heart & Ver Menú Completo (OPEN IN NEW TAB) */}
                        <div className="pt-4 border-t border-gray-700/60 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenMenuNewTab(currentRecommendation.restaurant.menuUrl)}
                            aria-label="Abrir menú completo en nueva pestaña"
                            className="p-3.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 rounded-2xl transition flex items-center justify-center gap-2 font-bold text-sm"
                          >
                            <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
                            <span>Me interesa (Nueva pestaña)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenMenuNewTab(currentRecommendation.restaurant.menuUrl)}
                            className="flex-1 py-3.5 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2"
                          >
                            <span>Ver menú completo</span>
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* UPCOMING DISHES LIST (5 Columns on desktop) */}
                    <div className="lg:col-span-5 space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                        Próximos Platillos Recomendados
                      </h4>
                      <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                        {recommendations.map((item, idx) => {
                          const isSelected = idx === selectedDishIndex;
                          return (
                            <button
                              key={item.dish.id}
                              type="button"
                              onClick={() => setSelectedDishIndex(idx)}
                              className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-amber-500/20 border-amber-500 shadow-md'
                                  : 'bg-gray-800/40 border-gray-800 hover:bg-gray-800 text-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <span className="text-base font-extrabold text-emerald-400 flex-shrink-0">
                                  {item.matchPercentage}%
                                </span>
                                <div className="truncate">
                                  <p className="font-bold text-sm text-white truncate">{item.dish.nombre}</p>
                                  <p className="text-xs text-gray-400 truncate">${item.dish.precio.toFixed(2)}</p>
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>

          {/* Navigation Controls (Steps 1 to 4) */}
          {step < 5 && (
            <div className="mt-8 pt-4 border-t border-gray-800 flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-sm transition flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Atrás</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <span>Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
