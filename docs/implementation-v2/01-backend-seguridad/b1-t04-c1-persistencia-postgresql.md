# B1-T04-C1 / B1-T04-C1-F / continuaciÃ³n â€” Persistencia y esquema PostgreSQL (validaciÃ³n local Docker)

- Fecha/hora: 2026-11-11 (C1: ~03:16Zâ€“03:31Z, C1-F: ~03:59Zâ€“04:15Z, continuaciÃ³n: ~05:29Zâ€“05:38Z)
- Rama: `v2-segunda-version`
- Estado: **BLOQUEADA/PARCIAL** (migraciÃ³n/persistencia/invalidaciÃ³n/auditorÃ­a y suite integraciÃ³n PostgreSQL real demostradas; `getDishes` y HTTP CRUD+permisos verificados; recomendaciones pÃºblicas canÃ³nicas verificadas como conservadoras/excluyentes; **bloqueos de seguridad/flujo** impiden completar loginâ†’JWT utilizable y CRUD HTTP post-reinicio sin bypass. No se avanza a C1-G/C2/B1-T05.)

## 1. Entorno utilizado (local, desarrollo, no producciÃ³n)
- Docker/Compose obligatorio. Sin producciÃ³n. Sin `docker compose down -v`, sin `docker volume prune`, sin eliminar volÃºmenes/contenedores/imÃ¡genes.
- Servicios: `postgres` (`mexxicanmx_db`, `pgvector/pgvector:pg16`, healthy), `redis` (`menus-qr-redis-1`, healthy), `backend` (`menus-qr-backend-1`, UP). `GET /health` â†’ `{"status":"UP","database":"connected"}`.
- DBs locales: `mexxicanmx_db` (volumen `menus-qr_postgres_data`, `platillos_count=0` antes de migraciÃ³n manual); `b1t04_test` aislada (creada en contenedor, `pgcrypto/vector`) para pruebas/integraciÃ³n con datos ficticios y cleanup. Credenciales no expuestas.

## 2. Comandos ejecutados (reproducibles, sin secretos)
```bash
# Preflight
git branch --show-current
git status --short
git diff --stat
docker compose ps
docker compose exec -T backend sh -c 'node -e "fetch(\"http://localhost:4000/health\").then(r=>r.text()).then(console.log)"'

# Temporal C1-F: origen confirmado (script HTTP C1-F creado en tarea previa) y eliminado (ya no necesario)
rm backend/tmp_http_b1t04_c1f.js
docker compose exec -T backend sh -c 'rm -f /app/c1f2_test.js /app/tmp_http_b1t04_c1f.js'

# MigraciÃ³n + idempotencia (ejecutadas en C1/C1-F)
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < backend/src/db/migrations/20261111_b1t04_catalog_verification.sql
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < backend/src/db/migrations/20261111_b1t04_catalog_verification.sql

# IntegraciÃ³n PostgreSQL real (Docker, b1t04_test)
docker compose exec -T backend sh -c 'cd /app && DATABASE_URL=postgresql://<redacted>@postgres:5432/b1t04_test node --test tests/integration/b1t04Postgres.integration.test.js'

# RegresiÃ³n unitaria
cd backend && node --test tests/unit/catalogVerification.test.js tests/unit/eligibilityEvaluation.test.js tests/unit/b1t04IntegrationFlow.test.js tests/unit/restrictionConsolidation.test.js tests/unit/recommendationValidation.test.js
```
(Flujos HTTP auth/OTP y recomendaciones canÃ³nicas ejecutados como scripts Node en contenedor contra `http://localhost:4000` con datos ficticios y cleanup; sin bypass de autenticaciÃ³n/roles.)

## 3. MigraciÃ³n aplicada y esquema comprobado
- `backend/src/db/migrations/20261111_b1t04_catalog_verification.sql`: aditiva, `BEGIN/COMMIT`, idempotente, sin auto-verificar histÃ³ricos. Aplicada e idempotente en `mexxicanmx_db` y `b1t04_test`. Tablas `alergenos_canonicos` (seed 14), `alergeno_terminos`, `platillo_verificacion_auditoria`; columnas/JSONB/estados/versionado verificados en `platillos`. Esquema sincronizado con `init.sql`, `db/contract/schema.json`, `db.js`.

## 4. Limpieza de temporal
- `backend/tmp_http_b1t04_c1f.js` (untracked, host): contenido inspeccionado â€” script de pruebas HTTP C1-F (JWT/DB/requests, email `b1t04c1f_*`). **Origen confirmado (creado durante C1-F) y ya no necesario. Eliminado** del host y del contenedor (`/app/c1f2_test.js`, `/app/tmp_http_b1t04_c1f.js`).

## 5. InvestigaciÃ³n y resultado de `getDishes`
- No reproducible en estado actual. `menuController.getDishes` filtra por `restaurante_id=req.user.id` con auth+rol+suscripciÃ³n. Evidencia: controller+DB real y HTTP autenticado real (`GET /api/menu/platillos`) retornan platillo creado/actualizado con `verification_summary`. Incidencia previa atribuida a contexto de script ad-hoc. RegresiÃ³n cubierta en suite integraciÃ³n. Sin eliminar filtros de negocio.

## 6. Pruebas HTTP reales y autenticadas (C1-F, vigentes)
- Mecanismo real: JWT `Authorization: Bearer` (`JWT_SECRET` entorno) + `authMiddleware`/`roleMiddleware(['RESTAURANTE','SUPER_ADMIN'])`/`subscriptionMiddleware`.
- Resultados: `GET /api/menu/platillos` sin tokenâ†’401, rol COMENSALâ†’403; `POST /api/menu/platillos`â†’201; `GET`â†’200 (found, summary); `PUT`â†’200 y `GET` refleja actualizaciÃ³n; invalidaciÃ³n por cambio de receta + auditorÃ­a preservada (4 acciones) confirmadas en DB; `POST` invÃ¡lidoâ†’400; `PUT` otro restauranteâ†’404. Sin bypass.

## 7. Flujo real login/OTPâ†’JWT por HTTP (continuaciÃ³n)
- **Ejecutado vÃ­a endpoints reales** (`POST /api/auth/register`, `POST /api/auth/verify-email`, `POST /api/auth/login`) con datos ficticios.
- Para suministrar el cÃ³digo OTP (entregado por correo en el flujo real) se leyÃ³ el valor almacenado en Redis por el backend (`otp:registro:<email>`) â€” **infraestructura de prueba para obtener el cÃ³digo**, sin omitir/suplantar endpoints de verificaciÃ³n.
- **Resultados:**
  - `POST /api/auth/register` â†’ **201** `{requiereVerificacion:true}`.
  - OTP presente en Redis (cÃ³digo obtenido vÃ­a infra de prueba).
  - `POST /api/auth/verify-email` `{email,codigo}` â†’ **200** (verificaciÃ³n exitosa).
  - Estado en DB: `email_verificado=true`, `suscripcion_activa=false`, `estado='pendiente'`, `rol='RESTAURANTE'`.
  - `POST /api/auth/login` â†’ **403** `{mensaje:"Tu correo ya fue verificado. Tu cuenta estÃ¡ en espera de aprobaciÃ³n por el Super Admin."}` â€” **no se obtuvo `access_token`**.
- **Bloqueo de seguridad (documentado):** el flujo real requiere aprobaciÃ³n/activaciÃ³n por Super Admin tras verificaciÃ³n; sin ella el login no emite JWT. Obtener JWT utilizable para `/api/menu/*` exigirÃ­a activar/aprobar cuenta fuera del mecanismo de usuario o saltarse controles (bypass). **No realizado.** Prueba de â€œcrear por HTTP con JWT de login, reiniciar backend y recuperar por HTTPâ€ **BLOQUEADA** por este motivo.

## 8. Recomendaciones pÃºblicas â€” payload canÃ³nico vÃ¡lido (continuaciÃ³n)
- Endpoint real: `POST /api/public/menu/:restaurant_id/recommendations` (pÃºblico).
- **Payload canÃ³nico usado:** `{ "craving": { "text": "pollo", "tags": [] }, "restrictions": { "allergies": ["cacahuate"], "diet": "none", "excludedIngredients": [] }, "options": { "limit": 5, "locale": "es-MX" } }`.
- **Fixture (DB local, ficticio, cleanup):** restaurante aprobado/activo; 3 platillos activos: (A) `contains` cacahuate declarado/metadata, (B) cacahuate `unknown`/incompleto/no verificado, (C) `may_contain` cacahuate/incompleto/no verificado.
- **Resultado:** HTTP **200**, `recommendations_count=0`, `rec_ids=[]`, `any_ineligible_or_unknown_included=false`, `meta={totalCandidates:3, recommendedCount:0, fallback:true}`. **Platillos no elegibles/desconocidos/no verificados excluidos (no recomendados/compatibles por defecto).**

## 9. Persistencia tras reinicio de backend (solo backend)
- **Requisito completo (crear por HTTP, reiniciar solo backend, recuperar por HTTP): BLOQUEADO** â€” depende de JWT obtenido por login real sin bypass (ver punto 7).
- **Verificado:** migraciÃ³n y datos persisten en PostgreSQL (volumen Docker). Backend reiniciado en C1-F y `/health` UP con DB connected; suite de integraciÃ³n PostgreSQL real y consultas SQL confirman persistencia en DB. Sin `docker compose down -v`/prune.
- **No verificado en esta corrida (end-to-end HTTP encadenado):** crearâ†’reiniciar solo `menus-qr-backend-1`â†’`GET` HTTP del mismo registro con token real de login.

## 10. Rutas de consulta individual de platillos
- **InvestigaciÃ³n (`backend/src/routes`, `backend/src/controllers`):**
  - `menuRoutes.js` (`/api/menu`, auth+rol RESTAURANTE/SUPER_ADMIN+suscripciÃ³n): `GET /platillos` (listado, `getDishes`), `POST /platillos`, `PUT /platillos/:id`, `DELETE /platillos/:id`. **No existe `GET /platillos/:id`.**
  - `publicRoutes.js` (`/api/public/menu`): `POST /recommendations`, `GET /:restaurant_id` (menÃº pÃºblico), `POST /:restaurant_id/recommendations`. **No existe endpoint pÃºblico de platillo individual por id.**
  - `restaurantRoutes.js`/admin: sin consulta individual de platillo.
- **ConclusiÃ³n:** **no existe endpoint dedicado de consulta individual de platillo** en rutas actuales (solo listado, update/delete por id, y menÃº pÃºblico agregado).

## 11. Suite automatizada de integraciÃ³n PostgreSQL real
- `backend/tests/integration/b1t04Postgres.integration.test.js` (Docker, `b1t04_test`, sin mocks, cleanup por prueba).
- **4 PASS, 0 FAIL, 0 SKIPPED:** persistencia/JSONB/getDishes; update+versionado+invalidaciÃ³n+auditorÃ­a; histÃ³rico no auto-verificado; elegibilidad conservadora (`contains/may_contain` no compatibles; `unknown`, incompleto, compuesto no resuelto, contacto cruzado desconocido, sin aprobaciÃ³n, versiÃ³n distinta â†’ no `compatible_segun_datos`).

## 12. RegresiÃ³n unitaria
- `cd backend && node --test tests/unit/catalogVerification.test.js tests/unit/eligibilityEvaluation.test.js tests/unit/b1t04IntegrationFlow.test.js tests/unit/restrictionConsolidation.test.js tests/unit/recommendationValidation.test.js`
- **72 PASS, 0 FAIL, 0 SKIPPED**.

## 13. Archivos modificados
- **C1 (en Ã¡rbol):** `backend/src/db/migrations/20261111_b1t04_catalog_verification.sql`, `backend/src/db/init.sql`, `db/contract/schema.json`, `backend/src/config/db.js`
- **C1-F/continuaciÃ³n:** `backend/tests/integration/b1t04Postgres.integration.test.js` (nuevo), `docs/implementation-v2/BITACORA.md`, `docs/implementation-v2/01-backend-seguridad/b1-t04-c1-persistencia-postgresql.md`
- **Eliminado (temporal C1-F, confirmado origen/no necesario):** `backend/tmp_http_b1t04_c1f.js`
- **No modificados:** frontend, `ml-service`, contratos HTTP pÃºblicos, `/interpret`, locks/package manifests, migraciones no relacionadas, DEC pendientes, B1-T04-C2/C1-G/B1-T05.

## 14. Limitaciones / bloqueos y criterio de cierre
- **BLOQUEADA (seguridad/flujo real, sin bypass):** obtenciÃ³n de JWT utilizable por `POST /api/auth/login` tras register+verify-email (cuenta queda `pendiente`/`suscripcion_activa=false` a la espera de aprobaciÃ³n Super Admin; login 403). Impide prueba HTTP completa â€œcrear por HTTPâ†’reiniciar solo backendâ†’recuperar por HTTPâ€ con auth real de login.
- **NO VERIFICADO:** persistencia post-restart encadenada por HTTP con auth de login; flujo de recomendaciÃ³n positiva â€œeligible verificadoâ€ vÃ­a HTTP con payload canÃ³nico (requiere datos con verificaciÃ³n aprobada vigente completa, no disponibles por flujo pÃºblico/admin en esta corrida sin bypass).
- Criterio `CUMPLE` no alcanzado por bloqueos/pendientes anteriores. **No se avanzÃ³ a C1-G.**

## 15. ActualizaciÃ³n 2026-11-13 (ETAPA A, sin ejecuciÃ³n E2E por usuario)

- **Script E2E preparado:** `backend/test_e2e_b1t04.js` cubre flujo real adminâ†’aprobaciÃ³n restauranteâ†’loginâ†’createâ†’approve incomplete/completeâ†’stale tras updateâ†’401/403â†’restart backendâ†’persistencia; sintaxis verificada. EjecuciÃ³n limpia y evidencia HTTP final pendientes (usuario ejecutarÃ¡; ejecuciones previas afectadas por rate limit 429).
- **Cambios relevantes a verificaciÃ³n:** export de helpers faltantes en `catalogVerification` y correcciÃ³n de normalizaciÃ³n `contacto_cruzado` en `menuController` para consistencia de versiÃ³n/aprobaciÃ³n. RevisiÃ³n de rutas: invalidaciÃ³n conservadora en `createDish`/`updateDish`; `DELETE` elimina platillo; admin solo modifica `activo` en suspensiÃ³n.
- **RegresiÃ³n:** unitarias 77/77 PASS (local). IntegraciÃ³n PostgreSQL 4/4 PASS es evidencia previa no re-ejecutada esta sesiÃ³n.
- **Estado:** **PARCIAL/BLOQUEADA** para cierre E2E HTTP y ETAPA B (Docker daemon no disponible en esta ejecuciÃ³n).

