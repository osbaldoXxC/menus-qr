-- Rollback Script: 20261117_r4_comensal_auth_quota_audit.rollback.sql
-- Location: backend/src/db/rollbacks/ (physically separated from migrations/ to prevent auto-discovery execution)
-- Issue #43: [R4/R5][Security] Reversión segura sin destruir usuarios_comensales ni audit_logs existentes.

BEGIN;

DROP TABLE IF EXISTS comensal_uso_eventos;
DROP TABLE IF EXISTS comensal_uso_ventanas;
DROP TABLE IF EXISTS comensal_entitlements;
DROP TABLE IF EXISTS comensal_refresh_tokens;

ALTER TABLE usuarios_comensales DROP CONSTRAINT IF EXISTS chk_usuarios_comensales_rol;
ALTER TABLE usuarios_comensales DROP CONSTRAINT IF EXISTS chk_usuarios_comensales_estado;
DROP INDEX IF EXISTS idx_usuarios_comensales_email_active;

ALTER TABLE usuarios_comensales DROP COLUMN IF EXISTS password_hash;
ALTER TABLE usuarios_comensales DROP COLUMN IF EXISTS rol;
ALTER TABLE usuarios_comensales DROP COLUMN IF EXISTS estado;
ALTER TABLE usuarios_comensales DROP COLUMN IF EXISTS email_verificado;
ALTER TABLE usuarios_comensales DROP COLUMN IF EXISTS updated_at;

UPDATE schema_migrations_audit
SET execution_status = 'ROLLED_BACK',
    executed_at = CURRENT_TIMESTAMP
WHERE version = '20261117_r4_comensal_auth_quota_audit';

COMMIT;
