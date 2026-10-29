import { useContext, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../../services/auth';
import { ThemeContext } from '../../context/ThemeContext';

const menuVariants = {
  hidden: { opacity: 0, y: -12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.2 } },
};

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [user, setUser] = useState(authService.getCurrentUser());

  useEffect(() => {
    return authService.onAuthChange(() => setUser(authService.getCurrentUser()));
  }, []);

  const { theme, toggleTheme } = useContext(ThemeContext);
  const rol = user.rol?.toLowerCase() || '';
  const isDashboardUser = rol === 'restaurante' || rol === 'super_admin';

  // Determinar si estamos en la sección de Negocios o Comensales
  const isBusinessSection = ['/para-restaurantes', '/precios', '/como-funciona', '/login', '/register'].includes(location.pathname);

  // Menu Items según el contexto
  const businessItems = [
    { nombre: 'Inicio', ruta: '/para-restaurantes' },
    { nombre: 'Precios', ruta: '/precios' },
    { nombre: 'Comensales', ruta: '/' },
  ];

  const consumerItems = [
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Descubrir', ruta: '/descubrir' },
    { nombre: 'Cuestionario IA', ruta: '/cuestionario' },
    { nombre: 'Para Restaurantes', ruta: '/para-restaurantes' },
  ];

  const menuItems = isBusinessSection ? businessItems : consumerItems;

  const handleLogout = () => {
    authService.logout();
    setMenuAbierto(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-apple-bg/80 dark:bg-apple-dark-bg/80 transition-colors duration-300">
        <div className="mx-auto max-w-[1400px] px-5 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to={isDashboardUser ? '/dashboard/restaurante' : (isBusinessSection ? '/para-restaurantes' : '/')}
              className="flex items-center gap-2 cursor-pointer select-none group"
            >
              <motion.img
                src="/favicon.svg"
                alt="MexxicanMX Logo"
                className="w-5 h-5 object-contain"
                whileHover={{ rotate: 12 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
              <span className="text-[15px] font-semibold tracking-tight text-apple-text dark:text-apple-dark-text">
                MexxicanMX
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {menuItems.map((item) => (
                <Link
                  key={item.ruta}
                  to={item.ruta}
                  className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                    location.pathname === item.ruta 
                      ? 'text-apple-blue bg-apple-blue/5' 
                      : 'text-apple-text-secondary dark:text-apple-dark-text-secondary hover:text-apple-text dark:hover:text-apple-dark-text'
                  }`}
                >
                  {item.nombre}
                </Link>
              ))}
            </nav>

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 text-apple-text-secondary hover:text-apple-text transition-colors rounded-lg hover:bg-white/5"
                aria-label="Alternar tema"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>

              {!user.isAuthenticated ? (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-[13px] font-medium text-apple-text-secondary hover:text-apple-text transition-colors"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    to="/register"
                    className="px-6 py-2 text-[13px] font-semibold bg-apple-blue text-white rounded-full hover:bg-apple-blue-hover transition-all duration-200 shadow-apple-sm hover:shadow-apple-glow"
                  >
                    Empezar gratis
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to={isDashboardUser ? "/dashboard/restaurante" : "/perfil"}
                    className="px-4 py-2 text-[13px] font-semibold bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary text-apple-text dark:text-apple-dark-text rounded-full border border-apple-border dark:border-apple-dark-border hover:bg-apple-bg-tertiary transition-all"
                  >
                    {isDashboardUser ? 'Panel Control' : 'Mi Perfil'}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-red-500 hover:text-red-600 transition-colors"
                    title="Cerrar sesión"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="lg:hidden p-2 -mr-2 text-apple-text-secondary hover:text-apple-text transition-colors"
              aria-label="Menú"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuAbierto ? (
                  <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {menuAbierto && (
            <motion.div
              variants={menuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="lg:hidden border-t border-apple-border dark:border-apple-dark-border bg-apple-bg/95 dark:bg-apple-dark-bg/95 backdrop-blur-xl"
            >
              <div className="px-5 py-6 space-y-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.ruta}
                    to={item.ruta}
                    onClick={() => setMenuAbierto(false)}
                    className="block px-4 py-3 text-[15px] font-medium text-apple-text-secondary hover:text-apple-text hover:bg-apple-bg-secondary rounded-xl transition-all"
                  >
                    {item.nombre}
                  </Link>
                ))}

                <div className="h-px bg-apple-border dark:bg-apple-dark-border my-4" />

                {!user.isAuthenticated ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Link
                      to="/login"
                      onClick={() => setMenuAbierto(false)}
                      className="flex items-center justify-center px-4 py-3 text-[15px] font-medium text-apple-text rounded-xl border border-apple-border dark:border-apple-dark-border"
                    >
                      Entrar
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMenuAbierto(false)}
                      className="flex items-center justify-center px-4 py-3 text-[15px] font-semibold bg-apple-blue text-white rounded-xl shadow-apple-glow"
                    >
                      Registro
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <Link
                      to={isDashboardUser ? "/dashboard/restaurante" : "/perfil"}
                      onClick={() => setMenuAbierto(false)}
                      className="block px-4 py-3 text-[15px] font-medium text-apple-text bg-apple-bg-secondary rounded-xl text-center"
                    >
                      {isDashboardUser ? 'Panel de Control' : 'Mi Perfil'}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-[15px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    toggleTheme();
                    setMenuAbierto(false);
                  }}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 text-[15px] font-medium text-apple-text bg-apple-bg-secondary rounded-xl"
                >
                  {theme === 'dark' ? '☀️ Modo día' : '🌙 Modo noche'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Spacer para que el contenido no quede debajo del header fixed */}
      <div className="h-16" />
    </>
  );
}