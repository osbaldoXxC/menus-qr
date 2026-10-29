import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BouncyLoadingScreenProps {
  isReady?: boolean;
  onComplete?: () => void;
  minDurationMs?: number;
}

const LOADING_MESSAGES = [
  'Consultando el apetito de hoy...',
  'Cruzando texturas, ingredientes y sabores...',
  'Calculando el match ideal con Inteligencia Artificial...',
  'Emplatando las mejores recomendaciones para ti...'
];

export const BouncyLoadingScreen: React.FC<BouncyLoadingScreenProps> = ({
  isReady = true,
  onComplete,
  minDurationMs = 1800
}) => {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotación fluida de mensajes cada 650ms
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 650);

    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDurationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [minDurationMs]);

  // Solo completar cuando se haya cumplido el tiempo mínimo Y los datos estén 100% listos
  useEffect(() => {
    if (minTimeElapsed && isReady) {
      if (onComplete) onComplete();
    }
  }, [minTimeElapsed, isReady, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-[#0c0c0d] text-[#1D1D1F] dark:text-[#F5F5F7] font-sans overflow-hidden select-none"
    >
      {/* ── AURA DIFUSA DEGRADADA DE FONDO (MARCA MEXXICANMX) ── */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <motion.div
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.15, 0.25, 0.15]
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-[480px] h-[480px] rounded-full bg-gradient-to-tr from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] blur-[120px]"
        />
      </div>

      {/* ── PÍLDORA SUPERIOR DE ESTADO ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.03] dark:bg-white/[0.06] backdrop-blur-xl mb-10 shadow-sm"
      >
        <span className="w-2 h-2 rounded-full bg-[#FF4A00] animate-pulse" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#86868B] dark:text-[#A1A1A6]">
          IA Gastronómica · Descubriendo
        </span>
      </motion.div>

      {/* ── ANIMACIÓN BOUNCY CON FÍSICA NATURAL Y EMOJIS NATIVOS 1:1 ── */}
      <div className="relative flex flex-col items-center justify-center h-48 w-64 mb-6">
        
        {/* Satélites Laterales Flotantes con rebote elástico y proporciones naturales */}
        <div className="absolute inset-x-0 top-10 flex items-center justify-between px-3 pointer-events-none">
          {/* Satélite Izquierdo 🥑 (Proporción 1:1 intacta) */}
          <motion.div
            animate={{
              y: [0, -22, 0],
              rotate: [-6, 3, -6]
            }}
            transition={{
              duration: 0.85,
              repeat: Infinity,
              ease: [0.34, 1.56, 0.64, 1],
              delay: 0.12
            }}
            className="text-3xl select-none leading-none drop-shadow-md"
            style={{ transformOrigin: 'center center' }}
          >
            🥑
          </motion.div>

          {/* Satélite Derecho 🌶️ (Proporción 1:1 intacta) */}
          <motion.div
            animate={{
              y: [0, -24, 0],
              rotate: [6, -3, 6]
            }}
            transition={{
              duration: 0.85,
              repeat: Infinity,
              ease: [0.34, 1.56, 0.64, 1],
              delay: 0.24
            }}
            className="text-3xl select-none leading-none drop-shadow-md"
            style={{ transformOrigin: 'center center' }}
          >
            🌶️
          </motion.div>
        </div>

        {/* HERO CENTRAL REBOTANTE: Salto elástico con proporciones 1:1 */}
        <motion.div
          animate={{
            y: [0, -38, 0]
          }}
          transition={{
            duration: 0.85,
            repeat: Infinity,
            ease: [0.34, 1.56, 0.64, 1]
          }}
          className="relative z-10 w-24 h-24 rounded-[26px] bg-gradient-to-tr from-[#FF2A54] via-[#FF4A00] to-[#FF8C00] shadow-[0_16px_36px_rgba(255,74,0,0.32)] flex items-center justify-center p-[2.5px]"
        >
          {/* Contenedor interior nítido con el emoji natural 1:1 */}
          <div className="w-full h-full rounded-[23px] bg-white dark:bg-[#141416] flex items-center justify-center relative overflow-hidden">
            <span className="text-4xl select-none leading-none drop-shadow-sm">
              🌮
            </span>
            <div className="absolute inset-0 bg-gradient-to-t from-[#FF4A00]/10 to-transparent pointer-events-none" />
          </div>
        </motion.div>

        {/* SOMBRA DINÁMICA EN EL SUELO (Se encoge y desvanece al elevarse, se expande al aterrizar) */}
        <motion.div
          animate={{
            scaleX: [1.15, 0.55, 1.15],
            opacity: [0.45, 0.12, 0.45]
          }}
          transition={{
            duration: 0.85,
            repeat: Infinity,
            ease: [0.34, 1.56, 0.64, 1]
          }}
          className="w-20 h-2.5 rounded-full bg-black/40 dark:bg-white/25 blur-[3px] mt-4"
        />

      </div>

      {/* ── TEXTOS DINÁMICOS Y ANIMADOS ── */}
      <div className="text-center max-w-sm px-6 h-16 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="text-[17px] font-black tracking-tight text-[#1D1D1F] dark:text-white"
          >
            {LOADING_MESSAGES[messageIndex]}
          </motion.p>
        </AnimatePresence>
        <p className="text-[12px] font-medium text-[#86868B] dark:text-[#A1A1A6] mt-1.5">
          Preparando tu experiencia personalizada
        </p>
      </div>

      {/* ── BARRA DE PROGRESO FLUIDA ── */}
      <div className="w-44 h-1 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden mt-6">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{
            duration: 1.3,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="w-1/2 h-full rounded-full bg-gradient-to-r from-[#FF2A54] via-[#FF4A00] to-[#FF8C00]"
        />
      </div>

    </motion.div>
  );
};
