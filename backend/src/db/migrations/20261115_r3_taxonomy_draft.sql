-- PREPARED ONLY. Separate authorization required to execute.
-- Depends on 20261115_r3_catalog_evidence.sql. No approval or historical backfill.
BEGIN;
INSERT INTO exclusion_grupo_version (grupo, version, estado, fuente)
VALUES ('cerdo', 1, 'borrador', 'docs/implementation-v2/03-base-datos/02-verificabilidad-alimentaria.md N.2');
INSERT INTO exclusion_termino (grupo, version, termino_normalizado, relacion, fuente) VALUES
('cerdo',1,'cerdo','sinonimo','Propuesta N.2: pendiente de revisión operativa'),
('cerdo',1,'puerco','sinonimo','Propuesta N.2: pendiente de revisión operativa'),
('cerdo',1,'carne_de_cerdo','sinonimo','Propuesta N.2: pendiente de revisión operativa'),
('cerdo',1,'manteca_de_cerdo','derivado','Propuesta N.2: relación dirigida, no sinónimo intercambiable');
-- Reviewer identity/date and transition to aprobada are deliberately absent.
COMMIT;
