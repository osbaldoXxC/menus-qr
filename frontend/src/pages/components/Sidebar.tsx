import { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Utensils, 
  PlusCircle, 
  QrCode, 
  Settings, 
  User, 
  LogOut, 
  ChevronLeft, 
  Menu,
  Sun,
  Moon,
  Home,
  MessageSquare
} from 'lucide-react';
import { Logo } from './Logo';
import { authService } from '../../services/auth';
import { ThemeContext } from '../../context/ThemeContext';
import { useRestaurant } from '../../context/RestaurantContext';

interface SidebarItemProps {
  icon: any;
  label: string;
  ruta: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}

const SidebarItem = ({ icon: Icon, label, ruta, active, collapsed, onClick }: SidebarItemProps) => {
  return (
    <Link
      to={ruta}
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
        ${active 
          ? 'bg-apple-blue text-white shadow-apple-glow' 
          : 'text-apple-text-secondary dark:text-apple-dark-text-secondary hover:text-apple-text dark:hover:text-apple-dark-text hover:bg-apple-bg-secondary dark:hover:bg-apple-dark-bg-secondary'}
      `}
    >
      <motion.div 
        className={`flex-shrink-0 ${active ? 'text-white' : 'text-apple-blue'}`}
        whileHover={{ scale: 1.1 }}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      </motion.div>
      {!collapsed && (
        <span className={`text-[14px] font-medium whitespace-nowrap overflow-hidden transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-90'}`}>
          {label}
        </span>
      )}
      {active && !collapsed && (
        <motion.div 
          layoutId="active-indicator"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
        />
      )}
    </Link>
  );
};

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [user, setUser] = useState(authService.getCurrentUser());

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) setCollapsed(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const unsubscribe = authService.onAuthChange(() => setUser(authService.getCurrentUser()));
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      unsubscribe();
    };
  }, []);

  const rol = user.rol?.toLowerCase() || '';
  const isSuperAdmin = rol === 'super_admin';

  const { isPremium } = useRestaurant();

  const mainItems = [
    { icon: LayoutDashboard, label: 'Panel de Control', ruta: '/dashboard/restaurante' },
    { icon: Utensils, label: 'Mi Menú', ruta: '/dashboard/platillos' },
    { icon: PlusCircle, label: 'Nuevo Platillo', ruta: '/dashboard/platillos/nuevo' },
    { icon: QrCode, label: 'Código QR', ruta: '/dashboard/qr' },
  ];

  const secondaryItems = [
    { icon: Settings, label: 'Configuración', ruta: '/dashboard/configuracion' },
    ...(isPremium ? [{ icon: MessageSquare, label: 'Soporte Premium', ruta: '/dashboard/soporte' }] : []),
    { icon: User, label: 'Mi Perfil', ruta: '/perfil' },
  ];

  if (isSuperAdmin) {
    mainItems.push({ icon: LayoutDashboard, label: 'Admin Panel', ruta: '/admin' });
  }

  const handleLogout = () => {
    authService.logout();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full py-6 px-4">
      {/* Logo & Toggle */}
      <div className={`flex items-center mb-10 ${collapsed ? 'justify-center' : 'justify-between px-2'}`}>
        <Link to="/" className="flex items-center gap-2">
          <Logo size={collapsed ? 32 : 28} />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-apple-text dark:text-apple-dark-text">
              MexxicanMX
            </span>
          )}
        </Link>
        {!isMobile && !collapsed && (
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg bg-apple-bg-secondary dark:bg-apple-dark-bg-secondary text-apple-text-secondary hover:text-apple-text transition-colors"
          >
            <ChevronLeft className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} size={18} />
          </button>
        )}
        {!isMobile && collapsed && (
           <button 
           onClick={() => setCollapsed(!collapsed)}
           className="absolute -right-3 top-20 p-1 rounded-full bg-apple-blue text-white shadow-lg z-50"
         >
           <ChevronLeft className="rotate-180" size={14} />
         </button>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 space-y-2">
        {!collapsed && <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-apple-text-tertiary">Menú Principal</p>}
        {mainItems.map((item) => (
          <SidebarItem
            key={item.ruta}
            {...item}
            active={location.pathname === item.ruta}
            collapsed={collapsed}
            onClick={() => isMobile && setShowMobileSidebar(false)}
          />
        ))}

        <div className="my-6 border-t border-apple-border dark:border-apple-dark-border opacity-50" />

        {!collapsed && <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-apple-text-tertiary">Ajustes</p>}
        {secondaryItems.map((item) => (
          <SidebarItem
            key={item.ruta}
            {...item}
            active={location.pathname === item.ruta}
            collapsed={collapsed}
            onClick={() => isMobile && setShowMobileSidebar(false)}
          />
        ))}
      </div>

      {/* Footer Actions */}
      <div className="mt-auto space-y-2 pt-6">
        <button
          onClick={toggleTheme}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
            text-apple-text-secondary hover:text-apple-text hover:bg-apple-bg-secondary dark:hover:bg-apple-dark-bg-secondary
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-500" />}
          {!collapsed && <span className="text-[14px] font-medium">{theme === 'dark' ? 'Modo Día' : 'Modo Noche'}</span>}
        </button>

        <button
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
            text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-[14px] font-medium">Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      {isMobile && (
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-apple-bg/80 dark:bg-apple-dark-bg/80 backdrop-blur-xl border-b border-apple-border dark:border-apple-dark-border z-40 flex items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={24} />
            <span className="text-base font-bold tracking-tight text-apple-text dark:text-apple-dark-text">MexxicanMX</span>
          </Link>
          <button 
            onClick={() => setShowMobileSidebar(true)}
            className="p-2 text-apple-text-secondary"
          >
            <Menu size={24} />
          </button>
        </div>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 88 : 260 }}
          className={`
            fixed top-0 left-0 bottom-0 bg-apple-bg dark:bg-apple-dark-bg border-r border-apple-border dark:border-apple-dark-border z-50
            hidden lg:block overflow-hidden transition-colors duration-300
          `}
        >
          <SidebarContent />
        </motion.aside>
      )}

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobile && showMobileSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileSidebar(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-apple-bg dark:bg-apple-dark-bg z-[70] shadow-2xl"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Page Content Margin Adjuster */}
      <div 
        className="flex-shrink-0 transition-all duration-300 hidden lg:block" 
        style={{ width: collapsed ? 88 : 260 }} 
      />

    </>
  );
}
