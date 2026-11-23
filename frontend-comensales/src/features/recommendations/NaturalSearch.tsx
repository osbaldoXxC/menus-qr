import { useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { recommendationService as globalService } from './recommendationService';
import { recommendationService as restaurantService } from '../../services/recommendation';
import type { RecommendationResponse } from '../../services/recommendationContract';
import { comensalAuthService, formatMexicoRenewalDate } from '../../services/comensalAuth';
import type { ComensalQuota, ComensalUser } from '../../services/comensalAuth';
import { ComensalAuthModal } from '../../components/ComensalAuthModal';
import type { AuthModalMode } from '../../components/ComensalAuthModal';
import { ThemeContext } from '../../context/ThemeContext';
import { Logo } from '../../pages/components/Logo';
import { BouncyLoadingScreen } from './BouncyLoadingScreen';
import { DescubrirResultados } from './DescubrirResultados';
import { formatMenuPrice } from './formatMenuPrice';
import { createSearchFlow } from './searchFlow';
import type { SearchState } from './searchFlow';

type Props = { restaurantId?: string; initialText?: string };

function generateIntentKey() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function NaturalSearch({ restaurantId, initialText = '' }: Props) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [text, setText] = useState(initialText);
  const latestText = useRef(text);
  const [state, setState] = useState<SearchState>({ phase: 'idle' });
  const [user, setUser] = useState<ComensalUser | null>(null);
  const [quota, setQuota] = useState<ComensalQuota | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const flow = useRef<ReturnType<typeof createSearchFlow> | null>(null);
  const intentKeyRef = useRef<string>(generateIntentKey());
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const loading = state.phase === 'loading';

  useEffect(() => { latestText.current = text; }, [text]);

  useEffect(() => {
    let active = true;
    const savedDraft = comensalAuthService.consumePendingCravingDraft();
    if (savedDraft && !initialText) {
      setText(savedDraft);
    }
    comensalAuthService.getSession().then((session) => {
      if (!active) return;
      if (session) {
        setUser(session.user);
        setQuota(session.quota);
      }
      setAuthChecked(true);
    }).catch(() => {
      if (active) setAuthChecked(true);
    });
    return () => { active = false; };
  }, [initialText]);

  useEffect(() => {
    const controller = createSearchFlow(message => {
      const request = {
        craving: { text: message, tags: [] },
        requestKey: intentKeyRef.current
      };
      return restaurantId
        ? restaurantService.getRecommendations(restaurantId, request)
        : globalService.getGlobalRecommendations(request);
    }, (nextState) => {
      setState(nextState);
      if (nextState.phase === 'success' || nextState.phase === 'no_verified_results') {
        const nextQuota = (nextState.response.meta as typeof nextState.response.meta & { quota?: ComensalQuota })?.quota;
        if (nextQuota) setQuota(nextQuota);
      } else if (nextState.phase === 'error') {
        if (nextState.quota) setQuota(nextState.quota);
        if (nextState.errorCode === 'AUTH_REQUIRED') {
          comensalAuthService.savePendingCravingDraft(latestText.current);
          setUser(null);
          setSessionExpiredNotice(true);
          setAuthModalMode('login');
          setAuthModalOpen(true);
        }
      }
    }, 1500);
    flow.current = controller;
    setState({ phase: 'idle' });
    return () => { controller.dispose(); if (flow.current === controller) flow.current = null; };
  }, [restaurantId]);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await flow.current?.search(text);
  }

  function handleAuthenticated(session: { user: ComensalUser; quota: ComensalQuota }) {
    setUser(session.user);
    setQuota(session.quota);
    setAuthModalOpen(false);
    setSessionExpiredNotice(false);
    const restored = comensalAuthService.consumePendingCravingDraft();
    if (restored && !text.trim()) {
      setText(restored);
    }
    if (state.phase === 'error' && state.errorCode === 'AUTH_REQUIRED') {
      intentKeyRef.current = generateIntentKey();
      flow.current?.edit();
    }
    // Focus submit button so the user triggers the search with an explicit action (never auto-fire!)
    setTimeout(() => {
      submitButtonRef.current?.focus();
    }, 40);
  }

  async function handleLogout() {
    await comensalAuthService.logout().catch(() => {});
    setUser(null);
    setQuota(null);
    flow.current?.edit();
  }

  if (state.phase === 'success') {
    return <DescubrirResultados response={state.response} embedded={!!restaurantId} onRefine={() => {
      intentKeyRef.current = generateIntentKey();
      flow.current?.edit();
    }} />;
  }

  const quotaExhausted = !!(quota && !quota.isPaid && quota.remaining !== null && quota.remaining <= 0);

  return <div className={`${restaurantId ? '' : 'min-h-screen'} bg-[#FCF5EF] dark:bg-[#15110F] text-[#1D1D1F] dark:text-[#F5F5F7] font-sans flex flex-col relative overflow-hidden transition-colors duration-500`}>
    {!restaurantId && <header className="w-full border-b border-black/[0.06] dark:border-white/[0.06] backdrop-blur-xl bg-white/80 dark:bg-black/80 sticky top-0 z-30 transition-colors duration-300">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8 flex items-center justify-between h-[60px]">
        <Link to="/" className="flex items-center gap-2 select-none group rounded-lg focus-visible:ring-2 focus-visible:ring-[#FF4A00]" aria-label="Ir a la página principal de comensales">
          <Logo size={22} className="group-hover:rotate-12 transition-transform duration-300" />
          <span className="text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">MexxicanMX</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs font-semibold text-[#514B48] dark:text-[#E6D9D0]">
                Hola, {user.nombre.split(' ')[0]}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#E9DFD8] dark:border-[#57463B] bg-[#F6F1ED] dark:bg-[#392B24] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#EFE6DF] transition-colors focus-visible:ring-2 focus-visible:ring-[#FF4A00]"
              >
                Cerrar sesión
              </button>
            </div>
          ) : authChecked ? (
            <button
              type="button"
              onClick={() => {
                comensalAuthService.savePendingCravingDraft(text);
                setAuthModalMode('login');
                setAuthModalOpen(true);
              }}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#FFAD62] text-[#1D1D1F] hover:bg-[#FFA04A] transition-colors focus-visible:ring-2 focus-visible:ring-[#FF4A00]"
            >
              Iniciar sesión
            </button>
          ) : null}
          <button type="button" onClick={toggleTheme} aria-label="Alternar tema claro y oscuro"
            className="p-2 text-[#86868B] hover:text-[#1D1D1F] dark:text-[#A1A1A6] dark:hover:text-white rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#FF4A00]">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute left-1/2 top-1/2 h-[440px] w-[min(90vw,620px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF8C35]/[0.38] blur-[100px] dark:bg-[#FF8C00]/[0.18]" /></div>
    <main className="w-full max-w-[526px] mx-auto px-4 py-8 sm:py-14 flex-1 flex flex-col justify-center z-10">
      <div className="w-full bg-white dark:bg-[#201C1A] rounded-[22px] p-6 sm:p-[38px] shadow-[0_24px_60px_-24px_rgba(158,89,36,0.35)] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] border border-[#F5DDCA] dark:border-white/[0.10] relative transition-colors duration-300">
      <div className="space-y-5">
      <header className="text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFE2C3] text-[32px] shadow-[0_8px_18px_rgba(230,145,68,0.2)] select-none dark:bg-[#5C3824]" aria-hidden="true">😋</span>
        <h1 className="text-2xl sm:text-[28px] font-black text-[#1D1D1F] dark:text-white tracking-tight">¿Qué se te antoja hoy?</h1>
        <p className="text-[13px] sm:text-sm font-normal text-[#626267] dark:text-[#CAC3BE] mt-2 leading-relaxed">Cuéntanos qué quieres comer. Puedes mencionar sabores, ingredientes que no quieres o cuánto deseas gastar.</p>
      </header>
      {quota && (
        <div
          role="status"
          aria-live="polite"
          data-testid="comensal-quota-banner"
          className={`rounded-xl border px-3.5 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 ${
            quota.isPaid
              ? 'border-[#D4A373] bg-[#FFF8F0] dark:bg-[#3A2A1E] text-[#7A3E00] dark:text-[#FFD1A6]'
              : quotaExhausted
                ? 'border-red-700 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200'
                : 'border-[#E9DFD8] dark:border-[#57463B] bg-[#F6F1ED] dark:bg-[#392B24] text-[#514B48] dark:text-[#E6D9D0]'
          }`}
        >
          {quota.isPaid ? (
            <span className="font-bold">✨ Plan de pago activo · Recomendaciones sin cuota semanal</span>
          ) : (
            <>
              <span className="font-bold">
                Usos disponibles: {quota.remaining} de {quota.limit ?? 5}
              </span>
              <span className="text-[11px] opacity-90">
                Se renueva {formatMexicoRenewalDate(quota.resetsAt)}
              </span>
            </>
          )}
        </div>
      )}
      <div aria-label="Ejemplos de lo que puedes escribir" className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#514B48] dark:text-[#E6D9D0]">
        <span className="sr-only">Ejemplos: </span>
        <span className="rounded-full border border-[#E9DFD8] bg-[#F6F1ED] px-3 py-1.5 dark:border-[#57463B] dark:bg-[#392B24]">🌶️ Picante</span>
        <span className="rounded-full border border-[#E9DFD8] bg-[#F6F1ED] px-3 py-1.5 dark:border-[#57463B] dark:bg-[#392B24]">💰 Menos de $150</span>
        <span className="rounded-full border border-[#E9DFD8] bg-[#F6F1ED] px-3 py-1.5 dark:border-[#57463B] dark:bg-[#392B24]">🌿 Sin cilantro</span>
      </div>
      <form onSubmit={search} className="space-y-5" aria-busy={loading}>
        <div>
        <label htmlFor="natural-search-message" className="mb-2 block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">Tu antojo</label>
        <div className="relative">
        <textarea id="natural-search-message" value={text} onChange={e => {
          intentKeyRef.current = generateIntentKey();
          flow.current?.edit();
          setText(e.target.value);
        }} required maxLength={500} rows={3} aria-describedby="natural-search-count"
          placeholder="Ej. Quiero algo picoso sin puerco, y tengo 100 pesos."
          className="block w-full min-h-[100px] bg-[#F8F8F8] dark:bg-white/[0.05] border border-black/[0.12] dark:border-white/[0.18] rounded-xl px-4 pt-3 pb-7 text-base leading-relaxed text-[#1D1D1F] dark:text-white placeholder-[#626267] dark:placeholder-[#B8B8BE] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#C43800] dark:focus:outline-[#FFAD80] resize-y transition-colors" />
        <span id="natural-search-count" className="pointer-events-none absolute bottom-2 right-3 text-xs text-[#656065] dark:text-[#C8BDB6]">{text.length}/500 <span className="sr-only">caracteres</span></span>
        </div>
        </div>
        <button ref={submitButtonRef} type="submit" disabled={loading || !text.trim() || quotaExhausted} className="w-full min-h-[48px] py-3 px-6 rounded-xl bg-[#FFAD62] text-[#1D1D1F] font-extrabold text-[15px] shadow-[0_8px_18px_rgba(230,145,68,0.2)] hover:bg-[#FFA04A] active:bg-[#F4933B] transition-[background-color,box-shadow] motion-reduce:transition-none text-center disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B3000] dark:focus-visible:outline-[#FFAD80]">
          {loading ? 'Buscando…' : <><span aria-hidden="true" className="mr-2">🌶️</span>Buscar platillos</>}
        </button>
      </form>
      <SearchNotice loading={false} error={state.phase === 'error' ? state.message : ''} />
      {state.phase === 'no_verified_results' && <SearchResults result={state.response} />}
      </div>
      </div>
    </main>
    {loading && <BouncyLoadingScreen isReady={false} showSpacyStatus={false} />}
    <ComensalAuthModal
      isOpen={authModalOpen}
      initialMode={authModalMode}
      pendingCravingText={text}
      sessionExpiredNotice={sessionExpiredNotice}
      onClose={() => setAuthModalOpen(false)}
      onAuthenticated={handleAuthenticated}
    />
  </div>;
}

export function SearchNotice({ loading, error }: { loading: boolean; error: string }) {
  return <>
    {loading && <p role="status" className="text-sm">Buscando platillos con los datos disponibles…</p>}
    {error && <p role="alert" className="rounded-xl border border-red-700 px-4 py-3 text-red-900 dark:text-red-200">{error}</p>}
  </>;
}

export function SearchResults({ result }: { result: RecommendationResponse }) {
  return <section aria-labelledby="search-results-heading" className="space-y-4">
        <h2 id="search-results-heading" className="text-2xl font-bold">{result.status.code === 'no_verified_results' ? 'Sin resultados verificables' : 'Platillos encontrados'}</h2>
        {result.status.code === 'no_verified_results' && <p role="status">No encontramos platillos cuya compatibilidad podamos verificar para tu solicitud. Puedes cambiar el mensaje e intentarlo de nuevo.</p>}
        {result.safety.hasUnverifiableRestrictions && <p>Parte de la información necesaria no pudo verificarse con los datos disponibles.</p>}
        <p className="text-sm text-[#514B48] dark:text-[#D6CECA]">{result.safety.disclaimer}</p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.recommendations.map(item => <li key={`${item.restaurant.id}:${item.dish.id}`} className="overflow-hidden rounded-2xl border border-[#D5C9C3] dark:border-[#564E4A] bg-white dark:bg-[#242120] shadow-sm">
            {item.dish.url_imagen && <img src={item.dish.url_imagen} alt="" loading="lazy" className="h-44 w-full object-cover" />}
            <article className="space-y-2 p-5">
              <h3 className="text-lg font-bold">{item.dish.nombre}</h3>
              {item.restaurant.name && <p className="text-sm">{item.restaurant.name}</p>}
              {item.dish.descripcion && <p className="text-sm text-[#514B48] dark:text-[#D6CECA]">{item.dish.descripcion}</p>}
              <p className="font-semibold">{formatMenuPrice(item.dish.precio)}</p>
              {item.reasons.map((reason, index) => <p key={index} className="text-sm">{reason}</p>)}
              <p className="text-xs text-[#514B48] dark:text-[#D6CECA]">{item.safety.disclaimer}</p>
              {item.restaurant.menuUrl && <a href={item.restaurant.menuUrl} className="inline-block rounded text-sm font-semibold text-[#9F3100] dark:text-[#FFA981] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Ver menú</a>}
            </article>
          </li>)}
        </ul>
  </section>;
}
