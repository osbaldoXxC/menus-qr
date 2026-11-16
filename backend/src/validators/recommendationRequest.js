const { z } = require('zod');

const LOCALE_REGEX = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const REQUEST_ID_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;

const trimToString = (v) => (typeof v === 'string' ? v.trim() : v);

const boundedString = (max, min = 0) => z.preprocess(
  (v) => (v === undefined || v === null ? v : trimToString(v)),
  z.string().min(min).max(max)
);

const cravingSchema = z.object({
  text: z.preprocess(
    (v) => (v === undefined || v === null ? '' : trimToString(v)),
    z.string().max(500)
  ).default(''),
  tags: z.preprocess(
    (v) => (v === undefined ? [] : v),
    z.array(z.preprocess(trimToString, z.string().min(1).max(40))).max(10)
  ).default([])
}).strict();

const dietSchema = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== 'string') return v;
    const t = v.trim().toLowerCase();
    return t === '' ? 'none' : t;
  },
  z.enum(['none', 'vegetarian', 'vegan']).nullable().optional()
);

const stringArray = (maxItems) => z.preprocess(
  (v) => (v === undefined ? [] : v),
  z.array(z.preprocess(trimToString, z.string().min(1).max(40))).max(maxItems)
).default([]);

const limitSchema = z.preprocess((v) => {
  if (v === undefined || v === null || v === '') return 5;
  return v;
}, z.union([
  z.number(),
  z.string().regex(/^-?\d+$/)
]).transform((v, ctx) => {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  if (!Number.isInteger(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'limit_must_be_integer' });
    return z.NEVER;
  }
  if (n < 1 || n > 10) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must_be_between_1_and_10' });
    return z.NEVER;
  }
  return n;
}));

const localeSchema = z.preprocess(
  (v) => (v === undefined || v === null || v === '' ? 'es-MX' : trimToString(v)),
  z.string().min(2).max(35).refine((v) => LOCALE_REGEX.test(v), { message: 'invalid_locale' })
).default('es-MX');

const requestIdSchema = z.preprocess(
  (v) => (v === undefined || v === null || v === '' ? undefined : trimToString(v)),
  z.string().max(128).refine((v) => REQUEST_ID_REGEX.test(v), { message: 'invalid_request_id' }).optional()
);

const restrictionsSchema = z.object({
  allergies: stringArray(20).optional(),
  diet: dietSchema,
  excludedIngredients: stringArray(20).optional(),
  budgetMax: z.number().finite().gt(0).max(100000)
    .refine((v) => /^\d+(?:\.\d{1,2})?$/.test(String(v)), { message: 'invalid_decimal_precision' })
    .nullable().optional(),
  budgetCurrency: z.preprocess((v) => typeof v === 'string' ? v.trim().toUpperCase() : v,
    z.literal('MXN').nullable().optional()),
  budgetPerPerson: z.union([z.literal(false), z.null()]).optional()
}).strict().partial();

const optionsSchema = z.object({
  limit: limitSchema.optional(),
  locale: localeSchema.optional(),
  requestId: requestIdSchema
}).strict().partial();

const canonicalRequestSchema = z.object({
  craving: cravingSchema.optional(),
  restrictions: restrictionsSchema.optional(),
  options: optionsSchema.optional()
}).strict();

function generateRequestId() {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function formatZodIssues(issues) {
  return issues.map((issue) => {
    const field = issue.path && issue.path.length ? issue.path.join('.') : 'body';
    let reason = issue.message || 'invalid_value';
    if (issue.code === 'invalid_type') reason = 'invalid_type';
    if (issue.code === 'too_small') reason = 'too_small';
    if (issue.code === 'too_big') reason = 'too_big';
    if (issue.code === 'invalid_enum_value' || issue.code === 'invalid_value') reason = 'invalid_value';
    if (issue.code === 'unrecognized_keys') reason = 'unrecognized_field';
    return { field, reason };
  });
}

// DEC-012 (APROBADA 2026-11-12): envelope canónico externo del recomendador V2.
const DISCLAIMER = 'Basado en información declarada del menú; no garantiza ausencia de trazas o contaminación cruzada.';

function buildSafety({ hasUnverifiable, overall } = {}) {
  return {
    overall: overall || (hasUnverifiable ? 'sin_resultados_verificables' : 'compatible_segun_datos'),
    hasUnverifiableRestrictions: !!hasUnverifiable,
    disclaimer: DISCLAIMER
  };
}

function buildHttpErrorEnvelope({ requestId, errorCode, statusCode, message, details, scope, limitApplied } = {}) {
  const rid = requestId || generateRequestId();
  const safeDetails = Array.isArray(details) ? details : [];
  return {
    requestId: rid,
    recommendations: [],
    meta: {
      requestId: rid,
      scope: scope || null,
      totalCandidates: 0,
      evaluatedCandidates: 0,
      returned: 0,
      limitApplied: typeof limitApplied === 'number' ? limitApplied : 5,
      fallback: false,
      mlUsed: false
    },
    status: { code: statusCode, message: message || '', details: safeDetails },
    safety: buildSafety({ hasUnverifiable: false, overall: 'sin_resultados_verificables' }),
    error: { code: errorCode, message: message || '', retryable: false, details: safeDetails }
  };
}

// Envelope de éxito DEC-012.5. Calcula status.code/safety según resultado real.
// extraMeta: campos legacy transitorios (restaurant_id, recommendedCount, mlReason) para no romper consumidores actuales (renombrado/retiro en R4).
function buildRecommendationSuccessResponse({ requestId, recommendations, scope, totalCandidates, evaluatedCandidates, limitApplied, fallback, mlUsed, hasUnverifiable, extraMeta } = {}) {
  const recs = Array.isArray(recommendations) ? recommendations : [];
  const returned = recs.length;
  let statusCode;
  let statusMessage = null;
  let safetyOverall;
  if (returned === 0) {
    statusCode = 'no_verified_results';
    statusMessage = 'No fue posible verificar recomendaciones seguras con la información disponible.';
    safetyOverall = 'sin_resultados_verificables';
  } else if (fallback) {
    statusCode = 'partial_results_sanitized';
    safetyOverall = 'compatible_segun_datos';
  } else {
    statusCode = 'ok';
    safetyOverall = 'compatible_segun_datos';
  }
  const rid = requestId || generateRequestId();
  const meta = {
    requestId: rid,
    scope: scope || null,
    totalCandidates: typeof totalCandidates === 'number' ? totalCandidates : 0,
    evaluatedCandidates: typeof evaluatedCandidates === 'number' ? evaluatedCandidates : 0,
    returned,
    limitApplied: typeof limitApplied === 'number' ? limitApplied : 5,
    fallback: !!fallback,
    mlUsed: !!mlUsed
  };
  if (extraMeta && typeof extraMeta === 'object') Object.assign(meta, extraMeta);
  return {
    requestId: rid,
    recommendations: recs,
    meta,
    status: { code: statusCode, message: statusMessage, details: [] },
    safety: buildSafety({ hasUnverifiable: !!hasUnverifiable, overall: safetyOverall }),
    error: null
  };
}

function buildValidationErrorResponse(details, requestId, limitApplied) {
  const safeDetails = Array.isArray(details) ? details : [{ field: 'body', reason: 'invalid_request' }];
  const rid = requestId || generateRequestId();
  return {
    requestId: rid,
    recommendations: [],
    meta: {
      requestId: rid,
      scope: null,
      totalCandidates: 0,
      evaluatedCandidates: 0,
      returned: 0,
      limitApplied: typeof limitApplied === 'number' ? limitApplied : 5,
      fallback: false,
      mlUsed: false
    },
    status: {
      code: 'invalid_request',
      message: 'Solicitud inválida.',
      details: safeDetails
    },
    safety: buildSafety({ hasUnverifiable: false, overall: 'sin_resultados_verificables' }),
    error: {
      code: 'INVALID_REQUEST',
      message: 'Solicitud inválida.',
      retryable: false,
      details: safeDetails
    }
  };
}

function normalizeRecommendationRequest(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : body;
  if (input === null || input === undefined) {
    return { ok: false, details: [{ field: 'body', reason: 'invalid_type' }], requestId: generateRequestId(), limitApplied: 5 };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, details: [{ field: 'body', reason: 'invalid_type' }], requestId: generateRequestId(), limitApplied: 5 };
  }

  const parsed = canonicalRequestSchema.safeParse(input);
  if (!parsed.success) {
    const details = formatZodIssues(parsed.error.issues || []);
    return { ok: false, details, requestId: generateRequestId(), limitApplied: 5 };
  }

  const data = parsed.data;
  const craving = {
    text: (data.craving && typeof data.craving.text === 'string') ? data.craving.text : '',
    tags: (data.craving && Array.isArray(data.craving.tags)) ? [...new Set(data.craving.tags)] : []
  };

  const restrictionsIn = data.restrictions || {};

  const allergies = Array.isArray(restrictionsIn.allergies)
    ? [...new Set(restrictionsIn.allergies)]
    : [];

  let diet;
  if (restrictionsIn.diet !== undefined) {
    diet = restrictionsIn.diet;
  } else {
    diet = 'none';
  }
  if (diet === null) diet = 'none';

  const excludedIngredients = Array.isArray(restrictionsIn.excludedIngredients) ? [...new Set(restrictionsIn.excludedIngredients)] : [];

  const optionsIn = data.options || {};
  const limit = (optionsIn.limit !== undefined) ? optionsIn.limit : 5;
  const locale = optionsIn.locale !== undefined ? optionsIn.locale : 'es-MX';
  const requestId = optionsIn.requestId || generateRequestId();

  const restrictions = {
    allergies,
    diet,
    excludedIngredients
  };

  if (Object.prototype.hasOwnProperty.call(restrictionsIn, 'budgetMax')) restrictions.budgetMax = restrictionsIn.budgetMax;
  if (restrictionsIn.budgetMax != null || restrictionsIn.budgetCurrency != null) restrictions.budgetCurrency = restrictionsIn.budgetCurrency || 'MXN';
  if (Object.prototype.hasOwnProperty.call(restrictionsIn, 'budgetPerPerson')) restrictions.budgetPerPerson = restrictionsIn.budgetPerPerson;

  const options = { limit, locale, requestId };

  // Legacy-compatible fields for current downstream logic/fallback (B1-T02 scope: no fallback logic change)
  const legacy = {
    craving,
    diet: diet || 'none',
    allergies,
    limit
  };

  return {
    ok: true,
    requestId,
    limitApplied: limit,
    canonical: { craving, restrictions, options },
    legacy
  };
}

module.exports = {
  normalizeRecommendationRequest,
  buildValidationErrorResponse,
  buildRecommendationSuccessResponse,
  buildHttpErrorEnvelope,
  buildSafety,
  DISCLAIMER,
  generateRequestId
};
