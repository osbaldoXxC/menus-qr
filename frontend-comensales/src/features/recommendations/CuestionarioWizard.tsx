import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, ArrowLeft, ShieldAlert, Check, RotateCcw } from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import { Logo } from '../../pages/components/Logo';

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
  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

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
  }, [initialState]);

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
      className="min-h-screen bg-white dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] font-sans flex flex-col justify-between relative overflow-hidden transition-colors duration-500"
    >
      {/* ── BARRA DE PROGRESO DEGRADADA SUPERIOR ── */}
      <div className="fixed top-0 left-0 w-full h-1 bg-black/[0.05] dark:bg-white/[0.08] z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] transition-all duration-500 ease-in-out"
          initial={{ width: '20%' }}
          animate={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* ── DIFUSIÓN CÁLIDA DE MARCA DE FONDO ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[550px] bg-gradient-to-br from-[#FF2A54]/[0.07] via-[#FF4A00]/[0.05] to-[#FF8C00]/[0.07] blur-[140px] rounded-full pointer-events-none -z-10" />

      {/* ── NAVBAR FIJO Y COHERENTE CON EL LANDING Y DESCUBRIR ── */}
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
            <span className="text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">MexxicanMX</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] font-bold bg-[#FF4A00]/10 dark:bg-[#FF4A00]/20 text-[#FF4A00] rounded-full uppercase tracking-wide">
              Cuestionario IA
            </span>
          </div>

          {/* Estado de paso y selector de tema */}
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-[#86868B] dark:text-[#A1A1A6] bg-black/[0.03] dark:bg-white/[0.06] px-3.5 py-1.5 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
              Paso <span className="text-[#FF4A00] font-black">{step}</span> de 5
            </div>
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

      {/* ── CONTENEDOR PRINCIPAL DEL CARD ── */}
      <main className="w-full max-w-[580px] mx-auto px-4 py-8 flex-1 flex flex-col justify-center z-10">
        <div className="w-full bg-white dark:bg-[#161617] rounded-[28px] p-6 md:p-10 shadow-2xl border border-black/[0.06] dark:border-white/[0.08] relative overflow-hidden transition-colors duration-300">
          
          <AnimatePresence mode="wait">
            
            {/* ── STEP 1: ANTOJO ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: direction * 25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 25 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <span className="text-5xl mb-3 block select-none">🤤</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] to-[#FF8C00]">
                    PASO 1 · TU ANTOJO
                  </span>
                  <h1 className="text-2xl md:text-3xl font-black text-[#1D1D1F] dark:text-white tracking-tight mt-1">
                    ¿Qué antojo tienes hoy?
                  </h1>
                  <p className="text-[14px] font-normal text-[#86868B] dark:text-[#A1A1A6] mt-2 leading-relaxed">
                    Describe con tus palabras sabores, texturas o lo que te gustaría comer
                  </p>
                </div>

                <div className="mt-4">
                  <textarea
                    data-testid="craving-input"
                    value={cravingText}
                    onChange={e => setCravingText(e.target.value)}
                    rows={4}
                    placeholder="Ej: 'Quiero algo caldosito y muy picante para revivir el alma, o unos tacos con salsa bien brava...'"
                    className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.10] rounded-[18px] p-4 text-[15px] font-medium text-[#1D1D1F] dark:text-white placeholder-[#86868B] dark:placeholder-[#A1A1A6] focus:outline-none focus:border-[#FF4A00] focus:ring-2 focus:ring-[#FF4A00]/20 resize-none transition-all"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-bold text-[#86868B] dark:text-[#A1A1A6] uppercase tracking-wider mb-3">
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
                          className={`py-2.5 px-4 rounded-full font-semibold text-[13px] transition-all duration-200 flex items-center justify-center gap-1.5 border cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#FF4A00] ${
                            isSelected
                              ? 'bg-[#FF4A00]/10 dark:bg-[#FF4A00]/20 border-[#FF4A00] text-[#FF4A00] font-bold shadow-sm'
                              : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08] text-[#1D1D1F] dark:text-[#D1D5DB] hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#FF4A00]" />}
                          <span>{chip.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={onCancel || (() => navigate('/'))}
                    className="flex-1 py-3.5 px-5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] border border-black/[0.06] dark:border-white/[0.08] font-bold text-[13px] text-[#4B5563] dark:text-[#D1D5DB] transition text-center focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-3.5 px-6 rounded-full bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] text-white font-extrabold text-[14px] shadow-lg shadow-[#FF4A00]/25 hover:opacity-95 transition text-center flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none cursor-pointer"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: DIETA ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: direction * 25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 25 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <span className="text-5xl mb-3 block select-none">🥗</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] to-[#FF8C00]">
                    PASO 2 · PREFERENCIAS
                  </span>
                  <h1 className="text-2xl md:text-3xl font-black text-[#1D1D1F] dark:text-white tracking-tight mt-1">
                    Preferencias Alimenticias
                  </h1>
                  <p className="text-[14px] font-normal text-[#86868B] dark:text-[#A1A1A6] mt-2 leading-relaxed">
                    ¿Sigues algún tipo de dieta u opción alimenticia especial?
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
                        className={`w-full p-4 rounded-[18px] border text-left transition-all flex items-center justify-between cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#FF4A00] ${
                          isSelected
                            ? 'bg-[#FF4A00]/10 dark:bg-[#FF4A00]/20 border-[#FF4A00] shadow-sm'
                            : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08] hover:border-[#FF4A00]/40'
                        }`}
                      >
                        <div>
                          <div className={`font-bold text-[15px] ${isSelected ? 'text-[#FF4A00] dark:text-white' : 'text-[#1D1D1F] dark:text-white'}`}>
                            {opt.label}
                          </div>
                          <div className="text-[12px] text-[#86868B] dark:text-[#A1A1A6] mt-0.5">{opt.desc}</div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-[#FF4A00] font-bold" />}
                      </button>
                    );
                  })}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex-1 py-3.5 px-5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] border border-black/[0.06] dark:border-white/[0.08] font-bold text-[13px] text-[#4B5563] dark:text-[#D1D5DB] transition flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Atrás</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-3.5 px-6 rounded-full bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] text-white font-extrabold text-[14px] shadow-lg shadow-[#FF4A00]/25 hover:opacity-95 transition flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none cursor-pointer"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: ALERGIAS ── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: direction * 25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 25 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <span className="text-5xl mb-3 block select-none">🛡️</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] to-[#FF8C00]">
                    PASO 3 · SEGURIDAD
                  </span>
                  <h1 className="text-2xl md:text-3xl font-black text-[#1D1D1F] dark:text-white tracking-tight mt-1">
                    Alergias e Intolerancias
                  </h1>
                  <p className="text-[14px] font-normal text-[#86868B] dark:text-[#A1A1A6] mt-2 leading-relaxed">
                    Selecciona tus restricciones. Serán excluidas estrictamente del menú.
                  </p>
                </div>

                <div className="bg-[#FF4A00]/[0.06] dark:bg-[#FF4A00]/[0.10] border border-[#FF4A00]/20 rounded-[18px] p-4 flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-[#FF4A00] flex-shrink-0" />
                  <p className="text-[12px] font-medium text-[#1D1D1F] dark:text-white leading-relaxed">
                    <strong className="text-[#FF4A00]">Tus alergias son prioridad:</strong> los platillos que contengan trazas serán descartados.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {ALLERGY_OPTIONS.map(opt => {
                    const isSelected = selectedAllergies.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid="allergy-option"
                        onClick={() => toggleAllergy(opt.id)}
                        className={`p-3.5 rounded-[16px] border font-bold text-[13px] transition-all text-center flex items-center justify-center gap-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#FF4A00] ${
                          isSelected
                            ? 'bg-rose-500/10 dark:bg-rose-500/20 border-rose-500 text-rose-600 dark:text-rose-400 shadow-sm'
                            : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08] text-[#4B5563] dark:text-[#D1D5DB] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-rose-500" />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex-1 py-3.5 px-5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] border border-black/[0.06] dark:border-white/[0.08] font-bold text-[13px] text-[#4B5563] dark:text-[#D1D5DB] transition flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Atrás</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-3.5 px-6 rounded-full bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] text-white font-extrabold text-[14px] shadow-lg shadow-[#FF4A00]/25 hover:opacity-95 transition flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none cursor-pointer"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: CON QUIÉN COMES ── */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: direction * 25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 25 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <span className="text-5xl mb-3 block select-none">👥</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] to-[#FF8C00]">
                    PASO 4 · CONTEXTO
                  </span>
                  <h1 className="text-2xl md:text-3xl font-black text-[#1D1D1F] dark:text-white tracking-tight mt-1">
                    ¿Con quién comes?
                  </h1>
                  <p className="text-[14px] font-normal text-[#86868B] dark:text-[#A1A1A6] mt-2 leading-relaxed">
                    Así ajustamos las porciones y el ambiente de las recomendaciones
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
                        className={`p-4 rounded-[18px] border text-center transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#FF4A00] ${
                          isSelected
                            ? 'bg-[#FF4A00]/10 dark:bg-[#FF4A00]/20 border-[#FF4A00] text-[#FF4A00] font-bold shadow-sm'
                            : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08] text-[#4B5563] dark:text-[#D1D5DB] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="text-lg font-bold">{opt.label}</div>
                        <div className="text-[11px] text-[#86868B] dark:text-[#A1A1A6] mt-1">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="flex-1 py-3.5 px-5 rounded-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] border border-black/[0.06] dark:border-white/[0.08] font-bold text-[13px] text-[#4B5563] dark:text-[#D1D5DB] transition flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Atrás</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-3.5 px-6 rounded-full bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] text-white font-extrabold text-[14px] shadow-lg shadow-[#FF4A00]/25 hover:opacity-95 transition flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none cursor-pointer"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 5: READY / PRE-FETCH (REDiseñado con el Branding MexxicanMX y Logo Oficial) ── */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="text-center py-4 space-y-6"
              >
                {/* Hero Avatar con el Logo Oficial y Gradiente de Marca */}
                <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-[28px] bg-gradient-to-tr from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] blur-xl opacity-40 animate-pulse" />
                  <div className="relative w-full h-full rounded-[26px] bg-gradient-to-tr from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] p-[2.5px] shadow-[0_16px_36px_rgba(255,74,0,0.32)]">
                    <div className="w-full h-full rounded-[23px] bg-white dark:bg-[#141416] flex items-center justify-center relative overflow-hidden">
                      <Logo size={42} className="relative z-10" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#FF4A00]/15 to-transparent pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-transparent bg-clip-text bg-gradient-to-r from-[#FF2A54] to-[#FF8C00]">
                    MOTOR DE INTELIGENCIA GASTRONÓMICA
                  </span>
                  <h1 className="text-3xl md:text-4xl font-black text-[#1D1D1F] dark:text-white tracking-tight mt-1.5">
                    ¡Todo listo!
                  </h1>
                  <p className="text-[14px] font-normal text-[#86868B] dark:text-[#A1A1A6] mt-2 max-w-sm mx-auto leading-relaxed">
                    Tu motor de recomendaciones de IA ha procesado tu antojo y configurado los filtros de seguridad.
                  </p>
                </div>

                {/* Resumen Visual de Preferencias */}
                <div className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] rounded-[20px] p-4 text-left space-y-2 max-w-md mx-auto">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#86868B] dark:text-[#A1A1A6] mb-1">
                    Tus preferencias configuradas:
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[12px]">
                    <span className="px-3 py-1 rounded-full bg-[#FF4A00]/10 dark:bg-[#FF4A00]/20 text-[#FF4A00] font-bold">
                      🤤 {cravingText ? `"${cravingText.slice(0, 30)}${cravingText.length > 30 ? '...' : ''}"` : 'Lo más recomendado'}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#4B5563] dark:text-[#D1D5DB] font-semibold">
                      {DIET_OPTIONS.find(d => d.id === selectedDiet)?.label || 'Sin restricciones'}
                    </span>
                    {selectedAllergies.length > 0 && (
                      <span className="px-3 py-1 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 font-bold">
                        🛡️ {selectedAllergies.length} alergia(s) filtrada(s)
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#4B5563] dark:text-[#D1D5DB] font-semibold">
                      {SOCIAL_OPTIONS.find(s => s.id === selectedSocial)?.label || '🧑 Solo'}
                    </span>
                  </div>
                </div>

                {/* Acciones Finales */}
                <div className="flex flex-col gap-3 max-w-sm mx-auto pt-1">
                  <button
                    type="button"
                    data-testid="discover-recommendations"
                    onClick={handleFinish}
                    className="w-full py-4 px-8 rounded-full bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] hover:opacity-95 text-white font-extrabold text-[15px] shadow-[0_12px_24px_rgba(255,74,0,0.28)] hover:shadow-[0_16px_32px_rgba(255,74,0,0.38)] transition-all flex items-center justify-center gap-2.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
                  >
                    <span>🚀 Descubrir platillos</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full py-3 px-4 rounded-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] border border-black/[0.06] dark:border-white/[0.08] text-[13px] font-bold text-[#86868B] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white transition flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF4A00] outline-none"
                  >
                    <RotateCcw className="w-4 h-4" />
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
