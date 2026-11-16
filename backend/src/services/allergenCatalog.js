'use strict';

/**
 * Catálogo canónico de alérgenos y resolución determinista.
 * Relaciones documentadas explícitamente (reglas internas/documentadas en docs de verificación B1-T04).
 * No inventar equivalencias no documentadas; mantener conservadurismo ante desconocidos.
 */

const CANONICAL_ALLERGENS = Object.freeze([
  { id: 'gluten', canonical: 'gluten', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'crustaceos', canonical: 'crustaceos', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'huevo', canonical: 'huevo', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'pescado', canonical: 'pescado', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'cacahuate', canonical: 'cacahuate', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'soya', canonical: 'soya', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'lacteos', canonical: 'lacteos', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'frutos_secos', canonical: 'frutos_secos', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'apio', canonical: 'apio', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'mostaza', canonical: 'mostaza', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'sesamo', canonical: 'sesamo', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'sulfitos', canonical: 'sulfitos', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'altramuces', canonical: 'altramuces', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' },
  { id: 'moluscos', canonical: 'moluscos', source: 'catalogo_base_documentado_b1t04', verification: 'documented_rule' }
]);

const CANONICAL_IDS = new Set(CANONICAL_ALLERGENS.map((a) => a.id));

// Explicit synonym/variant -> canonical allergen mappings (deterministic, documented)
const SYNONYM_TO_CANONICAL = Object.freeze({
  mani: 'cacahuate',
  cacahuete: 'cacahuate',
  peanut: 'cacahuate',
  peanuts: 'cacahuate',
  leche: 'lacteos',
  lactosa: 'lacteos',
  milk: 'lacteos',
  queso: 'lacteos',
  mantequilla: 'lacteos',
  crema: 'lacteos',
  yogurt: 'lacteos',
  yogur: 'lacteos',
  huevo: 'huevo',
  huevos: 'huevo',
  egg: 'huevo',
  eggs: 'huevo',
  gluten: 'gluten',
  trigo: 'gluten',
  wheat: 'gluten',
  cebada: 'gluten',
  barley: 'gluten',
  centeno: 'gluten',
  rye: 'gluten',
  avena: 'gluten',
  oats: 'gluten',
  soya: 'soya',
  soja: 'soya',
  soy: 'soya',
  pescado: 'pescado',
  fish: 'pescado',
  camaron: 'crustaceos',
  camarones: 'crustaceos',
  shrimp: 'crustaceos',
  langosta: 'crustaceos',
  cangrejo: 'crustaceos',
  crustaceo: 'crustaceos',
  crustaceos: 'crustaceos',
  nuez: 'frutos_secos',
  nueces: 'frutos_secos',
  almendra: 'frutos_secos',
  almendras: 'frutos_secos',
  avellana: 'frutos_secos',
  avellanas: 'frutos_secos',
  pistacho: 'frutos_secos',
  pistaches: 'frutos_secos',
  nuez_de_castilla: 'frutos_secos',
  sesamo: 'sesamo',
  ajonjoli: 'sesamo',
  tahini: 'sesamo',
  mostaza: 'mostaza',
  mustard: 'mostaza',
  apio: 'apio',
  celery: 'apio',
  sulfitos: 'sulfitos',
  sulfito: 'sulfitos',
  altramuz: 'altramuces',
  altramuces: 'altramuces',
  molusco: 'moluscos',
  moluscos: 'moluscos',
  almeja: 'moluscos',
  mejillon: 'moluscos',
  pulpo: 'moluscos',
  calamar: 'moluscos'
});

// Explicit ingredient/derivative -> canonical allergen relations (deterministic, documented)
const DERIVATIVE_RELATIONS = Object.freeze([
  { term: 'harina_de_trigo', allergens: ['gluten'], source: 'catalogo_base_documentado_b1t04', type: 'derivative' },
  { term: 'pan', allergens: ['gluten'], source: 'catalogo_base_documentado_b1t04', type: 'compound' },
  { term: 'pasta', allergens: ['gluten'], source: 'catalogo_base_documentado_b1t04', type: 'compound' },
  { term: 'salsa_de_soya', allergens: ['soya', 'gluten'], source: 'catalogo_base_documentado_b1t04', type: 'compound' },
  { term: 'tofu', allergens: ['soya'], source: 'catalogo_base_documentado_b1t04', type: 'derivative' },
  { term: 'mantequilla_de_mani', allergens: ['cacahuate'], source: 'catalogo_base_documentado_b1t04', type: 'derivative' },
  { term: 'crema_de_cacahuate', allergens: ['cacahuate'], source: 'catalogo_base_documentado_b1t04', type: 'derivative' },
  { term: 'queso', allergens: ['lacteos'], source: 'catalogo_base_documentado_b1t04', type: 'derivative' },
  { term: 'suero_de_leche', allergens: ['lacteos'], source: 'catalogo_base_documentado_b1t04', type: 'derivative' },
  { term: 'caseina', allergens: ['lacteos'], source: 'catalogo_base_documentado_b1t04', type: 'derivative' },
  { term: 'mayonesa', allergens: ['huevo'], source: 'catalogo_base_documentado_b1t04', type: 'compound' },
  { term: 'tahini', allergens: ['sesamo'], source: 'catalogo_base_documentado_b1t04', type: 'derivative' }
]);

function normalizeTerm(value) {
  if (value === undefined || value === null) return null;
  let s = String(value).trim().toLowerCase();
  if (!s) return null;
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s || null;
}

function getCanonicalAllergen(term) {
  const n = normalizeTerm(term);
  if (!n) return null;
  if (CANONICAL_IDS.has(n)) return n;
  if (SYNONYM_TO_CANONICAL[n]) return SYNONYM_TO_CANONICAL[n];
  return null;
}

function findDerivativeRelations(term) {
  const n = normalizeTerm(term);
  if (!n) return [];
  return DERIVATIVE_RELATIONS.filter((r) => r.term === n);
}

function resolveAllergensForTerm(term) {
  const n = normalizeTerm(term);
  if (!n) {
    return { normalized: null, directAllergen: null, derivativeAllergens: [], allergens: [], relations: [], mappable: false };
  }
  const direct = getCanonicalAllergen(n);
  const derivatives = findDerivativeRelations(n);
  const derivativeAllergens = Array.from(new Set(derivatives.flatMap((d) => d.allergens)));
  const relations = [];
  if (direct) relations.push({ type: CANONICAL_IDS.has(n) ? 'canonical' : 'synonym', allergen: direct, term: n, source: 'catalogo_base_documentado_b1t04' });
  derivatives.forEach((d) => relations.push({ type: d.type, allergens: d.allergens, term: n, source: d.source }));
  const all = Array.from(new Set([...(direct ? [direct] : []), ...derivativeAllergens]));
  return {
    normalized: n,
    directAllergen: direct,
    derivativeAllergens,
    allergens: all,
    relations,
    mappable: all.length > 0
  };
}

function resolveAllergenSet(terms) {
  const list = Array.isArray(terms) ? terms : [];
  const perTerm = list.map((t) => resolveAllergensForTerm(t));
  const allergens = Array.from(new Set(perTerm.flatMap((r) => r.allergens || [])));
  const unmapped = perTerm.filter((r) => r.normalized && !r.mappable).map((r) => r.normalized);
  return { perTerm, allergens, unmapped, source: 'allergenCatalog_v1' };
}

module.exports = {
  CANONICAL_ALLERGENS,
  CANONICAL_IDS,
  SYNONYM_TO_CANONICAL,
  DERIVATIVE_RELATIONS,
  normalizeTerm,
  getCanonicalAllergen,
  findDerivativeRelations,
  resolveAllergensForTerm,
  resolveAllergenSet
};
