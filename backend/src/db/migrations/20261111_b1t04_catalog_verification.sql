-- B1-T04-C1: additive catalog verification metadata (idempotent, no destructive changes, no auto-verify historical data)
BEGIN;

-- 1) Canonical allergen catalog and relations (additive, reference data)
CREATE TABLE IF NOT EXISTS alergenos_canonicos (
  id VARCHAR(64) PRIMARY KEY,
  nombre_canonico VARCHAR(120) NOT NULL UNIQUE,
  descripcion TEXT NULL,
  fuente VARCHAR(255) NULL,
  nivel_verificacion VARCHAR(50) NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alergeno_terminos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alergeno_id VARCHAR(64) NOT NULL REFERENCES alergenos_canonicos(id) ON DELETE CASCADE,
  termino_normalizado VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- sinonimo | variante | derivado | compuesto
  fuente VARCHAR(255) NULL,
  nivel_verificacion VARCHAR(50) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (alergeno_id, termino_normalizado, tipo)
);

CREATE INDEX IF NOT EXISTS idx_alergeno_terminos_termino ON alergeno_terminos(termino_normalizado);
CREATE INDEX IF NOT EXISTS idx_alergeno_terminos_alergeno ON alergeno_terminos(alergeno_id);

-- 2) Recipe/catalog section columns required by B1-T04 verification/completeness/versioning (additive, conservative defaults)
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS ingredientes_secundarios JSONB DEFAULT '[]'::jsonb;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS salsas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS aderezos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS condimentos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS ingredientes_compuestos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS sustituciones_permitidas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS modificadores_opcionales JSONB DEFAULT '[]'::jsonb;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS alergenos_declarados JSONB DEFAULT '[]'::jsonb;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS contacto_cruzado JSONB NULL;

-- 3) Dish verification metadata (additive, conservative defaults; historical records remain unverified)
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS verification_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS verification_state VARCHAR(50) NOT NULL DEFAULT 'declared_unverified';
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS completeness_state VARCHAR(50) NOT NULL DEFAULT 'incomplete';
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS cross_contamination_state VARCHAR(50) NOT NULL DEFAULT 'not_assessed';
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS verified_recipe_version VARCHAR(128) NULL;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS current_recipe_version VARCHAR(128) NULL;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS verified_by UUID NULL;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS verification_source VARCHAR(255) NULL;
ALTER TABLE platillos ADD COLUMN IF NOT EXISTS verification_updated_at TIMESTAMP WITH TIME ZONE NULL;

-- 4) Audit trail for dish verification changes (additive)
CREATE TABLE IF NOT EXISTS platillo_verificacion_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platillo_id UUID NOT NULL REFERENCES platillos(id) ON DELETE CASCADE,
  restaurante_id UUID NOT NULL,
  accion VARCHAR(100) NOT NULL,
  estado_anterior JSONB NULL,
  estado_nuevo JSONB NULL,
  actor_id UUID NULL,
  actor_rol VARCHAR(50) NULL,
  motivo TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_platillo_verif_aud_platillo ON platillo_verificacion_auditoria(platillo_id);
CREATE INDEX IF NOT EXISTS idx_platillo_verif_aud_restaurante ON platillo_verificacion_auditoria(restaurante_id);

-- 5) Seed canonical allergens (idempotent, documented base)
INSERT INTO alergenos_canonicos (id, nombre_canonico, fuente, nivel_verificacion) VALUES
('gluten','gluten','catalogo_base_documentado_b1t04','documented_rule'),
('crustaceos','crustaceos','catalogo_base_documentado_b1t04','documented_rule'),
('huevo','huevo','catalogo_base_documentado_b1t04','documented_rule'),
('pescado','pescado','catalogo_base_documentado_b1t04','documented_rule'),
('cacahuate','cacahuate','catalogo_base_documentado_b1t04','documented_rule'),
('soya','soya','catalogo_base_documentado_b1t04','documented_rule'),
('lacteos','lacteos','catalogo_base_documentado_b1t04','documented_rule'),
('frutos_secos','frutos_secos','catalogo_base_documentado_b1t04','documented_rule'),
('apio','apio','catalogo_base_documentado_b1t04','documented_rule'),
('mostaza','mostaza','catalogo_base_documentado_b1t04','documented_rule'),
('sesamo','sesamo','catalogo_base_documentado_b1t04','documented_rule'),
('sulfitos','sulfitos','catalogo_base_documentado_b1t04','documented_rule'),
('altramuces','altramuces','catalogo_base_documentado_b1t04','documented_rule'),
('moluscos','moluscos','catalogo_base_documentado_b1t04','documented_rule')
ON CONFLICT (id) DO NOTHING;

COMMIT;
