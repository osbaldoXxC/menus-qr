import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, ArrowLeft, ShieldAlert, Check, RotateCcw } from 'lucide-react';

export interface CuestionarioState {
  cravingText: string;
  cravingTags: string[];
  diet: string;
  allergies: string[];
  socialContext: string;
}

interface CuestionarioWizardProps {
  initialState?: Partial<CuestionarioState>;
  onComplete?: (state: CuestionarioState) => void;
  onCancel?: () => void;
}

const CRAVING_CHIPS = [
  { id: 'picante', label: 'Picante', testId: 'craving-tag-picante' },
  { id: 'caldosito', label: 'Caldosito', testId: 'craving-tag-caldosito' },
  { id: 'italiana', label: 'Italiana', testId: 'craving-tag-italiana' },
  { id: 'japonesa', label: 'Japonesa', testId: 'craving-tag-japonesa' },
  { id: 'mexicana', label: 'Mexicana', testId: 'craving-tag-mexicana' },
  { id: 'rapida', label: 'Rápida', testId: 'craving-tag-rapida' }
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

export const CuestionarioWizard: React.FC<CuestionarioWizardProps> = ({
  initialState,
  onComplete,
  onCancel
}) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [direction, setDirection] = useState<number>(1);

  const [cravingText, setCravingText] = useState<string>(initialState?.cravingText || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialState?.cravingTags || []);
  const [selectedDiet, setSelectedDiet] = useState<string>(initialState?.diet || 'none');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(initialState?.allergies || []);
  const [selectedSocial, setSelectedSocial] = useState<string>(initialState?.socialContext || 'solo');

  useEffect(() => {
    // Cargar del localStorage si existe previa sesión
    const saved = localStorage.getItem('mexxicanmx_cuestionario_state');
    if (saved && !initialState) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.cravingText) setCravingText(parsed.cravingText);
        if (parsed.cravingTags) setSelectedTags(parsed.cravingTags);
        if (parsed.diet) setSelectedDiet(parsed.diet);
        if (parsed.allergies) setSelectedAllergies(parsed.allergies);
        if (parsed.socialContext) setSelectedSocial(parsed.socialContext);
      } catch (e) {
        console.warn('Error al restaurar estado de cuestionario:', e);
      }
    }
  }, []);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const toggleAllergy = (allergyId: string) => {
    setSelectedAllergies(prev =>
      prev.includes(allergyId) ? prev.filter(a => a !== allergyId) : [...prev, allergyId]
    );
  };

  const handleNext = () => {
    if (step < 5) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const handleFinish = () => {
    const finalState: CuestionarioState = {
      cravingText: cravingText.trim(),
      cravingTags: selectedTags,
      diet: selectedDiet,
      allergies: selectedAllergies,
      socialContext: selectedSocial
    };

    localStorage.setItem('mexxicanmx_cuestionario_state', JSON.stringify(finalState));

    if (onComplete) {
      onComplete(finalState);
    } else {
      navigate('/descubrir');
    }
  };

  const progressPercentage = (step / 5) * 100;

  return (
    <div
      data-testid="recommendation-wizard"
      className="min-h-screen bg-gradient-to-br from-[#fff6f0] to-[#fdeae1] text-[#141d23] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col items-center justify-between pb-12 relative"
    >
      {/* Top Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1.5 bg-[#e5e7eb] z-50">
        <motion.div
          className="h-full bg-[#ff6b35] transition-all duration-500 ease-in-out"
          initial={{ width: '20%' }}
          animate={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Header Container */}
      <header className="w-full max-w-7xl mx-auto px-6 pt-8 flex items-center justify-between">
        <div
          onClick={() => navigate('/')}
          className="font-extrabold text-2xl text-[#141d23] tracking-tight cursor-pointer flex items-center gap-2 select-none"
        >
          <span className="text-3xl">🌮</span>
          <span>MexxicanMX</span>
        </div>
        <div className="text-xs font-bold text-[#6b7280] bg-white/80 px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
          Paso <span className="text-[#ff6b35]">{step}</span> de 5
        </div>
      </header>

      {/* Main Card Container (Stitch UI Consistency Redesign) */}
      <main className="w-full max-w-[580px] mx-auto px-4 mt-6 mb-8 flex-1 flex flex-col justify-center">
        <div className="w-full bg-white rounded-[24px] p-6 md:p-10 shadow-[0_20px_40px_rgba(0,0,0,0.08)] border border-gray-100 relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            
            {/* STEP 1: ANTOJO */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 30 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <span className="text-5xl mb-3 block">🤤</span>
                  <h1 className="text-2xl md:text-3xl font-black text-[#141d23]">
                    ¿Qué antojo tienes?
                  </h1>
                  <p className="text-sm font-medium text-[#6b7280] mt-2">
                    Describe con tus propias palabras lo que se te antoja comer hoy
                  </p>
                </div>

                <div className="mt-4">
                  <textarea
                    data-testid="craving-input"
                    value={cravingText}
                    onChange={e => setCravingText(e.target.value)}
                    rows={4}
                    placeholder="Ej: 'Quiero algo caldosito y muy picante para revivir el alma...'"
                    className="w-full bg-[#f3f4f6] border-2 border-transparent rounded-[16px] p-4 text-base font-medium text-[#141d23] placeholder-[#9ca3af] focus:outline-none focus:bg-white focus:border-[#ff6b35] focus:ring-4 focus:ring-[#ff6b35]/10 resize-none transition-all"
                  />
                </div>

                <div>
                  <p className="text-xs font-bold text-[#6b7280] uppercase tracking-wider mb-3">
                    Selección rápida (Opcional)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {CRAVING_CHIPS.map(chip => {
                      const isSelected = selectedTags.includes(chip.id);
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          data-testid={chip.testId}
                          onClick={() => toggleTag(chip.id)}
                          className={`py-3 px-4 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-1.5 border ${
                            isSelected
                              ? 'bg-[#ff6b35]/10 border-2 border-[#ff6b35] text-[#ff6b35] shadow-[0_4px_12px_rgba(255,107,53,0.15)] font-bold'
                              : 'bg-white border-gray-200 text-[#141d23] hover:bg-[#f3f4f6]'
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4 text-[#ff6b35]" />}
                          <span>{chip.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={onCancel || (() => navigate('/'))}
                    className="flex-1 py-3 px-5 rounded-[12px] bg-transparent border border-gray-300 font-bold text-sm text-[#4b5563] hover:bg-gray-100 transition text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-3.5 px-6 rounded-[12px] bg-[#ff6b35] text-white font-extrabold text-sm shadow-md shadow-[#ff6b35]/25 hover:bg-[#e05624] transition text-center flex items-center justify-center gap-2"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: DIETA */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 30 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <span className="text-5xl mb-3 block">🥗</span>
                  <h1 className="text-2xl md:text-3xl font-black text-[#141d23]">
                    Preferencias Alimenticias
                  </h1>
                  <p className="text-sm font-medium text-[#6b7280] mt-2">
                    ¿Sigues algún tipo de dieta u opción alimenticia?
                  </p>
                </div>

                <div className="space-y-2.5">
                  {DIET_OPTIONS.map(opt => {
                    const isSelected = selectedDiet === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid="diet-option"
                        onClick={() => setSelectedDiet(opt.id)}
                        className={`w-full p-4 rounded-[16px] border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#ff6b35]/10 border-2 border-[#ff6b35] text-[#141d23] shadow-sm'
                            : 'bg-white border-gray-200 hover:border-gray-300 text-[#4b5563]'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-base text-[#141d23]">{opt.label}</div>
                          <div className="text-xs text-[#6b7280] mt-0.5">{opt.desc}</div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-[#ff6b35] font-bold" />}
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex-1 py-3 px-5 rounded-[12px] bg-transparent border border-gray-300 font-bold text-sm text-[#4b5563] hover:bg-gray-100 transition flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Atrás</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-3.5 px-6 rounded-[12px] bg-[#ff6b35] text-white font-extrabold text-sm shadow-md shadow-[#ff6b35]/25 hover:bg-[#e05624] transition flex items-center justify-center gap-2"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: ALERGIAS */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 30 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <span className="text-5xl mb-3 block">⚠️</span>
                  <h1 className="text-2xl md:text-3xl font-black text-[#141d23]">
                    Alergias e Intolerancias
                  </h1>
                  <p className="text-sm font-medium text-[#6b7280] mt-2">
                    Selecciona si tienes alguna. Serán excluidas estrictamente.
                  </p>
                </div>

                <div className="bg-[#fff3ed] border border-[#ff6b35]/30 rounded-[16px] p-4 flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-[#ff6b35] flex-shrink-0" />
                  <p className="text-xs font-semibold text-[#832600] leading-relaxed">
                    <strong>🤖 Tus alergias son prioridad.</strong> Los platillos incompatibles serán excluidos de tus recomendaciones.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {ALLERGY_OPTIONS.map(opt => {
                    const isSelected = selectedAllergies.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid="allergy-option"
                        onClick={() => toggleAllergy(opt.id)}
                        className={`p-3.5 rounded-[14px] border font-bold text-sm transition-all text-center flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-rose-50 border-2 border-rose-500 text-rose-700 shadow-sm'
                            : 'bg-white border-gray-200 text-[#4b5563] hover:bg-gray-50'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-rose-600" />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex-1 py-3 px-5 rounded-[12px] bg-transparent border border-gray-300 font-bold text-sm text-[#4b5563] hover:bg-gray-100 transition flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Atrás</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-3.5 px-6 rounded-[12px] bg-[#ff6b35] text-white font-extrabold text-sm shadow-md shadow-[#ff6b35]/25 hover:bg-[#e05624] transition flex items-center justify-center gap-2"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: CON QUIÉN COMES */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 30 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <span className="text-5xl mb-3 block">🎯</span>
                  <h1 className="text-2xl md:text-3xl font-black text-[#141d23]">
                    ¿Con quién comes?
                  </h1>
                  <p className="text-sm font-medium text-[#6b7280] mt-2">
                    Así ajustamos las recomendaciones a la ocasión
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {SOCIAL_OPTIONS.map(opt => {
                    const isSelected = selectedSocial === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid="social-context-option"
                        onClick={() => setSelectedSocial(opt.id)}
                        className={`p-4 rounded-[16px] border text-center transition-all ${
                          isSelected
                            ? 'bg-[#ff6b35]/10 border-2 border-[#ff6b35] text-[#141d23] shadow-sm font-bold'
                            : 'bg-white border-gray-200 text-[#4b5563] hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-xl font-bold">{opt.label}</div>
                        <div className="text-xs text-[#6b7280] mt-1">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex-1 py-3 px-5 rounded-[12px] bg-transparent border border-gray-300 font-bold text-sm text-[#4b5563] hover:bg-gray-100 transition flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Atrás</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-3.5 px-6 rounded-[12px] bg-[#ff6b35] text-white font-extrabold text-sm shadow-md shadow-[#ff6b35]/25 hover:bg-[#e05624] transition flex items-center justify-center gap-2"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
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
                className="text-center py-6 space-y-6"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-[#ff6b35]/10 flex items-center justify-center text-4xl border border-[#ff6b35]/30 animate-bounce">
                  ✨
                </div>

                <div>
                  <h1 className="text-3xl font-black text-[#141d23]">¡Todo listo!</h1>
                  <p className="text-sm font-medium text-[#6b7280] mt-2 max-w-sm mx-auto">
                    Tu motor de recomendaciones de IA ha procesado tu antojo y configurado los filtros de seguridad.
                  </p>
                </div>

                <div className="flex flex-col gap-3 max-w-xs mx-auto pt-2">
                  <button
                    type="button"
                    data-testid="discover-recommendations"
                    onClick={handleFinish}
                    className="w-full py-4 px-8 rounded-[14px] bg-[#ff6b35] text-white font-black text-lg shadow-lg shadow-[#ff6b35]/30 hover:bg-[#e05624] transition flex items-center justify-center gap-3"
                  >
                    <span>🚀 Descubrir platillos</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full py-2.5 px-4 text-xs font-bold text-[#6b7280] hover:text-[#141d23] transition flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Modificar respuestas</span>
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </div>
      </main>
    </div>
  );
};
