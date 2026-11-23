-- Datos sintéticos: este archivo solo se monta en la base temporal de CI.
DO $$
BEGIN
  IF current_database() <> 'r3_test_isolated' OR current_user <> 'ci_test' THEN
    RAISE EXCEPTION 'La fixture E2E requiere la base y usuario aislados de CI';
  END IF;
END $$;

UPDATE restaurantes
SET password_hash = '$2a$10$HqbjiD615V7FfYaYgQo4KOMKX9hrvZcZVGfmLHcKfpHbwN.OgkeHS',
    email_verificado = true
WHERE id = '10000000-0000-4000-8000-000000000001'
  AND email = 'uno@example.invalid';

INSERT INTO restaurantes (id, nombre_negocio, email, password_hash, rol, estado, email_verificado)
VALUES ('10000000-0000-4000-8000-000000000099', 'Admin CI', 'admin-ci@example.invalid',
        '$2a$10$HqbjiD615V7FfYaYgQo4KOMKX9hrvZcZVGfmLHcKfpHbwN.OgkeHS',
        'SUPER_ADMIN', 'aprobado', true);
