import { useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ThemeContext } from '../../context/ThemeContext';
import { Logo } from '../components/Logo';
import { ComensalAuthModal } from '../../components/ComensalAuthModal';

export function Register() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <div className="min-h-screen bg-[#FCF5EF] dark:bg-[#15110F] text-[#1D1D1F] dark:text-[#F5F5F7] font-sans flex flex-col relative overflow-hidden transition-colors duration-500">
      <header className="w-full border-b border-black/[0.06] dark:border-white/[0.06] backdrop-blur-xl bg-white/80 dark:bg-black/80 sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex items-center justify-between h-[60px]">
          <Link to="/" className="flex items-center gap-2 select-none group rounded-lg focus-visible:ring-2 focus-visible:ring-[#FF4A00]">
            <Logo size={22} />
            <span className="text-[15px] font-semibold tracking-tight">MexxicanMX</span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar tema claro y oscuro"
            className="p-2 text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white rounded-lg"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <ComensalAuthModal
          isOpen={true}
          initialMode="register"
          onClose={() => navigate('/descubrir')}
          onAuthenticated={() => navigate('/descubrir')}
        />
      </main>
    </div>
  );
}
