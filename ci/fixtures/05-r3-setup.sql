-- 1. En r3_test_isolated: aprobar la versión de taxonomía de cerdo para pruebas de inmutabilidad y ausencia
UPDATE exclusion_grupo_version
SET estado = 'aprobada',
    aprobado_por = '00000000-0000-4000-8000-000000000001',
    aprobado_en = now()
WHERE grupo = 'cerdo' AND version = 1 AND estado = 'borrador';

-- 2. Asegurar que los restaurantes de fixtures tengan el password hash válido de 'Synthetic-only-123!'
UPDATE restaurantes
SET password_hash = '$2a$10$HqbjiD615V7FfYaYgQo4KOMKX9hrvZcZVGfmLHcKfpHbwN.OgkeHS',
    email_verificado = true
WHERE id IN ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');

-- 3. Crear base de datos r3_test_rollback para pruebas de rollback y esquema no versionado
CREATE DATABASE r3_test_rollback OWNER ci_test;

\connect r3_test_rollback
\i /docker-entrypoint-initdb.d/01-schema.sql
\i /docker-entrypoint-initdb.d/02-fixtures.sql

UPDATE restaurantes
SET password_hash = '$2a$10$HqbjiD615V7FfYaYgQo4KOMKX9hrvZcZVGfmLHcKfpHbwN.OgkeHS',
    email_verificado = true
WHERE id IN ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');

\connect r3_test_isolated
