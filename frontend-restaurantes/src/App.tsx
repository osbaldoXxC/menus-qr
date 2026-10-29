import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './pages/components/ProtectedRoute';
import { ThemeProvider } from './context/ThemeContext';
import { RestaurantProvider } from './context/RestaurantContext';
import { MainLayout } from './pages/components/MainLayout';
import { Logo } from './pages/components/Logo';

// Direct imports for instant, zero-delay dashboard navigation
import { DashboardRestaurante } from './pages/DashboardRestaurante/DashboardRestaurante';
import { MiMenu } from './pages/MiMenu/MiMenu';
import { NuevoPlatillo } from './pages/NuevoPlatillo/NuevoPlatillo';
import { CodigoQR } from './pages/CodigoQR/CodigoQR';
import { Configuracion } from './pages/Configuracion/Configuracion';
import { Soporte } from './pages/Soporte/Soporte';
import { Perfil } from './pages/Perfil/Perfil';

// Lazy-loaded auth pages
const Login = lazy(() => import('./pages/Login/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register/Register').then(m => ({ default: m.Register })));
const VerifyEmail = lazy(() => import('./pages/Login/VerifyEmail').then(m => ({ default: m.VerifyEmail })));
const RecuperarContrasena = lazy(() => import('./pages/Login/RecuperarContrasena').then(m => ({ default: m.RecuperarContrasena })));
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

// Redirección inteligente en la raíz:
// Si ya hay sesión activa de restaurante -> Dashboard
// Si no hay sesión -> Inicio de sesión directo
function RootRedirect() {
  const token = localStorage.getItem('access_token');
  const rol = (localStorage.getItem('rol') || '').toUpperCase();
  if (token && (rol.includes('RESTAURANTE') || rol.includes('SUPER_ADMIN'))) {
    return <Navigate to="/dashboard/restaurante" replace />;
  }
  return <Navigate to="/login" replace />;
}

function RestaurantRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Raíz: Inicio de sesión directo o Dashboard si está autenticado */}
        <Route path="/" element={<RootRedirect />} />

        {/* Rutas legacy redirigidas a raíz */}
        <Route path="/para-restaurantes" element={<Navigate to="/" replace />} />
        <Route path="/como-funciona" element={<Navigate to="/" replace />} />
        <Route path="/precios" element={<Navigate to="/" replace />} />

        {/* Autenticación Restaurante */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />

        {/* Perfil & Dashboard de Gestión del Restaurante */}
        <Route path="/perfil" element={
          <ProtectedRoute allowedRoles={['RESTAURANTE']}>
            <Perfil />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={<Navigate to="/dashboard/restaurante" replace />} />
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

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <RestaurantProvider>
        <BrowserRouter>
          <MainLayout>
            <RestaurantRoutes />
          </MainLayout>
        </BrowserRouter>
      </RestaurantProvider>
    </ThemeProvider>
  );
}

export default App;
