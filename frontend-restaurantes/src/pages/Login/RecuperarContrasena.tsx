import { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../../services/auth';
import { ThemeContext } from '../../context/ThemeContext';
import { Logo } from '../components/Logo';

export function RecuperarContrasena() {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Paso 1: Solicitar código OTP de recuperación
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('El correo electrónico es requerido.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await authService.forgotPassword(email);
      setSuccess('Si el correo está registrado, recibirás un código OTP de 6 dígitos.');
      setCooldown(60);
      // Avanzar al siguiente paso después de una breve pausa
      setTimeout(() => {
        setStep('reset');
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.mensaje || 'Error al enviar la solicitud de recuperación.');
    } finally {
      setLoading(false);
    }
  };

  // Reenviar OTP desde el paso de restablecimiento
  const handleResendOtp = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await authService.forgotPassword(email);
      setSuccess('Se ha enviado un nuevo código OTP a tu correo.');
      setCooldown(60);
    } catch (err: any) {
      setError(err.response?.data?.mensaje || 'Error al reenviar el código.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: Restablecer contraseña con el código OTP
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo || !newPassword || !confirmPassword) {
      setError('Todos los campos son requeridos.');
      return;
    }
    if (codigo.length !== 6) {
      setError('El código OTP debe ser de 6 dígitos.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await authService.resetPassword({ email, codigo, newPassword });
      setSuccess('¡Contraseña restablecida con éxito! Redirigiéndote al inicio de sesión...');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.mensaje || 'El código es incorrecto o ha expirado.');
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
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[50%] rounded-full bg-[#FF3B30]/[0.05] dark:bg-[#FF453A]/[0.06] blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[35%] h-[45%] rounded-full bg-[#0071E3]/[0.05] dark:bg-[#2997FF]/[0.06] blur-[90px]" />
      </div>

      <motion.div
        className="w-full max-w-[400px] relative z-10"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <Logo size={64} className="mb-4" />
          <h1 className="text-[1.7rem] font-black tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] mb-1">
            {step === 'request' ? 'Recupera tu contraseña' : 'Crea tu nueva contraseña'}
          </h1>
          <p className="text-[13.5px] text-[#86868B] dark:text-[#A1A1A6] max-w-[320px]">
            {step === 'request' 
              ? 'Ingresa tu correo electrónico registrado y te enviaremos un código OTP para restablecer tu cuenta.' 
              : `Ingresa el código OTP enviado a ${email} y tu nueva contraseña.`}
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

        {/* Formularios */}
        <AnimatePresence mode="wait">
          {step === 'request' ? (
            <motion.form
              key="request-form"
              onSubmit={handleRequestOtp}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="Correo electrónico registrado"
                required
                autoComplete="email"
                disabled={loading}
              />

              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 mt-2 bg-[#0071E3] dark:bg-[#2997FF] text-white rounded-full text-[15px] font-bold hover:bg-[#0077ED] dark:hover:bg-[#40A9FF] transition-all duration-200 disabled:opacity-50"
              >
                {loading ? 'Enviando código...' : 'Enviar Código OTP'}
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="reset-form"
              onSubmit={handleResetPassword}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider ml-1">Código OTP de 6 dígitos</label>
                <input
                  type="text"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-5 py-3.5 rounded-2xl text-[15px] outline-none bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.10] dark:border-white/[0.10] text-[#1D1D1F] dark:text-[#F5F5F7] text-center tracking-[0.2em] font-mono font-bold text-lg"
                  placeholder="000000"
                  required
                  disabled={loading}
                />
              </div>

              <div className="relative space-y-1">
                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider ml-1">Nueva Contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass + ' pr-12'}
                  placeholder="Mínimo 6 caracteres"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-8 text-[#AEAEB2] dark:text-[#6E6E73] hover:text-[#86868B]"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider ml-1">Confirmar Nueva Contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Repite la contraseña"
                  required
                  disabled={loading}
                />
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 mt-4 bg-[#FF3B30] dark:bg-[#FF453A] text-white rounded-full text-[15px] font-bold hover:bg-[#E02B20] dark:hover:bg-[#FF5C52] transition-all duration-200 disabled:opacity-50"
              >
                {loading ? 'Restableciendo...' : 'Restablecer Contraseña'}
              </motion.button>

              <div className="flex justify-between items-center text-[12px] pt-2 px-1">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                >
                  ← Cambiar correo
                </button>
                
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={cooldown > 0 || loading}
                  className="text-[#0071E3] dark:text-[#2997FF] font-semibold disabled:opacity-50"
                >
                  {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Link a Login */}
        <div className="mt-8 text-center">
          <Link to="/login" className="text-[14px] text-[#0071E3] dark:text-[#2997FF] font-semibold hover:underline transition-colors">
            Volver al inicio de sesión
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
