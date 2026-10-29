import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { authService } from '../../services/auth';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const [user, setUser] = useState(authService.getCurrentUser());

  useEffect(() => {
    return authService.onAuthChange(() => setUser(authService.getCurrentUser()));
  }, []);

  const rol = user.rol?.toLowerCase() || '';
  const isDashboardUser = user.isAuthenticated && (rol === 'restaurante' || rol === 'super_admin');
  
  // Dashboard routes use Sidebar
  const useSidebar = isDashboardUser && (location.pathname.startsWith('/dashboard') || location.pathname === '/perfil' || location.pathname === '/admin');

  // Routes that handle their own Header/Footer internally
  const selfContainedRoutes = ['/', '/para-restaurantes', '/como-funciona', '/precios', '/descubrir', '/cuestionario', '/login', '/register'];
  const isSelfContained = selfContainedRoutes.includes(location.pathname) || location.pathname.startsWith('/menu/');

  // Hide footer in dashboard and self-contained routes
  const showFooter = !useSidebar && !isSelfContained && !['/login', '/register'].includes(location.pathname);

  return (
    <div className={`flex min-h-screen relative overflow-x-clip bg-apple-bg dark:bg-apple-dark-bg transition-colors duration-300 ${useSidebar ? 'flex-col lg:flex-row' : 'flex-col'}`}>
      {/* Decorative Mesh Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-apple-blue/5 blur-[120px] dark:bg-apple-blue/10" />
        <div className="absolute top-[20%] -right-[10%] w-[35%] h-[35%] rounded-full bg-apple-accent/5 blur-[100px] dark:bg-apple-accent/10" />
        <div className="absolute -bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-apple-blue/5 blur-[110px] dark:bg-apple-blue/10" />
      </div>

      {useSidebar ? (
        <Sidebar />
      ) : !isSelfContained ? (
        <Header />
      ) : null}
      
      <main className={`flex-1 relative z-10 w-full transition-all duration-300 ${useSidebar ? 'min-h-screen bg-apple-bg dark:bg-apple-dark-bg pt-16 lg:pt-0' : 'flex flex-col'}`}>
        {children}
        {showFooter && <Footer />}
      </main>
    </div>
  );
}
