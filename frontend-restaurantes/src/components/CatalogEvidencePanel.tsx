import { useEffect, useState } from 'react';
import api from '../services/api';

const sections = ['ingredientes_principales', 'ingredientes_secundarios', 'complementos', 'salsas',
  'aderezos', 'condimentos', 'ingredientes_compuestos', 'sustituciones_permitidas', 'modificadores_opcionales'];
type Evidence = { id?: string; confirmacion_id?: string; confirmado_en: string; actor_id: string;
  procedencia: string; revocado_en?: string; motivo_revocacion?: string; grupo?: string;
  version_precio?: string; receta_revision?: string; taxonomia_revision?: string };
interface Snapshot {
  dish: Record<string, any>; recipeVersion: string; catalogFingerprint: string; currencyState: string;
  evidence: { prices: Evidence[]; absences: Evidence[]; taxonomy: Array<{
    grupo: string; version: number; revision: string; terms: Array<{ termino_normalizado: string; relacion: string }> }> };
  exclusions: Array<{ group: string; state: string }>;
}
const control = 'block w-full p-3 border rounded-lg bg-transparent focus-visible:ring-2 focus-visible:ring-orange-700';
const button = 'p-3 border rounded-lg focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-50';
function ingredientLabel(value: any): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return 'Composición desconocida';
  const children = value.subIngredients || value.ingredientes_componentes;
  return `${value.name || value.nombre || 'Ingrediente sin nombre'}${Array.isArray(children) ? ': ' + children.map(ingredientLabel).join(', ') : ''}`;
}
function errorMessage(error: any) {
  const status = error.response?.status;
  if (status === 503) return 'La verificación del catálogo aún no está disponible. Los datos continúan sin confirmar.';
  if (status === 403) return 'Solo el propietario autorizado puede confirmar este catálogo.';
  if (status === 409) return 'Los datos cambiaron. Vuelve a cargar y revisa la versión actual antes de confirmar.';
  if (status === 422) return 'La composición está incompleta o contradice la ausencia solicitada. Corrige la receta antes de confirmar.';
  return 'No se pudo completar la operación. No se ha confirmado el cambio.';
}

/** Review saved data only. Explicit per-section declarations; no bulk auto-check. */
export function CatalogEvidencePanel({ dishId, dirty }: { dishId: string; dirty: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [source, setSource] = useState('');
  const [reviewedPrice, setReviewedPrice] = useState(false);
  const [group, setGroup] = useState('');
  const [declarations, setDeclarations] = useState<Record<string, string>>({});
  const [absenceChecked, setAbsenceChecked] = useState(false);
  const [reason, setReason] = useState('');
  async function load() {
    setBusy(true); setError(''); setSnapshot(null); setReviewedPrice(false);
    setDeclarations({}); setAbsenceChecked(false); setGroup('');
    try { setSnapshot((await api.get(`/menu/platillos/${encodeURIComponent(dishId)}/evidence`)).data); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [dishId]);
  async function perform(path: string, body: unknown) {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post(path, body);
      await load(); setNotice('Operación registrada. Revisa el estado actualizado.');
    } catch (err) { setError(errorMessage(err)); setReviewedPrice(false); setAbsenceChecked(false); }
    finally { setBusy(false); }
  }
  const taxonomy = snapshot?.evidence.taxonomy.find(t => t.grupo === group);
  const disabled = busy || dirty || !source.trim();
  const absenceReady = taxonomy && absenceChecked && sections.every(s => declarations[s]);
  return <section aria-labelledby="catalog-evidence-title" aria-busy={busy} className="mt-8 p-5 border rounded-xl space-y-4">
    <h2 id="catalog-evidence-title" className="text-xl font-bold">Verificación del catálogo guardado</h2>
    <p>Confirma únicamente lo que revisaste. Una declaración de ingredientes no garantiza ausencia de alérgenos ni contaminación cruzada.</p>
    {dirty && <p role="status">Hay cambios sin guardar. La evidencia anterior puede dejar de aplicar al guardar; guarda y vuelve a revisar antes de confirmar.</p>}
    {busy && <p role="status">Consultando o registrando evidencia…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <button type="button" disabled={busy} className={button} onClick={() => void load()}>Actualizar estado</button>
    {snapshot && <>
      <p><strong>{snapshot.dish.nombre}</strong> — precio guardado: {snapshot.dish.precio ?? 'desconocido'}. Moneda MXN: {snapshot.currencyState === 'confirmed' ? 'confirmada para este precio' : 'sin evidencia vigente'}.</p>
      <label className="block">Procedencia de la revisión (receta, ficha o revisión directa)
        <textarea value={source} maxLength={1000} onChange={e => setSource(e.target.value)} className={control} />
      </label>
      <label className="block"><input type="checkbox" checked={reviewedPrice} onChange={e => setReviewedPrice(e.target.checked)} /> Revisé este precio exacto y confirmo que está expresado en MXN.</label>
      <button type="button" className={button} disabled={disabled || !reviewedPrice} onClick={() => void perform('/menu/evidence/currency', {
        currency: 'MXN', source, catalogFingerprint: snapshot.catalogFingerprint,
        dishes: [{ id: dishId, price: String(snapshot.dish.precio), priceRevision: snapshot.dish.evidencia_precio_revision }]
      })}>Confirmar MXN de este precio</button>
      <h3 className="text-lg font-semibold">Composición y ausencia específica</h3>
      {sections.map(section => <div key={section} className="space-y-2">
        <p className="font-semibold">{section.replace(/_/g, ' ')}</p>
        <p className="break-words">{Array.isArray(snapshot.dish[section]) && snapshot.dish[section].length
          ? snapshot.dish[section].map(ingredientLabel).join(' · ') : 'Sin ingredientes registrados; no implica ausencia confirmada.'}</p>
        <label className="block">Revisión de {section.replace(/_/g, ' ')}
          <select className={control} value={declarations[section] || ''} onChange={e => {
            setDeclarations({ ...declarations, [section]: e.target.value }); setAbsenceChecked(false);
          }}>
            <option value="">No revisada / desconocida</option><option value="complete">Revisé la composición completa</option>
            {section !== 'ingredientes_principales' && <option value="not_applicable_declared">Revisé que esta sección no aplica</option>}
          </select>
        </label>
      </div>)}
      <label className="block">Ausencia a declarar
        <select value={group} className={control} onChange={e => { setGroup(e.target.value); setAbsenceChecked(false); }}>
          <option value="">Selecciona un grupo revisado</option>
          {snapshot.evidence.taxonomy.map(t => <option key={`${t.grupo}:${t.version}`} value={t.grupo}>{t.grupo} (versión {t.version})</option>)}
        </select>
      </label>
      {!snapshot.evidence.taxonomy.length && <p>No hay grupos alimentarios revisados disponibles. No se puede confirmar ausencia.</p>}
      {taxonomy && <p>Cobertura revisada: {taxonomy.terms.map(t => `${t.termino_normalizado.replace(/_/g, ' ')} (${t.relacion})`).join(', ')}.</p>}
      <label className="block"><input type="checkbox" checked={absenceChecked} onChange={e => setAbsenceChecked(e.target.checked)} /> Revisé todos los ingredientes, componentes, sustituciones y opciones; declaro ausencia del grupo seleccionado en esta receta.</label>
      <button type="button" disabled={disabled || !absenceReady} className={button} onClick={() => taxonomy && void perform(`/menu/platillos/${dishId}/evidence/absence`, {
        source, recipeVersion: snapshot.recipeVersion, recipeRevision: snapshot.dish.evidencia_receta_revision,
        group, taxonomyVersion: taxonomy.version, taxonomyRevision: taxonomy.revision, sections: declarations
      })}>Confirmar ausencia específica</button>
      <h3 className="text-lg font-semibold">Historial y revocación</h3>
      <label className="block">Motivo de revocación<input className={control} value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></label>
      {(['prices', 'absences'] as const).map(kind => snapshot.evidence[kind].map((e, i) => {
        const id = kind === 'prices' ? e.confirmacion_id : e.id;
        const stale = kind === 'prices' ? e.version_precio !== snapshot.dish.evidencia_precio_revision :
          e.receta_revision !== snapshot.dish.evidencia_receta_revision || !snapshot.evidence.taxonomy.some(t => t.revision === e.taxonomia_revision);
        return <article key={`${kind}:${id}:${i}`} className="border rounded-lg p-3 break-words">
          <p>{kind === 'prices' ? 'Moneda MXN' : `Ausencia de ${e.grupo}`} — {e.revocado_en ? 'Revocada' : stale ? 'Ya no aplica a los datos actuales' : 'Registrada; vigencia evaluada por el backend'}</p>
          <p>Fecha: {e.confirmado_en}. Responsable: {e.actor_id}. Procedencia: {e.procedencia}.</p>
          {e.revocado_en && <p>Revocación: {e.revocado_en}. Motivo: {e.motivo_revocacion}.</p>}
          {!e.revocado_en && <button type="button" className={button} disabled={busy || !reason.trim()} onClick={() => void perform(`/menu/evidence/${kind === 'prices' ? 'currency' : 'absence'}/${id}/revoke`, { reason })}>Revocar esta declaración</button>}
        </article>;
      }))}
      {!snapshot.evidence.prices.length && !snapshot.evidence.absences.length && <p>Aún no hay confirmaciones registradas.</p>}
    </>}
  </section>;
}
