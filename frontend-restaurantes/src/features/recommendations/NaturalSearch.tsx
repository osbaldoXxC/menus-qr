import { useRef, useState } from 'react';
import { recommendationService as globalService } from './recommendationService';
import { recommendationService as restaurantService } from '../../services/recommendation';
import type { RecommendationResponse } from '../../services/recommendationContract';

type Props = { restaurantId?: string; initialText?: string };

export function NaturalSearch({ restaurantId, initialText = '' }: Props) {
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const sequence = useRef(0);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message) { setError('Escribe qué se te antoja antes de buscar.'); return; }
    if (message.length > 500) { setError('Tu mensaje debe tener como máximo 500 caracteres.'); return; }
    const current = ++sequence.current;
    setLoading(true); setError(''); setResult(null);
    try {
      const request = { craving: { text: message, tags: [] } };
      const response = restaurantId
        ? await restaurantService.getRecommendations(restaurantId, request)
        : await globalService.getGlobalRecommendations(request);
      if (sequence.current === current) setResult(response);
    } catch (_) {
      if (sequence.current === current) setError('No pudimos buscar platillos. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      if (sequence.current === current) setLoading(false);
    }
  }

  return <main className="min-h-screen bg-[#FAF8F6] dark:bg-[#141414] text-[#26211F] dark:text-[#F6F2EF] px-4 py-10 sm:px-6 sm:py-16">
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-bold uppercase tracking-widest text-[#9F3100] dark:text-[#FFA981]">MexxicanMX</p>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">¿Qué se te antoja hoy?</h1>
        <p className="max-w-2xl text-base sm:text-lg text-[#514B48] dark:text-[#D6CECA]">Cuéntanos qué quieres comer. Puedes mencionar sabores, ingredientes que no quieres o cuánto deseas gastar.</p>
      </header>
      <form onSubmit={search} className="space-y-4" aria-busy={loading}>
        <label htmlFor="natural-search-message" className="block text-sm font-semibold">Tu mensaje</label>
        <textarea id="natural-search-message" value={text} onChange={e => {
          sequence.current += 1; setText(e.target.value); setResult(null); setError(''); setLoading(false);
        }} required maxLength={500} rows={4}
          placeholder="Ej. Quiero algo picoso sin puerco, y tengo 100 pesos"
          className="block w-full resize-y rounded-2xl border border-[#B9ACA5] dark:border-[#716761] bg-white dark:bg-[#242120] px-4 py-4 text-base shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A33400] dark:focus-visible:outline-[#FFB18C]" />
        <button type="submit" disabled={loading || !text.trim()} className="w-full sm:w-auto rounded-full bg-[#A33400] px-8 py-3.5 font-bold text-white hover:bg-[#812900] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A33400] dark:focus-visible:outline-[#FFB18C]">
          {loading ? 'Buscando…' : 'Buscar platillos'}
        </button>
      </form>
      <SearchNotice loading={loading} error={error} />
      {result && <SearchResults result={result} />}
    </div>
  </main>;
}

export function SearchNotice({ loading, error }: { loading: boolean; error: string }) {
  return <>
    {loading && <p role="status" className="text-sm">Buscando platillos con los datos disponibles…</p>}
    {error && <p role="alert" className="rounded-xl border border-red-700 px-4 py-3 text-red-900 dark:text-red-200">{error}</p>}
  </>;
}

export function SearchResults({ result }: { result: RecommendationResponse }) {
  return <section aria-labelledby="search-results-heading" className="space-y-4">
        <h2 id="search-results-heading" className="text-2xl font-bold">{result.recommendations.length ? 'Platillos encontrados' : 'Sin resultados verificables'}</h2>
        {!result.recommendations.length && <p role="status">No encontramos platillos cuya compatibilidad podamos verificar para tu solicitud. Puedes cambiar el mensaje e intentarlo de nuevo.</p>}
        {result.safety.hasUnverifiableRestrictions && <p>Parte de la información necesaria no pudo verificarse con los datos disponibles.</p>}
        <p className="text-sm text-[#514B48] dark:text-[#D6CECA]">{result.safety.disclaimer}</p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.recommendations.map(item => <li key={`${item.restaurant.id}:${item.dish.id}`} className="overflow-hidden rounded-2xl border border-[#D5C9C3] dark:border-[#564E4A] bg-white dark:bg-[#242120] shadow-sm">
            {item.dish.url_imagen && <img src={item.dish.url_imagen} alt="" loading="lazy" className="h-44 w-full object-cover" />}
            <article className="space-y-2 p-5">
              <h3 className="text-lg font-bold">{item.dish.nombre}</h3>
              {item.restaurant.name && <p className="text-sm">{item.restaurant.name}</p>}
              {item.dish.descripcion && <p className="text-sm text-[#514B48] dark:text-[#D6CECA]">{item.dish.descripcion}</p>}
              {item.safety.priceVerified === true && typeof item.dish.precio === 'number' && <p className="font-semibold">${item.dish.precio.toFixed(2)} MXN</p>}
              {item.reasons.map((reason, index) => <p key={index} className="text-sm">{reason}</p>)}
              <p className="text-xs text-[#514B48] dark:text-[#D6CECA]">{item.safety.disclaimer}</p>
              {item.restaurant.menuUrl && <a href={item.restaurant.menuUrl} className="inline-block rounded text-sm font-semibold text-[#9F3100] dark:text-[#FFA981] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Ver menú</a>}
            </article>
          </li>)}
        </ul>
  </section>;
}
