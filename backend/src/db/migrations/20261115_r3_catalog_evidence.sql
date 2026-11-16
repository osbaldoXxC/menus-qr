-- R3 evidence: prepared only; do not execute without separate authorization.
BEGIN;

SET LOCAL lock_timeout = '5s';
-- Requires B1-T04. Revisions identify changes, never imply verification.
ALTER TABLE platillos ADD COLUMN evidencia_precio_revision uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE platillos ADD COLUMN evidencia_receta_revision uuid NOT NULL DEFAULT gen_random_uuid();

-- Acceso tenant con FKs compuestas; primero auditar duplicados e integridad.
ALTER TABLE platillos ADD CONSTRAINT uq_platillo_restaurante UNIQUE (id, restaurante_id);

CREATE TABLE confirmacion_moneda_restaurante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES restaurantes(id),
  moneda char(3) NOT NULL CHECK (moneda = 'MXN'),
  catalogo_huella text NOT NULL CHECK (catalogo_huella ~ '^[a-f0-9]{64}$'),
  actor_id uuid NOT NULL, actor_tipo text NOT NULL CHECK (actor_tipo = 'RESTAURANTE'),
  confirmado_en timestamptz NOT NULL DEFAULT now(), procedencia text NOT NULL,
  revocado_en timestamptz, revocado_por uuid, motivo_revocacion text,
  UNIQUE (id, restaurante_id),
  CHECK (actor_id = restaurante_id),
  CHECK (length(trim(procedencia)) BETWEEN 1 AND 1000),
  CHECK (revocado_por IS NULL OR revocado_por = restaurante_id),
  CHECK ((revocado_en IS NULL AND revocado_por IS NULL AND motivo_revocacion IS NULL) OR
         (revocado_en IS NOT NULL AND revocado_por IS NOT NULL AND motivo_revocacion IS NOT NULL AND length(trim(motivo_revocacion)) > 0))
);
CREATE TABLE confirmacion_precio_platillo (
  confirmacion_id uuid NOT NULL, restaurante_id uuid NOT NULL, platillo_id uuid NOT NULL,
  precio_confirmado numeric(10,2) NOT NULL CHECK (precio_confirmado >= 0),
  version_precio text NOT NULL CHECK (length(version_precio) > 0),
  PRIMARY KEY (confirmacion_id, platillo_id),
  FOREIGN KEY (confirmacion_id, restaurante_id) REFERENCES confirmacion_moneda_restaurante(id, restaurante_id),
  FOREIGN KEY (platillo_id, restaurante_id) REFERENCES platillos(id, restaurante_id)
);
CREATE INDEX idx_precio_evidencia_platillo ON confirmacion_precio_platillo(restaurante_id, platillo_id);
CREATE INDEX idx_moneda_vigente_restaurante ON confirmacion_moneda_restaurante(restaurante_id, confirmado_en DESC) WHERE revocado_en IS NULL;

-- Taxonomia curada y versionada; sinonimos y derivados tienen direccion distinta.
CREATE TABLE exclusion_grupo_version (
  grupo text NOT NULL CHECK (grupo ~ '^[a-z][a-z0-9_]{0,63}$'), version integer NOT NULL CHECK (version > 0),
  estado text NOT NULL CHECK (estado IN ('borrador','aprobada','retirada')),
  fuente text NOT NULL CHECK (length(trim(fuente)) > 0), aprobado_por uuid, aprobado_en timestamptz,
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  PRIMARY KEY (grupo, version),
  CHECK (estado <> 'aprobada' OR (aprobado_por IS NOT NULL AND aprobado_en IS NOT NULL))
);
CREATE UNIQUE INDEX uq_exclusion_grupo_aprobado ON exclusion_grupo_version(grupo) WHERE estado = 'aprobada';
CREATE TABLE exclusion_termino (
  grupo text NOT NULL, version integer NOT NULL,
  termino_normalizado text NOT NULL CHECK (termino_normalizado ~ '^[a-z0-9]+([ _][a-z0-9]+)*$'),
  relacion text NOT NULL CHECK (relacion IN ('sinonimo','derivado')),
  fuente text NOT NULL CHECK (length(trim(fuente)) > 0), PRIMARY KEY (grupo, version, termino_normalizado),
  FOREIGN KEY (grupo, version) REFERENCES exclusion_grupo_version(grupo, version)
);
-- Una evidencia especifica, NO una garantia de ausencia de alergeno o trazas.
CREATE TABLE platillo_ausencia_confirmada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurante_id uuid NOT NULL, platillo_id uuid NOT NULL,
  grupo text NOT NULL, taxonomia_version integer NOT NULL, receta_version text NOT NULL,
  receta_revision uuid NOT NULL, taxonomia_revision uuid NOT NULL,
  secciones jsonb NOT NULL CHECK (jsonb_typeof(secciones) = 'object'),
  actor_id uuid NOT NULL, actor_tipo text NOT NULL CHECK (actor_tipo = 'RESTAURANTE'),
  confirmado_en timestamptz NOT NULL DEFAULT now(), procedencia text NOT NULL,
  revocado_en timestamptz, revocado_por uuid, motivo_revocacion text,
  CHECK (actor_id = restaurante_id),
  CHECK (length(trim(procedencia)) BETWEEN 1 AND 1000),
  CHECK (revocado_por IS NULL OR revocado_por = restaurante_id),
  FOREIGN KEY (platillo_id, restaurante_id) REFERENCES platillos(id, restaurante_id),
  FOREIGN KEY (grupo, taxonomia_version) REFERENCES exclusion_grupo_version(grupo, version),
  CHECK ((revocado_en IS NULL AND revocado_por IS NULL AND motivo_revocacion IS NULL) OR
         (revocado_en IS NOT NULL AND revocado_por IS NOT NULL AND motivo_revocacion IS NOT NULL AND length(trim(motivo_revocacion)) > 0))
);
CREATE INDEX idx_ausencia_vigente ON platillo_ausencia_confirmada(restaurante_id, platillo_id, grupo) WHERE revocado_en IS NULL;

-- Immutable evidence; only a single, irreversible revocation is permitted.
CREATE FUNCTION r3_guard_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Evidence must be retained'; END IF;
  IF OLD.revocado_en IS NOT NULL OR NEW.revocado_en IS NULL OR
     (to_jsonb(OLD) - ARRAY['revocado_en','revocado_por','motivo_revocacion']) IS DISTINCT FROM
     (to_jsonb(NEW) - ARRAY['revocado_en','revocado_por','motivo_revocacion']) THEN
    RAISE EXCEPTION 'Only irreversible revocation is allowed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER r3_moneda_immutable BEFORE UPDATE OR DELETE ON confirmacion_moneda_restaurante
  FOR EACH ROW EXECUTE FUNCTION r3_guard_evidence();
CREATE TRIGGER r3_ausencia_immutable BEFORE UPDATE OR DELETE ON platillo_ausencia_confirmada
  FOR EACH ROW EXECUTE FUNCTION r3_guard_evidence();

CREATE FUNCTION r3_deny_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only evidence'; END $$;
CREATE TRIGGER r3_precio_immutable BEFORE UPDATE OR DELETE ON confirmacion_precio_platillo
  FOR EACH ROW EXECUTE FUNCTION r3_deny_mutation();

-- All ordinary SQL writers, including imports, pass these triggers. UUID revisions
-- prevent ABA (change then restore) from resurrecting confirmations.
CREATE FUNCTION r3_catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipe_keys text[] := ARRAY['nombre','descripcion','ingredientes_principales',
  'ingredientes_secundarios','complementos','salsas','aderezos','condimentos',
  'ingredientes_compuestos','sustituciones_permitidas','modificadores_opcionales',
  'etiquetas_dieteticas','alergenos_declarados','contacto_cruzado','nivel_picante','porcion',
  'verification_metadata'];
BEGIN
  NEW.evidencia_precio_revision := OLD.evidencia_precio_revision;
  NEW.evidencia_receta_revision := OLD.evidencia_receta_revision;
  IF pg_trigger_depth() > 1 THEN NEW.evidencia_receta_revision := gen_random_uuid(); END IF;
  IF NEW.precio IS DISTINCT FROM OLD.precio OR NEW.restaurante_id IS DISTINCT FROM OLD.restaurante_id THEN
    NEW.evidencia_precio_revision := gen_random_uuid();
  END IF;
  IF (SELECT jsonb_object_agg(key, value) FROM jsonb_each(to_jsonb(NEW)) WHERE key = ANY(recipe_keys))
       IS DISTINCT FROM
     (SELECT jsonb_object_agg(key, value) FROM jsonb_each(to_jsonb(OLD)) WHERE key = ANY(recipe_keys))
     OR NEW.restaurante_id IS DISTINCT FROM OLD.restaurante_id THEN
    NEW.evidencia_receta_revision := gen_random_uuid();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER r3_catalog_revision BEFORE UPDATE ON platillos FOR EACH ROW EXECUTE FUNCTION r3_catalog_revision();

-- Relational recipes are not silently merged into JSON recipes. Their writers
-- still invalidate any previous confirmation, including insert/delete/restore.
CREATE FUNCTION r3_relational_recipe_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    UPDATE platillos SET evidencia_receta_revision = gen_random_uuid() WHERE id = OLD.platillo_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    UPDATE platillos SET evidencia_receta_revision = gen_random_uuid() WHERE id = NEW.platillo_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER r3_relational_recipe_changed AFTER INSERT OR UPDATE OR DELETE ON receta_platillo
  FOR EACH ROW EXECUTE FUNCTION r3_relational_recipe_changed();
CREATE FUNCTION r3_ingredient_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE platillos SET evidencia_receta_revision = gen_random_uuid()
    WHERE id IN (SELECT platillo_id FROM receta_platillo WHERE ingrediente_id = OLD.id);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER r3_ingredient_changed BEFORE UPDATE OR DELETE ON ingredientes_catalogo
  FOR EACH ROW EXECUTE FUNCTION r3_ingredient_changed();

-- A reviewed taxonomy is immutable; retirement is irreversible. New meanings
-- require a new version and explicit review. No taxonomy or history is approved here.
CREATE FUNCTION r3_taxonomy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Retire taxonomy instead'; END IF;
  IF OLD.estado = 'retirada' OR (OLD.estado = 'aprobada' AND
     (NEW.estado <> 'retirada' OR (to_jsonb(NEW) - 'estado') IS DISTINCT FROM (to_jsonb(OLD) - 'estado'))) THEN
    RAISE EXCEPTION 'Reviewed taxonomy is immutable';
  END IF;
  NEW.revision := gen_random_uuid();
  RETURN NEW;
END $$;
CREATE TRIGGER r3_taxonomy_guard BEFORE UPDATE OR DELETE ON exclusion_grupo_version
  FOR EACH ROW EXECUTE FUNCTION r3_taxonomy_guard();
CREATE FUNCTION r3_term_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g text; v integer; s text;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.grupo, NEW.version) IS DISTINCT FROM (OLD.grupo, OLD.version) THEN
    RAISE EXCEPTION 'Term cannot change taxonomy';
  END IF;
  IF TG_OP = 'DELETE' THEN g := OLD.grupo; v := OLD.version;
  ELSE g := NEW.grupo; v := NEW.version; END IF;
  SELECT estado INTO s FROM exclusion_grupo_version WHERE grupo = g AND version = v FOR UPDATE;
  IF s IS DISTINCT FROM 'borrador' THEN RAISE EXCEPTION 'Only draft terms can change'; END IF;
  UPDATE exclusion_grupo_version SET revision = gen_random_uuid() WHERE grupo = g AND version = v;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER r3_term_guard BEFORE INSERT OR UPDATE OR DELETE ON exclusion_termino
  FOR EACH ROW EXECUTE FUNCTION r3_term_guard();
CREATE INDEX idx_exclusion_termino_lookup ON exclusion_termino(termino_normalizado, grupo, version);

-- Separate retained audit log: existing audit cascades on dish deletion.
CREATE TABLE catalogo_evidencia_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL, actor_id uuid NOT NULL,
  accion text NOT NULL CHECK (accion IN ('confirm_currency','confirm_absence','revoke_currency','revoke_absence')),
  evidencia_id uuid NOT NULL, creado_en timestamptz NOT NULL DEFAULT now(),
  detalle jsonb NOT NULL, CHECK (actor_id = restaurante_id)
);
CREATE INDEX idx_evidencia_auditoria_restaurante ON catalogo_evidencia_auditoria(restaurante_id, creado_en DESC);
CREATE TRIGGER r3_audit_immutable BEFORE UPDATE OR DELETE ON catalogo_evidencia_auditoria
  FOR EACH ROW EXECUTE FUNCTION r3_deny_mutation();

CREATE FUNCTION r3_confirm_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_role text; d platillos%ROWTYPE; g exclusion_grupo_version%ROWTYPE;
BEGIN
  SELECT rol INTO owner_role FROM restaurantes WHERE id = NEW.restaurante_id FOR SHARE;
  IF owner_role IS DISTINCT FROM 'RESTAURANTE' THEN RAISE EXCEPTION 'Owner role required'; END IF;
  IF TG_TABLE_NAME = 'confirmacion_moneda_restaurante' THEN RETURN NEW; END IF;
  SELECT * INTO d FROM platillos WHERE id = NEW.platillo_id AND restaurante_id = NEW.restaurante_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dish scope mismatch'; END IF;
  IF TG_TABLE_NAME = 'confirmacion_precio_platillo' THEN
    PERFORM 1 FROM confirmacion_moneda_restaurante WHERE id = NEW.confirmacion_id
      AND restaurante_id = NEW.restaurante_id AND revocado_en IS NULL
      AND confirmado_en = transaction_timestamp() FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Coverage belongs to the confirmation transaction'; END IF;
    IF NEW.precio_confirmado IS DISTINCT FROM d.precio OR NEW.version_precio IS DISTINCT FROM d.evidencia_precio_revision::text THEN
      RAISE EXCEPTION 'Stale price';
    END IF;
  ELSE
    SELECT * INTO g FROM exclusion_grupo_version WHERE grupo = NEW.grupo AND version = NEW.taxonomia_version FOR SHARE;
    IF g.estado IS DISTINCT FROM 'aprobada' OR g.revision IS DISTINCT FROM NEW.taxonomia_revision
       OR NEW.receta_revision IS DISTINCT FROM d.evidencia_receta_revision THEN RAISE EXCEPTION 'Stale recipe or taxonomy'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER r3_moneda_guard BEFORE INSERT ON confirmacion_moneda_restaurante FOR EACH ROW EXECUTE FUNCTION r3_confirm_guard();
CREATE TRIGGER r3_precio_guard BEFORE INSERT ON confirmacion_precio_platillo FOR EACH ROW EXECUTE FUNCTION r3_confirm_guard();
CREATE TRIGGER r3_ausencia_guard BEFORE INSERT ON platillo_ausencia_confirmada FOR EACH ROW EXECUTE FUNCTION r3_confirm_guard();
CREATE TRIGGER r3_moneda_no_truncate BEFORE TRUNCATE ON confirmacion_moneda_restaurante FOR EACH STATEMENT EXECUTE FUNCTION r3_deny_mutation();
CREATE TRIGGER r3_precio_no_truncate BEFORE TRUNCATE ON confirmacion_precio_platillo FOR EACH STATEMENT EXECUTE FUNCTION r3_deny_mutation();
CREATE TRIGGER r3_ausencia_no_truncate BEFORE TRUNCATE ON platillo_ausencia_confirmada FOR EACH STATEMENT EXECUTE FUNCTION r3_deny_mutation();
CREATE TRIGGER r3_audit_no_truncate BEFORE TRUNCATE ON catalogo_evidencia_auditoria FOR EACH STATEMENT EXECUTE FUNCTION r3_deny_mutation();

COMMIT;
