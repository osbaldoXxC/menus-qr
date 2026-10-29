import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { ThemeContext } from '../../context/ThemeContext';

export function Register() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nombre_dueño: '',
    email: '',
    password: '',
    nombre_negocio: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', formData);
      navigate('/verify-email', { state: { email: formData.email } });
    } catch (err: any) {
      setError(err.response?.data?.mensaje || err.response?.data?.error || 'Error al registrar. Intenta de nuevo.');
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
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[50%] rounded-full bg-[#0071E3]/[0.06] dark:bg-[#2997FF]/[0.08] blur-[110px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[45%] rounded-full bg-[#FF4A00]/[0.05] dark:bg-[#FF4A00]/[0.07] blur-[90px]" />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-5 right-5 p-2.5 rounded-full bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white transition-colors z-10"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <motion.div
        className="w-full max-w-[440px] relative z-10"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            className="text-5xl mb-5 inline-block"
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, -8, 8, 0] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            🍽️
          </motion.div>
          <h1 className="text-[1.8rem] font-black tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] mb-2">
            Registra tu restaurante
          </h1>
          <p className="text-[14px] text-[#86868B] dark:text-[#A1A1A6]">
            Únete a 500+ restaurantes que ya usan MexxicanMX
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
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              type="text"
              value={formData.nombre_dueño}
              onChange={(e) => setFormData({ ...formData, nombre_dueño: e.target.value })}
              className={inputClass}
              placeholder="Tu nombre"
              required
              autoComplete="name"
            />
            <input
              type="text"
              value={formData.nombre_negocio}
              onChange={(e) => setFormData({ ...formData, nombre_negocio: e.target.value })}
              className={inputClass}
              placeholder="Nombre del restaurante"
              required
            />
          </div>

          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={inputClass}
            placeholder="Correo electrónico"
            required
            autoComplete="email"
          />

          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className={inputClass}
            placeholder="Contraseña"
            required
            autoComplete="new-password"
          />

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3.5 mt-1 bg-[#0071E3] dark:bg-[#2997FF] text-white rounded-full text-[15px] font-bold hover:bg-[#0077ED] dark:hover:bg-[#40A9FF] transition-all duration-200 hover:shadow-[0_0_28px_rgba(0,113,227,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="inline-block">⏳</motion.span>
                Registrando...
              </span>
            ) : 'Crear cuenta gratis'}
          </motion.button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
          <span className="text-[12px] text-[#AEAEB2] dark:text-[#6E6E73] font-medium">o</span>
          <div className="flex-1 h-px bg-black/[0.08] dark:bg-white/[0.08]" />
        </div>

        <p className="text-center text-[14px] text-[#86868B] dark:text-[#A1A1A6]">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-[#0071E3] dark:text-[#2997FF] font-semibold hover:underline transition-colors">
            Inicia sesión
          </Link>
        </p>

        <p className="text-center mt-5 text-[12px] text-[#AEAEB2] dark:text-[#6E6E73]">
          Al registrarte aceptas nuestros términos y política de privacidad.
        </p>
      </motion.div>
    </div>
  );
}
