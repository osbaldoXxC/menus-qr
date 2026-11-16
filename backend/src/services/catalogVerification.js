'use strict';

const crypto = require('crypto');
const { resolveAllergenSet, normalizeTerm, getCanonicalAllergen } = require('./allergenCatalog');

const ALLERGEN_STATES = Object.freeze({
  CONTAINS: 'contains',
  MAY_CONTAIN: 'may_contain',
  VERIFIED_ABSENT: 'verified_absent',
  UNKNOWN: 'unknown'
});

const COMPLETENESS_STATES = Object.freeze({
  COMPLETE: 'complete',
  INCOMPLETE: 'incomplete',
  NOT_APPLICABLE_DECLARED: 'not_applicable_declared',
  PENDING_VERIFICATION: 'pending_verification'
});

const VERIFICATION_STATES = Object.freeze({
  DECLARED_UNVERIFIED: 'declared_unverified',
  REVIEWED: 'reviewed',
  VERIFIED_APPROVED: 'verified_approved',
  OUTDATED: 'outdated',
  INVALIDATED_BY_CHANGE: 'invalidated_by_change',
  CONFLICT: 'conflict'
});

const CROSS_CONTAMINATION_STATES = Object.freeze({
  VERIFIED_CONTROLLED: 'verified_controlled',
  POSSIBLE: 'possible',
  UNKNOWN: 'unknown',
  NOT_ASSESSED: 'not_assessed'
});

const RECIPE_VERSION_FIELDS = Object.freeze([
  'nombre',
  'descripcion',
  'ingredientes_principales',
  'ingredientes_secundarios',
  'complementos',
  'salsas',
  'aderezos',
  'condimentos',
  'ingredientes_compuestos',
  'sustituciones_permitidas',
  'modificadores_opcionales',
  'etiquetas_dieteticas',
  'alergenos_declarados',
  'contacto_cruzado',
  'nivel_picante',
  'porcion'
]);

function toArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeIngredientEntry(entry) {
  if (entry === undefined || entry === null) return null;
  if (typeof entry === 'string') {
    const name = entry.trim();
    if (!name) return null;
    return { name, declared: true };
  }
  if (typeof entry === 'object') {
    const name = typeof entry.name === 'string' ? entry.name.trim() : (typeof entry.nombre === 'string' ? entry.nombre.trim() : '');
    if (!name) return null;
    return {
      ...entry,
      name,
      declared: true,
      isCompound: entry.isCompound === true || entry.es_compuesto === true,
      compoundResolved: entry.compoundResolved === true || entry.desglosado === true,
      subIngredients: toArray(entry.subIngredients || entry.ingredientes_componentes)
    };
  }
  return null;
}

function extractSection(dish, key, aliases = []) {
  const keys = [key, ...aliases];
  for (const k of keys) {
    if (dish && Object.prototype.hasOwnProperty.call(dish, k)) {
      return toArray(dish[k]).map(normalizeIngredientEntry).filter(Boolean);
    }
  }
  return [];
}

function getVerificationMetadata(dish) {
  const meta = dish && (dish.verification_metadata || dish.verificacion || dish.metadata_verificacion);
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) return meta;
  return null;
}

function getSectionStatus(meta, section) {
  if (!meta || !meta.completeness || typeof meta.completeness !== 'object') return null;
  const v = meta.completeness[section];
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && typeof v.status === 'string') return v.status;
  return null;
}

function normalizeForVersion(value) {
  if (Array.isArray(value)) return value.map(normalizeForVersion);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach((k) => { out[k] = normalizeForVersion(value[k]); });
    return out;
  }
  return value === undefined ? null : value;
}

function computeRecipeVersion(dish) {
  const payload = {};
  RECIPE_VERSION_FIELDS.forEach((k) => {
    payload[k] = normalizeForVersion(dish ? (dish[k] !== undefined ? dish[k] : null) : null);
  });
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function evaluateCompleteness(dish) {
  const meta = getVerificationMetadata(dish);
  const sections = ['ingredientes_principales','ingredientes_secundarios','complementos','salsas','aderezos','condimentos','ingredientes_compuestos','sustituciones_permitidas','modificadores_opcionales','contacto_cruzado'];
  const statusBySection = {};
  let allSufficient = true;

  sections.forEach((section) => {
    const declared = getSectionStatus(meta, section);
    const dataAliases = {
      ingredientes_secundarios: ['ingredientes_secundarios','secondaryIngredients'],
      salsas: ['salsas','sauces'],
      aderezos: ['aderezos','dressings'],
      condimentos: ['condimentos','seasonings'],
      ingredientes_compuestos: ['ingredientes_compuestos','compoundIngredients'],
      sustituciones_permitidas: ['sustituciones_permitidas','allowedSubstitutions'],
      modificadores_opcionales: ['modificadores_opcionales','optionalModifiers','opciones_modificables'],
      contacto_cruzado: ['contacto_cruzado','crossContamination','cross_contamination']
    };
    const hasData = section === 'ingredientes_principales'
      ? extractSection(dish, 'ingredientes_principales').length > 0
      : (section === 'complementos' ? extractSection(dish, 'complementos').length > 0 : extractSection(dish, section, dataAliases[section] || []).length > 0 || (section === 'contacto_cruzado' && !!(meta && meta.crossContamination)));

    if (declared === COMPLETENESS_STATES.NOT_APPLICABLE_DECLARED) {
      statusBySection[section] = { status: COMPLETENESS_STATES.NOT_APPLICABLE_DECLARED, sufficient: true };
      return;
    }
    if (declared === COMPLETENESS_STATES.COMPLETE) {
      statusBySection[section] = { status: COMPLETENESS_STATES.COMPLETE, sufficient: true };
      return;
    }
    if (declared === COMPLETENESS_STATES.INCOMPLETE || declared === COMPLETENESS_STATES.PENDING_VERIFICATION) {
      statusBySection[section] = { status: declared, sufficient: false };
      allSufficient = false;
      return;
    }
    if (hasData) {
      statusBySection[section] = { status: COMPLETENESS_STATES.PENDING_VERIFICATION, sufficient: false, inferred: true };
      allSufficient = false;
    } else {
      statusBySection[section] = { status: COMPLETENESS_STATES.INCOMPLETE, sufficient: false, inferred: true, reason: 'not_declared' };
      allSufficient = false;
    }
  });

  const main = extractSection(dish, 'ingredientes_principales');
  if (main.length === 0) {
    statusBySection.ingredientes_principales = { status: COMPLETENESS_STATES.INCOMPLETE, sufficient: false, reason: 'missing_main_ingredients' };
    allSufficient = false;
  }

  return {
    allSectionsSufficient: allSufficient,
    sections: statusBySection,
    source: meta ? 'verification_metadata' : 'inferred_conservative'
  };
}

function evaluateCrossContamination(dish) {
  const meta = getVerificationMetadata(dish);
  const cc = meta && meta.crossContamination ? meta.crossContamination : (dish && dish.contacto_cruzado ? dish.contacto_cruzado : null);
  if (!meta) return { status: CROSS_CONTAMINATION_STATES.UNKNOWN, verifiable: false, reason: 'no_verification_metadata' };
  let status = null;
  if (cc && typeof cc === 'object') status = cc.status || cc.state || null;
  if (typeof cc === 'string') status = cc;
  if (!status) return { status: CROSS_CONTAMINATION_STATES.NOT_ASSESSED, verifiable: false, reason: 'not_assessed' };
  const allowed = Object.values(CROSS_CONTAMINATION_STATES);
  if (!allowed.includes(status)) return { status: CROSS_CONTAMINATION_STATES.UNKNOWN, verifiable: false, reason: 'invalid_status' };
  const verifiable = status === CROSS_CONTAMINATION_STATES.VERIFIED_CONTROLLED;
  return { status, verifiable, details: cc && typeof cc === 'object' ? cc : { status } };
}

function evaluateVerificationStatus(dish) {
  const meta = getVerificationMetadata(dish);
  if (!meta) {
    return { state: VERIFICATION_STATES.DECLARED_UNVERIFIED, verifiedApproved: false, reason: 'no_verification_metadata' };
  }
  const currentVersion = computeRecipeVersion(dish);
  const verifiedVersion = meta.verifiedRecipeVersion || meta.recipeVersion || meta.recipe_version || null;
  const state = meta.verificationState || meta.verification_state || meta.state || VERIFICATION_STATES.DECLARED_UNVERIFIED;

  if (verifiedVersion && verifiedVersion !== currentVersion) {
    return { state: VERIFICATION_STATES.INVALIDATED_BY_CHANGE, verifiedApproved: false, reason: 'recipe_changed_after_verification', currentVersion, verifiedVersion };
  }
  if (state === VERIFICATION_STATES.CONFLICT) return { state, verifiedApproved: false, reason: 'conflict', currentVersion, verifiedVersion };
  if (state === VERIFICATION_STATES.OUTDATED) return { state, verifiedApproved: false, reason: 'outdated', currentVersion, verifiedVersion };
  if (state === VERIFICATION_STATES.INVALIDATED_BY_CHANGE) return { state, verifiedApproved: false, reason: 'invalidated', currentVersion, verifiedVersion };
  if (state === VERIFICATION_STATES.VERIFIED_APPROVED && verifiedVersion === currentVersion) {
    return {
      state, verifiedApproved: true, currentVersion, verifiedVersion,
      verifiedBy: meta.verifiedBy || meta.verified_by || null,
      verifiedAt: meta.verifiedAt || meta.verified_at || null,
      source: meta.verificationSource || meta.source || null
    };
  }
  if (state === VERIFICATION_STATES.REVIEWED) return { state, verifiedApproved: false, reason: 'reviewed_not_approved', currentVersion, verifiedVersion };
  return { state: VERIFICATION_STATES.DECLARED_UNVERIFIED, verifiedApproved: false, reason: 'not_verified_approved', currentVersion, verifiedVersion };
}

function collectAllRelevantIngredientEntries(dish) {
  const sections = ['ingredientes_principales','ingredientes_secundarios','complementos','salsas','aderezos','condimentos','ingredientes_compuestos'];
  const aliases = {
    ingredientes_secundarios: ['secondaryIngredients'],
    salsas: ['sauces'],
    aderezos: ['dressings'],
    condimentos: ['seasonings'],
    ingredientes_compuestos: ['compoundIngredients']
  };
  const entries = [];
  sections.forEach((s) => extractSection(dish, s, aliases[s] || []).forEach((e) => entries.push({ ...e, section: s })));
  return entries;
}

function resolveCompound(entry) {
  const isCompound = entry && (entry.isCompound === true || entry.es_compuesto === true);
  const resolved = entry && (entry.compoundResolved === true || entry.desglosado === true);
  const subs = entry ? toArray(entry.subIngredients || entry.ingredientes_componentes).map(normalizeIngredientEntry).filter(Boolean) : [];
  if (!isCompound) return { isCompound: false, resolved: true, effectiveTerms: [entry ? entry.name : null].filter(Boolean), unresolved: false };
  if (resolved && subs.length > 0) return { isCompound: true, resolved: true, effectiveTerms: subs.map((s) => s.name), unresolved: false };
  return { isCompound: true, resolved: false, effectiveTerms: [entry ? entry.name : null].filter(Boolean), unresolved: true };
}

function getTermAllergenAssessment(dish, term, requestedCanonical) {
  const meta = getVerificationMetadata(dish);
  if (!meta) return null;
  const assessments = Array.isArray(meta.ingredientAllergenAssessments) ? meta.ingredientAllergenAssessments : [];
  const nTerm = normalizeTerm(term);
  for (const a of assessments) {
    if (!a || typeof a !== 'object') continue;
    const aTerm = normalizeTerm(a.term || a.ingredient || a.name);
    if (aTerm !== nTerm) continue;
    const aAllergen = getCanonicalAllergen(a.allergen || a.allergenId || a.value) || normalizeTerm(a.allergen);
    if (aAllergen !== requestedCanonical) continue;
    const state = a.state || a.status || a.result;
    if (state === ALLERGEN_STATES.CONTAINS || state === ALLERGEN_STATES.MAY_CONTAIN || state === ALLERGEN_STATES.VERIFIED_ABSENT || state === ALLERGEN_STATES.UNKNOWN) {
      return { state, source: a.source || 'ingredientAllergenAssessments', evidence: a };
    }
  }
  return null;
}

function evaluateAllergenForDish(dish, requestedAllergenOrTerm, context = {}) {
  const reqNorm = normalizeTerm(requestedAllergenOrTerm);
  const reqResolved = resolveAllergenSet([requestedAllergenOrTerm]);
  const requestedCanonical = reqResolved.allergens[0] || null;
  const completeness = evaluateCompleteness(dish);
  const verification = evaluateVerificationStatus(dish);
  const crossContamination = evaluateCrossContamination(dish);
  const meta = getVerificationMetadata(dish);

  const base = {
    requested: requestedAllergenOrTerm,
    requestedNormalized: reqNorm,
    requestedCanonical,
    allergenState: ALLERGEN_STATES.UNKNOWN,
    reason: 'insufficient_information',
    completeness,
    verification,
    crossContamination,
    evidence: { matches: [], relations: [], conflicts: [], unresolvedCompounds: [], termAssessments: [] }
  };

  if (!requestedCanonical) {
    base.reason = 'requested_allergen_not_mappable';
    return base;
  }

  if (meta && meta.conflicts && Array.isArray(meta.conflicts) && meta.conflicts.length > 0) {
    const relevant = meta.conflicts.filter((c) => {
      if (!c || !c.allergen) return true;
      return normalizeTerm(c.allergen) === requestedCanonical || getCanonicalAllergen(c.allergen) === requestedCanonical;
    });
    if (relevant.length > 0) {
      base.evidence.conflicts.push(...relevant);
      base.allergenState = ALLERGEN_STATES.UNKNOWN;
      base.reason = 'conflict_between_sources';
      return base;
    }
  }

  const ccAllergens = meta && meta.crossContamination && Array.isArray(meta.crossContamination.allergens)
    ? meta.crossContamination.allergens.map((a) => getCanonicalAllergen(a)).filter(Boolean)
    : [];
  if (crossContamination.status === CROSS_CONTAMINATION_STATES.POSSIBLE && (ccAllergens.length === 0 || ccAllergens.includes(requestedCanonical))) {
    base.allergenState = ALLERGEN_STATES.MAY_CONTAIN;
    base.reason = 'documented_possible_cross_contamination';
    return base;
  }

  const declaredAllergens = [];
  if (meta && Array.isArray(meta.declaredAllergens)) declaredAllergens.push(...meta.declaredAllergens);
  if (meta && Array.isArray(meta.alergenos_declarados)) declaredAllergens.push(...meta.alergenos_declarados);
  if (dish && Array.isArray(dish.alergenos_declarados)) declaredAllergens.push(...dish.alergenos_declarados);
  const declaredResolved = resolveAllergenSet(declaredAllergens.map((a) => (a && typeof a === 'object' ? (a.value || a.name || a.allergen) : a)));
  if (declaredResolved.allergens.includes(requestedCanonical)) {
    base.allergenState = ALLERGEN_STATES.CONTAINS;
    base.reason = 'declared_allergen_present';
    base.evidence.matches.push({ source: 'declared_allergens', allergen: requestedCanonical });
    return base;
  }

  if (verification.state === VERIFICATION_STATES.INVALIDATED_BY_CHANGE) {
    base.allergenState = ALLERGEN_STATES.UNKNOWN;
    base.reason = 'verification_invalidated_by_recipe_change';
    return base;
  }

  const ingredients = collectAllRelevantIngredientEntries(dish);
  let hasUnresolvedCompound = false;
  let hasUnassessedUnknown = false;
  const matchedRelations = [];

  for (const ing of ingredients) {
    const compound = resolveCompound(ing);
    if (compound.unresolved) {
      hasUnresolvedCompound = true;
      base.evidence.unresolvedCompounds.push({ ingredient: ing.name, section: ing.section });
      continue;
    }
    const terms = compound.effectiveTerms.length ? compound.effectiveTerms : [ing.name];
    for (const term of terms) {
      const nTerm = normalizeTerm(term);
      const catalogRes = resolveAllergenSet([term]);
      const explicit = getTermAllergenAssessment(dish, term, requestedCanonical);

      if (explicit) {
        base.evidence.termAssessments.push({ term: nTerm, assessment: explicit });
        if (explicit.state === ALLERGEN_STATES.CONTAINS || explicit.state === ALLERGEN_STATES.MAY_CONTAIN) {
          matchedRelations.push({ ingredient: ing.name, section: ing.section, term, source: 'explicit_assessment', state: explicit.state });
          continue;
        }
        if (explicit.state === ALLERGEN_STATES.VERIFIED_ABSENT) {
          continue;
        }
        hasUnassessedUnknown = true;
        continue;
      }

      if (catalogRes.allergens.includes(requestedCanonical)) {
        matchedRelations.push({ ingredient: ing.name, section: ing.section, term, resolution: catalogRes, source: 'catalog_relation' });
        continue;
      }

      if (nTerm) {
        hasUnassessedUnknown = true;
      }
    }
  }

  if (matchedRelations.some((m) => m.state === ALLERGEN_STATES.MAY_CONTAIN)) {
    base.allergenState = ALLERGEN_STATES.MAY_CONTAIN;
    base.reason = 'ingredient_assessment_may_contain';
    base.evidence.matches.push(...matchedRelations);
    return base;
  }
  if (matchedRelations.length > 0) {
    base.allergenState = ALLERGEN_STATES.CONTAINS;
    base.reason = 'ingredient_or_derivative_match';
    base.evidence.matches.push(...matchedRelations);
    return base;
  }

  if (
    completeness.allSectionsSufficient &&
    verification.verifiedApproved &&
    !hasUnresolvedCompound &&
    !hasUnassessedUnknown &&
    crossContamination.status === CROSS_CONTAMINATION_STATES.VERIFIED_CONTROLLED
  ) {
    base.allergenState = ALLERGEN_STATES.VERIFIED_ABSENT;
    base.reason = 'verified_complete_no_match_with_term_assessments';
    base.evidence.scope = 'verified_declared_recipe_with_explicit_allergen_assessments';
    return base;
  }

  base.allergenState = ALLERGEN_STATES.UNKNOWN;
  base.reason = hasUnresolvedCompound ? 'unresolved_compound_ingredient'
    : (!completeness.allSectionsSufficient ? 'incomplete_catalog_information'
      : (!verification.verifiedApproved ? 'verification_not_approved_or_invalidated'
        : (crossContamination.status !== CROSS_CONTAMINATION_STATES.VERIFIED_CONTROLLED ? 'cross_contamination_not_verifiable'
          : (hasUnassessedUnknown ? 'ingredient_allergen_assessment_missing' : 'insufficient_information'))));
  return base;
}

function buildConservativeVerificationMetadata(inputMeta, dish, actor, opts = {}) {
  const now = new Date().toISOString();
  const currentVersion = computeRecipeVersion(dish);
  const inMeta = inputMeta && typeof inputMeta === 'object' && !Array.isArray(inputMeta) ? inputMeta : {};

  // Persisted verification state is always conservative on create/update unless an explicit, authorized, and fully evidenced approval flow is implemented.
  // Records must never be auto-verified or marked complete without explicit evidence.
  const completeness = inMeta.completeness && typeof inMeta.completeness === 'object' ? inMeta.completeness : {};
  const crossContamination = inMeta.crossContamination && typeof inMeta.crossContamination === 'object'
    ? { ...inMeta.crossContamination }
    : { status: CROSS_CONTAMINATION_STATES.NOT_ASSESSED };

  if (!crossContamination.status) crossContamination.status = CROSS_CONTAMINATION_STATES.NOT_ASSESSED;

  const meta = {
    ...inMeta,
    completeness,
    crossContamination,
    verificationState: VERIFICATION_STATES.DECLARED_UNVERIFIED,
    currentRecipeVersion: currentVersion,
    verifiedRecipeVersion: null,
    verifiedBy: null,
    verifiedAt: null,
    verificationSource: inMeta.verificationSource || inMeta.source || null,
    lastModifiedBy: actor && actor.id ? actor.id : null,
    lastModifiedAt: now,
    invalidatedAt: opts.invalidatedFrom ? now : (inMeta.invalidatedAt || null),
    invalidationReason: opts.invalidationReason || (opts.invalidatedFrom ? 'recipe_changed' : (inMeta.invalidationReason || null)),
    previousVerifiedRecipeVersion: opts.invalidatedFrom ? (opts.previousVerifiedRecipeVersion || null) : (inMeta.previousVerifiedRecipeVersion || null)
  };

  return { meta, currentVersion, state: VERIFICATION_STATES.DECLARED_UNVERIFIED };
}

module.exports = {
  ALLERGEN_STATES,
  COMPLETENESS_STATES,
  VERIFICATION_STATES,
  CROSS_CONTAMINATION_STATES,
  RECIPE_VERSION_FIELDS,
  computeRecipeVersion,
  evaluateCompleteness,
  evaluateVerificationStatus,
  evaluateCrossContamination,
  evaluateAllergenForDish,
  collectAllRelevantIngredientEntries,
  resolveCompound,
  getVerificationMetadata,
  buildConservativeVerificationMetadata
};
