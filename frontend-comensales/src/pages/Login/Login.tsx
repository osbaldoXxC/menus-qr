import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authService } from '../../services/auth';
import { ThemeContext } from '../../context/ThemeContext';
import { Logo } from '../components/Logo';

export function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authService.login(email, password);
      const rol = (response.rol || '').toString().toUpperCase();
      sessionStorage.setItem('splash_shown', 'pending');
      if (rol.includes('SUPER_ADMIN')) {
        window.location.href = import.meta.env.VITE_ADMIN_URL || 'http://localhost:3001';
      } else if (rol.includes('RESTAURANTE')) {
        navigate('/dashboard/restaurante');
      } else {
        navigate('/descubrir');
      }
    } catch (err: any) {
      if (err.response?.data?.requiereVerificacion) {
        navigate('/verify-email', { state: { email } });
        return;
      }
      setError(err.response?.data?.mensaje || 'Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `
    w-full px-5 py-3.5 rounded-2xl text-[15px] outline-none transition-all duration-200
    bg-black/[0.04] dark:bg-white/[0.05]
    border border-black/[0.10] dark:border-white/[0.10]
    text-[#1D1D1F] dark:text-[#F5F5F7]
    placeholder-[#AEAEB2] dark:placeholder-[#6E6E73]
    focus:border-[#0071E3] dark:focus:border-[#2997FF]
    focus:bg-black/[0.02] dark:focus:bg-white/[0.07]
  `;

  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-5 py-10 transition-colors duration-300 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[50%] rounded-full bg-[#0071E3]/[0.06] dark:bg-[#2997FF]/[0.08] blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[35%] h-[45%] rounded-full bg-[#FF4A00]/[0.05] dark:bg-[#FF4A00]/[0.07] blur-[90px]" />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-5 right-5 p-2.5 rounded-full bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white transition-colors z-10"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <motion.div
        className="w-full max-w-[400px] relative z-10"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 text-center">
          <Logo size={64} className="mb-4" />
          <h1 className="text-[1.8rem] font-black tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
            Bienvenido de vuelta
          </h1>
          <p className="text-[14px] text-[#86868B] dark:text-[#A1A1A6]">
            Inicia sesión en tu cuenta
          </p>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 rounded-2xl bg-red-500/[0.07] border border-red-500/20 text-red-500 dark:text-red-400 text-[13px] text-center font-medium"
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="Correo electrónico"
            required
            autoComplete="email"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass + ' pr-12'}
              placeholder="Contraseña"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#AEAEB2] dark:text-[#6E6E73] hover:text-[#86868B] dark:hover:text-[#A1A1A6] transition-colors select-none"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <div className="flex justify-end px-1">
            <Link to="/recuperar-contrasena" className="text-[12.5px] text-[#0071E3] dark:text-[#2997FF] hover:underline font-semibold transition-all">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3.5 mt-2 bg-[#0071E3] dark:bg-[#2997FF] text-white rounded-full text-[15px] font-bold hover:bg-[#0077ED] dark:hover:bg-[#40A9FF] transition-all duration-200 hover:shadow-[0_0_28px_rgba(0,113,227,0.3)] dark:hover:shadow-[0_0_28px_rgba(41,151,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="inline-block">⏳</motion.span>
                Iniciando sesión...
              </span>
            ) : 'Iniciar sesión'}
          </motion.button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
          <span className="text-[12px] text-[#AEAEB2] dark:text-[#6E6E73] font-medium">o</span>
          <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
        </div>

        <p className="text-center text-[14px] text-[#86868B] dark:text-[#A1A1A6]">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-[#0071E3] dark:text-[#2997FF] font-semibold hover:underline transition-colors">
            Regístrate gratis
          </Link>
        </p>

        <p className="text-center mt-6 text-[12px] text-[#AEAEB2] dark:text-[#6E6E73]">
          Tus datos se procesan con encriptación segura.
        </p>
      </motion.div>
    </div>
  );
}
