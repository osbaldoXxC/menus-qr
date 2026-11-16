'use strict';

const { generateRequestId } = require('../validators/recommendationRequest');
const vocabulary = require('./linguisticVocabulary');

const REQUEST_ID_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;

const STATES = Object.freeze({
  COMPATIBLE_SEGUN_DATOS: 'compatible_segun_datos',
  INCOMPATIBLE: 'incompatible',
  DESCONOCIDO: 'desconocido'
});

const ORIGINS = Object.freeze({
  STRUCTURED: 'structured',
  ML_EXTRACTION: 'ml_extraction'
});

function ensureRequestId(requestId) {
  if (typeof requestId === 'string') {
    const t = requestId.trim();
    if (t && REQUEST_ID_REGEX.test(t)) return t;
  }
  return generateRequestId();
}

function normalizeCategory(value) {
  if (typeof value !== 'string') return 'unknown';
  const t = value.trim().toLowerCase();
  return t || 'unknown';
}

function normalizeValue(category, value) {
  if (value === undefined || value === null) return null;
  if (category === 'diet') {
    if (typeof value !== 'string') return null;
    const t = value.trim().toLowerCase();
    if (!t || t === 'none') return 'none';
    return t;
  }
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    return t || null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((v) => normalizeValue('unknown', v)).filter((v) => v != null).join(',');
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function makeRestriction({ requestId, category, value, origin, state, reason, conflicts = [], sourceRef = null, raw = undefined }) {
  const cat = normalizeCategory(category);
  const norm = normalizeValue(cat, value);
  return {
    id: `${cat}:${norm == null ? 'null' : norm}:${origin}:${sourceRef || 'na'}`,
    category: cat,
    value,
    normalizedValue: norm,
    origin,
    state,
    reason: reason || 'unspecified',
    conflicts: Array.isArray(conflicts) ? conflicts : [],
    sourceRef,
    requestId,
    ...(raw !== undefined ? { raw } : {})
  };
}

function toArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function extractStructuredEntries(structured) {
  const entries = [];
  const s = structured && typeof structured === 'object' ? structured : {};
  if (Object.prototype.hasOwnProperty.call(s, 'diet')) {
    const diet = s.diet;
    if (diet !== undefined && diet !== null && !(typeof diet === 'string' && (diet.trim() === '' || diet.trim().toLowerCase() === 'none'))) {
      entries.push({ category: 'diet', value: diet, sourceRef: 'structured.diet' });
    }
  }
  toArray(s.allergies).forEach((v, i) => {
    if (v !== undefined && v !== null && v !== '') entries.push({ category: 'allergy', value: v, sourceRef: `structured.allergies[${i}]` });
  });
  toArray(s.excludedIngredients).forEach((v, i) => {
    if (v !== undefined && v !== null && v !== '') entries.push({ category: 'exclusion', value: v, sourceRef: `structured.excludedIngredients[${i}]` });
  });
  if (s.budgetMax != null) entries.push({ category: 'budget', value: s.budgetMax, sourceRef: 'structured.budgetMax' });
  Object.keys(s).forEach((key) => {
    if (['diet', 'allergies', 'excludedIngredients'].includes(key)) return;
    if (key.startsWith('budget')) return;
    const val = s[key];
    if (Array.isArray(val)) {
      val.forEach((v, i) => entries.push({ category: key, value: v, sourceRef: `structured.${key}[${i}]` }));
    } else if (val !== undefined && val !== null && val !== '') {
      entries.push({ category: key, value: val, sourceRef: `structured.${key}` });
    }
  });
  return entries;
}

function isExtractionAmbiguous(extraction) {
  if (!extraction || typeof extraction !== 'object') return false;
  if (extraction.ambiguous === true) return true;
  if (extraction.ambiguity === true) return true;
  if (extraction.ambiguous === 'unknown' || extraction.status === 'ambiguous') return true;
  if (Array.isArray(extraction.ambiguities) && extraction.ambiguities.length > 0) return true;
  return false;
}

function extractionAvailability(extraction) {
  if (extraction === null || extraction === undefined) return 'absent';
  if (typeof extraction !== 'object') return 'not_verifiable';
  if (extraction.available === false) return 'absent';
  if (extraction.error || extraction.status === 'error' || extraction.status === 'unavailable') return 'not_verifiable';
  if (extraction.notVerifiable === true || extraction.verifiable === false) return 'not_verifiable';
  return 'available';
}

function extractMlEntries(extraction) {
  if (!extraction || typeof extraction !== 'object') return [];
  const entries = [];
  const pushItem = (category, item, sourceRefBase, index) => {
    if (item === undefined || item === null || item === '') return;
    if (typeof item === 'object' && !Array.isArray(item)) {
      const value = Object.prototype.hasOwnProperty.call(item, 'value') ? item.value : item.name;
      const itemAmbiguous = item.ambiguous === true || item.ambiguity === true || item.uncertain === true || item.status === 'ambiguous';
      const itemNotVerifiable = item.notVerifiable === true || item.verifiable === false || item.status === 'unknown';
      entries.push({
        category,
        value: value !== undefined ? value : item,
        sourceRef: `${sourceRefBase}[${index}]`,
        ambiguous: itemAmbiguous,
        notVerifiable: itemNotVerifiable,
        raw: item
      });
      return;
    }
    entries.push({ category, value: item, sourceRef: `${sourceRefBase}[${index}]`, ambiguous: false, notVerifiable: false, raw: item });
  };
  const map = [
    ['diet', extraction.diet !== undefined ? extraction.diet : extraction.diets, 'extraction.diet'],
    ['allergy', extraction.allergies, 'extraction.allergies'],
    ['exclusion', extraction.exclusions || extraction.excludedIngredients, 'extraction.exclusions']
  ];
  map.forEach(([category, value, base]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => pushItem(category, v, base, i));
    } else {
      pushItem(category, value, base, 0);
    }
  });
  if (Array.isArray(extraction.items)) {
    extraction.items.forEach((it, i) => {
      if (!it || typeof it !== 'object') return;
      const cat = it.category || it.type || 'unknown';
      if (String(cat).toLowerCase().startsWith('budget')) return;
      pushItem(cat, it, `extraction.items`, i);
    });
  }
  return entries;
}

function sameSemanticValue(aNorm, bNorm) {
  if (aNorm == null || bNorm == null) return false;
  return aNorm === bNorm;
}

function buildIssue(requestId, code, message, details) {
  return { code, message, details: details || null, requestId };
}

function corroborateTextBudget(extraction, structured) {
  const budget = extraction && extraction.budget;
  if (structured.budgetMax != null || !budget || budget.ambiguous !== false ||
      extraction.ambiguous === true || budget.perPerson === true || budget.currency !== 'MXN') return null;
  const text = typeof budget.sourceText === 'string' ? budget.sourceText.trim().toLowerCase() : '';
  // Whole, explicit maximum clause only. Ranges, foreign currency, multiple
  // amounts, contradictions and per-person wording are not promoted to filters.
  const match = /^(?:(?:tengo|mi presupuesto es|presupuesto de|hasta|maximo|máximo) |quiero [a-záéíóúñ ]+ de (?:maximo|máximo) )(\d+(?:\.\d{1,2})?) (?:pesos|mxn)(?: y quiero [a-záéíóúñ ]+| para comer)?[.!]?$/.exec(text) ||
    /^quiero [a-záéíóúñ ]+(?:,?\s+(?:pero|y)\s+)(?:solo\s+)?tengo (\d+(?:\.\d{1,2})?) (?:pesos|mxn)[.!]?$/.exec(text);
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const knownOperators = vocabulary.contextualForms('maximo');
  const operators = knownOperators.length ? knownOperators : ['no mas de','no quiero gastar mas de','sin gastar mas de'];
  const safeOperators = [...operators,'traigo'].map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const colloquial = new RegExp(`^(?:${safeOperators}) (\\d+(?:\\.\\d{1,2})?|diez|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento) (?:pesos?|pesitos|varos?|mxn)[.!]?$`).exec(normalized);
  if (!match && !colloquial) return null;
  const words = {diez:10,veinte:20,treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100,ciento:100};
  const value = (match || colloquial)[1];
  const amount = words[value] || Number(value);
  if (amount <= 0 || amount > 100000 || amount !== budget.amount) return null;
  return amount;
}

function consolidateRestrictions({ requestId, structuredRestrictions, mlExtraction } = {}) {
  const rid = ensureRequestId(requestId);
  const structured = structuredRestrictions && typeof structuredRestrictions === 'object' ? structuredRestrictions : {};
  const availability = extractionAvailability(mlExtraction);
  const extractionAmbiguousGlobal = isExtractionAmbiguous(mlExtraction);
  const structuredEntries = extractStructuredEntries(structured);
  const mlEntries = availability === 'available' ? extractMlEntries(mlExtraction) : [];

  const consolidated = [];
  const textBudget = corroborateTextBudget(mlExtraction, structured);
  if (textBudget !== null) consolidated.push(makeRestriction({ requestId: rid, category: 'budget',
    value: textBudget, origin: 'text_corroborated', state: STATES.DESCONOCIDO,
    reason: 'text_budget_corroborated', sourceRef: 'extraction.budget.sourceText' }));
  const issues = [];
  const trace = {
    requestId: rid,
    vocabularyVersion: vocabulary.registry ? vocabulary.registry.version : 'unavailable',
    extractionAvailability: availability,
    extractionAmbiguous: extractionAmbiguousGlobal,
    structuredCount: structuredEntries.length,
    mlCount: mlEntries.length,
    conflictCount: 0,
    omissionCount: 0
  };

  structuredEntries.forEach((s, idx) => {
    const cat = normalizeCategory(s.category);
    const sNorm = normalizeValue(cat, s.value);
    const origin = ORIGINS.STRUCTURED;
    const idRef = s.sourceRef || `structured.${idx}`;

    const matches = mlEntries.filter((m) => normalizeCategory(m.category) === cat && sameSemanticValue(normalizeValue(cat, m.value), sNorm));
    const catMl = mlEntries.filter((m) => normalizeCategory(m.category) === cat);
    const conflicts = [];

    if (availability === 'absent') {
      issues.push(buildIssue(rid, 'ml_extraction_absent', 'Extracción ML ausente; se preserva restricción estructurada de forma conservadora.', { category: cat, sourceRef: idRef }));
    } else if (availability === 'not_verifiable') {
      issues.push(buildIssue(rid, 'ml_extraction_not_verifiable', 'Extracción ML no verificable; se preserva restricción estructurada de forma conservadora.', { category: cat, sourceRef: idRef }));
    }

    if (matches.some((m) => m.ambiguous)) {
      consolidated.push(makeRestriction({
        requestId: rid, category: cat, value: s.value, origin, state: STATES.DESCONOCIDO,
        reason: 'ml_extraction_ambiguous', conflicts: [{ type: 'ambiguous_extraction', sourceRef: matches.find((m) => m.ambiguous).sourceRef }],
        sourceRef: idRef
      }));
      return;
    }

    if (extractionAmbiguousGlobal && catMl.length > 0) {
      consolidated.push(makeRestriction({
        requestId: rid, category: cat, value: s.value, origin, state: STATES.DESCONOCIDO,
        reason: 'ml_extraction_globally_ambiguous', conflicts: [{ type: 'global_ambiguity', sourceRef: 'extraction' }],
        sourceRef: idRef
      }));
      return;
    }

    if (catMl.length > 0 && matches.length === 0) {
      const c = { type: 'structured_vs_extraction_contradiction', category: cat, structured: s.value, extracted: catMl.map((m) => m.value) };
      conflicts.push(c);
      trace.conflictCount += 1;
      issues.push(buildIssue(rid, 'contradiction_detected', 'Contradicción entre restricción estructurada y extracción ML; prevalece protección.', c));
      consolidated.push(makeRestriction({
        requestId: rid, category: cat, value: s.value, origin, state: STATES.DESCONOCIDO,
        reason: 'contradiction_unresolved_protective', conflicts, sourceRef: idRef
      }));
      return;
    }

    if (availability === 'available' && catMl.length === 0) {
      trace.omissionCount += 1;
      issues.push(buildIssue(rid, 'possible_ml_omission', 'Extracción ML no reflejó la restricción estructurada; se preserva la restricción.', { category: cat, sourceRef: idRef }));
    }

    // Structured explicit restriction preserved. State remains conservatively desconocido unless external verifiable evidence is provided (not assumed here).
    consolidated.push(makeRestriction({
      requestId: rid, category: cat, value: s.value, origin, state: STATES.DESCONOCIDO,
      reason: 'structured_preserved_verification_pending', conflicts, sourceRef: idRef
    }));
  });

  mlEntries.forEach((m, idx) => {
    const cat = normalizeCategory(m.category);
    const mNorm = normalizeValue(cat, m.value);
    const sameCatStructured = structuredEntries.filter((s) => normalizeCategory(s.category) === cat);
    const exactStructured = sameCatStructured.find((s) => sameSemanticValue(normalizeValue(cat, s.value), mNorm));

    if (exactStructured) {
      const state = (m.ambiguous || extractionAmbiguousGlobal || m.notVerifiable) ? STATES.DESCONOCIDO : STATES.DESCONOCIDO;
      const reason = m.ambiguous || extractionAmbiguousGlobal ? 'ml_extraction_ambiguous' : (m.notVerifiable ? 'ml_extraction_not_verifiable' : 'aligned_with_structured_verification_pending');
      consolidated.push(makeRestriction({
        requestId: rid, category: cat, value: m.value, origin: ORIGINS.ML_EXTRACTION, state,
        reason, conflicts: [], sourceRef: m.sourceRef || `extraction.${idx}`, raw: m.raw
      }));
      return;
    }

    if (sameCatStructured.length > 0) {
      // Contradiction already represented on structured side; keep extracted as conflicting trace only.
      consolidated.push(makeRestriction({
        requestId: rid, category: cat, value: m.value, origin: ORIGINS.ML_EXTRACTION, state: STATES.DESCONOCIDO,
        reason: 'contradicts_structured_restriction', conflicts: [{ type: 'extraction_conflicts_structured' }], sourceRef: m.sourceRef || `extraction.${idx}`, raw: m.raw
      }));
      return;
    }

    if (m.ambiguous || extractionAmbiguousGlobal || m.notVerifiable) {
      consolidated.push(makeRestriction({
        requestId: rid, category: cat, value: m.value, origin: ORIGINS.ML_EXTRACTION, state: STATES.DESCONOCIDO,
        reason: m.ambiguous || extractionAmbiguousGlobal ? 'ml_extraction_ambiguous' : 'ml_extraction_not_verifiable',
        conflicts: [], sourceRef: m.sourceRef || `extraction.${idx}`, raw: m.raw
      }));
      return;
    }

    // Inferred extraction without explicit structured restriction: do not auto-confirm as compatible; conservative unknown.
    consolidated.push(makeRestriction({
      requestId: rid, category: cat, value: m.value, origin: ORIGINS.ML_EXTRACTION, state: STATES.DESCONOCIDO,
      reason: 'inferred_extraction_verification_required', conflicts: [], sourceRef: m.sourceRef || `extraction.${idx}`, raw: m.raw
    }));
  });

  if (consolidated.length < structuredEntries.length) {
    const missing = structuredEntries.length - consolidated.length;
    trace.omissionCount += missing;
    issues.push(buildIssue(rid, 'structured_restriction_omission_detected', 'Posible omisión de restricciones estructuradas detectada; resultado conservador.', { missing }));
  }

  const hasUnresolvedProblem = trace.conflictCount > 0 || consolidated.some((r) => r.state === STATES.DESCONOCIDO) || availability !== 'available';
  const summary = {
    total: consolidated.length,
    byState: {
      [STATES.COMPATIBLE_SEGUN_DATOS]: consolidated.filter((r) => r.state === STATES.COMPATIBLE_SEGUN_DATOS).length,
      [STATES.INCOMPATIBLE]: consolidated.filter((r) => r.state === STATES.INCOMPATIBLE).length,
      [STATES.DESCONOCIDO]: consolidated.filter((r) => r.state === STATES.DESCONOCIDO).length
    },
    conservative: hasUnresolvedProblem || consolidated.length === 0 ? true : false
  };

  return {
    requestId: rid,
    consolidatedRestrictions: consolidated,
    states: STATES,
    summary,
    trace,
    issues
  };
}

function applyCompatibilityEvidence(result, evidence = {}) {
  // Deterministic, internal-only helper for tests/future integration: applies provided verifiable evidence without ML decisions.
  // Not used in production flow; does not infer compatibility from absence.
  if (!result || !Array.isArray(result.consolidatedRestrictions)) return result;
  const byId = evidence.byId && typeof evidence.byId === 'object' ? evidence.byId : {};
  result.consolidatedRestrictions = result.consolidatedRestrictions.map((r) => {
    const ev = byId[r.id];
    if (!ev || typeof ev !== 'object') return r;
    if (ev.state === STATES.INCOMPATIBLE && ev.evidence) {
      return { ...r, state: STATES.INCOMPATIBLE, reason: ev.reason || 'evidence_incompatible', evidence: ev.evidence };
    }
    if (ev.state === STATES.COMPATIBLE_SEGUN_DATOS && ev.evidence) {
      return { ...r, state: STATES.COMPATIBLE_SEGUN_DATOS, reason: ev.reason || 'evidence_compatible_segun_datos', evidence: ev.evidence };
    }
    return r;
  });
  const c = result.consolidatedRestrictions;
  result.summary = {
    total: c.length,
    byState: {
      [STATES.COMPATIBLE_SEGUN_DATOS]: c.filter((r) => r.state === STATES.COMPATIBLE_SEGUN_DATOS).length,
      [STATES.INCOMPATIBLE]: c.filter((r) => r.state === STATES.INCOMPATIBLE).length,
      [STATES.DESCONOCIDO]: c.filter((r) => r.state === STATES.DESCONOCIDO).length
    },
    conservative: c.some((r) => r.state === STATES.DESCONOCIDO)
  };
  return result;
}

module.exports = {
  STATES,
  ORIGINS,
  consolidateRestrictions,
  applyCompatibilityEvidence
};
