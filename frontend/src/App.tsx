import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './pages/components/ProtectedRoute';
import { authService } from './services/auth';
import { ThemeProvider } from './context/ThemeContext';
import { RestaurantProvider } from './context/RestaurantContext';
import { MainLayout } from './pages/components/MainLayout';
import { WelcomeSplash } from './pages/components/WelcomeSplash';
import { Logo } from './pages/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';

// Direct imports for instant, zero-delay dashboard navigation
import { DashboardRestaurante } from './pages/DashboardRestaurante/DashboardRestaurante';
import { MiMenu } from './pages/MiMenu/MiMenu';
import { NuevoPlatillo } from './pages/NuevoPlatillo/NuevoPlatillo';
import { CodigoQR } from './pages/CodigoQR/CodigoQR';
import { Configuracion } from './pages/Configuracion/Configuracion';
import { Soporte } from './pages/Soporte/Soporte';
import { Perfil } from './pages/Perfil/Perfil';

// Lazy-loaded public pages
const HomeDiners = lazy(() => import('./pages/Landing/NoSabesQueComer').then(m => ({ default: m.NoSabesQueComer })));
const PublicMenu = lazy(() => import('./pages/PublicMenu/PublicMenu').then(m => ({ default: m.PublicMenu })));
const Register = lazy(() => import('./pages/Register/Register').then(m => ({ default: m.Register })));
const Login = lazy(() => import('./pages/Login/Login').then(m => ({ default: m.Login })));
const ComoFunciona = lazy(() => import('./pages/ComoFunciona/ComoFunciona').then(m => ({ default: m.ComoFunciona })));
const ParaRestaurantes = lazy(() => import('./pages/ParaRestaurantes/ParaRestaurantes').then(m => ({ default: m.ParaRestaurantes })));
const Precios = lazy(() => import('./pages/Precios/Precios').then(m => ({ default: m.Precios })));
const EscanearQR = lazy(() => import('./pages/EscanearQR/EscanearQR').then(m => ({ default: m.EscanearQR })));
const Descubrir = lazy(() => import('./pages/Descubrir/Descubrir').then(m => ({ default: m.Descubrir })));
const CuestionarioIA = lazy(() => import('./pages/CuestionarioIA/CuestionarioIA').then(m => ({ default: m.CuestionarioIA })));
const VerifyEmail = lazy(() => import('./pages/Login/VerifyEmail').then(m => ({ default: m.VerifyEmail })));
const RecuperarContrasena = lazy(() => import('./pages/Login/RecuperarContrasena').then(m => ({ default: m.RecuperarContrasena })));
const AdminPanel = lazy(() => import('./pages/Admin/AdminPanel').then(m => ({ default: m.AdminPanel })));
const NotFound = lazy(() => import('./pages/NotFound/NotFound').then(m => ({ default: m.NotFound })));

function PageLoader() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <Logo size={64} className="animate-pulse mb-4" />
        <p className="text-gray-500 mt-2">Cargando...</p>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isAuthenticated, rol } = authService.getCurrentUser();
  const userRol = rol?.toLowerCase() || '';

  if (isAuthenticated) {
    if (userRol === 'super_admin') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('rol');
      localStorage.removeItem('restaurante_id');
      window.location.href = import.meta.env.VITE_ADMIN_URL || 'http://localhost:3001';
      return null;
    }
    if (userRol === 'restaurante') {
      return <Navigate to="/dashboard/restaurante" replace />;
    }
  }

  // Por defecto, la raíz es para Comensales
  return <HomeDiners />;
}

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full min-h-full"
      >
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            {/* Root: Experience for Diners */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Business Section */}
            <Route path="/para-restaurantes" element={<ParaRestaurantes />} />
            <Route path="/como-funciona" element={<ComoFunciona />} />
            <Route path="/precios" element={<Precios />} />

            {/* Auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />

            {/* Diner Experience */}
            <Route path="/descubrir" element={<Descubrir />} />
            <Route path="/cuestionario" element={<CuestionarioIA />} />
            <Route path="/menu/:restaurant_id" element={<PublicMenu />} />
            <Route path="/escanear/:id?" element={<EscanearQR />} />

            {/* Shared Profile */}
            <Route path="/perfil" element={
              <ProtectedRoute allowedRoles={['COMENSAL', 'RESTAURANTE']}>
                <Perfil />
              </ProtectedRoute>
            } />

            {/* Dashboard */}
            <Route path="/dashboard/restaurante" element={
              <ProtectedRoute allowedRoles={['RESTAURANTE']}>
                <DashboardRestaurante />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/platillos" element={
              <ProtectedRoute allowedRoles={['RESTAURANTE']}>
                <MiMenu />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/platillos/nuevo" element={
              <ProtectedRoute allowedRoles={['RESTAURANTE']}>
                <NuevoPlatillo />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/platillos/editar/:id" element={
              <ProtectedRoute allowedRoles={['RESTAURANTE']}>
                <NuevoPlatillo />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/qr" element={
              <ProtectedRoute allowedRoles={['RESTAURANTE']}>
                <CodigoQR />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/configuracion" element={
              <ProtectedRoute allowedRoles={['RESTAURANTE']}>
                <Configuracion />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/soporte" element={
              <ProtectedRoute allowedRoles={['RESTAURANTE']}>
                <Soporte />
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <AdminPanel />
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeProvider>
      <RestaurantProvider>
        <BrowserRouter>
          <WelcomeSplash />
          <MainLayout>
            <AnimatedRoutes />
          </MainLayout>
        </BrowserRouter>
      </RestaurantProvider>
    </ThemeProvider>
  );
}

export default App;
