import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../../services/auth';

function preloadAllChunks() {
  return Promise.all([
    import('../DashboardRestaurante/DashboardRestaurante'),
    import('../MiMenu/MiMenu'),
    import('../NuevoPlatillo/NuevoPlatillo'),
    import('../CodigoQR/CodigoQR'),
    import('../Configuracion/Configuracion'),
    import('../Perfil/Perfil'),
    import('../Descubrir/Descubrir'),
    import('../CuestionarioIA/CuestionarioIA'),
    import('../Precios/Precios'),
    import('../ComoFunciona/ComoFunciona'),
    import('../ParaRestaurantes/ParaRestaurantes'),
    import('../PublicMenu/PublicMenu'),
  ]);
}

const SPLASH_KEY = 'splash_shown';
let splashShownInTab = false; // Flag en memoria de la pestaña

export function WelcomeSplash() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  // Ejecutar al montar la app (F5 o primer acceso a la pestaña)
  useEffect(() => {
    const user = authService.getCurrentUser();
    const isAuth = user.isAuthenticated;
    const isPending = sessionStorage.getItem(SPLASH_KEY) === 'pending';
    const isPrivate = window.location.pathname.startsWith('/dashboard') || 
                      window.location.pathname.startsWith('/perfil') || 
                      window.location.pathname.startsWith('/admin');

    if (isPrivate && ((isAuth && !splashShownInTab) || isPending)) {
      splashShownInTab = true;
      setVisible(true);
    }
  }, []);

  // También escuchar el flag pending cuando cambia la ruta post-login
  useEffect(() => {
    const isPrivate = location.pathname.startsWith('/dashboard') || 
                      location.pathname.startsWith('/perfil') || 
                      location.pathname.startsWith('/admin');
                      
    if (isPrivate && sessionStorage.getItem(SPLASH_KEY) === 'pending') {
      splashShownInTab = true;
      setVisible(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!visible) return;

    const minDelay = new Promise<void>((r) => setTimeout(r, 2000));

    Promise.all([minDelay, preloadAllChunks()]).then(() => {
      setTimeout(() => {
        sessionStorage.removeItem(SPLASH_KEY);
        setVisible(false);
      }, 500);
    });
  }, [visible]);

  const user = authService.getCurrentUser();
  const isRestaurante = user.rol?.toUpperCase() === 'RESTAURANTE' || user.rol?.toUpperCase() === 'SUPER_ADMIN';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Aurora background */}
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#0071E3]/20 blur-[140px]"
              animate={{ x: [0, 60, 0], y: [0, 30, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-[#FF4A00]/15 blur-[120px]"
              animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <motion.div
            className="relative z-10 text-center select-none px-6"
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className="mb-6 inline-flex items-center justify-center p-3 rounded-3xl bg-white/5 border border-white/10 shadow-[0_0_50px_rgba(210,35,35,0.35)] backdrop-blur-md"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.05, 1], opacity: 1 }}
              transition={{ 
                opacity: { duration: 0.5 },
                scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' } 
              }}
            >
              <img
                src="/favicon.svg"
                alt="MexxicanMX"
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-2xl drop-shadow-2xl"
              />
            </motion.div>

            <motion.p
              className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6E6E73] mb-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              MexxicanMX
            </motion.p>

            <motion.h1
              className="text-[3rem] sm:text-[4rem] font-black tracking-tighter leading-tight text-white mb-2"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {isRestaurante ? 'Bienvenido\nde vuelta.' : 'Bienvenido.'}
            </motion.h1>

            <motion.p
              className="text-[14px] text-[#A1A1A6] mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {isRestaurante ? 'Preparando tu panel de control...' : 'Cargando tu experiencia...'}
            </motion.p>

            {/* Dots */}
            <motion.div
              className="flex items-center justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/30"
                  animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
