import type { RecommendationResponse } from '../../services/recommendationContract';

export type SearchState =
  | { phase: 'idle' | 'loading' }
  | { phase: 'success' | 'no_verified_results'; response: RecommendationResponse }
  | { phase: 'error'; message: string };

type SearchRequest = (message: string) => Promise<RecommendationResponse>;

function responseState(response: RecommendationResponse): SearchState {
  if (response.status.code === 'no_verified_results' && response.recommendations.length === 0) {
    return { phase: 'no_verified_results', response };
  }
  if (['ok', 'partial_results_sanitized'].includes(response.status.code) && response.recommendations.length > 0) {
    return { phase: 'success', response };
  }
  return { phase: 'error', message: 'El servicio devolvió una respuesta inesperada. Inténtalo de nuevo.' };
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error && (error as { response?: unknown }).response) {
    return 'El servicio no pudo completar la búsqueda. Inténtalo de nuevo.';
  }
  return 'No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.';
}

// State is held here synchronously to prevent duplicate submissions before a
// React rerender. Each edit invalidates any response already in flight.
export function createSearchFlow(request: SearchRequest, publish: (state: SearchState) => void, minDisplayMs = 0) {
  let state: SearchState = { phase: 'idle' };
  let sequence = 0;
  let disposed = false;
  let cancelDelay: (() => void) | undefined;
  function update(next: SearchState) { state = next; if (!disposed) publish(next); }
  function edit() { if (!disposed) { sequence += 1; cancelDelay?.(); update({ phase: 'idle' }); } }
  function dispose() { disposed = true; sequence += 1; cancelDelay?.(); }
  async function search(text: string) {
    if (disposed || state.phase === 'loading') return;
    const message = text.trim();
    if (!message) { update({ phase: 'error', message: 'Escribe qué se te antoja antes de buscar.' }); return; }
    if (message.length > 500) { update({ phase: 'error', message: 'Tu mensaje debe tener como máximo 500 caracteres.' }); return; }
    const current = ++sequence;
    update({ phase: 'loading' });
    const minimum = new Promise<void>(resolve => {
      const timer = setTimeout(resolve, minDisplayMs);
      cancelDelay = () => { clearTimeout(timer); resolve(); };
    });
    try {
      const response = await request(message);
      await minimum;
      if (!disposed && current === sequence) update(responseState(response));
    } catch (error) {
      if (current === sequence) cancelDelay?.();
      if (!disposed && current === sequence) update({ phase: 'error', message: errorMessage(error) });
    }
  }
  return { search, edit, dispose, getState: () => state };
}
