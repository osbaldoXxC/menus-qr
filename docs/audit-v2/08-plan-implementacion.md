# 08 — Plan de Implementación, Validación y Cierre de Diseño (V2)

**Estado:** plan documental (actualizado F1.7); **no ejecutar sin autorización explícita**. No incluye cambios de código/DB/config ni pruebas E2E.

## 1. Criterios de validación (diseño de pruebas unitarias e integración)

> Pruebas E2E: **excluidas**. Objetivo futuro: unitarias (BE/ML/FE lógica pura o mocks) e integración (BE↔ML mock/controlado, BE↔DB de prueba). **No ejecutadas en esta fase.**

| Caso | Tipo | Objetivo | Resultado esperado (según `06`,`07`,`09`,`10`) |
|---|---|---|---|
| Solicitud normal | Integración | Flujo feliz | 200, resultados reales, `safety` poblado, `limitApplied` correcto |
| Negación explícita ("sin cebolla") | Unit + integración | Exclusión correcta | `incompatible`/exclusión sin relajar |
| Restricción solo en texto ("sin cacahuate") | Integración | No omisión silenciosa | Fase I interpreta o, si falla/ambigua, BE fail-closed (`no_verified_results`) |
| Alergia declarada | Unit + integración | Seguridad obligatoria | Match → `incompatible`; datos insuficientes → `desconocido` y no verificado |
| Dieta solicitada | Unit + integración | Verificabilidad | Solo `compatible_segun_datos` con evidencia declarada; sin evidencia → `desconocido`/no verificado; `keto` no verificable |
| Presupuesto numérico estructurado | Unit + integración | Filtro duro | `precio > budgetMax` excluido |
| Presupuesto ambiguo/textual | Unit | No filtro inseguro | No duro si ambiguo/baja confianza; estructurado válido prevalece |
| Contradicción texto vs estructurado | Unit + integración | Prioridad segura | Prevalece restricción protectora/estructurada; sin relajar |
| ML omite restricción textual detectable | Unit + integración | Salvaguarda BE | BE marca `desconocido`/bloquea verificación |
| Ingrediente desconocido/no mapeado | Unit | Incertidumbre | `desconocido`, nunca `compatible` |
| Datos incompletos (ingredientes vacíos) | Unit + integración | Fail-closed | Dependiente → `desconocido`; no verificado si obligatorio |
| ML `/interpret` no disponible/timeout | Integración | Fallback seguro | Sin inferencia textual insegura; `fallback=true` o `no_verified_results` |
| ML `/rank` no disponible o inválido | Integración | Degradación segura | Ranking determinista sobre elegibles verificados o vacío verificado |
| Respuesta ML con ids inválidos/parciales | Integración | Saneo y revalidación | Descartar inválidos, no confiar datos ML, `partial_results_sanitized` o fallback |
| Restaurante incorrecto/inactivo/inexistente | Integración | Scope | 404/403 sin fuga cross-tenant |
| Sin resultados | Integración | Vacío correcto | 200 `no_verified_results` con meta/status coherentes |
| Límite/locale/requestId inválidos | Unit | Contrato | 400 `INVALID_REQUEST` |
| `socialContext` legacy | Unit | Migración | Ignorado/mapeado sin efecto en elegibilidad |
| Afirmaciones de seguridad | Unit | Lenguaje | Sin "100% libre"/garantías absolutas |

## 2. Orden de implementación recomendado (tras autorización)

| Fase impl. | Prioridad | Alcance | Dependencias | Riesgo | Validación |
|---|---|---|---|---|---|
| I-1 | Crítica | Fallback BE seguro + estados `safety` + lenguaje no absoluto | Ninguna | Menor recall | Unit reglas + integración degradación |
| I-2 | Crítica | Validación estricta (Zod), `limit/locale/requestId`, estructura uniforme errores, mapeo legacy | I-1 | Compatibilidad | Unit contrato + integración |
| I-3 | Alta | Consolidación de restricciones (estructurado+texto), salvaguardas no omisión, fail-closed | I-2 | Falsos negativos | Unit/integración NLP |
| I-4 | Alta | Contratos ML dos fases (`/interpret`, `/rank`) + refactor/scoring (Q6) + saneo respuestas | I-3 | Regresión/latencia | `pytest` unit/integración ML |
| I-5 | Alta | Revalidación BE e hidratación desde PostgreSQL (anti-invención, scope/activo/precio) | I-2,I-4 | Rechazo de respuestas previas | Integración con mocks |
| I-6 | Alta | Alineación FE (contrato, `safety`, disclaimers, `no_verified_results`, retiro `socialContext` efectivo) | I-2,I-5 | Cambio UX | Unit/component FE (sin E2E) |
| I-7 | Media | Pre-filtrado/top-K en DB y acotación candidatos | I-5 | Complejidad SQL | Integración + medición |
| I-8 | Media | Modelo de datos verificable aditivo (completitud, mapeos, procedencia) | Diseño estable | Migración/datos | Migraciones aditivas autorizadas |
| I-9 | Baja | Observabilidad (logs estructurados, métricas, trazas `requestId`) | I-1 | Bajo | Smoke |

## 3. Archivos que probablemente cambiarán (implementación futura)

| Capa | Archivos candidatos | Motivo |
|---|---|---|
| Backend | `backend/src/controllers/menuController.js`, `backend/src/routes/publicRoutes.js`, validadores/middleware, `backend/src/index.js` (errores/health si aplica), utilidades de consolidación/safety | Contrato, validación, dos fases, fallback, revalidación, hidratación DB |
| ML | `ml-service/main.py`, modelos/esquemas, `ml-service/tests/*` | `/interpret`, `/rank`, confianza/ambigüedad, scoring |
| Frontend comensales | `src/features/recommendations/recommendationService.ts`, `src/services/recommendation.ts`, `CuestionarioWizard.tsx`, `DescubrirResultados.tsx`, tipos | Contrato V2, seguridad/estados, disclaimers |
| Frontend restaurantes | `frontend-restaurantes/src/features/recommendations/*`, `services/recommendation.ts` (si aplica) | Alineación |
| DB (aditivo, autorizado) | migraciones en `backend/src/db/` o `db/` | Verificabilidad/completitud |
| Tests (no E2E) | `backend/tests/unit/*`, `ml-service/tests/*`, tests unit/component FE | Cobertura §1 |

**No cambiar sin necesidad:** `ai-engine/` (NO VERIFICADO), artefactos E2E, 9 archivos tracked preexistentes.

## 4. Riesgos residuales y decisiones

| ID | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | Datos incompletos/no verificables | Menor recall (fail-closed) | I-8, curación, UX clara |
| R2 | Ambigüedad NLP y omisiones | `desconocido` frecuente o riesgo si no se salvaguarda | Fase I + salvaguardas BE + tests lingüísticos |
| R3 | Latencia por dos fases ML | UX/rendimiento | Timeouts, acotación candidatos, fallback |
| R4 | Q6 scoring no reproducido | Ranking incorrecto | Reproducir con `pytest` autorizado y refactor |
| R5 | Endpoint global (scraping/costo) | Operación | Rate-limit específico, top-K, cache (propuesta) |
| R6 | Compatibilidad legacy | Regresión clientes | Mapeo determinista y ventana de transición |
| R7 | Despliegue/config real NO VERIFICADA | Seguridad/rendimiento | Auditoría de entorno previa a release |

**Decisiones cerradas en diseño (F1.7):** dos fases ML con autoridad BE, no omisión silenciosa, dietas iniciales verificables `vegetarian/vegan` (otras/keto no garantizadas), `confidence` informativo, umbral verificado 100% obligatorias en `compatible_segun_datos`, ambigüedad/falta de verificabilidad → `desconocido`, fallback fail-closed.  
**Pendientes (producto/operación/calibración):** copy UX final de `desconocido`, alcance/controles definitivos del endpoint global, moneda(s) soportada(s), versión de API y ventana legacy, umbrales numéricos de confianza/calibración ML, completitud real del catálogo, configuración efectiva de despliegue.

## 5. Cierre Fases 1.6–1.7 — Criterio de aceptación

| Criterio | Estado |
|---|---|
| Arquitectura coherente FE→BE→ML→DB con dos fases y autoridad BE | **CUMPLE** (`05`,`09`,`10`) |
| Contratos completos (tipos, errores, ejemplos, migración, presupuesto) | **CUMPLE** (`06`,`10`) |
| Incertidumbre/verificabilidad (`desconocido` nunca compatible, sin garantías absolutas) | **CUMPLE** (`07`,`09`) |
| Fallback seguro y no omisión silenciosa de restricciones textuales | **CUMPLE** (`07`,`09`,`10`) |
| Ranking sin recuperar descartados; ML no autoritativo | **CUMPLE** (`05`,`07`,`10`) |
| Plan y casos unit/integración (sin E2E) | **CUMPLE** (`08`) |

**Implementación:** no iniciada. Esperar autorización explícita del usuario.
