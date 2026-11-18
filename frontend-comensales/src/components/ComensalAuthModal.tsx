import { useEffect, useRef, useState } from 'react';
import { comensalAuthService } from '../services/comensalAuth';
import type { ComensalSessionResponse } from '../services/comensalAuth';

export type AuthModalMode = 'login' | 'register' | 'forgot' | 'reset';

interface Props {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  pendingCravingText?: string;
  sessionExpiredNotice?: boolean;
  onClose: () => void;
  onAuthenticated: (session: ComensalSessionResponse) => void;
}

export function ComensalAuthModal({
  isOpen,
  initialMode = 'login',
  pendingCravingText = '',
  sessionExpiredNotice = false,
  onClose,
  onAuthenticated
}: Props) {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setErrorCode('');
    setInfoMessage(sessionExpiredNotice ? 'Tu sesión expiró. Inicia sesión nuevamente para conservar tu antojo.' : '');
  }, [initialMode, isOpen, sessionExpiredNotice]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      firstInputRef.current?.focus();
    }, 30);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Crucial for SSR / r4-components.test.cjs: return null when closed so no extra <form> or submit button is mounted
  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode('');
    setInfoMessage('');

    try {
      if (mode === 'login') {
        const session = await comensalAuthService.login(email, password);
        onAuthenticated(session);
        return;
      }
      if (mode === 'register') {
        const session = await comensalAuthService.register(nombre, email, password);
        onAuthenticated(session);
        return;
      }
      if (mode === 'forgot') {
        const res = await comensalAuthService.forgotPassword(email);
        setInfoMessage(res.mensaje);
        setMode('reset');
        return;
      }
      if (mode === 'reset') {
        const res = await comensalAuthService.resetPassword(email, otpCode, password);
        setInfoMessage(res.mensaje);
        setPassword('');
        setOtpCode('');
        setMode('login');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code || '';
      const serverMsg = err?.response?.data?.mensaje;
      setErrorCode(code);
      if (!err?.response) {
        setError('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
      } else if (status === 423 || code === 'ACCOUNT_LOCKED') {
        setError(serverMsg || 'Tu cuenta está bloqueada temporalmente por seguridad. Intenta más tarde.');
      } else if (status === 401 || code === 'INVALID_CREDENTIALS') {
        setError(serverMsg || 'Correo o contraseña incorrectos.');
      } else {
        setError(serverMsg || 'No fue posible procesar tu solicitud. Revisa los datos e inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-200 motion-reduce:transition-none"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <dialog
        ref={dialogRef}
        open
        aria-modal="true"
        aria-labelledby="comensal-auth-modal-title"
        aria-describedby="comensal-auth-modal-desc"
        className="w-full max-w-[440px] rounded-[22px] bg-[#FCF5EF] dark:bg-[#201C1A] text-[#1D1D1F] dark:text-[#F5F5F7] border border-[#F5DDCA] dark:border-white/[0.12] p-6 sm:p-8 shadow-[0_24px_60px_-24px_rgba(158,89,36,0.45)] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)] relative animate-[comensalModalEnter_240ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
      >
        <style>{`
          @keyframes comensalModalEnter {
            from { opacity: 0; transform: translateY(14px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            dialog { animation: none !important; transition: none !important; }
          }
        `}</style>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE2C3] dark:bg-[#5C3824] px-3 py-1 text-xs font-bold text-[#9B3000] dark:text-[#FFAD80]">
              <span aria-hidden="true">🌶️</span> Acceso Comensales
            </span>
            <h2 id="comensal-auth-modal-title" className="text-xl sm:text-2xl font-black tracking-tight mt-2 text-[#1D1D1F] dark:text-white">
              {mode === 'login' && 'Inicia sesión para buscar'}
              {mode === 'register' && 'Crea tu cuenta gratuita'}
              {mode === 'forgot' && 'Recupera tu contraseña'}
              {mode === 'reset' && 'Ingresa tu código de seguridad'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de acceso"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#626267] dark:text-[#CAC3BE] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B3000] dark:focus-visible:outline-[#FFAD80]"
          >
            ✕
          </button>
        </div>

        <p id="comensal-auth-modal-desc" className="text-xs sm:text-sm text-[#626267] dark:text-[#CAC3BE] mb-4 leading-relaxed">
          {mode === 'register'
            ? 'Tu plan gratuito incluye 5 búsquedas útiles con recomendaciones cada semana (lunes a domingo, hora CDMX).'
            : 'Accede con tu cuenta de comensal para consultar tus recomendaciones personalizadas.'}
        </p>

        {pendingCravingText.trim() && (
          <div className="mb-4 rounded-xl border border-[#E9DFD8] dark:border-[#57463B] bg-[#F6F1ED] dark:bg-[#392B24] px-3.5 py-2.5 text-xs text-[#514B48] dark:text-[#E6D9D0]">
            <span className="font-bold block mb-0.5">Antojo guardado (se restaurará al entrar):</span>
            <span className="italic line-clamp-2">“{pendingCravingText.trim()}”</span>
          </div>
        )}

        {infoMessage && (
          <p role="status" className="mb-4 rounded-xl border border-[#D4A373] bg-[#FFF8F0] dark:bg-[#3A2A1E] px-4 py-3 text-xs font-semibold text-[#7A3E00] dark:text-[#FFD1A6]">
            {infoMessage}
          </p>
        )}

        {error && (
          <p role="alert" data-error-code={errorCode} className="mb-4 rounded-xl border border-red-700 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-xs font-semibold text-red-900 dark:text-red-200">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
          {mode === 'register' && (
            <div>
              <label htmlFor="comensal-auth-nombre" className="mb-1.5 block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Tu nombre
              </label>
              <input
                ref={firstInputRef}
                id="comensal-auth-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                placeholder="Ej. Félix García"
                className="block w-full min-h-[44px] rounded-xl bg-white dark:bg-white/[0.06] border border-black/[0.15] dark:border-white/[0.20] px-3.5 py-2.5 text-sm text-[#1D1D1F] dark:text-white placeholder-[#626267] dark:placeholder-[#B8B8BE] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#C43800] dark:focus:outline-[#FFAD80]"
              />
            </div>
          )}

          <div>
            <label htmlFor="comensal-auth-email" className="mb-1.5 block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Correo electrónico
            </label>
            <input
              ref={mode !== 'register' ? firstInputRef : undefined}
              id="comensal-auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              className="block w-full min-h-[44px] rounded-xl bg-white dark:bg-white/[0.06] border border-black/[0.15] dark:border-white/[0.20] px-3.5 py-2.5 text-sm text-[#1D1D1F] dark:text-white placeholder-[#626267] dark:placeholder-[#B8B8BE] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#C43800] dark:focus:outline-[#FFAD80]"
            />
          </div>

          {mode === 'reset' && (
            <div>
              <label htmlFor="comensal-auth-otp" className="mb-1.5 block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Código de verificación (6 dígitos)
              </label>
              <input
                id="comensal-auth-otp"
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                maxLength={6}
                placeholder="123456"
                className="block w-full min-h-[44px] rounded-xl bg-white dark:bg-white/[0.06] border border-black/[0.15] dark:border-white/[0.20] px-3.5 py-2.5 text-sm tracking-widest text-[#1D1D1F] dark:text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#C43800] dark:focus:outline-[#FFAD80]"
              />
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <label htmlFor="comensal-auth-password" className="mb-1.5 block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {mode === 'reset' ? 'Nueva contraseña (mín. 8 caracteres)' : 'Contraseña'}
              </label>
              <input
                id="comensal-auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className="block w-full min-h-[44px] rounded-xl bg-white dark:bg-white/[0.06] border border-black/[0.15] dark:border-white/[0.20] px-3.5 py-2.5 text-sm text-[#1D1D1F] dark:text-white placeholder-[#626267] dark:placeholder-[#B8B8BE] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#C43800] dark:focus:outline-[#FFAD80]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] py-3 px-6 rounded-xl bg-[#FFAD62] text-[#1D1D1F] font-extrabold text-[15px] shadow-[0_8px_18px_rgba(230,145,68,0.25)] hover:bg-[#FFA04A] active:bg-[#F4933B] transition-[background-color,box-shadow] motion-reduce:transition-none text-center disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B3000] dark:focus-visible:outline-[#FFAD80]"
          >
            {loading
              ? 'Validando…'
              : mode === 'login'
                ? 'Iniciar sesión y volver a mi antojo'
                : mode === 'register'
                  ? 'Crear cuenta gratis (5 usos/semana)'
                  : mode === 'forgot'
                    ? 'Enviar código de recuperación'
                    : 'Actualizar contraseña'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#E9DFD8] dark:border-white/[0.10] flex flex-wrap items-center justify-between gap-2 text-xs">
          {mode === 'login' ? (
            <>
              <button
                type="button"
                onClick={() => setMode('register')}
                className="font-bold text-[#9F3100] dark:text-[#FFA981] underline py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                ¿No tienes cuenta? Regístrate gratis
              </button>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-[#626267] dark:text-[#CAC3BE] hover:underline py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="font-bold text-[#9F3100] dark:text-[#FFA981] underline py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              ← Volver a iniciar sesión
            </button>
          )}
        </div>
      </dialog>
    </div>
  );
}
