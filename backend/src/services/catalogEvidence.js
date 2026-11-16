'use strict';

const crypto = require('node:crypto');
const { computeRecipeVersion } = require('./catalogVerification');
const { normalizeTerm } = require('./allergenCatalog');

// Attached only by the backend repository; a JSON verified flag has no authority.
const evidenceByDish = new WeakMap();
const SECTIONS = Object.freeze(['ingredientes_principales', 'ingredientes_secundarios',
  'complementos', 'salsas', 'aderezos', 'condimentos', 'ingredientes_compuestos',
  'sustituciones_permitidas', 'modificadores_opcionales']);
const UNKNOWN = Object.freeze({ state: 'desconocido', reason: 'evidence_insufficient' });
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const words = value => (normalizeTerm(value) || '').replace(/_/g, ' ');

function priceCents(value) {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== 'string' || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text)) return null;
  const [whole, part = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt((part + '00').slice(0, 2));
}

function catalogFingerprint(dishes) {
  return hash(dishes.map(d => [d.id, d.restaurante_id, String(d.precio), d.evidencia_precio_revision])
    .sort((a, b) => a[0].localeCompare(b[0])));
}

function attachEvidence(dish, evidence) { evidenceByDish.set(dish, evidence); return dish; }
function getEvidence(dish) { return evidenceByDish.get(dish) || { prices: [], absences: [], taxonomy: [] }; }

function sameScope(e, dish) {
  return e.restaurante_id === dish.restaurante_id && e.platillo_id === dish.id &&
    e.actor_id === dish.restaurante_id && e.actor_tipo === 'RESTAURANTE' &&
    !!e.confirmado_en && !!e.procedencia && !e.revocado_en;
}

function currencyVerified(dish) {
  const cents = priceCents(dish.precio);
  if (cents === null || !dish.evidencia_precio_revision) return false;
  return getEvidence(dish).prices.some(e => sameScope(e, dish) && e.moneda === 'MXN' &&
    e.version_precio === dish.evidencia_precio_revision && priceCents(e.precio_confirmado) === cents);
}

function resolveGroup(term, taxonomy) {
  const normalized = normalizeTerm(term);
  const matches = taxonomy.filter(t => t.estado === 'aprobada' && t.aprobado_por && t.aprobado_en &&
    t.terms.some(a => a.relacion === 'sinonimo' && normalizeTerm(a.termino_normalizado) === normalized));
  // Multiple active versions or meanings are ambiguous, never pick the first.
  return matches.length === 1 ? matches[0] : null;
}

function ingredientNames(entry, depth = 0) {
  if (depth > 8) return null;
  if (typeof entry === 'string') return entry.trim() ? [words(entry)] : null;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const name = entry.name || entry.nombre;
  if (typeof name !== 'string' || !name.trim()) return null;
  const subs = entry.subIngredients || entry.ingredientes_componentes;
  const hasComponents = Object.prototype.hasOwnProperty.call(entry, 'subIngredients') ||
    Object.prototype.hasOwnProperty.call(entry, 'ingredientes_componentes');
  if (!entry.isCompound && !entry.es_compuesto && !hasComponents) return [words(name)];
  if (!(entry.compoundResolved || entry.desglosado) || !Array.isArray(subs) || !subs.length) return null;
  const names = subs.map(s => ingredientNames(s, depth + 1));
  return names.some(n => !n) ? null : [words(name), ...names.flat()];
}

function recipeAssessment(dish, sections, taxonomy) {
  if (dish.has_relational_recipe) return UNKNOWN;
  const names = [];
  for (const section of SECTIONS) {
    const entries = dish[section];
    const status = sections && sections[section];
    if (!Array.isArray(entries)) return UNKNOWN;
    if (status === 'not_applicable_declared' && entries.length === 0 && section !== SECTIONS[0]) continue;
    if (status !== 'complete' || (section === SECTIONS[0] && !entries.length)) return UNKNOWN;
    const parsed = entries.map(e => ingredientNames(e));
    if (parsed.some(p => !p)) return UNKNOWN;
    names.push(...parsed.flat());
  }
  const present = taxonomy.terms.some(t => names.some(n => (` ${n} `).includes(` ${words(t.termino_normalizado)} `)));
  if (present) return { state: 'incompatible', reason: 'excluded_ingredient_present' };
  // These unqualified terms do not identify animal origin. Owner confirmation
  // cannot resolve ambiguous composition: edit/desgloss the recipe first.
  if (names.some(n => /(?:^| )(?:manteca|gelatina|chorizo|embutido|tocino)(?: |$)/.test(n))) return UNKNOWN;
  // A plain name for a preparation is not its composition. A resolved compound
  // includes its parent name too, so distinguish unexpanded entries separately.
  for (const section of SECTIONS) {
    for (const entry of dish[section]) {
      const name = typeof entry === 'string' ? entry : (entry?.name || entry?.nombre || '');
      const generic = /(?:^| )(?:salsa|aderezo|marinado|mezcla|relleno|caldo|preparado)(?: |$)/.test(words(name));
      if (generic && (typeof entry === 'string' || !(entry.isCompound || entry.es_compuesto) ||
          !(entry.compoundResolved || entry.desglosado))) return UNKNOWN;
    }
  }
  return { state: 'compatible_segun_datos', reason: 'specific_absence_confirmed' };
}

function evaluateExclusion(dish, term) {
  const evidence = getEvidence(dish);
  const taxonomy = resolveGroup(term, evidence.taxonomy);
  if (!taxonomy || !dish.evidencia_receta_revision) return UNKNOWN;
  const confirmation = evidence.absences.find(e => sameScope(e, dish) && e.grupo === taxonomy.grupo &&
    e.taxonomia_version === taxonomy.version && e.taxonomia_revision === taxonomy.revision &&
    e.receta_revision === dish.evidencia_receta_revision && e.receta_version === computeRecipeVersion(dish));
  if (!confirmation) return UNKNOWN;
  return recipeAssessment(dish, confirmation.secciones, taxonomy);
}

// Narrow corroboration of an ML proposal, not an independent general NLP parser.
// Only an explicit, entire exclusion clause maps to one reviewed synonym.
function corroborateExclusion(restriction, taxonomy) {
  if (restriction.category !== 'exclusion' || restriction.reason !== 'inferred_extraction_verification_required') return restriction;
  if (restriction.conflicts?.length || restriction.raw?.ambiguous) return restriction;
  const text = restriction.raw?.sourceText;
  if (typeof text !== 'string') return restriction;
  const group = resolveGroup(restriction.normalizedValue, taxonomy);
  if (!group) return restriction;
  const clauses = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[,.;!?]|\bpero\b/).map(c => c.trim());
  function exclusionClause(c) {
    const direct = /^(?:quiero (?:algo )?|que )?(?:sin|no tenga) (.+)$/.exec(c);
    if (direct) return resolveGroup(direct[1], taxonomy) === group;
    const natural = /^quiero ([a-z ]+) (?:sin|que no tenga) (.+)$/.exec(c);
    if (!natural || /\b(?:no|sin|excepto|pero|ni)\b/.test(natural[1])) return false;
    return resolveGroup(natural[2], taxonomy) === group;
  }
  const explicit = clauses.some(exclusionClause);
  // A second mention outside a corroborated exclusion can contradict or qualify
  // it. Do not let one matching clause conceal the rest of the user's request.
  const uncorroboratedMention = clauses.some(c => {
    if (exclusionClause(c)) return false;
    const normalizedClause = ` ${words(c)} `;
    return group.terms.some(t => normalizedClause.includes(` ${words(t.termino_normalizado)} `));
  });
  return explicit && !uncorroboratedMention
    ? { ...restriction, reason: 'backend_corroborated_exclusion', sourceRef: restriction.sourceRef }
    : restriction;
}

module.exports = { SECTIONS, UNKNOWN, priceCents, catalogFingerprint, attachEvidence, getEvidence,
  currencyVerified, resolveGroup, recipeAssessment, evaluateExclusion, corroborateExclusion };
