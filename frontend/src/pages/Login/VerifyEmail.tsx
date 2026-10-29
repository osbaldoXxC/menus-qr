import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authService } from '../../services/auth';
import { ThemeContext } from '../../context/ThemeContext';
import { Logo } from '../components/Logo';

export function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useContext(ThemeContext);
  
  // Obtener el correo del estado de navegación (si fue redirigido desde Registro o Login)
  const emailInicial = location.state?.email || '';
  
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Temporizador para el botón de reenviar código
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('El correo electrónico es requerido.');
      return;
    }
    if (codigo.length !== 6) {
      setError('El código de verificación debe tener 6 dígitos.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await authService.verifyEmail(email, codigo);
      setSuccess('¡Cuenta verificada con éxito! Redirigiéndote al inicio de sesión...');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.mensaje || 'El código ingresado es incorrecto o ha expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Ingresa tu correo electrónico para reenviar el código.');
      return;
    }
    setResending(true);
    setError('');
    setSuccess('');
    try {
      await authService.resendVerification(email);
      setSuccess('Se ha enviado un nuevo código OTP a tu correo.');
      setCooldown(60); // Iniciar cooldown de 60 segundos
    } catch (err: any) {
      setError(err.response?.data?.mensaje || 'Error al reenviar el código de verificación.');
    } finally {
      setResending(false);
    }
  };

  const inputClass = `
    w-full px-5 py-3.5 rounded-2xl text-[15px] outline-none transition-all duration-200 text-center tracking-[0.2em] font-mono font-bold text-lg
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
            Verifica tu cuenta
          </h1>
          <p className="text-[14px] text-[#86868B] dark:text-[#A1A1A6] max-w-[320px]">
            Ingresa tu correo y el código OTP de 6 dígitos que te enviamos por correo electrónico.
          </p>
        </div>

        {/* Mensaje de error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 rounded-2xl bg-red-500/[0.07] border border-red-500/20 text-red-500 dark:text-red-400 text-[13px] text-center font-medium"
          >
            {error}
          </motion.div>
        )}

        {/* Mensaje de éxito */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 rounded-2xl bg-green-500/[0.07] border border-green-500/20 text-green-600 dark:text-green-400 text-[13px] text-center font-medium"
          >
            {success}
          </motion.div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider ml-1">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3 rounded-2xl text-[14px] outline-none bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] text-[#1D1D1F] dark:text-[#F5F5F7]"
              placeholder="correo@ejemplo.com"
              required
              disabled={loading || !!emailInicial}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider ml-1">Código OTP</label>
            <input
              type="text"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              className={inputClass}
              placeholder="000000"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3.5 mt-4 bg-[#0071E3] dark:bg-[#2997FF] text-white rounded-full text-[15px] font-bold hover:bg-[#0077ED] dark:hover:bg-[#40A9FF] transition-all duration-200 hover:shadow-[0_0_28px_rgba(0,113,227,0.3)] dark:hover:shadow-[0_0_28px_rgba(41,151,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verificando...' : 'Verificar Código'}
          </motion.button>
        </form>

        {/* Reenviar Código */}
        <div className="mt-8 text-center">
          <p className="text-[13px] text-[#86868B] dark:text-[#A1A1A6]">
            ¿No recibiste el código?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="text-[#0071E3] dark:text-[#2997FF] font-semibold hover:underline disabled:opacity-50 disabled:no-underline transition-all"
            >
              {cooldown > 0 ? `Reenviar en ${cooldown}s` : resending ? 'Enviando...' : 'Reenviar OTP'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
