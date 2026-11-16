# B1-T06 — Pruebas unitarias, de seguridad y aceptación (Backend)

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 1 — Backend y Seguridad |
| Tarea | 06 |
| Nombre | Pruebas unitarias y de seguridad, criterios de aceptación del bloque |
| Dependencias | B1-T01–T05 |
| Estado inicial | PENDIENTE |

## B. Objetivo
Definir y ejecutar (cuando se autorice) la suite de verificación del Bloque 1 para demostrar cumplimiento de validación, consolidación, elegibilidad, fallback seguro y aislamiento, sin introducir recomendaciones inseguras.

## C. Estado actual
- **Comprobado:** `backend/tests/unit/slugService.test.js` y script `node --test` existen; no hay cobertura específica de recomendación V2 (validación, consolidación, estados, fallback, aislamiento) verificada.

## D. Alcance permitido (sujeto a autorización)
- Tests unitarios e integración backend (mocks ML/DB según diseño), fixtures de datos declarados, helpers de aserción de `safety/status/meta`, documentación de resultados.

## E. Fuera de alcance
- Pruebas E2E, pruebas de carga en producción, modificación de ML/FE/DB productiva.

## F. Procedimiento (autorizado)
1. Definir matriz de casos mínimos (I) y datos de prueba.
2. Implementar/ejecutar unit tests: validación, consolidación, evaluación de estados, fallback, revalidación/saneo, scope.
3. Implementar/ejecutar integración: endpoint con mock `/interpret` y `/rank`, timeout/error/ids inválidos, DB de prueba o mock controlado.
4. Registrar resultados, fallos y evidencias en bitácora; clasificar estado del bloque.

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-01 a 09; contratos `06/10`; reglas `07/09`.  
**Pendientes:** DEC-007 (umbrales) puede limitar casos numéricos de confianza (marcar NO VERIFICADO si aplica).

## H. Criterios de aceptación
- [ ] Casos críticos de seguridad pasan: alergia, exclusión, negación/texto, dieta no verificable, datos incompletos, presupuesto, ML caído, respuesta ML inválida, sin resultados, aislamiento.
- [ ] Ningún caso produce recomendación con obligatoria `desconocido`/`incompatible` como verificada.
- [ ] Errores y respuestas cumplen estructura uniforme.
- [ ] Evidencia de ejecución (comando, salida, fecha/entorno) registrada.
- [ ] Bloque 1 marcado `CUMPLE` solo si todos los criterios obligatorios tienen evidencia.

## I. Pruebas (escenarios mínimos)
- Validación: payload válido, inválido, límites, legacy, `requestId`.
- Consolidación: restricción solo en texto, ambigüedad, omisión, contradicción, ML interpret caído.
- Elegibilidad: `compatible_segun_datos`, `incompatible`, `desconocido`, completitud insuficiente, presupuesto.
- Fallback: `/interpret` o `/rank` timeout/error/shape inválido, ids ajenos, parcial inválido → saneo o `no_verified_results`.
- Aislamiento: scope restaurante, inexistente, inactivo, cross-tenant en respuesta ML, global acotado.
- Seguridad: sin lenguaje absoluto, sin datos autoritativos desde ML.

## J. Evidencias
- Reporte de tests, logs de `node --test`/runner usado, ejemplos JSON request/response anonimizados.

## K. Riesgos y rollback
- **Riesgo:** falsos positivos por mocks no representativos. **Mitigación:** alinear fixtures con contrato DB/ML. **Rollback:** no aplica a código si solo pruebas; revertir cambios de tarea.

## L. Condición de cierre
- H satisfecho, bitácora actualizada, estado de bloque definido con base en evidencia.

## M. Próxima tarea
- B2-T01 Endpoint `/interpret` (solo tras autorización de Bloque 2 y dependencias de contrato).
## Actualización 2026-11-13 (cierre técnico/documental, esta ejecución)

### Evidencia ejecutada/reutilizada

| Tipo | Comando / fuente | Resultado | Clasificación |
|---|---|---|---|
| Unitarias (todas conocidas, backend) | `docker compose exec -T backend sh -lc 'node --test tests/unit/b1t04IntegrationFlow.test.js tests/unit/catalogVerification.test.js tests/unit/eligibilityEvaluation.test.js tests/unit/recommendationValidation.test.js tests/unit/restrictionConsolidation.test.js tests/unit/slugService.test.js'` | **77 PASS, 0 FAIL** (6 suites) | Automatizada, esta ejecución |
| Unitarias B1-T04 foco | `node --test tests/unit/catalogVerification.test.js tests/unit/eligibilityEvaluation.test.js tests/unit/b1t04IntegrationFlow.test.js` | **47 PASS, 0 FAIL** | Automatizada, esta ejecución |
| Integración PostgreSQL real | `docker compose exec -T backend node --test tests/integration/b1t04Postgres.integration.test.js` | **4 PASS, 0 FAIL** | Automatizada, esta ejecución (Docker, `b1t04_test`) |
| HTTP E2E B1-T04 (flujo real) | `node backend/test_e2e_b1t04.js` (usuario, 2026-11-13) | **36 PASS, 0 FAIL** | Automatizada histórica válida, no re-ejecutada |
| Docker/operatividad | `docker compose config/ps`, health HTTP, conectividad intra-red, logs | Servicios operativos, health 200, sin errores críticos recientes observados | Técnica, esta ejecución |
| E2E manual UI (3 frontends) | Navegador/usuario | — | **PENDIENTE DE EJECUCIÓN POR EL USUARIO** |

### Matriz de aceptación (estado)

| Criterio B1-T06 | Estado | Evidencia / brecha |
|---|---|---|
| Validación: payload válido/inválido, límites, legacy, `requestId` | **PARCIAL** | Unit `recommendationValidation` 10/10 PASS; integración endpoint/contrato uniforme completo NO VERIFICADO |
| Consolidación: texto/ambigüedad/omisión/contradicción/ausencia | **PARCIAL** | Unit `restrictionConsolidation` 15/15 PASS; casos con `/interpret` real/mock y texto-only end-to-end PENDIENTES (dep. B2/B5) |
| Elegibilidad: estados, completitud, dieta/presupuesto, alérgenos/exclusiones | **PARCIAL (avanzado)** | Unit foco 47/47 + PG integración 4/4 + E2E histórico 36/36; cobertura V2 completa NO VERIFICADA |
| Fallback: ML timeout/error/shape/ids inválidos, saneo, `no_verified_results` | **PARCIAL** | Evidencia parcial en unit/integración B1-T04 e histórico; matriz completa de respuestas ML inválidas/parciales NO VERIFICADA |
| Aislamiento: scope restaurante, inexistente/inactivo, cross-tenant ML, global acotado | **NO CUMPLE** | Evidencia puntual 401/403/ownership; suite dedicada recomendador ausente |
| Seguridad: sin lenguaje absoluto, sin datos autoritativos ML, no recomendar desconocido/incompatible como verificado | **PARCIAL** | Cubierto en pruebas B1-T04; no demostrado para todo el bloque/contrato |

### Pruebas manuales UI (PENDIENTE DE EJECUCIÓN POR EL USUARIO)
1. **Comensales** `http://localhost:3000`: abrir app, consultar menús, solicitar recomendaciones desde interfaz, verificar estados/mensajes visibles.
2. **Restaurantes** `http://localhost:3002`: iniciar sesión, administrar platillos, modificar receta y observar comportamiento de verificación/invalidación en UI.
3. **Admin** `http://localhost:3001`: iniciar sesión como Super Admin, consultar/aprobar restaurantes, comprobar aprobación/rechazo de recetas incompletas e invalidación tras modificación.
4. **Precondiciones:** `cd C:\Users\Baldo\OneDrive\Escritorio\git\menus-qr; docker compose ps` (8 servicios Up/healthy según aplique). Cuentas locales existentes requeridas; **no compartir ni registrar contraseñas/OTP/JWT**.

### Pendientes técnicos reales
- Suite/casos dedicados de aislamiento y contrato recomendador (B1-T05/B1-T06).
- Integración de consolidación/validación con escenarios `/interpret`/`/rank` y decisiones DEC-002/003/007/008 (parcialmente fuera de alcance sin B2).
- Evidencia de respuestas uniformes V2 completas y revalidación/saneo ML exhaustivo.

### Estado final
**NO CUMPLE** — no se puede declarar aceptación del Bloque 1: faltan criterios/casos obligatorios con evidencia integral y pruebas manuales UI del usuario. Resultados técnicos automatizados disponibles son mayormente favorables en alcance B1-T04/B1-T02/B1-T03 (unitario) y deben conservarse.

## Actualización 2026-11-13 (continuación técnica, esta ejecución - evidencia nueva ejecutada)

| Tipo | Comando / fuente | Resultado | Clasificación |
|---|---|---|---|
| Integración validación B1-T02 (endpoints recomendación, DB/Redis reales, ML mock fallo) | `docker compose exec -T backend node --test tests/integration/b1t02Validation.integration.test.js` | **3 PASS, 0 FAIL** | Automatizada, esta ejecución |
| Integración aislamiento B1-T05 (scope restaurante, 404/403, ids ML ajenos/desconocidos filtrados) | `docker compose exec -T backend node --test tests/integration/b1t05Isolation.integration.test.js` | **4 PASS, 0 FAIL** | Automatizada, esta ejecución |
| Unitarias B1-T03 con extracción ML simulada (mock contrato, **no integración ML real**) | `docker compose exec -T backend node --test tests/unit/restrictionConsolidation.mockExtraction.test.js` | **8 PASS, 0 FAIL** | Automatizada (simulada), esta ejecución |
| Regresión B1-T04 integración PG (sanidad) | `docker compose exec -T backend node --test tests/integration/b1t04Postgres.integration.test.js` | **4 PASS, 0 FAIL** | Automatizada, esta ejecución |

**Matriz (actualización):**
- **Validación (B1-T02):** **PARCIAL (mejorado)** — unit 10/10 + integración endpoints 3/3 (400 uniforme `INVALID_REQUEST/invalid_request`, legacy aceptado, global inválido). Pendiente: contrato V2 completo en todos los casos/códigos, `meta.limitApplied/requestId` en respuestas exitosas uniformes V2, DEC-002/003.
- **Consolidación (B1-T03):** **PARCIAL** — unit 15/15 + 8/8 mocks de extracción (**simulados, no ML real**) cubren ausencia/ambigüedad/contradicción/explícitas/omisión/no verificable/fallos/fail-closed. Pendiente: integración real `/interpret` (B2), DEC-007/008.
- **Elegibilidad/fallback (B1-T04):** **PARCIAL (avanzado)** — evidencia previa válida + PG 4/4 revalidado esta sesión.
- **Aislamiento (B1-T05):** **PARCIAL (mejorado)** — integración 4/4 (cross-tenant fallback, 404/403, ids ML ajenos/desconocidos descartados por conjunto elegible). Pendiente: suite global/abuso/top-K/caché scope, rehidratación DB completa, DEC-004/005/006/010.
- **Seguridad/contratos:** **PARCIAL** — filtrado de no elegibles/cross-tenant demostrado en alcance probado; revalidación/saneo exhaustivo y contrato uniforme V2 completo NO VERIFICADO.
- **Aceptación Bloque 1:** **NO CUMPLE** (criterios integrales y dependencias DEC/B2/decisiones pendientes; UI manual usuario pendiente). Manual UI 3 frontends: **PENDIENTE DE EJECUCIÓN POR EL USUARIO**.

## Actualización 2026-11-13 (aplazamiento frontend R4/R5, decisión usuario)
- **Estado pruebas funcionales frontend (3 interfaces, revisión manual usuario):** APLAZADA HASTA R4/R5 — PENDIENTE DE VALIDACIÓN INTEGRAL (fallos observados por adaptación pendiente a cambios backend/contrato).
- **Tratamiento en aceptación R1/B1-T06:** no contabilizar como fallidas de R1; no repetir pruebas visuales en esta fase; no bloquear trabajo técnico automatizable. **No declarar R1 aceptado** si faltan criterios técnicos R1. Si existe requisito de interfaz obligatorio para aceptación R1 en criterios oficiales, se conserva y su ejecución se registra como diferida (R4 adaptación, R5 validación integral), sin modificación unilateral de criterios.
- **Matriz:** filas "E2E manual UI (3 frontends)" y validación UI multi-tenant permanecen pendientes de ejecución integral en R5 (R4 adapta contratos/UI); no constituyen evidencia de fallo técnico backend en esta fase.
