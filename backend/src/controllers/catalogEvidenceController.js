'use strict';

const { createCatalogEvidenceService } = require('../services/catalogEvidenceService');

/** Authenticated owner endpoints. Strict bodies; 400 invalid, 403 scope/role,
 * 404 missing, 409 stale snapshot, 422 insufficient recipe, 503 schema pending.
 * Actor identity always comes from the verified session; never the body.
 */
function handler(operation) {
  return async (req, res) => {
    try {
      const service = createCatalogEvidenceService(require('../config/db'));
      const result = await operation(service, req);
      return res.json(result);
    } catch (error) {
      const unavailable = ['42P01', '42703'].includes(error.code);
      const concurrent = ['40P01', '40001', '55P03'].includes(error.code);
      const status = unavailable ? 503 : (concurrent ? 409 : (error.status || 500));
      return res.status(status).json({ error: { code: unavailable ? 'EVIDENCE_UNAVAILABLE' :
        (concurrent ? 'EVIDENCE_CONCURRENT_CHANGE' : (error.status ? error.code : 'EVIDENCE_OPERATION_FAILED')) } });
    }
  };
}

module.exports = {
  inspect: handler((s, r) => s.inspect(r.user, r.user.id, r.params.id)),
  confirmCurrency: handler((s, r) => s.confirmCurrency(r.user, r.user.id, r.body)),
  confirmAbsence: handler((s, r) => s.confirmAbsence(r.user, r.user.id, r.params.id, r.body)),
  revoke: handler((s, r) => s.revoke(r.user, r.user.id, r.params.kind, r.params.evidenceId, r.body))
};
