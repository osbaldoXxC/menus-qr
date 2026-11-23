'use strict';

const { STATES } = require('./restrictionConsolidation');
const {
  ALLERGEN_STATES,
  evaluateAllergenForDish,
  evaluateVerificationStatus,
  evaluateCompleteness
} = require('./catalogVerification');
const { getCanonicalAllergen, normalizeTerm } = require('./allergenCatalog');
const { currencyVerified, evaluateExclusion, corroborateExclusion, getEvidence } = require('./catalogEvidence');

function toArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeIngredientToken(entry) {
  if (entry === undefined || entry === null) return null;
  if (typeof entry === 'string') return normalizeTerm(entry);
  if (typeof entry === 'object') {
    const name = typeof entry.name === 'string' ? entry.name : (typeof entry.nombre === 'string' ? entry.nombre : null);
    if (name) return normalizeTerm(name);
  }
  return null;
}

function collectAllIngredientTerms(dish) {
  const terms = new Set();
  const keys = ['ingredientes_principales','ingredientes_secundarios','complementos','salsas','aderezos','condimentos','ingredientes_compuestos'];
  keys.forEach((k) => {
    toArray(dish && dish[k]).forEach((e) => {
      const t = normalizeIngredientToken(e);
      if (t) terms.add(t);
      if (e && typeof e === 'object') {
        toArray(e.subIngredients || e.ingredientes_componentes).forEach((s) => {
          const st = normalizeIngredientToken(s);
          if (st) terms.add(st);
        });
      }
    });
  });
  return terms;
}

function mapAllergenStateToEligibility(allergenEval) {
  if (!allergenEval || typeof allergenEval !== 'object') {
    return { state: STATES.DESCONOCIDO, reason: 'allergen_evaluation_unavailable', evidence: null };
  }
  const st = allergenEval.allergenState;
  if (st === ALLERGEN_STATES.CONTAINS) {
    return { state: STATES.INCOMPATIBLE, reason: 'allergen_present_or_declared', evidence: { allergenState: st, detail: allergenEval.reason, requestedCanonical: allergenEval.requestedCanonical } };
  }
  if (st === ALLERGEN_STATES.MAY_CONTAIN) {
    return { state: STATES.INCOMPATIBLE, reason: 'allergen_may_contain', evidence: { allergenState: st, detail: allergenEval.reason, requestedCanonical: allergenEval.requestedCanonical } };
  }
  if (st === ALLERGEN_STATES.VERIFIED_ABSENT) {
    return { state: STATES.COMPATIBLE_SEGUN_DATOS, reason: 'allergen_verified_absent', evidence: { allergenState: st, detail: allergenEval.reason, requestedCanonical: allergenEval.requestedCanonical } };
  }
  return { state: STATES.DESCONOCIDO, reason: allergenEval.reason || 'allergen_unknown', evidence: { allergenState: st, requestedCanonical: allergenEval.requestedCanonical } };
}

function evaluateDietRestriction(restriction, dish) {
  const target = restriction ? restriction.normalizedValue : null;
  if (!target || target === 'none') {
    return { state: STATES.COMPATIBLE_SEGUN_DATOS, reason: 'no_diet_restriction', evidence: null };
  }
  const meta = dish && (dish.verification_metadata || dish.verificacion || dish.metadata_verificacion);
  const completeness = evaluateCompleteness(dish);
  const verification = evaluateVerificationStatus(dish);

  if (!meta || !completeness.allSectionsSufficient || !verification.verifiedApproved) {
    return { state: STATES.DESCONOCIDO, reason: 'diet_verification_not_available', evidence: { completenessSufficient: !!(completeness && completeness.allSectionsSufficient), verifiedApproved: !!(verification && verification.verifiedApproved) } };
  }

  const dietEvidence = meta.dietEvidence || meta.diet_verification || null;
  const evaluations = Array.isArray(dietEvidence && dietEvidence.evaluations) ? dietEvidence.evaluations : (Array.isArray(dietEvidence) ? dietEvidence : []);
  const match = evaluations.find((e) => normalizeTerm(e && (e.diet || e.value || e.name)) === target);
  if (match) {
    const st = String(match.state || match.status || '').toLowerCase();
    if (st === 'compatible' || st === 'verified_compatible' || st === 'compatible_segun_datos') {
      return { state: STATES.COMPATIBLE_SEGUN_DATOS, reason: 'diet_verified_compatible', evidence: { diet: target, source: match.source || 'dietEvidence' } };
    }
    if (st === 'incompatible' || st === 'not_compatible') {
      return { state: STATES.INCOMPATIBLE, reason: 'diet_verified_incompatible', evidence: { diet: target, source: match.source || 'dietEvidence' } };
    }
  }
  return { state: STATES.DESCONOCIDO, reason: 'diet_evidence_missing_or_not_verifiable', evidence: { diet: target } };
}

function isBlockingUnknownRestriction(restriction) {
  if (!restriction) return true;
  const reason = String(restriction.reason || '').toLowerCase();
  // Contradictions, ambiguity, non-verifiable/inferred ML-only signals: cannot be resolved by catalog verification alone => block
  if (reason.includes('contradiction')) return true;
  if (reason.includes('ambiguous')) return true;
  if (reason.includes('not_verifiable')) return true;
  if (reason.includes('inferred_extraction')) return true;
  if (reason.includes('ml_extraction_globally_ambiguous')) return true;
  if (Array.isArray(restriction.conflicts) && restriction.conflicts.length > 0) return true;
  // Structured preserved pending verification is evaluable against catalog evidence
  if (reason === 'structured_preserved_verification_pending') return false;
  if (reason === 'backend_corroborated_exclusion') return false;
  if (reason === 'aligned_with_structured_verification_pending') return false;
  if (reason === 'text_budget_corroborated') return false;
  // Default conservative: unknown restriction blocks unless clearly evaluable
  return true;
}

// Temporary opt-in for the local catalogue; never enabled in production.
function localMxnBudgetEnabled() {
  return ['development', 'test'].includes(process.env.NODE_ENV) && process.env.LOCAL_MXN_BUDGET === 'true';
}

function evaluateBudgetPrice(price, budget, currencyVerified = false, localMxnAssumed = false, exclusive = false) {
  const rawPrice = typeof price === 'string' ? price : (typeof price === 'number' && Number.isFinite(price) ? String(price) : '');
  const rawBudget = typeof budget === 'number' && Number.isFinite(budget) ? String(budget) : '';
  const monetary = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
  if (!monetary.test(rawPrice) || !monetary.test(rawBudget) || Number(rawBudget) <= 0 || Number(rawBudget) > 100000) {
    return { state: STATES.DESCONOCIDO, reason: 'budget_price_invalid', evidence: null };
  }
  if (!currencyVerified && !localMxnAssumed) return { state: STATES.DESCONOCIDO, reason: 'budget_currency_unverified', evidence: null };
  const toCents = (v) => { const [whole, fraction = ''] = v.split('.'); return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2)); };
  const compatible = exclusive ? toCents(rawPrice) < toCents(rawBudget) : toCents(rawPrice) <= toCents(rawBudget);
  return { state: compatible ? STATES.COMPATIBLE_SEGUN_DATOS : STATES.INCOMPATIBLE,
    reason: compatible ? 'budget_within_limit' : 'budget_exceeded', evidence: { currency: 'MXN', source: currencyVerified ? 'restaurant_confirmation' : 'local_development_policy' } };
}

function evaluateRestrictionAgainstDish(restriction, dish, context = {}) {
  restriction = restriction && corroborateExclusion(restriction, getEvidence(dish).taxonomy);
  const category = restriction && restriction.category ? String(restriction.category).toLowerCase() : 'unknown';
  const target = restriction ? restriction.normalizedValue : null;

  if (!restriction) {
    return { state: STATES.DESCONOCIDO, reason: 'restriction_missing', evidence: null };
  }

  if (restriction.state === STATES.INCOMPATIBLE) {
    return { state: STATES.INCOMPATIBLE, reason: restriction.reason || 'restriction_incompatible', evidence: restriction.evidence || null };
  }

  if (restriction.state === STATES.DESCONOCIDO && isBlockingUnknownRestriction(restriction)) {
    return { state: STATES.DESCONOCIDO, reason: restriction.reason || 'restriction_unknown', evidence: restriction.evidence || null };
  }

  // At this point: either compatible_según_datos (pre-verified claim) or a structured restriction pending catalog verification
  if (category === 'allergy' || category === 'exclusion') {
    if (!target) return { state: STATES.DESCONOCIDO, reason: 'invalid_restriction_value', evidence: null };

    if (category === 'exclusion' && !getCanonicalAllergen(target)) {
      const specific = evaluateExclusion(dish, target);
      if (specific.state !== STATES.DESCONOCIDO) return specific;
    }

    const canonical = getCanonicalAllergen(target);
    const allergenEval = evaluateAllergenForDish(dish, canonical || target, context);
    const mapped = mapAllergenStateToEligibility(allergenEval);

    if (mapped.state === STATES.INCOMPATIBLE) return mapped;
    if (mapped.state === STATES.COMPATIBLE_SEGUN_DATOS && allergenEval && allergenEval.allergenState === ALLERGEN_STATES.VERIFIED_ABSENT) {
      return mapped;
    }

    if (!canonical) {
      const presentTerms = collectAllIngredientTerms(dish);
      if (presentTerms.has(target)) {
        return { state: STATES.INCOMPATIBLE, reason: 'excluded_ingredient_declared_present', evidence: { term: target, source: 'declared_recipe' } };
      }
      return { state: STATES.DESCONOCIDO, reason: 'exclusion_not_verifiable', evidence: { term: target, allergenReason: allergenEval ? allergenEval.reason : null } };
    }

    return mapped;
  }

  if (category === 'diet') {
    return evaluateDietRestriction(restriction, dish);
  }

  if (category === 'budget' && ['structured', 'text_corroborated'].includes(restriction.origin)) {
    return evaluateBudgetPrice(dish && dish.precio, restriction.value, currencyVerified(dish), localMxnBudgetEnabled(), restriction.raw?.exclusive === true);
  }

  // Unknown/other categories cannot be safely verified
  return { state: STATES.DESCONOCIDO, reason: 'unsupported_restriction_category', evidence: { category } };
}

function evaluateDishEligibility(dish, consolidatedResult) {
  const restrictions = consolidatedResult && Array.isArray(consolidatedResult.consolidatedRestrictions)
    ? consolidatedResult.consolidatedRestrictions
    : [];

  const evaluations = restrictions.map((r) => {
    const ev = evaluateRestrictionAgainstDish(r, dish, { requestId: consolidatedResult ? consolidatedResult.requestId : undefined });
    return {
      restrictionId: r.id,
      category: r.category,
      normalizedValue: r.normalizedValue,
      origin: r.origin,
      state: ev.state,
      reason: ev.reason,
      evidence: ev.evidence || null
    };
  });

  let eligibleForVerified = true;
  let decision = 'eligible_verified';
  let primaryReason = 'all_restrictions_compatible_segun_datos';

  const incompatible = evaluations.find((e) => e.state === STATES.INCOMPATIBLE);
  const unknown = evaluations.find((e) => e.state === STATES.DESCONOCIDO);

  if (incompatible) {
    eligibleForVerified = false;
    decision = 'discarded_incompatible';
    primaryReason = 'restriction_incompatible';
  } else if (unknown) {
    eligibleForVerified = false;
    decision = 'not_verifiable';
    primaryReason = 'restriction_unknown_or_unverifiable';
  } else if (restrictions.length === 0) {
    eligibleForVerified = true;
    decision = 'eligible_verified';
    primaryReason = 'no_mandatory_restrictions';
  }

  return {
    dishId: dish ? dish.id : undefined,
    eligible: eligibleForVerified,
    decision,
    primaryReason,
    evaluations,
    trace: {
      requestId: consolidatedResult ? consolidatedResult.requestId : undefined,
      restrictionCount: restrictions.length
    }
  };
}

function evaluateEligibility(candidates, consolidatedResult, options = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : list.length;
  const results = list.map((dish) => ({ dish, evaluation: evaluateDishEligibility(dish, consolidatedResult) }));
  const eligible = results.filter((r) => r.evaluation.eligible).map((r) => r.dish);
  const discarded = results.filter((r) => !r.evaluation.eligible).map((r) => ({ dishId: r.evaluation.dishId, evaluation: r.evaluation }));
  return {
    requestId: consolidatedResult ? consolidatedResult.requestId : undefined,
    eligible,
    eligibleCount: eligible.length,
    discarded,
    discardedCount: discarded.length,
    totalCandidates: list.length,
    evaluations: results.map((r) => r.evaluation),
    limitedEligible: eligible.slice(0, limit)
  };
}

function rankDeterministic(dishes) {
  const list = Array.isArray(dishes) ? dishes.slice() : [];
  return list.sort((a, b) => {
    const an = String(a && a.nombre ? a.nombre : '').toLowerCase();
    const bn = String(b && b.nombre ? b.nombre : '').toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    const ai = String(a && a.id != null ? a.id : '');
    const bi = String(b && b.id != null ? b.id : '');
    return ai.localeCompare(bi);
  });
}

function buildSafeFallbackRecommendations(eligibleDishes, context = {}) {
  const limit = Number.isInteger(context.limit) && context.limit > 0 ? context.limit : 5;
  const ranked = rankDeterministic(eligibleDishes).slice(0, limit);
  return ranked.map((d, index) => {
    const score = Math.max(0.5, Number((0.9 - index * 0.01).toFixed(2)));
    const dishId = d && d.id;
    const menuUrl = d && d.menuUrl ? d.menuUrl : (context.menuUrl || null);
    const restaurant = {
      id: d && (d.restaurante_id || d.restaurant_id) ? (d.restaurante_id || d.restaurant_id) : (context.restaurantId || null),
      name: d && (d.restaurante_nombre || d.restaurant_name) ? (d.restaurante_nombre || d.restaurant_name) : (context.restaurantName || null),
      slug: d && (d.restaurante_slug || d.slug) ? (d.restaurante_slug || d.slug) : (context.restaurantSlug || null),
      menuUrl
    };
    return {
      dish: {
        id: dishId,
        nombre: d && d.nombre ? d.nombre : '',
        descripcion: d && d.descripcion ? d.descripcion : '',
        precio: d && d.precio != null ? (parseFloat(d.precio) || 0) : 0,
        url_imagen: d && d.url_imagen ? d.url_imagen : '',
        nivel_picante: d && d.nivel_picante ? d.nivel_picante : 0,
        porcion: d && d.porcion ? d.porcion : '',
        categoria_nombre: d && d.categoria_nombre ? d.categoria_nombre : '',
        etiquetas_dieteticas: d && Array.isArray(d.etiquetas_dieteticas) ? d.etiquetas_dieteticas : [],
        ingredientes_principales: d && Array.isArray(d.ingredientes_principales) ? d.ingredientes_principales : []
      },
      restaurant,
      matchScore: score,
      matchPercentage: Math.round(score * 100),
      reasons: ['Seleccionado según datos disponibles del menú.'],
      tags: d && Array.isArray(d.etiquetas_dieteticas) ? d.etiquetas_dieteticas : (d && Array.isArray(d.ingredientes_principales) ? d.ingredientes_principales.slice(0, 3) : [])
    };
  });
}

module.exports = {
  localMxnBudgetEnabled,
  evaluateBudgetPrice,
  evaluateRestrictionAgainstDish,
  evaluateDishEligibility,
  evaluateEligibility,
  rankDeterministic,
  buildSafeFallbackRecommendations
};
