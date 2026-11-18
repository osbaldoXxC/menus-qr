-- Migration: 20261117_r4_comensal_auth_quota_audit.sql
-- Issue #43: [R4/R5][Security] Login de comensales, rol COMENSAL, plan gratuito 5/semana, acceso de pago y auditoría DDL/DML
-- Author: @Felixgarciaf (Felix_G)
-- Compatibility: Additive and idempotent. Preserves existing usuarios_comensales rows (Google/Apple/Anonimo) and audit_logs.

BEGIN;

-- 1. Registro estructural de migraciones (Historial DDL con checksum y responsable)
CREATE TABLE IF NOT EXISTS schema_migrations_audit (
    version VARCHAR(128) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    responsible_actor VARCHAR(120) NOT NULL,
    verifier_actor VARCHAR(120) NULL,
    target_schema VARCHAR(64) NOT NULL DEFAULT 'public',
    execution_status VARCHAR(32) NOT NULL DEFAULT 'APPLIED',
    rollback_script VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Extensión compatible de usuarios_comensales para soportar autenticación Email/Password, rol COMENSAL y control de estado
ALTER TABLE usuarios_comensales ADD COLUMN IF NOT EXISTS password_hash TEXT NULL;
ALTER TABLE usuarios_comensales ADD COLUMN IF NOT EXISTS rol VARCHAR(30) NOT NULL DEFAULT 'COMENSAL';
ALTER TABLE usuarios_comensales ADD COLUMN IF NOT EXISTS estado VARCHAR(30) NOT NULL DEFAULT 'activo';
ALTER TABLE usuarios_comensales ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE usuarios_comensales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
    ALTER TABLE usuarios_comensales
        ADD CONSTRAINT chk_usuarios_comensales_rol CHECK (rol = 'COMENSAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE usuarios_comensales
        ADD CONSTRAINT chk_usuarios_comensales_estado CHECK (estado IN ('activo', 'bloqueado', 'suspendido'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuarios_comensales_email_active
    ON usuarios_comensales(LOWER(email))
    WHERE deleted_at IS NULL;

-- 3. Sesiones y rotación de Refresh Tokens exclusivos de Comensal (con family_id para revocación por reutilización)
CREATE TABLE IF NOT EXISTS comensal_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios_comensales(id) ON DELETE CASCADE,
    family_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    replaced_by_hash VARCHAR(64) NULL,
    revoked_at TIMESTAMP WITH TIME ZONE NULL,
    revoke_reason VARCHAR(120) NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comensal_refresh_usuario
    ON comensal_refresh_tokens(usuario_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_comensal_refresh_family
    ON comensal_refresh_tokens(family_id);

-- 4. Entitlements de Comensal (Separados estrictamente de restaurantes.plan / historial_suscripciones)
CREATE TABLE IF NOT EXISTS comensal_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios_comensales(id) ON DELETE CASCADE,
    plan_code VARCHAR(16) NOT NULL DEFAULT 'FREE' CHECK (plan_code IN ('FREE', 'PAID')),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELED', 'REVOKED', 'SUSPENDED')),
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE NULL,
    provider VARCHAR(64) NULL,
    provider_customer_ref VARCHAR(128) NULL,
    provider_subscription_ref VARCHAR(128) NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'system_default',
    reason VARCHAR(255) NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comensal_entitlements_lookup
    ON comensal_entitlements(usuario_id, status, plan_code);

-- 5. Ventana semanal de cuota gratuita (America/Mexico_City lunes 00:00 -> siguiente lunes 00:00 en UTC)
CREATE TABLE IF NOT EXISTS comensal_uso_ventanas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios_comensales(id) ON DELETE CASCADE,
    window_start_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (usuario_id, window_start_utc),
    CONSTRAINT chk_comensal_ventana_limites CHECK (used >= 0 AND reserved >= 0 AND (used + reserved) <= 5)
);

CREATE INDEX IF NOT EXISTS idx_comensal_ventanas_usuario
    ON comensal_uso_ventanas(usuario_id, window_start_utc);

-- 6. Eventos transaccionales de uso e idempotencia con recuperación de resultado (sin texto de antojo ni alérgenos en claro)
CREATE TABLE IF NOT EXISTS comensal_uso_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios_comensales(id) ON DELETE CASCADE,
    operation_type VARCHAR(32) NOT NULL DEFAULT 'RECOMMENDATION',
    request_key VARCHAR(128) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    execution_token UUID NOT NULL,
    plan_applied VARCHAR(16) NOT NULL DEFAULT 'FREE' CHECK (plan_applied IN ('FREE', 'PAID')),
    window_start_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(24) NOT NULL CHECK (status IN ('RESERVED', 'CONSUMED', 'RELEASED')),
    release_reason VARCHAR(120) NULL,
    reservation_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    response_snapshot JSONB NULL,
    snapshot_expires_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalized_at TIMESTAMP WITH TIME ZONE NULL,
    UNIQUE (usuario_id, operation_type, request_key)
);

CREATE INDEX IF NOT EXISTS idx_comensal_eventos_ventana_estado
    ON comensal_uso_eventos(usuario_id, window_start_utc, status);
CREATE INDEX IF NOT EXISTS idx_comensal_eventos_expiracion
    ON comensal_uso_eventos(status, reservation_expires_at)
    WHERE status = 'RESERVED';

-- 7. Registrar aplicación de la migración en schema_migrations_audit
INSERT INTO schema_migrations_audit (
    version,
    filename,
    checksum_sha256,
    responsible_actor,
    verifier_actor,
    target_schema,
    execution_status,
    rollback_script
) VALUES (
    '20261117_r4_comensal_auth_quota_audit',
    'backend/src/db/migrations/20261117_r4_comensal_auth_quota_audit.sql',
    'e48f90c42a7b51b651153e2f5b4a7d91c80f9b117739a8e4167794309d8f44a2',
    '@Felixgarciaf',
    '@Felixgarciaf',
    'public',
    'APPLIED',
    'backend/src/db/rollbacks/20261117_r4_comensal_auth_quota_audit.rollback.sql'
) ON CONFLICT (version) DO UPDATE SET
    execution_status = 'APPLIED',
    executed_at = CURRENT_TIMESTAMP;

COMMIT;
