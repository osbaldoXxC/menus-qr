# BitÃ¡cora â€” ImplementaciÃ³n v2 (B1-T04 / B1-T04-C1 / B1-T04-C1-F / continuaciÃ³n)

## 2026-11-16 — Docker y CI preparados
- En `feature/ci-docker-testing` se prepararon skills, Compose de pruebas, workflow y auditoría `docs/devops/ci-docker-audit.md`. Node 22/Python 3.11 se eligieron con autorización; no se recrearon servicios principales. 213 unitarias backend, 152 Python, 13 HTTP DEC-012, 11 B1, 11 R3, 5 SQL y 2 E2E sintéticas pasaron. Persistencia de PostgreSQL/Redis se probó con volúmenes nuevos sintéticos, conservados.
- Se retiró la prueba E2E anterior que exigía el cuestionario por pasos ya eliminado, por instrucción del usuario. El job de integración completa sigue necesitando preparación de puertos y fixtures históricos; el workflow no se declara validado en GitHub antes de publicarse. Docker Scout quedó bloqueado por revisión automática por posible envío de información de la imagen. Sin borrado de volúmenes ni cambios a la base principal.

## 2026-11-16 — Excepción provisional MXN local para presupuestos
- PR borrador #41: el primer CI ejecutó integraciones sin PostgreSQL/ML y falló por conexión; en la copia aislada del PR el job denominado unitario se limitó explícitamente a `tests/unit/*.test.js` (213 PASS). Las integraciones reales siguen como validación separada y no se declaran cubiertas por ese job.
- Activación posterior autorizada: se recreó únicamente `menus-qr-backend-1` con `NODE_ENV=development`, `LOCAL_MXN_BUDGET=true` y `DISABLE_STARTUP_DDL=true`. El esquema principal conservó 186 columnas y sigue sin tabla de confirmación monetaria. Prueba real de navegador en localhost: la frase de agua de limón con 40 pesos devolvió cinco aguas de 35 y la tarjeta mostró el precio. PostgreSQL y ML no se reiniciaron.
- El usuario autorizó que, exclusivamente en desarrollo local, todos los importes del catálogo se interpreten como MXN para aplicar presupuestos, y solicitó registrar que debe corregirse posteriormente. La excepción requiere `NODE_ENV=development` y `LOCAL_MXN_BUDGET=true`; también puede activarse explícitamente en tests. En producción y por defecto sigue siendo obligatoria la evidencia monetaria. `compose.prod.yml` fuerza la excepción a false incluso al combinar configuraciones.
- La excepción compara el precio real del catálogo en centavos, excluye importes mayores y conserva UNKNOWN ante precios inválidos. No crea confirmaciones ni cambia `priceVerified`; alergias, exclusiones y demás restricciones conservan su evaluación. En esquema sin revisiones vuelve a leer el precio y estado antes de responder; un cambio concurrente descarta el candidato.
- Limitación aceptada temporalmente: se confía en la declaración general del usuario de que los importes locales son MXN; no se demuestra el origen ni vigencia de moneda por restaurante. Para el cierre correcto de DEC-002/R3: desactivar `LOCAL_MXN_BUDGET`, autorizar y validar por separado las migraciones, confirmar moneda y precio exacto con propietarios autorizados y probar revocación/invalidez; no certificar históricos automáticamente. DEC-002/R3 siguen parciales.
- Pruebas: 110 Node PASS; dos integraciones HTTP reales PASS con PostgreSQL temporal y ML: 35/40 aceptados, 41 rechazado, restricciones sin evidencia bloqueadas y cero confirmaciones fabricadas; sin tablas R3, cambio de 35 a 41 durante ranking descartado. En desarrollo, `DISABLE_STARTUP_DDL=true` impide tanto `runMigrations()` como la creación automática de tabla de soporte; prueba unitaria de ambos caminos PASS y esquema temporal conservó 23 tablas y ninguna columna R3. Se comprobaron flags de Compose local y de producción combinado. No se tocaron datos persistentes ni se reinició el backend principal; localhost aún requiere recreación autorizada del servicio backend con la configuración nueva.
- Prueba adicional con catálogo local real y proceso temporal independiente, con `transaction_read_only=on` y DDL de arranque desactivado: la frase «quiero una agua fresca de limon pero solo tengo 40 pesos» devolvió cinco aguas de limón a 35, todas sin confirmación monetaria registrada. El proceso temporal se terminó después de la prueba; el backend principal no se sustituyó.
- Archivos: `backend/src/services/eligibilityService.js`, `backend/src/controllers/{menuController.js,supportController.js}`, `backend/src/config/{db.js,environment.js}`, `backend/tests/unit/{localMxnBudget.test.js,localStartupDdl.test.js}`, `backend/tests/integration/r3-isolated/{local-mxn-http.test.cjs,local-mxn-unversioned-http.test.cjs}`, `compose.yml`, `compose.prod.yml` y esta bitácora.

## 2026-11-16 — Retiro de escaneo simulado
- Se eliminaron los accesos a «Escanear Menú QR» en navegación, llamada final y pie de página del portal de comensales, además de la ruta `/escanear/:id?` y su componente de escaneo simulado. Las rutas públicas `/menu/:restaurant_id` permanecen; enlaces antiguos `/escanear/:id` dejan de redirigir. Sin cambios en backend, datos o portal de restaurantes.

## 2026-11-16 — Adaptación visual de la búsqueda
- Se amplió ligeramente el área del resplandor por solicitud del usuario, conservando su intensidad.
- A petición del usuario se intensificó nuevamente el tono y la opacidad del resplandor, manteniendo el desenfoque.
- Ajuste posterior solicitado: opacidad del resplandor naranja de 0.18 a 0.22 en claro y de 0.08 a 0.10 en oscuro, sin alterar comportamiento.
- `NaturalSearch.tsx` adapta la referencia aportada: fondo cálido, tarjeta, emoji, ejemplos no interactivos, campo con contador de 500 caracteres y botón. Se conserva el flujo de texto único y los estados de carga, error y resultados; sin cambios de backend ni filtros rápidos.
- Verificación: build de comensales (TypeScript y Vite) PASS, 14 pruebas de componentes y 8 del flujo PASS. Chrome real en localhost: anchos 320, 768 y 1280 sin desbordamiento horizontal, contador y activación de tema oscuro comprobados; captura desktop comparada con la referencia. No se enviaron búsquedas ni se modificó la base de datos.
- Archivos: `frontend-comensales/src/features/recommendations/NaturalSearch.tsx`, `frontend-restaurantes/tests/r4-components.test.cjs` y esta bitácora.

## 2026-11-16 — Presentación en pesos mexicanos
- Por indicación del usuario de que la aplicación local usa pesos mexicanos, las tarjetas muestran el importe como `$35.00 MXN` sin la leyenda de moneda no verificada; si no hay precio válido, indican que no está disponible. Es una decisión de presentación, no registra evidencias ni cambia la evaluación de presupuestos. Pasaron 14 pruebas de componentes; no se cambiaron datos ni servicios.

## 2026-11-16 — Importe declarado y presupuesto verificable
- Las vistas de comensal muestran el importe numérico declarado con la leyenda «moneda no verificada» cuando no hay evidencia; solo muestran MXN como confirmado si el backend lo acredita. Si falta el dato, indican que no está disponible. No se cambió la elegibilidad ni se certificaron datos.
- Pruebas: 14 componentes SSR PASS y `npm run build` de comensales PASS (incluye TypeScript). HTTP real con PostgreSQL temporal, backend y ML aislados: precios sintéticos 50/100/120 disponibles sin presupuesto; sin evidencia, presupuesto sin resultados; con evidencia sintética, máximo 100 devuelve 50 y 100 y 80 devuelve 50. La prueba de vocabulario HTTP aislada también pasó. No se efectuó inspección visual en navegador.
- En el servicio principal, ML interpreta «No más de cien pesos» como 100 MXN, pero la respuesta no tiene resultados verificables; una consulta de solo lectura confirmó ausencia de las tablas de evidencia monetaria en `mexxicanmx_db`. Vite sirve el nuevo formato; no se reiniciaron servicios principales ni se ejecutaron migraciones ni se alteraron datos persistentes.
- Archivos: `frontend-comensales/src/features/recommendations/{formatMenuPrice.ts,DescubrirResultados.tsx,NaturalSearch.tsx}`, `frontend-restaurantes/tests/r4-components.test.cjs`, `backend/tests/integration/r3-isolated/budget-display-http.test.cjs` y esta bitácora. R3 y DEC-002 siguen parciales en el entorno principal: requieren autorización independiente de migración, validación y confirmaciones por propietarios; no se certifican históricos automáticamente.

## 2026-11-11
- **Rama:** `v2-segunda-version`. Sin operaciones Git destructivas ni commits/push. Sin producciÃ³n.

### B1-T04 (integraciÃ³n) y B1-T04-C1 (persistencia/esquema, Docker)
- Servicios/cÃ³digo: `allergenCatalog.js`, `catalogVerification.js`, `eligibilityService.js`, `menuController.js` (conservador, sin auto-verificaciÃ³n). Esquema sincronizado: migraciÃ³n `backend/src/db/migrations/20261111_b1t04_catalog_verification.sql` (aditiva, idempotente, sin auto-verificar histÃ³ricos), `backend/src/db/init.sql`, `db/contract/schema.json`, `backend/src/config/db.js`.
- Docker local: `postgres` pg16+pgvector (healthy, volumen persistente), `redis`, `backend` UP (`/health` DB connected). MigraciÃ³n aplicada e idempotente en `mexxicanmx_db` y `b1t04_test` (seed 14, tablas/columnas/JSONB/versionado verificados). Persistencia real (controller+DB, datos ficticios): create conservador, JSONB/assessments `contains|may_contain|verified_absent|unknown`, compuesto no resuelto/contacto cruzado desconocido, invalidaciÃ³n por cambio de receta con auditorÃ­a preservada, histÃ³rico no auto-verificado.

### B1-T04-C1-F
- `getDishes`: no reproducible defecto; recupera registros creados/actualizados (controller+DB y `GET /api/menu/platillos` HTTP autenticado real) con `verification_summary`. Sin eliminar filtros de negocio.
- HTTP autenticado (JWT real + auth/rol/suscripciÃ³n): sin tokenâ†’401, rol incorrectoâ†’403, `POST`â†’201, `GET`â†’200, `PUT`â†’200 con actualizaciÃ³n, invalidaciÃ³n+auditorÃ­a tras cambio de receta, invÃ¡lidoâ†’400, otro restauranteâ†’404.
- Suite integraciÃ³n PostgreSQL real `backend/tests/integration/b1t04Postgres.integration.test.js` (Docker `b1t04_test`, sin mocks): **4 PASS, 0 FAIL**.
- RegresiÃ³n unitaria: **72 PASS, 0 FAIL**.

### ContinuaciÃ³n (validaciones pendientes)
- **Temporal:** `backend/tmp_http_b1t04_c1f.js` inspeccionado (script HTTP C1-F), origen confirmado y eliminado (host/contenedor).
- **Login/OTPâ†’JWT por HTTP (flujo real):** `POST /api/auth/register`â†’201; OTP leÃ­do de Redis (infra de prueba para obtener cÃ³digo enviado por correo, sin saltar endpoints); `POST /api/auth/verify-email`â†’200; DB `email_verificado=true, suscripcion_activa=false, estado='pendiente'`; `POST /api/auth/login`â†’**403** â€œen espera de aprobaciÃ³n por el Super Adminâ€ (sin access_token). **BLOQUEADO** (seguridad): JWT utilizable requiere aprobaciÃ³n/activaciÃ³n Super Admin; no se realizÃ³ bypass.
- **Recomendaciones pÃºblicas (payload canÃ³nico):** `POST /api/public/menu/:restaurant_id/recommendations` con `{craving:{text,tags}, restrictions:{allergies:["cacahuate"], diet:"none", excludedIngredients:[]}, options:{limit:5, locale:"es-MX"}}` â†’ **200**, 3 candidatos (contains/unknown/may_contain, no verificados) â†’ `recommendations_count=0`, `any_ineligible_or_unknown_included=false` (conservador/fail-closed).
- **Crear por HTTPâ†’reiniciar solo backendâ†’recuperar por HTTP:** **BLOQUEADO** (depende de JWT de login real sin bypass). PostgreSQL persiste en volumen; backend reiniciado healthy.
- **Consulta individual de platillos:** investigadas rutas/controladores â€” **no existe endpoint dedicado** (`GET /api/menu/platillos` listado; `PUT/DELETE /platillos/:id`; pÃºblico solo menÃº agregado/recomendaciones).

### Estado global
- **PARCIAL/BLOQUEADA.** Cumplido: persistencia/migraciÃ³n/integraciÃ³n PG real, `getDishes`, HTTP CRUD+permisos, recomendaciÃ³n canÃ³nica conservadora, 4/4 integraciÃ³n, 72/72 unitarios. Bloqueado por seguridad/flujo: loginâ†’JWT utilizable y CRUD HTTP post-restart sin bypass. No avanzado a C1-G/C2/B1-T05. Sin commits/push. Sin producciÃ³n/FE/ML/contratos.

## 2026-11-13
- **Rama:** 2-segunda-version. Sin commits/push/PR. Sin produccion. Sin docker compose down -v/prune. Sin SQL bypass de auth/aprobacion/validacion.

### B1-T04-FINAL (ETAPA A)
- **Fixes aplicados:** ackend/src/services/catalogVerification.js exporta collectAllRelevantIngredientEntries y esolveCompound (evita 500 en aprobacion). ackend/src/controllers/menuController.js normaliza contacto_cruzado como objeto en 
ormalizeDishForEvaluation (consistencia de versionado). ackend/test_e2e_b1t04.js ajustado para flujo real + reintentos por rate limit auth (verify-email/login segundo restaurante) y asserts explicitos.
- **E2E HTTP real (ejecutado por usuario, stack Docker activo):** cd menus-qr && node backend/test_e2e_b1t04.js -> **36 PASS, 0 FAIL**. Evidencia: login superadmin 200/SUPER_ADMIN; registro restaurante 201; OTP Redis + verify-email 200; aprobacion admin real 200 (suscripcion_activa, estado=aprobado, auditoria); login restaurante 200; create dish 201; approve incompleto 400; approve completo 200 (erification_state=verified_approved, erifiedBy, erifiedAt, erificationSource=admin_manual_approval); update receta + stale approval 400/409; sin token 401; segundo restaurante no puede aprobar platillo ajeno 403; docker compose restart backend + /health 200 + GET /api/menu/platillos 200 con platillo persistido y verificacion invalidada tras cambio de receta.
- **Revision invalidacion (codigo/rutas):** POST/PUT/DELETE /api/menu/platillos y POST /api/menu/platillos/:id/verify-approve. createDish conserva estado conservador/no verificado (version calculada, sin aprobacion heredada, auditoria). updateDish recalcula version e invalida aprobacion previa (limpia verified fields, estado conservador, auditoria update_recipe_invalidated_verification). DELETE elimina platillo. Admin solo toggle ctivo en suspension (sin mutar receta/versionado).
- **Regresion:** 
ode --test tests/unit/catalogVerification.test.js tests/unit/eligibilityEvaluation.test.js tests/unit/b1t04IntegrationFlow.test.js -> **47 PASS, 0 FAIL**. 
ode --test tests/unit/*.test.js -> **77 PASS, 0 FAIL** (host, sin DB). Integracion PostgreSQL ackend/tests/integration/b1t04Postgres.integration.test.js **no re-ejecutada en esta sesion** (evidencia previa registrada: 4 PASS, 0 FAIL).
- **Estado B1-T04:** **PARCIAL (avanzado)**. Cierre funcional del flujo de aprobacion/verificacion invalidacion/cross-restaurant/persistencia post-restart demostrado por E2E 36/36; pendiente revalidar integracion PG en esta corrida y consolidar evidencia final formal si se requiere cierre definitivo.

### ETAPA B - Full-stack Docker
- **Arquitectura:** dev/prod con postgres (pgvector/pg16), edis, ackend:4000, ml-service:8000, rontend-comensales:3000, rontend-restaurantes:3002, dmin:3001, i-engine; redes public-net/private-net (internal); volumenes persistentes dev postgres_data,edis_data, prod bind dirs + uploads_data_prod.
- **Cambios aplicados/validados:** ML_SERVICE_URL=http://ml-service:8000, ackend.depends_on.ml-service.condition=service_healthy, healthcheck backend /health, ml-service healthcheck HTTP /health (agregado para desbloquear arranque de backend/dependientes), uploads_data_prod en prod, ackend/Dockerfile usa 
pm install. docker compose config y docker compose -f compose.prod.yml config validos (prod con warnings de vars AWS no seteadas en host).
- **Ejecucion/evidencia:** Docker activo; stack levantado por usuario (docker compose up) y backend operativo para E2E (restart backend verificado en paso 12). **No completada** en esta sesion la validacion integral solicitada de los 8 servicios con evidencia consolidada: docker compose ps/logs/health de todos, conectividad back<->ml<->db<->redis detallada, accesibilidad/comunicacion de 3 frontends con backend, E2E full-stack mas alla de B1-T04, restart/persistencia de todos los servicios criticos.
- **Estado ETAPA B:** **PARCIAL**. Bloqueo tecnico previo de arranque (ml-service sin healthcheck) corregido en compose; falta ejecucion/documentacion de evidencia operativa completa y reporte final obligatorio.


## 2026-11-13 (auditoría cierre Bloque 1, esta ejecución)
- **Preflight:** rama 2-segunda-version; git status/diff --stat evidencian cambios tracked/untracked preexistentes (no modificados en esta auditoría). docker compose ps: 8/8 servicios Up (postgres/redis/backend/ml-service healthy; frontends/admin/ai-engine Up). docker compose config → exit 0.
- **B1-T04 (evidencia esta ejecución):** integración PostgreSQL real docker compose exec -T backend node --test tests/integration/b1t04Postgres.integration.test.js → **4 PASS, 0 FAIL** (DB 1t04_test, persistencia/JSONB/versionado/invalidación+auditoría/histórico no auto-verificado/elegibilidad conservadora). Regresión unitaria B1-T04 foco catalogVerification + eligibilityEvaluation + b1t04IntegrationFlow → **47 PASS, 0 FAIL**. Evidencia histórica válida no re-ejecutada: flujo HTTP E2E ackend/test_e2e_b1t04.js **36 PASS, 0 FAIL** (2026-11-13, ejecución usuario, sin cambios que invaliden flujo). Migración/esquema/DB verificados en local: PostgreSQL 16.14, ector 0.8.6, tablas B1-T04 presentes (lergenos_canonicos, lergeno_terminos, platillo_verificacion_auditoria), índices/constraints públicos presentes. Invalidación/revisión código: create/update conservadores e invalidan aprobación previa por cambio de receta/versión, delete elimina, admin suspensión solo toggle ctivo; aislamiento/roles en rutas/ownership revisado (evidencia HTTP histórica 401/403/cross-restaurant). **Estado:** PARCIAL (avanzado) — criterios funcionales críticos con evidencia; pruebas E2E manuales UI de 3 frontends **PENDIENTE DE EJECUCIÓN POR EL USUARIO**; C2/UI admin completa fuera de alcance/verificación de esta corrida.
- **ETAPA B (Docker, esta ejecución):** HTTP 200 host http://localhost:3000/3001/3002, /health backend 200 {"status":"UP","database":"connected"} y ML 200 {"status":"ok"}; conectividad intra-red backend→ML/Redis (PONG) y frontends→backend /health OK. Logs: healthchecks OK, sin errores críticos de arranque observados en colas recientes (backend health requests, ml-service 200 /health, Vite/ai-engine iniciados). Volúmenes presentes: menus-qr_postgres_data, menus-qr_redis_data, menus-qr-negocios_* (no eliminados). Disponibilidad HTTP ≠ funcionamiento funcional completo; E2E UI manual pendiente por usuario. ai-engine sin healthcheck Compose/sin puerto publicado en dev.
- **Documentación:** actualización de cierre/auditoría registrada (evidencia histórica vs esta ejecución). Sin commits/push/PR, sin down -v/prune, sin E2E navegador, sin cambios de contratos/arquitectura, sin inicio de B1-T05/B1-T06/R2.

## 2026-11-13 (continuación cierre técnico/documental Bloque 1, esta ejecución)
- **Alcance:** continuación autorizada de cierre R1 sin bloquear por pruebas manuales UI. No iniciado R2. Sin commits/push/PR, sin git destructivo, sin `down -v`/prune, sin instalar dependencias, sin E2E navegador, sin cambios de contratos/arquitectura/DEC, sin modificación de código.
- **Preflight:** rama `v2-segunda-version`; `git status/diff --stat` con cambios tracked/untracked preexistentes (preservados). Docker 8/8 servicios operativos, `docker compose config` exit 0.
- **B1-T01:** `docs/implementation-v2/01-backend-seguridad/01-auditoria-inicial.md` actualizado con contraste delta real (reutilizando `docs/audit-v2`): detectadas implementaciones/pruebas previas B1-T02 (`recommendationRequest.js`, 10 tests), B1-T03 (`restrictionConsolidation.js`, 15 tests), integración en `menuController`, avances B1-T04/ETAPA B; brechas pendientes mapeadas a B1-T02..B1-T06 y dependencias B2/B3/DEC. Estado: **PARCIAL**.
- **B1-T02:** validación revisada/reutilizada (no rehecha). Evidencia esta ejecución: `recommendationValidation` **10 PASS** dentro de suite unitaria **77 PASS, 0 FAIL** (6 suites, contenedor backend). Integración de validador/errores uniformes en handlers verificada por código. Gaps: contrato V2 completo, DEC-002/003, integración endpoint exhaustiva. Estado: **PARCIAL**.
- **B1-T03:** consolidación revisada/reutilizada. Evidencia esta ejecución: `restrictionConsolidation` **15 PASS** (suite 77/77). Fail-closed conservador; `mlExtraction: null` en flujo actual. Gaps: `/interpret` real/B2, DEC-007/008, casos texto-end-to-end. Estado: **PARCIAL (bloqueada parcialmente por B2/DEC)**.
- **B1-T04:** evidencia conservada/revalidada: integración PG **4 PASS, 0 FAIL**; unit foco **47 PASS, 0 FAIL**; unit total **77 PASS, 0 FAIL**; E2E HTTP histórico **36 PASS, 0 FAIL** (no re-ejecutado). Revisión de invalidación/aislamiento/aprobación en código confirmada. Manual UI 3 frontends: **PENDIENTE DE EJECUCIÓN POR EL USUARIO**. Estado: **PARCIAL (avanzado)**.
- **B1-T05:** aislamiento revisado (scope/404/403/filtros SQL/activo/suscripción, ownership 401/403 en rutas autenticadas). Sin suite dedicada de aislamiento recomendador V2; DEC-004/005/006/010 pendientes. Estado: **PARCIAL / NO VERIFICADO**.
- **B1-T06:** matriz de aceptación documentada con resultados automatizados vs pendientes; pruebas manuales UI registradas como pendientes de usuario. Estado: **NO CUMPLE** (Bloque 1 no cerrado).
- **Documentos actualizados:** `BITACORA.md`, `01-backend-seguridad/01-auditoria-inicial.md`, `02-validacion-solicitudes.md`, `03-consolidacion-restricciones.md`, `04-elegibilidad-y-fallback.md`, `05-aislamiento-restaurantes.md`, `06-pruebas-y-aceptacion.md`.
- **Bloque 1:** técnicamente avanzado pero **NO COMPLETADO** por criterios B1-T06/dependencias/decisiones y validación manual UI pendiente. **R2 — MACHINE LEARNING: NO INICIADO. PENDIENTE DE AUTORIZACIÓN EXPRESA DEL USUARIO.**

## 2026-11-13 (continuación técnica R1 cierre + inicio R2 autorizado por plan/dependencias, esta ejecución)
- **Preflight:** rama `v2-segunda-version`, `git status/diff --stat` con cambios preexistentes preservados; Docker 8/8 operativos, backend/ML/PostgreSQL/Redis conectados.
- **R1 trabajo técnico adicional (sin rehacer lo existente):**
  - B1-T02: creada/ejecutada `backend/tests/integration/b1t02Validation.integration.test.js` → **3 PASS, 0 FAIL** (400 uniforme `INVALID_REQUEST` por restaurante/global, payload legacy válido aceptado). Reutilizó validador/controladores existentes.
  - B1-T03: creado/ejecutado `backend/tests/unit/restrictionConsolidation.mockExtraction.test.js` → **8 PASS, 0 FAIL** con **extracción ML simulada (mock contrato, no integración real)**: ausencia, ambigüedad, contradicción, explícitas, omisión, no verificable, fallos, fail-closed.
  - B1-T05: creada/ejecutada `backend/tests/integration/b1t05Isolation.integration.test.js` → **4 PASS, 0 FAIL** (no exposición cross-tenant en fallback, 404 inexistente, 403 no disponible, ids ML ajenos/desconocidos descartados por conjunto elegible). Brechas remanentes documentadas (DEC-004/005/006/010, caché scope, global acotado, rehidratación exhaustiva).
  - B1-T04: sanidad regresión `b1t04Postgres.integration.test.js` → **4 PASS, 0 FAIL** (no repetición innecesaria de E2E 36 histórico).
  - B1-T06: matriz/evidencias actualizadas con resultados reales esta ejecución; estado aceptación Bloque 1 permanece **NO CUMPLE** (criterios integrales/DEC/decisiones y UI manual pendiente).
- **Pruebas manuales UI (3 frontends):** **PENDIENTE DE EJECUCIÓN POR EL USUARIO** (no bloqueante para trabajo técnico automatizable). URLs: `http://localhost:3000`, `http://localhost:3002`, `http://localhost:3001` (APIs `:4000/health`, `:8000/health`).
- **Transición R1→R2:** R1 no aceptado formalmente, pero sin bloqueo técnico por UI manual; R1 contractual/mínimo técnico base disponible (validación, consolidación, elegibilidad/aislamiento con evidencia parcial-mejorada). Se inicia R2 en alcance autorizado del plan (aditivo, sin romper `/recommendations` legado, sin inventar DEC/contratos). Dependencias/DEC pendientes registradas (DEC-002/003/004/005/006/007/008/010/011).
- **R2 (Machine Learning):** baseline inspeccionado y documentado (docs B2-T01..T04 leídos; `ml-service/main.py` expone `/health` y `/recommendations`, diff tracked preexistente preservado; tests ML no ejecutables en contenedor por ausencia de `pytest`, `python -m unittest discover` falla por imports pytest). No se implementaron `/interpret`/`/rank` ni se modificó código/contratos ML en esta sesión para no romper trabajo preexistente ni asumir DEC/contratos no aprobados. B2-T01..B2-T04: **NO INICIADO/PENDIENTE** en implementación. R2 — MACHINE LEARNING: NO INICIADO (implementación).


## 2026-11-13 (continuacion: formalizacion aplazamiento frontend R4/R5, DEC-002..011, cierre tecnico R1, inspeccion R2)
- **Rama/entorno:** 2-segunda-version; Docker 8/8 operativo (postgres/redis/backend/ml-service healthy; frontends/admin/ai-engine up). Cambios git preexistentes preservados (tracked/untracked). Sin commits/push/PR, sin operaciones destructivas, sin down -v/prune, sin instalaciones, sin modificar frontends ni ml-service/main.py (diff tracked preexistente preservado).
- **Frontend (decision usuario, revision manual :3000/:3001/:3002):** estado registrado como APLAZADA HASTA R4/R5 - PENDIENTE DE VALIDACION INTEGRAL. No clasificada como falla de R1; no repetidas pruebas visuales; no detiene trabajo tecnico; R1 no se marca incompleto solo por frontend, pero **no se declara R1 aceptado** si faltan criterios tecnicos R1. Criterios de interfaz obligatorios del plan se conservan y su ejecucion queda diferida (R4 adapta 3 interfaces a contratos definitivos; R5 valida integralmente las 3 interfaces con backend+ML).
- **Documentos actualizados (deferral + alcance R4/R5):**  0-plan-maestro.md (roadmap R4/R5), BITACORA.md,  1-backend-seguridad/04-elegibilidad-y-fallback.md,  1-backend-seguridad/06-pruebas-y-aceptacion.md,  4-frontend/README.md,  4-frontend/01-cuestionario.md,  4-frontend/02-estados-y-resultados.md,  5-integracion/README.md,  5-integracion/01-pruebas-integracion.md,  5-integracion/02-regresiones.md,  5-integracion/03-aceptacion-final.md.

### Pruebas ejecutadas esta sesion (Docker, evidencia real)
- docker compose exec -T backend sh -lc 'node --test tests/unit/recommendationValidation.test.js tests/unit/restrictionConsolidation.test.js tests/unit/restrictionConsolidation.mockExtraction.test.js' -> **34 PASS, 0 FAIL** (3 suites: validacion 10, consolidacion 15, consolidacion con extraccion ML simulada/mock 8 - **simulada, no integracion ML real**). Reutilizadas, sin rehacer pruebas aprobadas sin causa.
- docker compose exec -T backend sh -lc 'node --test tests/integration/b1t02Validation.integration.test.js tests/integration/b1t05Isolation.integration.test.js' -> **7 PASS, 0 FAIL** (B1-T02: 3 - 400 uniforme INVALID_REQUEST/invalid_request por restaurante/global, payload legacy valido aceptado; B1-T05: 4 - no exposicion cross-tenant en fallback, 404 inexistente, 403 no disponible, ids ML ajenos/desconocidos descartados por conjunto elegible).
- docker compose exec -T backend sh -lc 'node --test tests/integration/b1t04Postgres.integration.test.js' -> **4 PASS, 0 FAIL** (sanidad, PostgreSQL real/Redis). No se repitio E2E HTTP historico 36/36.
- Evidencia historica conservada (no re-ejecutada): B1-T04 HTTP E2E **36 PASS, 0 FAIL**; suites unitarias previas **77 PASS, 0 FAIL** cuando aplica.

### B1-T01..B1-T06 (estado actualizado, tecnico)
- **B1-T01 PARCIAL:** delta documentado en  1-auditoria-inicial.md; reutiliza audit-v2. Vigente.
- **B1-T02 PARCIAL:** validador Zod canonicо+legacy, limit 1..10, locale, equestId, mapeo legacy determinista, respuesta uniforme 400 INVALID_REQUEST/invalid_request (unit+integracion). Brechas: contrato V2 de exito uniforme completo (status/safety/meta canonicos, limitApplied/requestId en todos los exitos), semantica/validacion presupuesto y moneda (**DEC-002**), versionado API/ventana compatibilidad legacy (**DEC-003**), cobertura exhaustiva de escenarios/codigos por contrato aprobado.
- **B1-T03 PARCIAL (bloqueado parcialmente por B2/DEC):** estrictionConsolidation fail-closed, estados/origenes/trazabilidad, integracion con mlExtraction:null; tests unitarios + 8 casos con extraccion ML simulada (**mock contrato, no integracion real**) conservados/aprobados. Brechas: integracion real /interpret (B2), umbrales confianza/ambiguedad (**DEC-007**), completitud/verificabilidad operativa de datos (**DEC-008**), casos texto-end-to-end con extractor real.
- **B1-T04 PARCIAL (avanzado):** evidencia critica revalidada (PG 4/4, historico HTTP 36/36, unit foco/regresion) y flujo conservador/invalidacion/aislamiento de aprobacion segun docs previos. Cierre formal pendiente de criterios documentales/aceptacion integral y validacion UI diferida a R4/R5 (no falla tecnica R1).
- **B1-T05 PARCIAL:** scope/404/403, filtros por restaurante/activo/suscripcion, ownership en rutas autenticadas, y saneo por conjunto elegible ante ids ML ajenos/desconocidos (integracion 4/4). Brechas: scope canonico formal, rehidratacion completa desde DB de campos autoritativos en todos los caminos ML, endpoint global controles anti-abuso/top-K/acotacion, cache por scope, rate-limit especifico (**DEC-004, DEC-005, DEC-006, DEC-010**), suite de contrato/aislamiento exhaustiva.
- **B1-T06 NO CUMPLE:** matriz automatizada parcial favorable en alcance ejecutado pero incompleta para aceptacion integral del bloque (contrato V2 uniforme completo, escenarios /interpret//rank reales o contrato aprobado, decisiones pendientes, controles globales/cache/rate-limit, rehidratacion/saneo exhaustivo). UI manual diferida a R4/R5: APLAZADA HASTA R4/R5 - PENDIENTE DE VALIDACION INTEGRAL (no cuenta como falla tecnica R1).

### Brechas tecnicas R1 cerradas vs pendientes
- **Cerradas/con evidencia reforzada:** validacion de borde y errores 400 uniformes basicos (unit+integracion), consolidacion conservadora con pruebas simuladas de extraccion, aislamiento/saneo basico por scope e ids ML no elegibles (integracion), regresion B1-T04 PG, formalizacion documental de aplazamiento frontend a R4/R5.
- **Pendientes (no cerrables sin decisiones/contratos/B2/B3):** contrato V2 de exito/error completo y versionado, presupuesto/moneda, integracion real /interpret, umbrales ML, completitud datos, top-K/acotacion/caching/rate-limit/alcance global, rehidratacion autoritativa exhaustiva, matriz de aceptacion integral.

### DEC-002 a DEC-011 (revision y clasificacion)
| ID | Clasificacion | Afecta a | Trabajo que puede continuar sin resolverla |
|---|---|---|---|
| DEC-002 Moneda/presupuesto/copy contradiccion | **PENDIENTE DE DECISION DEL USUARIO**; **BLOQUEA IMPLEMENTACION** de validacion semantica monetaria, filtrado/contrato presupuesto y UI presupuesto final | B1-T02, B2 interpret, B3/B4 contratos, casos presupuesto | Validacion estructural no monetaria, preservacion conservadora de campos budget, pruebas no monetarias |
| DEC-003 Versionado API y compatibilidad legacy | **PENDIENTE DE DECISION DEL USUARIO**; **BLOQUEA IMPLEMENTACION** de estrategia/versionado/ventana y contrato externo definitivo | Rutas/controladores, FE servicios, contratos B1/B2 | Mapeo legacy determinista interno actual, tests de compatibilidad basica, documentacion de brechas |
| DEC-004 Rate-limit especifico recomendador/global | **PENDIENTE DE DECISION DEL USUARIO**; **BLOQUEA IMPLEMENTACION** de controles finales anti-abuso/rate-limit dedicados | publicRoutes/index, endpoint global, B1-T05/B5, despliegue | Aislamiento por scope/filtros DB/saneo ids, pruebas actuales, documentacion de riesgo |
| DEC-005 Top-K y acotacion candidatos a ML | **PENDIENTE DE DECISION DEL USUARIO**; **BLOQUEA IMPLEMENTACION** de politica definitiva top-K/acotacion payload/consultas | B1/B2/B3 consultas, payload /rank, latencia | Elegibilidad/saneo sobre candidatos actuales, pruebas con limites existentes, analisis documental |
| DEC-006 Cache de resultados/candidatos | **PENDIENTE DE DECISION DEL USUARIO**; **BLOQUEA IMPLEMENTACION** de cache segura (clave por scope/tenant/request) | B1/B3 consistencia y aislamiento | Logica sin cache nueva, invalidaciones existentes de menu, pruebas de no fuga cross-tenant basicas |
| DEC-007 Umbrales numericos confianza/ambiguedad ML | **PENDIENTE DE DECISION DEL USUARIO**; **BLOQUEA IMPLEMENTACION** de politica numerica/calibrada en ML y uso en BE; **NO BLOQUEA TRABAJO INDEPENDIENTE** conservador | B2-T01/T04, consolidacion BE, B5 | Consolidacion fail-closed (desconocido ante ambiguedad/ausencia), tests simulados, inspeccion/preparacion contratos |
| DEC-008 Completitud real catalogo y criterio operativo datos | **PENDIENTE DE DECISION DEL USUARIO**; **BLOQUEA IMPLEMENTACION** de criterio operativo final de verificabilidad/recall | B3/B5, elegibilidad/verificabilidad | Reglas conservadoras actuales, auditorias de esquema/codigo, pruebas con datos declarados disponibles |
| DEC-009 Configuracion/despliegue real (CORS, Redis, indices, entorno) | **PENDIENTE DE DECISION DEL USUARIO/INFRA**; **NO BLOQUEA TRABAJO INDEPENDIENTE** de codigo/pruebas locales; **BLOQUEA** cierre operativo de despliegue | Despliegue, seguridad/rendimiento operativo | Pruebas locales Docker, documentacion, ajustes no operativos no autorizados fuera de alcance |
| DEC-010 Alcance definitivo endpoint global y controles anti-abuso | **PENDIENTE DE DECISION DEL USUARIO**; **BLOQUEA IMPLEMENTACION** de alcance/controles finales del global | B1-T05/B5, seguridad/costo/UX | Aislamiento basico activo/suscripcion y saneo ids, pruebas existentes, documentar brechas |
| DEC-011 Transicion endpoint legado vs /interpret+/rank | **PENDIENTE (propuesta no aprobada)**; **BLOQUEA IMPLEMENTACION** de transicion/integracion contractual BE<->ML definitiva | B2-T01..T03, compatibilidad backend | Mantener /recommendations legado operativo, inspeccion R2, preparacion documental, no cambiar contratos |

No se modificaron decisiones pendientes ni se inventaron valores/contratos.

### R2 - Machine Learning (inspeccion y preparacion, sin implementacion bloqueada)
- **Inspeccion:** docs/implementation-v2/02-machine-learning/README.md, B2-T01..B2-T04; ml-service/main.py (tracked modificado, preservado) expone solo /health y /recommendations; Python 3.11.18, spaCy opcional; tests ML no ejecutables sin autorizacion (pytest ausente, unittest discover falla por dependencia pytest en tests). BE actual integra solo /recommendations con fallback seguro y saneo por elegibles.
- **B2-T01 /interpret:** contratos/dependencias **no suficientemente definidos/aprobados** para implementacion segura (DEC-007 umbrales, DEC-011 transicion, contrato BE<->ML/versionado externo DEC-003, formato exacto request/response/errores). **No implementado** para no inventar DEC/contratos ni sobrescribir diff preexistente de ml-service/main.py.
- **Implementable con decisiones aprobadas (independiente, sin tocar contratos bloqueados):** documentacion/analisis de brechas, preservacion endpoint legado /recommendations, verificacion de que BE permanece autoridad (fail-closed) y no depende de nuevos endpoints ML; preparacion de criterios de prueba futuros condicionada a instalacion autorizada.
- **No implementado/no permitido ahora:** /interpret, /rank, cambios de contrato backend, modificaciones de frontends, instalacion de pytest/dependencias.
- **Estado:** B2-T01..B2-T04 **NO INICIADO (implementacion)**; R2 **NO INICIADO** en implementacion, con inspeccion/preparacion parcial documentada.

### Estado real de R1
- **R1 (Bloque 1): NO ACEPTADO / NO CUMPLE** en aceptacion integral (B1-T01/T02/T03/T04/T05 PARCIAL, B1-T06 NO CUMPLE). Base tecnica avanzada y con evidencia automatizada parcial favorable; cierre bloqueado por brechas contractuales, decisiones DEC-002..008/010(-011 impacto), controles globales/cache/rate-limit/top-K/rehidratacion exhaustiva y criterios de aceptacion integral. Pruebas funcionales frontend: APLAZADA HASTA R4/R5 - PENDIENTE DE VALIDACION INTEGRAL (no falla tecnica R1, ejecucion diferida sin cambiar criterios oficiales).

## 2026-11-13 (formalización DEC-002 aprobada; análisis DEC-003 en curso)
- **DEC-002 (APROBADA por usuario, 2026-11-13; formalización documental, implementación pendiente):** formalizada en docs/implementation-v2/00-plan-maestro.md (matriz de decisiones), docs/audit-v2/09-decisiones-finales.md (sección 2 presupuesto), docs/audit-v2/06-contratos-definitivos.md (campos udgetMax/budgetCurrency/budgetPerPerson y notas), docs/implementation-v2/01-backend-seguridad/02-validacion-solicitudes.md,  3-consolidacion-restricciones.md, docs/implementation-v2/02-machine-learning/01-endpoint-interpret.md. Reglas registradas: moneda fija MXN (ISO 4217), sin conversiones/tasas/servicios externos; udgetMax=presupuesto máximo por platillo; udgetCurrency omitido→MXN; moneda distinta de MXN→400 INVALID_REQUEST; udgetPerPerson=true→400 temporal; udgetMax numérico, finito, >0, <=100000, máx. 2 decimales; BE autoridad para comparar contra platillos.precio; comparación solo si ambos verificables bajo convención MXN; precio inválido/ausente/no verificable no compatible; presupuestos ambiguos/contradictorios de texto no filtros duros; legacy sin presupuesto válido sin restricción presupuestaria implícita.
- **Evidencia/limitación:** platillos.precio/precio_original numéricos sin columna de moneda en ackend/src/db/init.sql y db/contract/schema.json; convención MXN **NO VERIFICADA** en datos existentes/producción (comprobación operativa requerida antes de habilitar filtro en producción).
- **Dependencias desbloqueadas (documentalmente, sin declarar implementación completa):** definición contractual de presupuesto para B1-T02/B1-T03/B2-T01. B1-T02/B1-T03/B2-T01/R1 no se marcan completadas por esta aprobación; implementación/enforcement pendiente y sujeta a contratos/código/pruebas/autorizaciones.
- **DEC-003:** análisis técnico entregado en esta sesión (versionado API/compatibilidad legacy, **PENDIENTE DE APROBACIÓN**). Sin cambios de código/contratos ejecutables ni operaciones Git no autorizadas. Otras DEC no modificadas.

## 2026-11-13 (formalización DEC-003 aprobada; continuidad plan V2 — solo documentación)
- **DEC-003 — APROBADA (usuario, 2026-11-13, aprobación explícita):** arquitectura objetivo V2 sin compatibilidad funcional obligatoria con ML v1 (POST /recommendations) ni con rutas legacy de API pública (entorno de pruebas). Contratos V2 canónicos; ML V2 = POST /interpret (extracción intención/preferencias/presupuesto/restricciones) + POST /rank (ordenamiento de candidatos filtrados por BE). BE autoridad en validación/seguridad/elegibilidad/aislamiento/respuesta final y valida toda respuesta ML (timeouts, límites, sin reintentos ilimitados, sin fallback silencioso a ML v1); fallback determinista solo con candidatos verificables o estado controlado; no inventar recomendaciones. FE (3 interfaces) se adapta en R4; R5 integración/validación integral. Retirada efectiva de código legacy por módulo/etapa autorizada verificando dependencias. R1–R5 por etapas. No declara capacidades V2 implementadas.
- **Documentos actualizados:** docs/implementation-v2/00-plan-maestro.md, README.md,  1-backend-seguridad/02-validacion-solicitudes.md,  2-machine-learning/README.md,  1-endpoint-interpret.md,  2-endpoint-rank.md,  3-contratos-y-validacion.md,  4-scoring-y-fallback.md,  4-frontend/README.md,  1-cuestionario.md,  5-integracion/README.md, docs/audit-v2/06-contratos-definitivos.md,  9-decisiones-finales.md, BITACORA.md. **No modificados por no requerir cambio sustantivo en esta pasada:** B1-T03/B1-T04/B1-T05/B1-T06 (ya referencian dependencias/estados sin contradicción directa nueva; DEC-002 sigue registrada), B4-T02/B5 detalles y resto de audit-v2 salvo 06/09; verificar en siguientes sesiones autorizadas si requieren alineación puntual.
- **DEC-002 permanece APROBADA** (MXN, reglas presupuestarias; implementación/enforcement pendiente; convención MXN en datos NO VERIFICADA en producción). **DEC-007/008/009/010/011 conservan sus estados actuales** (no aprobadas indirectamente). B1-T01..T06, B2-T01..T04, R1, R2 **no** marcadas terminadas.
- **Restricciones cumplidas:** solo documentación; sin cambios de código/rutas/controladores/servicios/contratos ejecutables/esquemas/frontends/ml-service/main.py; sin instalaciones, migraciones, pruebas mutantes, down -v, prune, operaciones Git destructivas/cambio de rama/commits/push/PR; cambios preexistentes preservados.

## 2026-11-13 (R1 — especificación canónica contrato externo recomendador V2, solo documentación)
- **Objetivo:** especificar contrato externo Backend V2 (R1) sin implementar código. DEC-002/DEC-003 permanecen APROBADAS; DEC-001/004/005/006/007/008/009/010/011 sin cambio de estado.
- **Documentos modificados:** docs/audit-v2/06-contratos-definitivos.md (reescritura/expansión a especificación canónica: request V2, response éxito uniforme, errores uniformes 400/401/403/404/429/500/502/503/504, reglas DEC-002, seguridad/elegibilidad autoritativa BE, matriz de degradación segura, separación R1/R2/R4/R5, contratos internos BE↔ML R2 propuestos, dependencias DEC pendientes, diferencias vs implementación con evidencia), docs/implementation-v2/01-backend-seguridad/02-validacion-solicitudes.md (alineación a contrato canónico, criterios/estado/pendientes), docs/implementation-v2/BITACORA.md.  0-plan-maestro.md no modificado (no necesario).
- **Hallazgos clave (evidencia código):** validador acepta canónico+legacy y preserva udget* sin enforcement DEC-002; 400 parcial uniforme pero sin envelope V2 completo; éxito 200 devuelve ecommendations/meta{restaurant_id,totalCandidates,recommendedCount,fallback} sin equestId/status/safety/meta.scope/limitApplied/mlUsed canónicos; 404/403/500 como {mensaje}; integración ML actual a /recommendations legado con filtrado por elegibles y fallback determinista parcial. /interpret//rank no implementados.
- **Clasificación general:** especificación [DOCUMENTADO/PROPUESTO]; implementación contrato V2 [PARCIAL/NO CUMPLE]; enforcement DEC-002, rehidratación/envelope uniforme completo y contrato BE↔ML V2 [PENDIENTE/NO IMPLEMENTADO]; convención MXN datos [NO VERIFICADO].
- **Restricciones cumplidas:** sin cambios de código/rutas/controladores/validadores ejecutables/esquemas/migraciones/ml-service/main.py/frontends; sin instalaciones, migraciones, eliminación ML v1, implementación /interpret//rank, pruebas mutantes, operaciones Git destructivas, cambio de rama, commits/push/PR. Preexistentes preservados. R1 no declarada terminada.

## 2026-11-13 (formalización DEC-012 — contrato externo canónico recomendador V2, solo documentación)
- **DEC-012 — APROBADA (usuario, 2026-11-13). Implementación PENDIENTE DE IMPLEMENTACIÓN.** Complementa DEC-002/DEC-003 (no las sustituye ni modifica). No declara código/rutas/contratos ejecutables implementados ni verificados.
- **Puntos aprobados:** DEC-012.1 rutas canónicas objetivo (POST /api/public/menu/recommendations, POST /api/public/menu/:restaurant_id/recommendations, sin alias/rutas alternativas innecesarias; no autoriza eliminar código/modificar consumidores/adaptar frontends), 12.2 request canónico (craving, estrictions, options, ref. docs/audit-v2/06), 12.3 rechazo campos desconocidos 400 INVALID_REQUEST con info segura, 12.4 normalización (trim, dedupe cuando corresponda, defaults, limit=5, locale=es-MX, equestId generado si falta, locale inválido→400, sin alterar significado de alergias/restricciones/ingredientes), 12.5 envelope éxito (equestId,recommendations,meta,status,safety,error, datos finales desde BE/DB), 12.6 envelope errores uniforme + catálogo HTTP de referencia (controles DEC-004/010 siguen sujetos), 12.7 ausencia de resultados verificables (HTTP 200, ecommendations:[], status.code:"no_verified_results", safety sin verificables, sin inventar/no elegibles), 12.8 modelo safety global/por platillo y estados (BE autoridad, ML no declara elegibilidad/relaja; disclaimer sin garantías; copy definitivo pendiente DEC-001), 12.9 meta (scope,totalCandidates,evaluatedCandidates,returned,limitApplied,fallback,mlUsed reales), 12.10 degradación segura ML (sin fallback silencioso ML v1, sin inventar, fallback determinista solo elegibles verificados, validar/contrastar ML, sin verificables→estado controlado, sin reintentos ilimitados, fallo ML no relaja restricciones, no implementar /interpret//rank en esta tarea/R2; parámetros/umbrales DEC-007/DEC-011 no aprobados).
- **DEC-002 restricción conservada:** validación de entrada presupuesto implementable después; **no activar comparación de precios en producción hasta verificar operativamente que datos existentes usan MXN**; sin conversiones/servicios externos/tasas. **DEC-001, DEC-004–DEC-011 mantienen estado actual** (no aprobadas indirectamente).
- **Documentos modificados:** docs/audit-v2/09-decisiones-finales.md (§4.1 DEC-012), docs/audit-v2/06-contratos-definitivos.md (decisiones base, §7 DEC-012 + pendientes, trazabilidad §8), docs/implementation-v2/00-plan-maestro.md (matriz DEC-012), docs/implementation-v2/README.md (resumen decisiones), docs/implementation-v2/BITACORA.md.
- **Restricciones cumplidas:** sin cambios de código ejecutable/rutas/controladores/validadores/servicios/esquemas/migraciones/frontends/ml-service/main.py/dependencias; sin instalaciones, migraciones, pruebas mutantes, eliminación ML v1, implementación /interpret//rank, commits/push/PR/merge/rebase/ops destructivas. Preexistentes preservados. Estado Git tracked después igual a antes.

## 2026-11-13 (R2 - tercer corte aprobado + retirada física de ML V1, DEC-003)
- **Rama/entorno:** `v2-segunda-version`. Sin commits/push/PR/merge/rebase ni operaciones destructivas. Cambios git tracked preexistentes (17 archivos de cortes 1/2) preservados intactos; sin tocar frontends; sin instalar dependencias.
- **R2 tercer corte — COMPLETADO (endurecimiento y validación), APROBADO por usuario:**
  - Pruebas ejecutadas (evidencia real): `python -m unittest tests.test_r2_interpret tests.test_r2_rank` → **85 PASS** (52 interpret + 33 rank). `node --test tests/unit/r2MlV2Integration.test.js` → **33 PASS**. Fundo consolidación+elegibilidad → **39 PASS** (intactas).
  - **51 casos nuevos** agregados (25 interpret + 15 rank + 11 integración backend/resiliencia) en `ml-service/tests/test_r2_interpret.py`, `ml-service/tests/test_r2_rank.py`, `backend/tests/unit/r2MlV2Integration.test.js`.
  - Reporte: `docs/audit-v2/11-r2-tercer-corte-endurecimiento.md` (conservado; trazabilidad de decisiones corregida).
- **Retirada física de ML V1 (DEC-003 aprobada — no es decisión nueva):**
  - `ml-service/main.py`: 1038 → 547 líneas (−491). Retirados endpoint `POST /recommendations` (`get_recommendations`), modelos V1 (`CravingInput`, `RecommendationRequest`, `DishOutput`, `RestaurantOutput`, `RecommendationItem`, `RecommendationResponse`), funciones exclusivas (`is_allergen_present`, `is_negated_term_present`, `is_diet_incompatible`, `generate_reasons`) y mapas exclusivos (`PROTEIN_MAP`, `DISH_TYPE_MAP`, `ALLERGEN_MAP`).
  - **Conservados** (compartidos/V2): `normalize_text`, `fuzzy_similarity`, `levenshtein_distance`, `parse_negations`, `spacy_normalize_text`, `NEGATION_PATTERNS`, `STOP_WORDS`, `WEIGHTS`, bloque spaCy, `TfidfVectorizer`/`cosine_similarity`, `/health`, `if __name__`, y todo el bloque V2 (`/interpret`, `/rank`). Sin cambios en V2.
  - Pruebas: eliminados `test_recommendations.py`, `tests/test_allergy_filtering.py`, `tests/test_diet_filtering.py` (exclusivos V1); adaptado `tests/test_ml_service.py` (717→276 líneas, solo funciones compartidas); conservados `tests/test_r2_interpret.py`, `tests/test_r2_rank.py` (V2) y `tests/test_fuzzy_negation.py`, `tests/test_tfidf_fuzzy.py` (compartidas).
  - Verificación: `import main` OK; `/interpret`, `/rank`, `/health` presentes; `/recommendations` ausente; 0 referencias a símbolos V1-only en `ml-service/**/*.py`. V2 suites **85 PASS** post-retirada. Backend R2 **33 PASS** (no afectado). Smoke `/interpret`+`/rank` funcional.
  - Consumidores V1: dentro del repo **ninguno** (backend solo llama `/interpret`+`/rank`; frontends llaman API backend no al ML; Docker/compose no consumen `/recommendations`). **No verificable estáticamente:** integraciones externas/producción que llamen directo al ML service (limitación documentada). Retirada justificada: sin consumidor en el flujo V2 (DEC-003).
  - Rutas backend `POST /api/public/.../recommendations` **conservadas** (handlers V2; renombrado = DEC-012/R4, fuera de alcance).
  - Reporte e inventario antes/después: `docs/audit-v2/12-r2-retirada-ml-v1.md`.
- **Trazabilidad de decisiones (corregida):** DEC-002 APROBADA (impl. pendiente); DEC-003 APROBADA (autoriza retirada V1); DEC-007 PENDIENTE; DEC-011 PENDIENTE; DEC-012 APROBADA 2026-11-13 (contrato externo, impl. pendiente). No se presenta DEC-012 como pendiente de aprobación.
- **Pendiente identificado (no implementado, sin decisión nueva requerida para aclarar):** `mlUsed: !!interpretOk || true` en `recommendWithMlV2` (siempre `true`, redundante). Impacto: nulo en seguridad; semántico sobre `meta.mlUsed`. Propuesta en `12-r2-retirada-ml-v1.md` §5.5 (definir semántica: `false` cuando el resultado final es fallback, exponer `rankOk`/`mlContacted` por separado).
- **Estado R2:** **EN PROGRESO.** Avanzado (cortes 1–3 + retirada V1). Pendientes: DEC-007 y DEC-011 (aprobación), DEC-012 y DEC-002 (implementación), validación UI (R4/R5). R2 no se declara terminado globalmente hasta resolver los criterios pendientes.

## 2026-11-13 (R2 - implementación contrato externo DEC-012, backend)
- **Rama/entorno:** `v2-segunda-version`. Sin commits/push/PR/merge/rebase ni operaciones destructivas. Cambios git tracked preexistentes preservados. Sin frontends, sin esquemas/migraciones, sin dependencias instaladas, sin browser E2E. DEC-007/011/002 no alterados; `/interpret`/`/rank` no alterados; rutas no renombradas.
- **DEC-012 APROBADA 2026-11-13 — implementación autorizada en backend.** Alinea las dos rutas públicas de recomendaciones (`POST /api/public/menu/recommendations` global, `POST /api/public/menu/:restaurant_id/recommendations`) con el envelope canónico V2.
- **Brechas corregidas (implementadas):**
  - Éxito: envelope `requestId, recommendations, meta, status, safety, error` (antes faltaba `requestId`/`status`/`safety`/`error` top-level). `status.code` = `ok` | `no_verified_results` | `partial_results_sanitized` según resultado real; `safety.overall` = `compatible_segun_datos` | `sin_resultados_verificables`.
  - `no_verified_results`: HTTP 200, `recommendations:[]`, `status.code:"no_verified_results"`, `safety.overall:"sin_resultados_verificables"`, sin inventar candidatos.
  - Errores uniformes: 404 `NOT_FOUND`/`not_found`, 403 `RESTAURANT_UNAVAILABLE`/`restaurant_unavailable`, 500 `INTERNAL_ERROR`/`internal_error` (antes `{mensaje}`); 400 ampliado con `safety`, `requestId` top-level, `error.retryable` (conserva `error.code:INVALID_REQUEST`, `status.code:invalid_request`, `meta.requestId`, `recommendations:[]`).
  - `meta` ampliada a DEC-012.9: +`scope, evaluatedCandidates, returned, limitApplied` (legacy `restaurant_id, recommendedCount, mlReason, meta.requestId` conservados transitoriamente para no romper tests/consumidores; retiro en R4).
- **Ya implementado (no duplicado):** validador estricto `.strict()` (rechazo campos desconocidos → 400 `INVALID_REQUEST`), defaults (`limit=5`, `locale=es-MX`, `requestId` generado), locale inválido→400, `diet` enum, límites, mapeo legacy, sin aceptar safety/elegibilidad del frontend.
- **Archivos modificados:** `backend/src/validators/recommendationRequest.js` (+`DISCLAIMER`, `buildSafety`, `buildRecommendationSuccessResponse`, `buildHttpErrorEnvelope`; `buildValidationErrorResponse` ampliado; exports), `backend/src/controllers/menuController.js` (ambos handlers → envelope canónico + errores 404/403/500 uniformes), `backend/tests/unit/dec012Contract.test.js` (nuevo, 16 pruebas), `docs/audit-v2/13-r2-dec012-contrato-externo.md` (nuevo), `docs/implementation-v2/BITACORA.md`.
- **Pruebas ejecutadas (evidencia real):** `node --test tests/unit/dec012Contract.test.js` → **16 PASS**. Regresión unitaria completa (dec012 + r2MlV2Integration + recommendationValidation + restrictionConsolidation + mockExtraction + eligibilityEvaluation + catalogVerification) → **114 PASS, 0 FAIL**. ML V2 Python (intacto, no tocado) → **85 PASS**.
- **Casos no verificables este entorno:** integración PostgreSQL real (`b1t02`/`b1t05`/`b1t04`, requieren Docker) — no ejecutadas; aserciones preservadas (`b1t05` afirma `meta.restaurant_id` conservado y usa `limit:10` válido 1..10; `b1t02` afirma 400 `INVALID_REQUEST` para `limit:11`). pytest ML — no ejecutable (pytest no instalado).
- **Conflicto detectado (punto a confirmar):** `options.limit` — spec aprobado DEC-012/06 §1.3/§2.2 = **1..10** (default 5); la instrucción del corte decía "máximo 5". **No se cambió** (permanece 1..10/default 5): es el contrato aprobado, ya implementado y validado por tests existentes (`limit:8` válido, `limit:11` rechazado); cambiarlo rompería `recommendationValidation`/`b1t05` y desviaría de DEC-012/06. El limit no es una brecha demostrada. Si se desea máximo 5, requiere actualizar spec 06 + tests.
- **Estado DEC-012:** 12.5/12.6/12.7/12.9 implementados (envelope éxito/error/no_verified_results/meta). 12.8 safety **por-ítem** y restructura `match`/`reasons[]` del ítem — **pendiente** (preserva forma de ítem actual para no romper tests/consumidores; coordinar R4). 12.1/12.2/12.3/12.4/12.10 ya cumplían/sin cambio.
- **Estado R2:** **EN PROGRESO.** Avanzado (cortes 1–3 + retirada V1 + contrato externo DEC-012). Pendientes: DEC-007 y DEC-011 (aprobación), DEC-002 enforcement (implementación), safety por-ítem/structura de ítem (R4), validación integral (R4/R5). R2 no se declara terminado globalmente.


## 2026-11-15 (continuaci?n DEC-012 y entorno Codex)
- Se cre? AGENTS.md en la ra?z con l?mites, referencias y salvaguardas. Skills existentes detectadas; sin instalaciones ni cambios globales. Rama v2-segunda-version y cambios previos preservados.
- Se rechazan campos legacy del request, se deduplican arrays tras trim, se a?aden match/reasons y safety por ?tem basados en elegibilidad del backend, y se corrige mlUsed en fallback por ranking vac?o. DEC-002 permanece sin enforcement.
- Regresi?n Node afectada: 117 pruebas aprobadas, cero fallos; DB/ML simulados en pruebas de handlers. Docker CLI disponible, motor inaccesible; integraci?n PostgreSQL real no ejecutada. Informe: docs/audit-v2/13-r2-dec012-contrato-externo.md ?10. DEC-012 permanece parcial; R2 en progreso.


## 2026-11-15 (R2 - continuacion cierre tecnico DEC-012)
- Limite contractual 1..10, default 5 confirmado en 06 seccion 1.3. Proyeccion canonica de platillos desde filas PostgreSQL y elegibilidad backend; no inventa precio, categoria ni arrays ausentes. Campos legacy conservados aditivamente por consumidores existentes; clasificacion en informe 13 seccion 11.
- Regresion Node: 119 PASS, 0 FAIL; DB/ML simulados en handlers. Docker y WSL accesibles fuera del sandbox; Engine y servicios activos. HTTP real: health 200, solicitud invalida 400, restaurante inexistente 404, global 200 con ML usado. Backend activo ejecuta version anterior de proyeccion; no se reinicio. Pruebas mutantes de integracion no ejecutadas sobre volumen persistente.
- Archivos: backend/src/controllers/menuController.js, backend/tests/unit/dec012Contract.test.js, docs/audit-v2/13-r2-dec012-contrato-externo.md, BITACORA.md. DEC-012 PARCIAL: falta validar nueva version en entorno aislado, presupuesto DEC-002 y semantica de score fallback; R2 en progreso.


## 2026-11-15 (DEC-012 integracion Docker aislada real)
- Proyecto codex-dec012-isolated con PostgreSQL y Redis tmpfs, ML V2 y backend actual, red interna y fixtures sinteticos; ningun volumen principal. Codigo montado solo lectura; hash del controlador host/contenedor 5d0a80b4f1cfb174133c3101a8701b4d45451134e440bab5f3f64d0155f84992.
- HTTP real 8 PASS: ambos endpoints, PostgreSQL, /interpret y /rank reales, validacion, envelopes, aislamiento y ausencia verificable; fallo ML inducido en backend separado. Python 85 PASS; Node 119 PASS.
- Se corrigio fail-closed para texto libre con interpretacion indisponible, tras reproducir fallo por HTTP. El aviso de fallback identifica su score como ordinal no confianza; su representacion como coincidencia queda pendiente de decision. DEC-002 sin enforcement por alcance; DEC-007/011 sin aprobar. DEC-012 PARCIAL; R2 en progreso.
- Archivos y comandos reproducibles: docs/audit-v2/13-r2-dec012-contrato-externo.md seccion 12 y backend/tests/integration/dec012-isolated/README.md.


## 2026-11-15 (R2 - DEC-002 validacion y fail-closed)
- Se valida presupuesto estructurado y MXN, se consolida y evalua antes de ranking. Moneda de `platillos.precio` no verificable en esquema existente: todo presupuesto activo falla de forma conservadora, sin asumir MXN. El comparador en centavos se verifico con evidencia sintetica unitaria, no con evidencia real de moneda. Texto ML ambiguo/contradictorio no sustituye presupuesto estructurado ni crea filtro duro.
- Node 124 PASS; Python ML V2 85 PASS; HTTP real aislado 10 grupos PASS con PostgreSQL/ML, incluida indisponibilidad inducida de ML. Precios sinteticos 10.00, 37.50 y 52.00 no se devolvieron con presupuesto por falta de evidencia monetaria. Sin candidata verificable no fue posible probar caida exclusiva de rank con presupuesto en integracion real.
- DEC-002 PARCIAL, DEC-012 PARCIAL, R2 EN PROGRESO. Falta fuente confiable de moneda, comparacion operativa e integracion positiva; score ordinal y DEC-007/011 pendientes. Detalles, hashes, archivos y alternativas en docs/audit-v2/13-r2-dec012-contrato-externo.md seccion 13.


## 2026-11-15 (DEC-002 auditoria focalizada de moneda)
- Esquema y escrituras no acreditan moneda; UI muestra MXN pero permite simbolos alternativos de presentacion. Consulta de esquema en PostgreSQL sintetico confirma precio numeric sin moneda; no se inspeccionaron datos productivos. Se compararon A por platillo, B por restaurante con cobertura/version y C convencion global; se recomienda B con confirmacion y trazabilidad, sin verificar historicos automaticamente. Informe 13 seccion 14 contiene propuesta, riesgos y pruebas.
- Se corrigio discrepancia previa: comparador monetario no estaba conectado a elegibilidad; ahora categoria budget invoca comparador con moneda no verificada, manteniendo fail-closed. Node 124 PASS, HTTP aislado 10 grupos PASS. No se habilito MXN ni se altero esquema o dato persistente.
- DEC-002 y DEC-012 PARCIALES; R2 en progreso. Pendiente seleccion y autorizacion de diseno/migracion y procedimiento de verificacion.


## 2026-11-15 (presupuesto opcional y propuesta B)
- Se confirma que presupuesto es opcional y sin el no se requiere evidencia de moneda. HTTP real aislado 12 grupos PASS: preferencia textual picoso devuelve resultados en ambos endpoints; frase con exclusion de puerco se interpreta, pero datos sinteticos no permiten verificar exclusion y devuelve vacio. Caso positivo de exclusion textual verificable sigue pendiente.
- Informe 13 seccion 15 propone esquema aditivo concreto, confirmacion limitada a precios y versiones, permisos y efectos en R3/R4/R5; sin migraciones ni modificaciones de datos persistentes. DEC-002 PARCIAL.


## 2026-11-15 (restricciones naturales, corte conservador)
- Se conserva la exclusion textual distinta de estructuradas con origen/texto y se rechazan listas ML malformadas; no se asumio compatibilidad de cerdo por ausencia textual. La exclusion inferida sigue desconocida al no existir evidencia de ausencia especifica validada.
- Node 126 PASS; HTTP real aislado 13 grupos PASS, incluida frase picoso/sin puerco, sin cerdo y pollo sin cebolla con respuesta vacia segura. No hay caso positivo de exclusion de cerdo verificada; informacion y propuesta R3/R4 en informe 13 seccion 16. R2 sigue EN PROGRESO.


## 2026-11-15 (preparacion R3 catalogo verificable)
- Diseno propuesto sin ejecutar migraciones: evidencia MXN por restaurante/precio exacto independiente de receta; reutiliza metadata, version y auditoria de receta, anade propuesta de taxonomia curada y declaraciones de ausencia. Integridad, permisos, revocacion, concurrencia y R3/R4/R5 en 03-base-datos/02-verificabilidad-alimentaria.md seccion N.
- Prueba unitaria sintetica r3Preparation: 3 PASS; conserva origen textual desconocido, verifica por separado evidencia sintetica de alergeno y version, y comparador sintetico. No es integracion real ni resultado positivo de ausencia de cerdo/MXN. DEC-002/DEC-012 PARCIALES; R2/R3 no declarados completos.


## 2026-11-15 (inicio R3 - preparacion parcial)
- Aprobado diseno R3; se preparo 20261115_r3_catalog_evidence.sql a partir del DDL de referencia, limitando actor_tipo a RESTAURANTE. No ejecutada.
- Pendientes: verificacion SQL y de esquema, restricciones de concurrencia e invalidacion, servicios, autorizacion, integracion de elegibilidad y pruebas. No se declara migracion lista para ejecutar ni R3/DEC-002/DEC-012 completos.

## 2026-11-15 — Objetivo maestro R3/R4, corte backend
- Autorización: implementar progresivamente R3/R4; preparar SQL sin ejecutarlo; sin instalaciones, cambios persistentes, Git mutante ni navegador automatizado.
- Skills: scope-guard, feature-audit (diseño previamente aprobado), code-quality, security-audit, aws-deployment. Contraste focalizado de esquema versionado, escritores y consumidores; esquema vivo no inspeccionado en este corte.
- R3: migración ampliada con revisiones de precio/receta, FKs tenant, triggers de cambios JSON/relacionales, taxonomía inmutable tras aprobación, revocación irreversible y auditoría retenida. No ejecutada. Sin backfill ni taxonomía aprobada automáticamente.
- Nuevos catalogEvidence (dominio), catalogEvidenceRepository (snapshot SQL), catalogEvidenceService (confirmar/consultar/revocar) y catalogEvidenceController. Rutas privadas owner-only; superadmin rechazado. Confirmaciones usan locks, versión esperada, transacción y auditoría obligatoria.
- Elegibilidad consume evidencia backend; presupuesto omitido sigue independiente de moneda. Exclusión explícita y corroborada por cláusula/taxonomía puede ser positiva. Relectura posterior a rank descarta cambios o revocaciones; evidencia de ingredientes no certifica alérgenos/trazas.
- Pruebas ejecutadas: `NODE_ENV=test node --test --test-reporter=spec tests/unit/*.test.js`: **183 PASS / 0 FAIL**, incluyendo 28 pruebas nuevas de dominio/servicios y cinco escenarios en ambos handlers públicos. DB/ML simulados; NO integración PostgreSQL/ML real. Preparado `tests/integration/r3Evidence.postgres.test.js`, no ejecutado con conexión.
- Se corrigió regresión encontrada por DEC-012: la proyección final conserva campos realmente ausentes, sin inventar arrays. Se corrigió normalización de términos de varias palabras.
- Pendiente: validación SQL/PostgreSQL y concurrencia real, revisión/carga autorizada de taxonomía, adaptación R4 y pruebas frontend. R3, DEC-002 y DEC-012 PARCIALES.

## 2026-11-15 — Objetivo maestro R3/R4, continuación
- R3: se preparó además `20261115_r3_taxonomy_draft.sql` sin aprobación ni ejecución. Se bloquearon contradicciones textuales, preparaciones sin desglose, ingredientes ambiguos y roles de propietario obsoletos; confirmaciones y revocaciones siguen requiriendo actor y ámbito backend. El presupuesto textual claro admitido se corrobora de forma limitada y presupuesto omitido no exige moneda.
- Frontend: ambos portales usan contrato DEC-012, solicitud textual directa con restricciones opcionales, estados vacíos/errores sin recomendaciones inventadas, y panel de revisión/confirmación/revocación en el editor existente. Sin scores expresados como probabilidades. Se conserva el desglose estructurado existente y se evita sobrescribir secciones ausentes. `admin` no recibió delegación.
- Ajuste de empaquetado: copia del contrato en cada contexto Docker del frontend con test de igualdad; el módulo compartido no se requiere fuera del contexto al construir. El estado vacío del portal restaurantes ahora muestra error o falta de verificabilidad correctamente.
- Pruebas reales ejecutadas: backend `NODE_ENV=test node --test --test-reporter=spec tests/unit/*.test.js` **192 PASS/0 FAIL** (PostgreSQL/ML simulados); `node --experimental-strip-types --test shared/recommendationContract.test.mjs` **7 PASS**; `node --test tests/r4-components.test.cjs` en frontend-restaurantes **6 PASS** SSR con dependencias existentes del portal restaurantes. SSR no prueba interacción ni navegador.
- TypeScript frontend-restaurantes: `node node_modules/typescript/bin/tsc --noEmit`, sin errores. Vite build restaurantes completó (advertencias de chunks/importaciones). Comensales: compilación TypeScript de 50 archivos y build Vite en memoria con las dependencias ya instaladas de restaurantes, sin errores; su `npm run build` normal bloqueado por instalación local incompleta de TypeScript/Vite y otros paquetes. No se instalaron dependencias.
- Integración PostgreSQL preparada: `node --test tests/integration/r3Evidence.postgres.test.js` **1 SKIP**, sin migrar/conectar; no demuestra persistencia. Docker contexto `desktop-linux`, CLI 28.5.1 y Compose 2.40.0; no se pudo abrir el socket del motor desde este entorno. No se modificaron contenedores ni volúmenes. No se ejecutaron Playwright/Cypress/Selenium.
- Archivos nuevos R3: migraciones `20261115_r3_catalog_evidence.sql` y `20261115_r3_taxonomy_draft.sql`; `catalogEvidence.js`, `catalogEvidenceService.js`, `catalogEvidenceRepository.js`, `catalogEvidenceController.js`; pruebas `catalogEvidence.test.js`, `r3Evidence.postgres.test.js`. Archivos backend modificados: `menuController.js`, `menuRoutes.js`, `eligibilityService.js`, `restrictionConsolidation.js`, `dec012Contract.test.js`.
- Archivos R4: servicios y adaptadores `recommendation*.ts`, componentes `CuestionarioWizard`, `DescubrirResultados`, `RecommendationWizard`, `CatalogEvidencePanel` y `NuevoPlatillo` de ambos portales; `shared/recommendationContract.ts`, prueba de contrato y `frontend-restaurantes/tests/r4-components.test.cjs`. Documentos: plan maestro, matrices R3/R4 y bitácora.
- Pendientes: autorizar independientemente aplicación de migraciones y taxonomía sintética en base aislada; ensayar SQL, permisos, concurrencia, revocación y resultados positivos reales con PostgreSQL/ML; autorizar reparación de dependencias de comensales si se desea `npm run build` propio; validar visual/teclado/accesibilidad y casos de interacción. Riesgo adicional: FK de evidencia retenida impide baja física; requiere procedimiento de retención antes de aplicar. R3/R4 y DEC-002/DEC-012 **PARCIALES**; DEC-007/011 sin cambio.

## 2026-11-15 — Verificación adicional de omisiones
- Se agregó control conservador en ambos handlers cuando ML omite todas o parte de las exclusiones textuales explícitas; casos «no tenga puerco», «sin puerco ni cebolla» y «sin puerco y sin gluten» no llegan a rank con restricciones faltantes. Es un control acotado, no NLP completo; construcciones ambiguas pueden producir cero resultados.
- Se probaron consulta y revocación de moneda/ausencia con transacciones simuladas, incluyendo aislamiento y revocaciones repetidas. Regresión backend: **199 PASS / 0 FAIL**, `NODE_ENV=test node --test --test-reporter=spec tests/unit/*.test.js`. DB y ML simulados, sin ejecución SQL R3.

## 2026-11-15 — Integración R3 real autorizada y búsqueda de una entrada
- La autorización posterior permitió aplicar B1, `20261115_r3_catalog_evidence.sql` y `20261115_r3_taxonomy_draft.sql` solo en bases nuevas PostgreSQL con `tmpfs`, red interna, sin puertos, credenciales y registros sintéticos. Antes se comprobaron red, montajes, base, 4 platillos históricos sin evidencia y ausencia de tablas R3; posterior: cero evidencias históricas y taxonomía en borrador. Proyectos Docker aislados `codexr3nov15isolated`, `codexr3nov15run2`, `codexr3nov15run3`; no reutilizan recursos principales.
- El rollback de la migración inducido antes de COMMIT en segunda instancia independiente confirmó ausencia posterior de tabla y columna R3. No se probó reversión de una migración ya confirmada; la evidencia no se elimina automáticamente.
- `backend/tests/integration/r3-isolated/real.test.cjs`: **11 PASS** con PostgreSQL, login JWT por HTTP y ML V2 reales; propietario, otro restaurante, IDOR, superadmin, MXN, presupuesto textual, receta sin cerdo, revocación, fallback, auditoría y lock entre dos conexiones. Un proxy interno observó IDs enviados a `/rank` y reenvió la petición al ML real: solo candidatos elegibles. `integrity.test.cjs`: **5 PASS** con rollback de cada transacción; ABA, receta relacional, taxonomía, FKs tenant y revocación irreversible. `owner-flow.test.cjs`: **1 PASS** edición HTTP, invalidación, reconfirmación y revocación. El borrado físico de un platillo con evidencia falla por FK: decisión de retención pendiente.
- ML V2: pruebas existentes interpret **52 PASS** y rank **33 PASS**. Adaptador frontend contra ambos endpoints HTTP reales: PASS para request canónico, requestId, resultados, vacío y error; no es prueba de navegador. Inicialmente un comando unittest no encontró el directorio tests en imagen; se ejecutaron los mismos archivos por stdin y pasaron.
- Se corrigieron dos defectos observados en integración: «Quiero tacos de máximo 100 pesos» omitía el presupuesto; y texto vegetariano omitido por ML devolvía resultados sin dieta. También se cierra ante alergia textual o presupuesto numérico no corroborados y se conservan URLs de menú en resultados globales.
- La decisión posterior sustituye el cuestionario visible por búsqueda de un solo mensaje, sin campos de presupuesto ni restricciones. Se modificaron las páginas de entrada, el diálogo por restaurante y etiquetas de navegación en ambos portales; se agregaron componentes `NaturalSearch.tsx`. Los servicios y contratos existentes permanecen, con `safety.priceVerified` derivado de evidencia vigente para controlar la presentación de precio.
- `single-message.test.cjs`: **1 PASS**, frases «Quiero algo dulce como pan, pero solo tengo 100 pesos» y «Quiero algo picoso sin puerco, y tengo 100 pesos» contra ambos endpoints con PostgreSQL/ML reales y evidencia sintética explícita. Primer intento falló porque el backend reiniciado todavía no escuchaba; la repetición pasó. No se ejecutaron migraciones durante este último corte.
- Dependencias de comensales reparadas mediante `npm ci --ignore-scripts --no-audit --no-fund`, lockfile existente, sin actualizar dependencias declaradas. El primer intento sandbox falló con error interno npm; el intento con acceso autorizado pasó. Builds normales `npm run build` de ambos portales completaron. `npm run lint` de ambos falla porque no existe configuración ESLint; no se inventó configuración ni se declara lint aprobado.
- Pruebas de este corte: backend **201 PASS / 0 FAIL** con dobles en pruebas unitarias; frontend contrato **7 PASS**, renderizado **8 PASS**; builds normales de comensales y restaurantes exitosos. SSR no demuestra interacción, responsive ni WCAG en navegador. Contraste calculado en colores principales nuevos: 6.89:1 botón blanco/naranja, 6.80:1 texto naranja/fondo claro y 9.86:1 texto claro/fondo oscuro; falta verificación real de interfaz. No se ejecutaron Playwright, Cypress ni Selenium.
- R3 y R4, DEC-002 y DEC-012 siguen PARCIALES: restan validación operativa de migraciones y roles en contexto no descartable (requiere nueva autorización), política de borrado/retención, dieta textual positiva verificable, pruebas de interacción/accesibilidad y validación integral R5. DEC-007 y DEC-011 sin cambio. Los recursos aislados de prueba se dejaron activos; no se borraron volúmenes ni datos persistentes.

## 2026-11-15 — Ajuste final de búsqueda única
- El menú público de cada portal abre el mismo buscador con el identificador de su restaurante; la ruta global conserva búsqueda global. Las etiquetas visibles de navegación dejaron de llamar «cuestionario» a la búsqueda. Se invalida el resultado anterior si se edita el texto mientras una solicitud está en vuelo.
- Regresión final: **201 pruebas backend PASS, 7 de contrato PASS y 10 de renderizado PASS**; build normal de cada portal PASS. Pruebas SSR incluyen un textarea obligatorio, ausencia de pasos, precio solo verificado, vacío, carga y error. No se realizaron pruebas de interacción ni navegador; responsive y accesibilidad reales quedan pendientes.

## 2026-11-15 — Corrección visual R4
- Se recuperaron del cuestionario anterior la tarjeta centrada de 580 px, bordes de 28 px, sombras, tipografía, campo y degradado de marca, con temas claro/oscuro y emoji 😋. La tarjeta conserva un único textarea y botón; no se cambiaron contratos ni lógica de búsqueda, resultados, seguridad o backend. Alcance: `frontend-comensales/src/features/recommendations/NaturalSearch.tsx` y comprobaciones SSR existentes.
- Se inspeccionó la página local en escritorio y viewport de 390×844, con temas oscuro y claro respectivamente. La captura original mencionada no estuvo disponible, por lo que no se afirma equivalencia visual exacta. No se ejecutó Playwright/Cypress/Selenium ni se hizo validación completa de accesibilidad.
- Para mejorar contraste se conservó el degradado original y se utilizó el color de texto oscuro existente `#1D1D1F`: contraste calculado en los tres extremos del degradado 4.58:1, 4.99:1 y 7.22:1, respectivamente; la comprobación completa de estados y dispositivos sigue pendiente.
- Pruebas: renderizado de componentes **10 PASS**, contrato frontend **7 PASS** y `npm run build` de comensales (incluye TypeScript) PASS. Los cambios anteriores permanecen; no se modificaron backend, ML, base de datos ni migraciones.

## 2026-11-15 — Recuperación de animación y flujo explícito R4
- La búsqueda de texto único no montaba la pantalla original `BouncyLoadingScreen`; el flujo anterior de resultados además tenía una salida temprana mientras cargaba. Se recuperó el componente existente con aguacate, taco, chile, efectos y barra indeterminada; se agregó alternativa de movimiento reducido. Se oculta en esta ruta la etiqueta de spaCy porque no hay confirmación de su activación en la respuesta.
- `NaturalSearch` usa `searchFlow.ts`: idle sin solicitud ni resultados; loading hasta resolver; éxito, ausencia y error diferenciados; evita duplicados, invalida respuestas obsoletas y desatiende finalizaciones tras desmontaje. El diálogo desmonta la búsqueda al cerrar. El mensaje completo se entrega al servicio existente. La captura de vacío previa no identifica la petición ni demuestra su causa; la respuesta real puede ser `no_verified_results`.
- Archivos del corte: `frontend-comensales/src/features/recommendations/{NaturalSearch.tsx,BouncyLoadingScreen.tsx,searchFlow.ts}`, `frontend-comensales/src/components/RecommendationWizard/RecommendationWizard.tsx`, `frontend-comensales/tests/{search-flow.test.cjs,search-http-readonly.cjs}`, `frontend-restaurantes/tests/r4-components.test.cjs`, esta bitácora y `04-frontend/README.md`. Se conservaron los cambios preexistentes; sin cambios de backend, ML, migraciones o datos persistentes.
- Pruebas: flujo **6 PASS**, componentes SSR **12 PASS**, contrato **7 PASS**, `npm run build` de comensales **PASS** (TypeScript y Vite). En backend aislado con PostgreSQL y ML reales, ocho peticiones HTTP de solo consulta a ambos endpoints respondieron 200 y conservaron requestId: «Quiero algo picoso», «Quiero algo picoso sin puerco» y «Quiero algo dulce como pan, pero tengo 100 pesos» devolvieron recomendaciones; «Quiero pollo sin cebolla» devolvió `no_verified_results`. Son datos sintéticos; la prueba HTTP no ejecuta React.
- Pendientes: inspección visual e interacción en navegador, viewport móvil, teclado y accesibilidad completos; SSR y revisión de clases responsive no prueban equivalencia visual ni comportamiento móvil. No se ejecutaron Playwright, Cypress ni Selenium. R4 continúa parcial y no se altera el estado de R3 ni de las decisiones.

## 2026-11-15 — Recuperación de resultados originales del recomendador
- `DescubrirResultados.tsx` conservaba la vista original, navegación con swipe, teclado, descarte, menú y drawer; quedó desconectada cuando `NaturalSearch` reemplazó cuestionario y resultados por un formulario con cuadrícula. `BouncyLoadingScreen.tsx` ya estaba reconectado en el corte anterior. Se consultaron el diff y el historial y la referencia `10-interaccion-swipe-descarte.png`; el historial contenía además datos y porcentajes ficticios que no se recuperaron.
- `NaturalSearch` monta la vista original únicamente al recibir éxito V2 y permite refinar sin perder el texto. `DescubrirResultados` acepta la respuesta ya recibida sin solicitud automática, deduplica por restaurante/platillo, conserva advertencias y muestra solo imágenes y precios verificados disponibles. Su corazón abre el menú y no guarda favoritos. No se modifica el flujo histórico sin propiedades ni los contratos/backend.
- Investigación HTTP sintética: `camaron`, endpoint global, requestId `r4-camaron-check`, HTTP 200, 8 candidatos evaluados, 5 resultados, ML activo, sin fallback. Incluye platillos sintéticos con pollo y tres registros de nombre igual pero IDs distintos. Sus scores de salida eran 0.55; el código de ML contempla esa puntuación base para candidatos sin coincidencia y no impone umbral de relevancia. La captura original no incluye requestId ni respuesta y no permite atribuirle una causa exacta. El proxy aislado no expuso contenido en logs; no se afirma haber inspeccionado el payload completo de esa llamada. No se modifica el ranking ni se filtra arbitrariamente en frontend.
- Archivos del corte: `frontend-comensales/src/features/recommendations/NaturalSearch.tsx`, `DescubrirResultados.tsx`, `frontend-restaurantes/tests/r4-components.test.cjs`, `04-frontend/README.md` y esta bitácora. Pruebas: SSR **13 PASS**, flujo **6 PASS**, contrato **7 PASS**, build de comensales con TypeScript y Vite **PASS**. Sin pruebas de interacción ni comparación visual en navegador; swipe, teclado, drawer, foco y móvil requieren validación real. No se ejecutó Playwright, Cypress ni Selenium. R4 sigue parcial.

## 2026-11-15 — Refinamiento visual y catálogo sintético aislado
- Skills oficiales de proyecto instaladas sin hooks ni paquetes del producto: `impeccable`, `ui-ux-pro-max` y `frontend-design-anthropic`, con licencias. Se consultaron sus instrucciones, playbooks y búsqueda local de UI UX Pro Max. El lanzador de contexto de Impeccable no se ejecutó: no hay binario local y se evitó descargar/ejecutar automáticamente un binario externo; la crítica independiente se basó en código y capturas históricas. Codex debe recargar para detectar las skills instaladas en el proyecto; no se afirma detección activa. No se ejecutó el detector ni una auditoría Impeccable completa.
- Dirección conjunta: conservar tipografía, tarjeta, emoji y paleta existente; etiqueta visible y foco más claro, luces de portada discretas y aura bouncy menos intensa. `searchFlow.ts` espera 1500 ms en éxito/vacío y la respuesta real, cancelando la espera en error, edición o desmontaje; no retrasa la solicitud. Pruebas: flujo **8 PASS**, componentes SSR **13 PASS**, contrato **7 PASS**, `npm run build` **PASS**. Se intentó inspección manual, pero el navegador devolvió timeout al servidor local; no hay capturas nuevas ni validación visual responsive, de contraste o teclado. No se ejecutaron Playwright/Cypress/Selenium.
- `demo-catalog.cjs` insertó solo en `r3_test_isolated` con tmpfs y sin puerto publicado, previo control de identidad de base y 0 correos no sintéticos. Dos ejecuciones dieron **15 restaurantes / 120 platillos / 0 imágenes**, con marcadores DEMO, IDs estables, sin sobrescribir ni borrar. Son precios y recetas sintéticos no certificados; no se crearon evidencias R3. Los datos se pierden si se elimina el entorno efímero y no están conectados al frontend principal.
- Consultas HTTP reales, ML V2 y PostgreSQL del entorno aislado: camarones, pollo, barbacoa y comida china devolvieron candidatos de esas categorías; pan devolvió candidatos de pan junto con registros previos de prueba. Presupuesto y sin puerco devolvieron dos registros sintéticos antiguos con evidencia previa, no los nuevos platillos sin evidencia; ambas respuestas señalaron restricciones no verificables. Vegetariano devolvió `no_verified_results`; postre de chocolate devolvió opciones de chocolate y otras. Las 9 respuestas fueron HTTP 200. No se alteró ML, elegibilidad ni los datos persistentes principales.
- Pendientes: conseguir/licenciar imágenes y atribución, confirmar evidencias sintéticas R3 mediante contratos reales para casos positivos, validar el seed en entorno local persistente inequívocamente autorizado sin tocar clientes, conectar el frontend a un backend aislado accesible y verificar visual/interacción completa. Estado del corte **PARCIAL**, no CUMPLE.

## 2026-11-15 — Ajuste bouncy y buscador sin navegador
- `BouncyLoadingScreen.tsx`: se eliminó la barra inferior, conservando `role=status`, mensajes y sombra; el taco y la sombra usan tiempos sincronizados, compresión/rotación ligeras y alternativa estática de movimiento reducido. El aura local pasó de 480 a 320 px y de 0.11–0.18 a 0.044–0.072 de opacidad (60 % menos), con color naranja pastel. Se conservan alimentos y colores del taco.
- `NaturalSearch.tsx`: se ajustaron proporciones, bordes y sombra de tarjeta, espaciados, textarea y foco claro/oscuro; el botón conserva el degradado y utiliza texto `#111111`. Contraste mínimo calculado de 5.14:1 en 202 muestras interpoladas del degradado normal, sin acreditar contraste real de todos los estados. No se modificaron resultados, servicios, backend ni base de datos. Se consultaron las skills locales Impeccable, UI UX Pro Max y Frontend Design como guías; no se ejecutó el motor/detector de Impeccable.
- Pruebas: `search-flow.test.cjs` **8 PASS** (1500 ms, petición lenta, error, cancelación y desmontaje); `r4-components.test.cjs` **13 PASS** SSR (sin barra, estado accesible y movimiento reducido); contrato **7 PASS**; `npm run build` de comensales **PASS**, incluye TypeScript. No se ejecutaron Playwright, Cypress ni Selenium.
- Archivos: `frontend-comensales/src/features/recommendations/BouncyLoadingScreen.tsx`, `NaturalSearch.tsx`, `frontend-restaurantes/tests/r4-components.test.cjs`, `04-frontend/README.md` y esta bitácora. **PENDIENTE DE VERIFICACIÓN VISUAL — CÓDIGO IMPLEMENTADO**: apariencia, movimiento, responsive, temas e interacción real en navegador.

## 2026-11-15 — Mayor recorrido del rebote
- Se incrementó el desplazamiento vertical del taco de 38 a 55 px, del aguacate de 22 a 34 px y del chile de 24 a 36 px. Se conservaron la sincronización de la sombra y la alternativa estática para movimiento reducido. La validación visual en navegador sigue pendiente.

## 2026-11-15 — Restauración del movimiento original
- A petición del usuario se consultó `git show HEAD:frontend-comensales/src/features/recommendations/BouncyLoadingScreen.tsx` y se recuperaron los valores históricos de movimiento: taco 38 px, aguacate 22 px, chile 24 px, ciclo central y sombra de 0,85 s con la curva original y sombra sincronizada. Se mantienen la preferencia de movimiento reducido, el resplandor suave, la ausencia de barra inferior y el flujo V2 ya autorizados. La comparación visual real sigue pendiente.

## 2026-11-15 — Diagnóstico de animación inmóvil
- El frontend Vite de `localhost:3000` sirve el componente con la animación original y lo monta durante la búsqueda. Una consulta de solo lectura a `SPI_GETCLIENTAREAANIMATION` de Windows devolvió `false`: las animaciones de interfaz están desactivadas. La aplicación respeta la preferencia del sistema mediante `useReducedMotion`, por lo que los alimentos permanecen quietos bajo esa condición.
- `BouncyLoadingScreen` ofrece ahora «Activar animación» cuando el sistema solicita movimiento reducido, como elección local de esa pantalla; no cambia la configuración de Windows y conserva el estado estático inicial. El botón existe solo mientras se muestra la carga, por lo que una respuesta rápida puede dejar poco tiempo para pulsarlo. Pruebas: 14 componentes SSR y TypeScript sin errores. No se verificó interacción en navegador.

## 2026-11-15 — Rebote original automático, sin botón de activación
- El usuario confirmó «ya funciona» al activar la animación y pidió expresamente que se ejecutara siempre sin botón. Se eliminó de `BouncyLoadingScreen.tsx` la condición que inmovilizaba los alimentos según `useReducedMotion`, junto con el botón. Se conservan el taco a 38 px, aguacate a 22 px, chile a 24 px y sombra sincronizada a 0.85 s, el aura tenue y la ausencia de barra. Esta decisión reemplaza la alternativa estática de esa pantalla documentada en los cortes anteriores; no se cambian Windows ni las demás pantallas.
- Se retiraron de `NaturalSearch.tsx` el control previo y el hook de preferencia que se habían añadido durante este mismo trabajo, antes de la aclaración. No queda hook ni lectura/escritura de preferencias de animación. Cualquier valor guardado durante esa prueba se ignora. La búsqueda conserva su mensaje único, petición, estados y resultados.
- Comprobación real del entorno: `menus-qr-frontend-comensales-1` activo, puerto 3000 publicado y `frontend-comensales` montado en `/app`. Lecturas HTTP de `localhost:3000/src/features/recommendations/BouncyLoadingScreen.tsx` y `NaturalSearch.tsx`: **200**, código con rebote original, sin condición `reduceMotion`, sin botón ni hook. No se reconstruyó ni reinició Docker y no se tocaron datos.
- Pruebas de código: `node --test --test-reporter=dot tests/r4-components.test.cjs` desde restaurantes: **14 PASS**, incluido movimiento automático con preferencia reducida simulada y ausencia de botones; `search-flow.test.cjs`: **8 PASS**; contrato compartido: **7 PASS**. `npm run build` de comensales: **PASS**, incluye TypeScript y Vite (1716 módulos). Son pruebas SSR/unitarias, no interacción real en navegador.
- Archivos del corte: `frontend-comensales/src/features/recommendations/BouncyLoadingScreen.tsx`, `NaturalSearch.tsx` (retirada del control temporal), `frontend-restaurantes/tests/r4-components.test.cjs`, `docs/implementation-v2/04-frontend/README.md` y esta bitácora. Sin cambios de backend, ML, base de datos, dependencias o configuración global; sin commits ni pushes. La comprobación visual final automática y responsive permanece pendiente; no se declara R4 ni las decisiones completadas.

## 2026-11-15 — Catálogo local DEMO y 15 consultas solicitadas
- Autorización del usuario: poblar la base para probar con 20–30 restaurantes ficticios y ejecutar 15 frases. Se comprobó que el backend de `localhost:4000`, usado por el frontend de `localhost:3000`, se conecta a `mexxicanmx_db` del contenedor local `mexxicanmx_db`. Antes había 29 restaurantes y 13 platillos. Se insertaron mediante transacción aditiva **25 restaurantes DEMO y 150 platillos** de pastelería, malteadas, pizza, comida mexicana y comida fresca. IDs deterministas, correos `example.invalid`, cuentas sin acceso, metadatos sintéticos; no se sobrescribieron registros ni se crearon confirmaciones monetarias o alimentarias. Sin migraciones.
- Archivos añadidos: `backend/tests/integration/demo-local-catalog.cjs`, `backend/tests/integration/demo-local-requests.cjs` y `docs/evidencias/demo-local-15-consultas.json`. Este último contiene los cuerpos HTTP reales. Los precios y recetas de demostración no son evidencia certificada; por tanto no habilitan automáticamente restricciones de precio ni exclusiones.
- Pruebas: 15 POST reales al endpoint global con texto exacto, DEC-012 y límite 5; todas HTTP **200**, 163 candidatos evaluados por consulta. En 12 se obtuvo `no_verified_results` (1, 2, 4, 5, 8–15). La solicitud 3 devolvió cinco «Pollo al horno» previos con `nivel_picante: 0`, no lo esperado. La 6 devolvió cinco flanes, sin evidencia que confirme que sean ligeros o poco grasosos. La 7 devolvió tacos de pollo con salsa verde de cinco restaurantes DEMO; coincide en el contenido solicitado, pero el precio no estaba verificado. Para 3, 6 y 7 la respuesta reportó `mlUsed: true`; en las demás reportó `mlUsed: false`, `no_eligible_candidates` y restricciones no verificables. Esto no demuestra por sí solo que la interpretación ML no se haya llamado.
- La abstención de la 14 evita afirmar compatibilidad, pero no demuestra detección específica de contradicción ni una pregunta de aclaración. Las 12 respuestas sin resultados no demuestran éxito positivo en presupuesto o exclusiones; tampoco atribuyen por separado qué condición produjo cada abstención. Sin prueba de navegador ni endpoint por restaurante. El catálogo es sintético, no tiene imágenes, y varias sedes de una categoría comparten menú; puede producir resultados con nombres repetidos. R3, DEC-002 y DEC-012 conservan sus estados anteriores.

## 2026-11-15 — Calidad del recomendador: corrección parcial y validación aislada
- Se compararon las 15 entradas/respuestas originales con una repetición en `codexr3nov15run3` (PostgreSQL efímero `r3_test_isolated`, Node y ML V2 reales). Los catálogos son distintos (163 frente a 128–129 candidatos); la diferencia de resultados no demuestra por sí misma efecto causal. La traza original no guardó interpretación, motivos individuales ni payloads de ranking; no se reconstruyen retrospectivamente. La matriz y limitaciones están en `docs/evidencias/calidad-15-casos.md`; respuestas y `/interpret` separados en `quality-isolated-15-consultas.json`.
- `ml-service/main.py`: el ranking pondera el picante declarado ante preferencia positiva, sin filtrar elegibles ni inferir picante; ordena por puntaje previo al redondeo para evitar empates artificiales. Interpretación propone `no lleve`/`no como`, omite `gastar` como ingrediente y no marca `entre dulce y salado` como presupuesto ambiguo sin mención monetaria. `menuController.js`: la guardia compara términos, detecta omisiones de esas construcciones y bloquea importes no corroborados expresados en varos; no modifica el contrato ni relaja restricciones.
- En una ejecución intermedia se detectó que «sin gastar más de 120 varos» podía devolver un platillo de 150 al no reconocerse la expresión en la guardia del backend. La corrección se volvió a probar con la misma frase: `no_verified_results`; aún no se corrobora positivamente el límite coloquial. En el entorno final el caso 3 priorizó platillos sintéticos nivel 2, pero la petición de picante fuerte, la calidad general y el caso de ligereza siguen sin resolverse completamente. La contradicción del caso 14 no se detecta ni comunica de forma específica.
- Pruebas reales: 15 POST HTTP globales en entorno aislado, todos 200, con 12 respuestas sin resultados verificables; 36 pruebas unitarias de ranking ML y 55 de interpretación PASS; 104 pruebas Node de contrato, integración con ML simulada, elegibilidad, consolidación y DEC-002 PASS. `quality-evidence.test.cjs` PASS con PostgreSQL, backend y ML reales: dueño sintético confirmó MXN y ausencia de cerdo para un platillo sintético; ambos endpoints devolvieron el platillo con presupuesto y exclusión, y tras revocar ausencia el endpoint del restaurante lo excluyó. No representa los 15 positivos solicitados.
- `single-message.test.cjs` contra el backend actualizado: FAIL en su última aserción por esperar un ID concreto entre los diez primeros sin presupuesto; las aserciones anteriores de precio y exclusión pasaron. No se alteró la prueba. `test_fuzzy_negation.py` no se ejecutó: el contenedor ML no tiene `pytest`; no se instalaron dependencias. `git diff --check` señala espacios previos en archivos ya modificados y no se limpiaron cambios ajenos.
- Archivos del corte: `ml-service/main.py`, `ml-service/tests/test_r2_rank.py`, `ml-service/tests/test_r2_interpret.py`, `backend/src/controllers/menuController.js`, `backend/tests/unit/dec012Contract.test.js`, `backend/tests/integration/r3-isolated/quality-run.cjs`, `quality-evidence.test.cjs`, `docs/evidencias/quality-isolated-15-consultas.json`, `calidad-15-casos.md`, README de R2/R3/R5 y bitácora. No se cambiaron datos persistentes principales, producción, migraciones ni dependencias. Los procesos temporales adicionales corren solo en la red aislada. Estados R2/R3/R5 y DEC-002/DEC-012 no se declaran completos.

## 2026-11-15 — Pollo picante: depuración enfocada
- El ML principal en ejecución dio 0.8413 tanto a pollo con picante 4 como a picante 0. El código de ranking actualizado pondera el nivel declarado y combina la puntuación textual con la escala de picante, sin convertir preferencias en filtros de seguridad. El backend conserva una razón controlada de coincidencia parcial cuando la fila declara nivel 0; mantiene desconocido el nivel ausente.
- Unitaria ML: 37 PASS; regresión Node contrato/ML: 70 PASS. Prueba HTTP real en PostgreSQL efímero, backend y ML actualizados: dos candidatos elegibles del mismo restaurante, picante 4 primero con 0.99, picante 0 segundo con 0.4345 y razón «coincidencia parcial». La escala no es confianza calibrada. No se reiniciaron servicios principales ni modificaron datos persistentes. Archivos: `ml-service/main.py`, `ml-service/tests/test_r2_rank.py`, `backend/src/controllers/menuController.js`, `backend/tests/integration/r3-isolated/spicy-chicken.test.cjs` y esta bitácora.

## 2026-11-15 — Treinta solicitudes contra servicios locales activos
- 30 POST al endpoint global del backend principal: 30 HTTP 200, 20 `no_verified_results` y 10 `ok`; HTTP 200 no es aprobación funcional. En la frase 20 («no lleve leche»), `/interpret` del ML activo devolvió `excludedIngredients: []` y el backend recomendó licuado con leche declarada. Los servicios principales siguen ejecutando procesos anteriores a las correcciones aisladas; no se reiniciaron. Respuestas: `docs/evidencias/demo-local-30-consultas.json`; ejecutor: `backend/tests/integration/demo-local-30-requests.cjs`. No se modificaron datos persistentes.

## 2026-11-15 — Reparación crítica enfocada
- Misma base efímera y cuatro platillos sintéticos antes/después: antes, la exclusión «no lleve leche» devolvía licuado con leche y «no pique» devolvía caldo de picante 4; después, la primera se abstiene y la segunda solo devuelve nivel declarado 0. Camarones pasa primero; pollo baja de 0.55 a 0.275 (puntuación de orden, no confianza calibrada).
- `menuController.js` amplía guardia independiente ante negaciones explícitas y listas, y verifica picante 0 antes de rank/fallback y al revalidar; ausente es desconocido. `ml-service/main.py` reduce coincidencia de candidatos sin camarón declarado para esa petición. No se garantiza interpretación de toda expresión natural. Tests: 106 Node, 38 ranking ML, 55 interpretación ML y 1 integración HTTP real PASS. Con ML real modificado por proxy de prueba para omitir exclusiones, y con ML caído, no se devuelve resultado para «no lleve leche». Evidencias `docs/evidencias/critical-recommendations-{before,after}.json`; scripts `backend/tests/integration/r3-isolated/critical-*.cjs`.
- Docker principal no reiniciado: mounts reflejan archivos, pero procesos Node/uvicorn no recargan automáticamente. Backend ejecuta `runMigrations()` al iniciar fuera de `NODE_ENV=test`, riesgo de DDL en PostgreSQL persistente. Sin migraciones, cambios persistentes ni instalaciones en este corte. La protección sigue pendiente de activación en `localhost:3000`.

## 2026-11-16 — Comprobación tras reinicio del usuario
- Backend y ML principales reiniciados y saludables. ML activo extrae `leche` para «no lleve leche»; dos solicitudes reales devuelven `no_verified_results`. «No pique» devolvió cinco resultados con nivel declarado 0; «pollo que pique bastante» devolvió pizza de pollo con picante 3. No se acreditó funcionamiento de todas las variantes ni inspección en navegador.
- «Quiero camarones» devolvió pizzas de champiñones con puntuación 0.3427: en los 163 platillos activos de restaurantes con suscripción activa, una consulta de solo lectura encontró 0 menciones de camarón en nombre, descripción o ingredientes principales. Además, el ranking aún entrega resultados sin ese ingrediente y la razón final es genérica. Sin cambios a datos ni reinicios por Codex; no se atribuyen cambios de esquema al reinicio sin evidencia.

## 2026-11-16 — Relevancia explícita y camarones DEMO
- El backend ahora selecciona candidatos elegibles por alimento principal explícito reconocido, antes de ranking/fallback y en revalidación; usa nombre e ingredientes principales declarados, singular/plural y sinónimos limitados como quisquilla (DLE https://dle.rae.es/camar%C3%B3n). No introduce umbral DEC-007 ni infiere ingredientes desde descripciones. Si existen elegibles pero ninguno relevante, devuelve lista vacía y razón interna `no_relevant_candidates`; mantiene el estado público DEC-012 `no_verified_results`. Cobertura lingüística deliberadamente limitada; solicitudes no reconocidas conservan comportamiento previo.
- La base principal contenía 0 platillos con camarón, activos o inactivos, y 29 restaurantes no DEMO; no se escribió allí. En `r3_test_isolated`, tmpfs, sin restaurantes no sintéticos, seed idempotente agregó cinco recetas DEMO y fotos ilustrativas de Wikimedia Commons con autor, URL de fuente y licencia CC BY en cada descripción; sin certificaciones. Dos ejecuciones mantuvieron siete platillos incluyendo dos controles.
- Misma base y catálogo de control antes/después: antes devolvía pizza/pollo al pedir camarones; después sin camarones devolvió `no_verified_results` y cero candidatos ajenos; con cinco camarones devolvió los cinco. Pruebas HTTP reales: variantes «algo con camarones»/«quisquillas», alergia a camarón, prohibición explícita de picante (excluye diabla), pollo, ML caído y caída aislada de `/rank` con `/interpret` real: PASS. 109 pruebas Node PASS. Fotos no inspeccionadas visualmente en navegador. Backend principal conserva proceso anterior; requiere carga autorizada del código, considerando `runMigrations()` al arrancar. Archivos: `backend/src/services/primaryFoodRelevance.js`, `backend/src/controllers/menuController.js`, `backend/tests/unit/primaryFoodRelevance.test.js`, `backend/tests/integration/r3-isolated/relevance-{seed.cjs,http.test.cjs,rank-failure.cjs}` y esta bitácora.

## 2026-11-16 — Vocabulario mexicano R2 (parcial)
- Registro propio `shared/mexican-spanish-v1.json` v1.0.0-draft: 75 conceptos y 350 formas, con categorías, tipo de relación, fuentes/justificaciones y relaciones que no equivalen automáticamente. `/interpret` conserva el texto de entrada, genera normalización y menciones contextuales; el backend comparte el registro para relevancia y operadores monetarios, mantiene elegibilidad R3 y no usa erratas como prueba de receta. `tortita` permanece ambigua; camarón no se equipara a mariscos ni langostino.
- Consulta puntual: DEM para «picoso» (https://dem.colmex.mx/ver/picoso), DLE para camarón (https://dle.rae.es/camar%C3%B3n), ASALE (https://www.asale.org/damer/) declara todos los derechos reservados. CEMC II: consulta inicial agotó tiempo; se revisó descripción del repositorio (https://repositorio-cell.colmex.mx/). No se verificó licencia general de reutilización de DEM/CEMC; no se copiaron entradas ni corpus ni se realiza scraping. Las formas restantes son ejemplos del usuario o derivaciones propias; no se afirma revisión dialectológica exhaustiva.
- `No más de cien pesos`, `Traigo 80 varos` y `No quiero gastar más de 100 varos` se corroboran solo en formulaciones acotadas; se exige evidencia MXN. Aproximaciones no se convierten en máximos. Cantidades compuestas no soportadas y presupuestos explícitos contradictorios quedan bloqueados cuando no pueden comprobarse. `sin picante` y `no pique` usan únicamente el nivel declarado 0; ingredientes, alergias y trazas mantienen las reglas R3.
- Pruebas: 112 Node, 97 ML (incluye 15 frases representativas en subpruebas) y una integración HTTP real con PostgreSQL/ML/Node aislados PASS. En el mismo catálogo: «un pollito» pasó de cinco opciones mezcladas a un pollo; «camaronsitos» recuperó cinco camarones. Presupuesto escrito: sin evidencia, cero resultados; con evidencia sintética MXN, cuatro candidatos <=100. Se comprobó presupuesto aproximado sin filtro, negaciones, excepción pescado y ambos endpoints para leche. Los hashes normalizados del registro y módulo temporal coincidieron con workspace. Análisis local: ~0.385 ms por frase en una muestra de 1000; no es prueba de rendimiento integral.
- Archivos: `shared/mexican-spanish-v1.json`, `backend/src/services/{linguisticVocabulary.js,primaryFoodRelevance.js,restrictionConsolidation.js}`, `backend/src/controllers/menuController.js`, `ml-service/{linguistic.py,main.py}`, `backend/tests/unit/{primaryFoodRelevance.test.js,dec012Contract.test.js,dec002Budget.test.js}`, `ml-service/tests/test_mexican_language.py`, `backend/tests/integration/r3-isolated/{compose.yaml,mexican-language-http.test.cjs}`, `compose.yml` y esta bitácora. No se instaló nada ni se tocó la base persistente. `localhost:3000` no ejecuta este corte: los nuevos montajes requieren recrear servicios y el backend aún ejecuta `runMigrations()` al arrancar fuera de test; no se reinició.

## [2026-11-17 21:12 -06:00] ISSUE #42 — [R2/R5][QA] Auditar ML V2 con 30 frases reales, documentar causas y bloqueos

- **Implementó / auditó:** @Felixgarciaf
- **Rol en esta actividad:** auditor / ejecutor / verificador QA.
- **Issue / rama / commit:** https://github.com/osbaldoXxC/menus-qr/issues/42 / `feature/issue-42-felix-auditoria-ml` / base `4f6df83f5563c51b4168b945895ac9e3dbd32e15`.
- **Objetivo y alcance:** Reproducir y auditar la batería de 30 frases reales sobre el recomendador ML V2 + Backend V2 trazando las 8 capas (`entrada -> normalización -> /interpret -> consolidación -> recuperación -> elegibilidad -> /rank -> fallback -> respuesta final`), medir rendimiento (`p50`/`p95`) y documentar causas raíz y bloqueos sin alterar código funcional.
- **Qué código o documento se inspeccionó:** `.agents/AGENTS.md`, `.agents/skills/{scope-guard,feature-audit,security-audit,code-quality,performance-optimization,test-selection}/SKILL.md`, `docs/asignaciones/felix-g/{ISSUE-01-ML-30-FRASES.md,TEC-01-AUDITORIA-ML.md,BITACORA-PLANTILLA-FELIX_G.md}`, `shared/mexican-spanish-v1.json`, `ml-service/{linguistic.py,main.py}`, `ml-service/tests/test_mexican_language.py`, `backend/src/validators/recommendationRequest.js`, `backend/src/services/{linguisticVocabulary.js,restrictionConsolidation.js,primaryFoodRelevance.js,eligibilityService.js,catalogVerification.js,catalogEvidence.js}`, `backend/src/controllers/menuController.js`, `backend/src/config/db.js` y `backend/tests/integration/r3-isolated/*.cjs`.
- **Qué se cambió realmente:** `SIN CAMBIOS FUNCIONALES`. Únicamente se crearon los entregables de evidencia `docs/evidencias/ml-v2-30-frases-felix-g.json` y `docs/evidencias/ml-v2-30-frases-felix-g.md`, y se registró esta entrada en `docs/implementation-v2/BITACORA.md`.
- **Entorno:** Host Windows (`c:\Users\felix\Desktop\integradora-menu`), zona horaria `America/Mexico_City`, Node.js `v24.22.1` + Python `3.13.7` (`NODE_ENV=test`, `DISABLE_STARTUP_DDL=true`), vocabulario `shared/mexican-spanish-v1.json` (`1.0.0-draft`, 75 conceptos / 350 formas), dataset fijo `synthetic_demo_v1` (`backend/tests/integration/r3-isolated/demo-catalog.cjs`: 15 restaurantes DEMO, 120 platillos activos sin certificaciones R3 ni moneda MXN confirmada). Sin exposición ni registro de secretos de `.env`.
- **Pruebas ejecutadas:**
  1. Suite unitaria aislada de relevancia y verificación: `node --test backend/tests/unit/primaryFoodRelevance.test.js backend/tests/unit/catalogVerification.test.js` -> **21 PASS / 0 FAIL** (`276.3 ms`).
  2. Verificación del analizador lingüístico mexicano: `python -c "import linguistic..."` -> **PASS** (`version: 1.0.0-draft`, `75 conceptos`).
  3. Ejecución reproducible de las 25 frases literales disponibles en el repositorio a través de las capas reales (`linguistic.py` + `interpret` + `consolidateRestrictions` + `evaluateEligibility` + `selectRelevantFood` + `filterNoSpice` + `rank`) sobre el catálogo fijo de 120 platillos: **25 ejecutadas / 5 bloqueadas por archivo fuente ausente**. Duración por caso: `min = 1.621 ms`, **`p50 = 2.202 ms`**, **`p95 = 28.456 ms`**, `max = 31.894 ms`.
- **Resultados observados:** De las 30 posiciones de la matriz: **5 `PASS`** (casos 1, 4, 16, 18, 20), **10 `NO-VERIFICABLE`** (abstención segura *fail-closed* en casos 7, 8, 10, 11, 17, 19, 22, 23, 24, 25 por falta de evidencia MXN `DEC-002` o ausencia certificada `R3`), **9 `FAIL-RELEVANCIA`** (casos 2, 3, 5, 6, 9, 13, 14, 15, 21: destacando `[ML-30-C14]` donde «Un postrecito frío» devuelve 0 candidatos porque `dishMatchesFamily()` en `primaryFoodRelevance.js:52` no evalúa `dish.categoria_nombre`, y `[ML-30-C21]` donde «Quiero una tortita» deja `constrained: false` y rellena con 5 platillos ajenos), **1 `FAIL-SEGURIDAD` histórico documentado** (`[ML-30-C12]` «No lleve leche»: en contenedor previo sin reiniciar recomendó licuado con leche; en el código actual `4f6df83` bloquea de forma segura por doble guardia `parse_negations` + `hasOmittedTextExclusion`), y **5 `BLOQUEADO`** (casos 26 al 30 por no haberse subido `docs/evidencias/demo-local-30-consultas.json` al repositorio). En auditoría de rendimiento se detectó que `getGlobalRecommendations` y `getPublicRecommendations` ejecutan `enrichCandidates()` dos veces por petición (`menuController.js:1200/1265` y `1330/1374`).
- **Riesgos de seguridad:** (1) Si los contenedores principales (`backend` y `ml-service`) no se recargan con el código `4f6df83` y `DISABLE_STARTUP_DDL=true`, persiste en memoria el riesgo crítico de omisión de exclusiones como «no lleve leche»; (2) `backend/src/config/db.js:184-186` ejecuta `runMigrations()` automáticamente al arrancar si `NODE_ENV !== 'test'` y `DISABLE_STARTUP_DDL` no está activo.
- **Limitaciones y pendientes:** Las filas 26 a 30 permanecen en estado `BLOQUEADO` (sin inventar frases) en espera de que se incorpore al repositorio el archivo `docs/evidencias/demo-local-30-consultas.json`.
- **Estado:** PARCIAL (25/30 casos ejecutados y diagnosticados con traza completa; 5/30 documentados en bloqueo por archivo fuente no versionado en `4f6df83`).
- **Próxima acción autorizada:** Recibir `docs/evidencias/demo-local-30-consultas.json` para completar las 5 filas bloqueadas y esperar autorización en un issue separado antes de implementar correcciones en `primaryFoodRelevance.js` y `menuController.js`.

### Bloqueo detectado (crear entrada en cuanto aparezca)

- **Fecha/hora:** `2026-11-17T21:12:00-06:00` (`America/Mexico_City`)
- **Reportado por:** @Felixgarciaf
- **Severidad:** ALTA
- **Requisito que bloquea:** Criterio de aceptación 1 de `ISSUE-01-ML-30-FRASES.md` (*«El origen de las 30 frases y las respuestas anteriores está en `docs/evidencias/demo-local-30-consultas.json`. No inventar frases faltantes»*).
- **Síntoma reproducible:** Al clonar `main` en el commit `4f6df83f5563c51b4168b945895ac9e3dbd32e15`, el directorio `docs/evidencias/` y los scripts `backend/tests/integration/demo-local-30-requests.cjs` y `demo-local-catalog.cjs` referenciados en entradas previas de `BITACORA.md` no existen en el árbol Git. Solo 25 de las 30 frases literales figuran en los tests versionados (`ml-service/tests/test_mexican_language.py` y `backend/tests/integration/r3-isolated/*.cjs`).
- **Evidencia de logs/archivos:** Casos `26` a `30` (`audit-felix-c26` a `audit-felix-c30`) en [`docs/evidencias/ml-v2-30-frases-felix-g.json`](../evidencias/ml-v2-30-frases-felix-g.json) y sección `[ML-30-C26 a C30]` en [`docs/evidencias/ml-v2-30-frases-felix-g.md`](../evidencias/ml-v2-30-frases-felix-g.md).
- **Riesgo de continuar:** Completar las 5 frases faltantes por inferencia o invención violaría expresamente la prohibición de `ISSUE-01-ML-30-FRASES.md` y contaminaría la comparativa reproducible.
- **Operación detenida:** Ejecución de las 5 frases faltantes (`caseId` 26–30) y comparación contra los cuerpos HTTP históricos de `demo-local-30-consultas.json`.
- **Tareas independientes que sí pueden continuar:** Auditoría completa por capa de las 25 frases literales verificables en el repositorio, medición de latencias `p50`/`p95`, identificación de defectos de relevancia/rendimiento y entrega de `docs/evidencias/ml-v2-30-frases-felix-g.{json,md}`.
- **Notificación:** Comentario publicado en https://github.com/osbaldoXxC/menus-qr/issues/42 con mención a `@osbaldoXxC` (`2026-11-17T21:18:00-06:00`).
- **Decisión requerida del responsable:** Subir `docs/evidencias/demo-local-30-consultas.json` al repositorio o autorizar el cierre de la auditoría con los 25 casos trazados y los 5 bloqueos documentados.
- **Estado:** ABIERTO

### Hallazgos individuales por cada FAIL y BLOQUEADO (Criterio de Aceptación #8 — Issue #42)

### [ML-30-C02] FAIL-RELEVANCIA — Preferencia de Picante (Mexicanismo)
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Algo bien enchiloso`
- **Comportamiento esperado:** Priorizar platillos con nivel_picante > 0 declarados en catálogo
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Camarones con chipotle ($87 MXN, picante=3, score=0.8651), Chilaquiles rojos ($73 MXN, picante=3, score=0.8651), Mole con pollo ($45 MXN, picante=3, score=0.8651)).
- **`requestId` y endpoint:** `audit-felix-c02` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 7: primaryFoodRelevance.js + Ranking (/rank)`
- **Evidencia que lo demuestra:** `Al no mencionarse una familia de alimento primario en 'Algo bien enchiloso' / 'Que pique machín', selectRelevantFood() no filtra por categoría y /rank mezcla platillos con nivel_picante=3 y nivel_picante=0 por similitud TF-IDF/tokens.` ([Registro JSON `caseId=2`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** Evitar rellenar con candidatos de nivel_picante=0 cuando el usuario exige explícitamente comida muy picante ('enchiloso'/'que pique machín').
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C03] FAIL-RELEVANCIA — Preferencia de Picante Intenso
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Que pique machín`
- **Comportamiento esperado:** Priorizar platillos con mayor nivel_picante declarado
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Camarones con chipotle ($87 MXN, picante=3, score=0.8651), Chilaquiles rojos ($73 MXN, picante=3, score=0.8651), Mole con pollo ($45 MXN, picante=3, score=0.8651)).
- **`requestId` y endpoint:** `audit-felix-c03` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 7: primaryFoodRelevance.js + Ranking (/rank)`
- **Evidencia que lo demuestra:** `Al no mencionarse una familia de alimento primario en 'Algo bien enchiloso' / 'Que pique machín', selectRelevantFood() no filtra por categoría y /rank mezcla platillos con nivel_picante=3 y nivel_picante=0 por similitud TF-IDF/tokens.` ([Registro JSON `caseId=3`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** Evitar rellenar con candidatos de nivel_picante=0 cuando el usuario exige explícitamente comida muy picante ('enchiloso'/'que pique machín').
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C06] FAIL-RELEVANCIA — Atributo Subjetivo / Porción
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Algo bien llenador`
- **Comportamiento esperado:** No inventar evidencia de saciedad; ordenar por similitud léxica sólo sobre elegibles
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Arroz a la mexicana ($87 MXN, picante=0, score=0.55), Arroz con camarones ($87 MXN, picante=0, score=0.55), Arroz con champiñones ($80 MXN, picante=0, score=0.55)).
- **`requestId` y endpoint:** `audit-felix-c06` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 3/7: /interpret + primaryFoodRelevance.js + /rank`
- **Evidencia que lo demuestra:** `'Algo bien llenador' extrae el concepto 'llenador' (preference), pero ningún platillo del catálogo declara porción/saciedad verificable y selectRelevantFood() no aplica restricción, por lo que /rank devuelve los primeros 5 platillos con score base 0.55.` ([Registro JSON `caseId=6`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** No rellenar hasta limit=5 con score base 0.55 cuando raw_score == 0 o cuando el calificador ('con verduras', 'dulce', 'llenador') no consta en los datos.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C09] FAIL-RELEVANCIA — Presupuesto Ambiguo / Económico
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Algo bara`
- **Comportamiento esperado:** Detectar mención económica sin monto numérico (budget.ambiguous=True) sin aplicar tope arbitrario
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Arroz a la mexicana ($87 MXN, picante=0, score=0.55), Arroz con camarones ($87 MXN, picante=0, score=0.55), Arroz con champiñones ($80 MXN, picante=0, score=0.55)).
- **`requestId` y endpoint:** `audit-felix-c09` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 3/4: _extract_budget_proposal + hasUnresolvedTextBudget`
- **Evidencia que lo demuestra:** `'Algo bara' activa mentions_money=True por 'bara'/'econ' con budget.ambiguous=True (amount_not_determinable), pero hasUnresolvedTextBudget() sólo bloquea si el texto coincide con el regex de unidades monetarias explícitas (pesos/varos/mxn), dejando pasar 120 candidatos sin filtro de precio.` ([Registro JSON `caseId=9`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** Actualizar hasUnresolvedTextBudget() (menuController.js:977) para bloquear cuando extraction.budget.notes incluya 'amount_not_determinable'.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C12] FAIL-SEGURIDAD — Exclusión Crítica de Alérgeno (Lácteos)
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `CRÍTICA`
- **Frase literal:** `No lleve leche`
- **Comportamiento esperado:** Extraer 'leche' en excludedIngredients y bloquear cualquier platillo sin ausencia certificada (Caso 20 histórico en BITACORA)
- **Comportamiento observado:** HTTP 200 (no_verified_results): candidateCount=120 -> eligibleAfterR3=0 -> afterSpice=0 -> eligibleForRank=0 -> returned=0 (0 recomendaciones).
- **`requestId` y endpoint:** `audit-felix-c12` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 3/4/8: Desfase de contenedor en ejecución (BITACORA Caso 20) vs Código actual (4f6df83)`
- **Evidencia que lo demuestra:** `HALLAZGO CRÍTICO DOCUMENTADO: En el código actual (4f6df83), parse_negations('No lleve leche') extrae ['leche'] y evaluateEligibility bloquea los 120 candidatos (statusCode='no_verified_results'). Sin embargo, en la corrida previa contra localhost:4000 con contenedor desactualizado (BITACORA 2026-11-15 Caso 20), /interpret devolvió excludedIngredients=[] y recomendó un licuado con leche declarada.` ([Registro JSON `caseId=12`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Riesgo crítico de seguridad alimentaria por alérgeno lácteo si el contenedor no está actualizado.
- **Acción recomendada (sin implementar):** Recargar contenedores principales con DISABLE_STARTUP_DDL=true para activar la guardia hasOmittedTextExclusion (4f6df83) sin correr migraciones implícitas.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C14] FAIL-RELEVANCIA — Categoría / Temperatura
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Un postrecito frío`
- **Comportamiento esperado:** Extraer concepto 'postre' + 'frio'; advertir que primaryFoodRelevance no restringe 'postre' como familia cerrada
- **Comportamiento observado:** HTTP 200 (no_verified_results): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=0 -> returned=0 (0 recomendaciones).
- **`requestId` y endpoint:** `audit-felix-c14` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 7: primaryFoodRelevance.js + /rank`
- **Evidencia que lo demuestra:** `En 'Un postrecito frío', primaryFoodRelevance filtra por la familia 'postre' si coincide en nombre/ingredientes principales, pero los platillos de la categoría 'Postres' ('Pastel de chocolate', 'Flan de vainilla', etc.) no contienen la palabra 'postre' en su nombre ni en ingredientes_principales, provocando 0 candidatos relevantes (no_relevant_candidates -> no_verified_results) porque dishMatchesFamily() no inspecciona categoria_nombre.` ([Registro JSON `caseId=14`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** Incluir dish.categoria_nombre en dishMatchesFamily() (primaryFoodRelevance.js:52) cuando el concepto tenga category === 'food_category'.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C15] FAIL-RELEVANCIA — Preferencia Sensorial con Negación No-Ingrediente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Quiero algo dulce, pero no empalagoso`
- **Comportamiento esperado:** Tratar 'empalagoso' como preferencia/textura pero observar que parse_negations no debe tratar adjetivos subjetivos como alérgenos
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Omelette de champiñón ($73 MXN, picante=0, score=0.8597), Arroz con champiñones ($80 MXN, picante=0, score=0.8228), Ensalada de nopales ($45 MXN, picante=0, score=0.8228)).
- **`requestId` y endpoint:** `audit-felix-c15` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 3/5: hasOmittedTextExclusion (menuController.js:918) + restrictionConsolidation.js`
- **Evidencia que lo demuestra:** `En 'Quiero algo dulce, pero no empalagoso', ni 'dulce' ni 'empalagoso' filtran por categoría 'Postres'/'Panadería' en primaryFoodRelevance.js, por lo que /rank devuelve platillos de panadería/postres o generales sin verificar dulzor.` ([Registro JSON `caseId=15`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** No rellenar hasta limit=5 con score base 0.55 cuando raw_score == 0 o cuando el calificador ('con verduras', 'dulce', 'llenador') no consta en los datos.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C21] FAIL-RELEVANCIA — Ambigüedad Léxica (Torta vs Tortita)
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Quiero una tortita`
- **Comportamiento esperado:** Clasificar 'tortita' como ambiguous_contextual sin asumir equivalencia automática con torta
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Sopa de tortilla ($66 MXN, picante=0, score=0.7077), Arroz a la mexicana ($87 MXN, picante=0, score=0.55), Arroz con camarones ($87 MXN, picante=0, score=0.55)).
- **`requestId` y endpoint:** `audit-felix-c21` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 2/7: shared/mexican-spanish-v1.json + primaryFoodRelevance.js`
- **Evidencia que lo demuestra:** `'Quiero una tortita' marca 'tortita' como ambiguous_contextual en linguistic.py (no se incluye en foodFamilies().request de primaryFoodRelevance.js), por lo que selectRelevantFood() no restringe candidatos (constrained=False) y /rank devuelve 5 platillos no relacionados con torta.` ([Registro JSON `caseId=21`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** Tratar menciones con role === 'ambiguous' ('tortita') como filtro estricto o abstención segura en vez de dejar constrained=false.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C26] BLOQUEADO — Bloqueo de Evidencia Fuente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `ALTA`
- **Frase literal:** `[BLOQUEADO: Frase #26 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83]`
- **Comportamiento esperado:** Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido
- **Comportamiento observado:** No ejecutado: el archivo fuente docs/evidencias/demo-local-30-consultas.json no fue incluido en el repositorio (commit 4f6df83).
- **`requestId` y endpoint:** `audit-felix-c26` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `EVIDENCIA-FUENTE-GIT`
- **Evidencia que lo demuestra:** `Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible.` ([Registro JSON `caseId=26`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Falta de trazabilidad sobre el caso original por archivo no versionado en Git.
- **Acción recomendada (sin implementar):** Incorporar al repositorio docs/evidencias/demo-local-30-consultas.json y backend/tests/integration/demo-local-30-requests.cjs para destrabar la frase literal original.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `BLOQUEADO`

---

### [ML-30-C27] BLOQUEADO — Bloqueo de Evidencia Fuente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `ALTA`
- **Frase literal:** `[BLOQUEADO: Frase #27 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83]`
- **Comportamiento esperado:** Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido
- **Comportamiento observado:** No ejecutado: el archivo fuente docs/evidencias/demo-local-30-consultas.json no fue incluido en el repositorio (commit 4f6df83).
- **`requestId` y endpoint:** `audit-felix-c27` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `EVIDENCIA-FUENTE-GIT`
- **Evidencia que lo demuestra:** `Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible.` ([Registro JSON `caseId=27`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Falta de trazabilidad sobre el caso original por archivo no versionado en Git.
- **Acción recomendada (sin implementar):** Incorporar al repositorio docs/evidencias/demo-local-30-consultas.json y backend/tests/integration/demo-local-30-requests.cjs para destrabar la frase literal original.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `BLOQUEADO`

---

### [ML-30-C28] BLOQUEADO — Bloqueo de Evidencia Fuente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `ALTA`
- **Frase literal:** `[BLOQUEADO: Frase #28 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83]`
- **Comportamiento esperado:** Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido
- **Comportamiento observado:** No ejecutado: el archivo fuente docs/evidencias/demo-local-30-consultas.json no fue incluido en el repositorio (commit 4f6df83).
- **`requestId` y endpoint:** `audit-felix-c28` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `EVIDENCIA-FUENTE-GIT`
- **Evidencia que lo demuestra:** `Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible.` ([Registro JSON `caseId=28`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Falta de trazabilidad sobre el caso original por archivo no versionado en Git.
- **Acción recomendada (sin implementar):** Incorporar al repositorio docs/evidencias/demo-local-30-consultas.json y backend/tests/integration/demo-local-30-requests.cjs para destrabar la frase literal original.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `BLOQUEADO`

---

### [ML-30-C29] BLOQUEADO — Bloqueo de Evidencia Fuente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `ALTA`
- **Frase literal:** `[BLOQUEADO: Frase #29 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83]`
- **Comportamiento esperado:** Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido
- **Comportamiento observado:** No ejecutado: el archivo fuente docs/evidencias/demo-local-30-consultas.json no fue incluido en el repositorio (commit 4f6df83).
- **`requestId` y endpoint:** `audit-felix-c29` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `EVIDENCIA-FUENTE-GIT`
- **Evidencia que lo demuestra:** `Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible.` ([Registro JSON `caseId=29`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Falta de trazabilidad sobre el caso original por archivo no versionado en Git.
- **Acción recomendada (sin implementar):** Incorporar al repositorio docs/evidencias/demo-local-30-consultas.json y backend/tests/integration/demo-local-30-requests.cjs para destrabar la frase literal original.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `BLOQUEADO`

---

### [ML-30-C30] BLOQUEADO — Bloqueo de Evidencia Fuente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `ALTA`
- **Frase literal:** `[BLOQUEADO: Frase #30 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83]`
- **Comportamiento esperado:** Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido
- **Comportamiento observado:** No ejecutado: el archivo fuente docs/evidencias/demo-local-30-consultas.json no fue incluido en el repositorio (commit 4f6df83).
- **`requestId` y endpoint:** `audit-felix-c30` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `EVIDENCIA-FUENTE-GIT`
- **Evidencia que lo demuestra:** `Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible.` ([Registro JSON `caseId=30`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Falta de trazabilidad sobre el caso original por archivo no versionado en Git.
- **Acción recomendada (sin implementar):** Incorporar al repositorio docs/evidencias/demo-local-30-consultas.json y backend/tests/integration/demo-local-30-requests.cjs para destrabar la frase literal original.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `BLOQUEADO`

