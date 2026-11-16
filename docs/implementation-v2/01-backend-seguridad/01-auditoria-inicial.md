# B1-T01 — Contraste y verificación de vigencia (backend)

## A. Identificación
| Campo | Valor |
|---|---|
| Número de fase/bloque | Bloque 1 — Backend y Seguridad |
| Número de tarea | 01 |
| Nombre | Contraste y verificación de vigencia (auditoría inicial del backend) |
| Dependencias | Ninguna de implementación; **reutiliza** `docs/audit-v2/` como línea base (no repetir auditoría) |
| Estado inicial | PENDIENTE |
| **Estado actual (2026-11-13, corrida de cierre)** | **PARCIAL** — delta documentado con evidencia disponible; aceptación formal depende de cierre de B1-T02..B1-T06 |

## B. Objetivo
Reutilizar los hallazgos de `docs/audit-v2/` como línea base y realizar únicamente un **contraste delta** del backend de recomendaciones: confirmar vigencia respecto al código actual, detectar cambios posteriores, contradicciones o información insuficiente, y precisar brechas/correcciones pendientes antes de cualquier cambio autorizado. **No repetir auditorías ya realizadas** salvo evidencia que lo justifique.

## C. Línea base reutilizada (sin repetir auditoría)
- **Fuente histórica/técnica:** `docs/audit-v2/00`–`10`, `09-decisiones-finales.md`, `audit-report.md`.
- Hallazgos vigentes como base: contratos/flujo actual, fallback inseguro histórico, ausencia de 2 fases `/interpret`+`/rank` en operación completa, validación/consolidación/elegibilidad/aislamiento y cobertura de pruebas insuficientes en estado previo, decisiones D-ARQ/DEC documentadas.

## D. Contraste delta (evidencia 2026-11-13, esta ejecución)

| Área (audit-v2) | Estado observado actual | Delta vs línea base | Evidencia | Impacto |
|---|---|---|---|---|
| Validación de borde recomendador (B1-T02) | Existen `backend/src/validators/recommendationRequest.js` (Zod, canónico+legacy, `limit` 1..10, `locale`, `requestId`, respuesta uniforme `INVALID_REQUEST/invalid_request`) y tests `tests/unit/recommendationValidation.test.js` (**10 PASS** en suite 77/77, 2026-11-13) | **Implementación y pruebas unitarias presentes** (no ausentes). Integración usada en handlers de recomendación según revisión de `menuController.js` (validación + 400 uniforme). | Código/tests en repo, ejecución `node --test` (6 suites, 77 PASS, 0 FAIL) en contenedor backend | Cierra brecha parcial de validación; persisten brechas de contrato V2 completo, DEC-002/003, cobertura integral endpoint/errores |
| Consolidación restricciones (B1-T03) | Existen `backend/src/services/restrictionConsolidation.js` (estados, orígenes, ambigüedad/ausencia/no verificable/contradicción/omisión, fail-closed `desconocido`, trazabilidad `requestId`, evidencia determinista) y tests `tests/unit/restrictionConsolidation.test.js` (**15 PASS**) | **Lógica de consolidación y pruebas presentes**. Integración en flujo de recomendación con `mlExtraction: null` (sin fase `/interpret` real). | Código/tests, 77/77 unitarios | Cobertura parcial; depende de B2 `/interpret`, DEC-007/008 y casos end-to-end con extracción ML |
| Elegibilidad/fallback/verificación catálogo (B1-T04) | Servicios `catalogVerification.js`, `eligibilityService.js`, integración en `menuController.js`, migración B1-T04, endpoint `POST /api/menu/platillos/:id/verify-approve`, invalidación conservadora en create/update; exports corregidos y normalización `contacto_cruzado` aplicada | **Avance significativo** respecto a fallback inseguro histórico para alcance B1-T04: evaluación conservadora, filtrado contra elegibles, persistencia/versionado/auditoría | HTTP E2E histórico **36 PASS, 0 FAIL** (usuario 2026-11-13); integración PG **4 PASS, 0 FAIL** (2026-11-13 esta corrida); unit foco **47 PASS, 0 FAIL**; DB PG 16.14, `vector` 0.8.6, tablas/índices/constraints presentes | Criterios críticos con evidencia fuerte; cierre formal PARCIAL (UI manual usuario, aceptación documental/C2 completa) |
| Aislamiento por restaurante (B1-T05) | Endpoint por restaurante resuelve UUID/slug y filtra por `restaurante_id`, `activo`, `suscripcion_activa` (404/403 observados históricamente); global filtra restaurantes/platos activos con suscripción; ownership/roles en rutas de menú/aprobación | **Mitigaciones presentes**, sin evidencia de suite de aislamiento V2 completa ni revalidación/caché/scope exhaustivos | Revisión de rutas/controlador; E2E histórico incluye 401/403/cross-restaurant en aprobación; sin tests dedicados aislamiento recomendador | Brecha parcial: requiere pruebas/casos B1-T05 y decisiones DEC-004/005/006/010 |
| Pruebas/aceptación (B1-T06) | Suites unitarias backend (6 archivos, **77 PASS**), integración PG B1-T04 (4 PASS), E2E HTTP B1-T04 histórico (36 PASS) | **Cobertura aumentada** pero no equivalente a matriz de aceptación completa del bloque | Ejecuciones 2026-11-13 (esta corrida + histórico válido) | B1-T06 NO CUMPLE hasta cubrir matriz crítica y evidencia integral |
| Infra/Docker | `compose.yml/prod.yml` ajustados (healthchecks, `ML_SERVICE_URL`, depends_on, backend/ml Dockerfiles/config según árbol); stack 8/8 operativo en dev | **Mejora operativa** (arranque/health/connectividad básica verificados) | `docker compose config` exit 0, `ps`, HTTP 200, conectividad intra-red, logs sin errores críticos recientes | ETAPA B disponibilidad OK; funcionalidad UI completa **NO VERIFICADA** (manual usuario) |
| ML 2 fases / contrato V2 completo | No evidenciado `/interpret`+`/rank` canónicos integrados end-to-end en esta corrida | **Brecha vigente** (dependencia B2) | Línea base audit-v2 + ausencia de evidencia de integración | Bloquea cierre total de consolidación/flujo V2 |

## E. Correcciones pendientes priorizadas (mapeo B1-T02..T06)

| Prioridad | Corrección pendiente | Tarea | Dependencias/DEC | Estado |
|---|---|---|---|---|
| Alta | Completar criterios formales de validación V2 (contrato uniforme completo, legacy/versionado definido, casos endpoint/integración) | B1-T02 | DEC-002, DEC-003, B1-T01/T06 | PARCIAL |
| Alta | Completar consolidación con extracción ML real/contrato `/interpret`, casos textuales/umbrales y trazabilidad operativa | B1-T03 | B2, DEC-007/008 | PARCIAL (BLOQUEADA parcialmente por B2/DEC) |
| Alta | Cierre formal B1-T04 (aceptación documental/C2 alcance, evidencia manual UI usuario) sin repetir pruebas válidas | B1-T04 | Usuario (UI), criterios tarea | PARCIAL (avanzado) |
| Alta | Casos y pruebas de aislamiento multi-tenant/revalidación ML/caché por scope/global | B1-T05 | DEC-004/005/006/010, B3 parcial | PARCIAL/NO VERIFICADO |
| Crítica | Matriz de aceptación del bloque (unit/integración/seguridad/contratos) y clasificación final con evidencia | B1-T06 | B1-T01..T05 | NO CUMPLE |

## F. Dependencias reales con B2/B3
- **B2 (ML):** `/interpret` y contrato de extracción/confianza/ambigüedad necesarios para consolidación completa B1-T03 y flujo V2; `/rank`/contrato para revalidación/ranking objetivo completo. Sin B2, consolidación opera conservadora con extracción ausente.
- **B3 (DB):** consultas acotadas, verificabilidad/completitud de datos y top-K/scope para elegibilidad/aislamiento/rendimiento; algunas capacidades B1-T04 ya usan esquema/migración local, pero criterios completos dependen de B3 y DEC-008.

## G. Elementos NO VERIFICADOS
- Comportamiento funcional completo de UI en navegador (3 frontends) — **PENDIENTE DE EJECUCIÓN POR EL USUARIO**.
- Efectividad runtime de CORS/rate-limit específico/configuración despliegue real, calibración ML, completitud real de catálogo (DEC-004/007/008/009).
- Cobertura exhaustiva de todos los caminos de error/contrato uniforme en endpoints de recomendación.

## H. Confirmaciones
- No se repitió auditoría `audit-v2`; se documentó delta con evidencia.
- No se modificó código, DB, configuración ni archivos protegidos deliberadamente en esta tarea documental; no se ejecutaron operaciones Git destructivas/commits/push.

## I. Condición de cierre
- **No cerrado (CUMPLE)**: faltan evidencias/implementaciones/pruebas para criterios completos de B1-T02..B1-T06 y aceptación formal.
- **Siguiente:** B1-T02 (validación) y B1-T03 (consolidación) sobre base existente, respetando dependencias/DEC.
