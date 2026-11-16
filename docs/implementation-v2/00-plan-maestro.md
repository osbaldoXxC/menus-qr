# 00 â€” Plan Maestro de ImplementaciÃ³n V2

**Documento:** fuente de verdad del roadmap V2. **Estado:** documental, sin autorizaciÃ³n de implementaciÃ³n.  
**Base:** `docs/audit-v2/00`â€“`10`, `audit-report.md`, contraste con cÃ³digo real (ver secciÃ³n Estado actual).

## 1. Objetivo general de V2
Entregar un recomendador de platillos seguro, coherente y verificable extremo a extremo (React â†’ Node â†’ ML â†’ PostgreSQL â†’ Node â†’ React) donde:
- Las restricciones obligatorias (alergias, exclusiones, dieta verificable, presupuesto verificable, scope/activo) se aplican con autoridad en Node y **nunca** se relajan por fallo de ML o por fallback.
- La incertidumbre se representa explÃ­citamente (`compatible_segun_datos` | `incompatible` | `desconocido`) y `desconocido` nunca se trata como compatible.
- ML interpreta intenciÃ³n y rankea candidatos elegibles; no decide seguridad ni es fuente autoritativa de datos de catÃ¡logo.
- No se inventan resultados, datos ni garantÃ­as alimentarias ("100% libre" prohibido).

## 1.1 LÃ­nea base y reutilizaciÃ³n de auditorÃ­as
- Las auditorÃ­as de `docs/audit-v2/` son la **lÃ­nea base histÃ³rica y tÃ©cnica** del proyecto.
- **Ninguna tarea debe repetir una auditorÃ­a ya realizada** salvo que exista evidencia de cambios posteriores, contradicciones o informaciÃ³n insuficiente.
- Las tareas deben **reutilizar sus hallazgos** y concentrarse en implementar y verificar las correcciones pendientes.
- Cualquier verificaciÃ³n adicional debe ser **delta** (cambios/contradicciones/gaps) y registrarse con evidencia en `BITACORA.md`.

## 2. Arquitectura objetivo
- **Frontend (comensales):** captura intenciÃ³n (`craving.text/tags`) y restricciones estructuradas; presenta `safety`, disclaimers y estados vacÃ­o/error/no verificable; sin lÃ³gica autoritativa de seguridad.
- **Backend Node.js (orquestador/autoridad):** valida request (borde), resuelve scope, consolida restricciones (estructuradas + extracciÃ³n ML), consulta PostgreSQL, determina elegibilidad, llama ML en dos fases, revalida/sanea respuestas, hidrata datos reales desde DB, responde contrato uniforme y aplica fallback fail-closed.
- **ML Service (FastAPI):** Fase I `/interpret` (entidades, negaciones, alergias/dietas/presupuesto, confianza/ambigÃ¼edad, propone) y Fase II `/rank` (ordena candidatos elegibles acotados, propone); sin acceso a DB como verdad ni decisiÃ³n final de elegibilidad.
- **PostgreSQL:** fuente de verdad de restaurantes/platillos/precios/activo y atributos declarados; soporte a consultas acotadas y, a futuro autorizado, mejoras aditivas de verificabilidad.

> Detalle normativo: `docs/audit-v2/05-arquitectura-definitiva.md`, `09`, `10`.

## 3. Flujo completo de recomendaciones
1. FE â†’ BE: request canÃ³nico (`craving`, `restrictions`, `options` con `limit/locale/requestId`).
2. BE: validaciÃ³n, normalizaciÃ³n, scope, `requestId`, rate-limit.
3. BE â†’ ML `/interpret`: extracciÃ³n de texto (propuesta).
4. BE: consolida restricciones (sin omisiÃ³n silenciosa), resuelve contradicciones sin relajar, marca ambigÃ¼edad como `desconocido`.
5. BE â†” PostgreSQL: candidatos reales (activos, scope) y evaluaciÃ³n de elegibilidad/verificabilidad.
6. BE â†’ ML `/rank`: solo candidatos elegibles/evaluables acotados.
7. BE: revalida ids/scope/activo/precio/restricciones, descarta invÃ¡lidos, hidrata desde DB, aplica ranking/reglas finales.
8. BE â†’ FE: respuesta uniforme (`recommendations`, `meta`, `status`, `error`, `safety`).
- **Degradado:** ML caÃ­do/invÃ¡lido o restricciÃ³n textual no verificable â‡’ fallback determinista seguro o `no_verified_results` (fail-closed). Ver `docs/audit-v2/07`, `10`.

## 4. Responsabilidades por componente
| Componente | Responsabilidades | Prohibiciones |
|---|---|---|
| React | Captura, presentaciÃ³n de estados/safety/disclaimers, respeto de `limitApplied` | Decidir seguridad/elegibilidad, inventar datos, afirmar garantÃ­as |
| Node.js | ValidaciÃ³n, consolidaciÃ³n, elegibilidad, fallback, revalidaciÃ³n, hidrataciÃ³n DB, contrato, trazabilidad | Confiar ciegamente en ML, relajar restricciones, omitir restricciones textuales, exponer internos |
| ML | `/interpret` y `/rank` (propuestas con evidencia/confianza) | Filtrado final obligatorio, DB como verdad, inventar candidatos/campos/precios, garantizar seguridad |
| PostgreSQL | CatÃ¡logo y atributos declarados, integridad, consultas acotadas | Inferir compatibilidad no registrada, NLP |

## 5. Dependencias entre los cinco bloques
| Bloque | Depende de | Habilita |
|---|---|---|
| 1. Backend y seguridad | LÃ­nea base `audit-v2` (reutilizada), contraste delta y contratos/decisiones | Base segura para ML, DB, FE e integraciÃ³n |
| 2. Machine Learning | Contratos BEâ†”ML, consolidaciÃ³n/elegibilidad en BE (B1), candidatos definidos (B3) | InterpretaciÃ³n/ranking coherente con autoridad BE |
| 3. Base de datos | Modelo actual, reglas de verificabilidad (B1/B2) | Consultas acotadas y datos verificables para elegibilidad/ranking |
| 4. Frontend | Contrato BEâ†’FE estable, estados de safety/errores (B1/B2) | UX coherente y no engaÃ±osa |
| 5. IntegraciÃ³n y validaciÃ³n | B1â€“B4 implementados y autorizados por tarea | AceptaciÃ³n end-to-end (sin E2E en alcance inicial) |

> Ajustes de orden entre **tareas** se documentan en cada bloque; el orden de **bloques** no cambia sin autorizaciÃ³n.

## 6. Roadmap (documental, sujeto a autorizaciÃ³n por tarea)
| Fase | Bloque | Objetivo | PrecondiciÃ³n | Estado |
|---|---|---|---|---|
| R1 | 01-backend-seguridad | ValidaciÃ³n, consolidaciÃ³n, elegibilidad, fallback seguro, aislamiento, revalidaciÃ³n | ReutilizaciÃ³n de `audit-v2` + contraste delta, decisiones de diseÃ±o | PENDIENTE (autorizaciÃ³n futura) |
| R2 | 02-machine-learning | `/interpret`, `/rank`, contratos, scoring, manejo de errores/ambigÃ¼edad | R1 contractual mÃ­nimo definido | PENDIENTE |
| R3 | 03-base-datos | Consultas acotadas, verificabilidad, integridad; definir necesidades de migraciÃ³n (no ejecutar) | R1/R2 criterios de datos | PENDIENTE |
| R4 | 04-frontend | Cuestionario, contrato FE, estados conocidos/desconocidos/no verificables, seguridad; adaptacion de las 3 interfaces a contratos definitivos | R1 contrato BE->FE estable | PENDIENTE - pruebas funcionales frontend **APLAZADA HASTA R4/R5 - PENDIENTE DE VALIDACION INTEGRAL** |
| R5 | 05-integracion | Unit/integracion/contratos, casos criticos, regresiones, aceptacion; validacion integral de las 3 interfaces con backend+ML | R1-R4 autorizados y completados | PENDIENTE - pruebas funcionales frontend **APLAZADA HASTA R4/R5 - PENDIENTE DE VALIDACION INTEGRAL** |

## 7. Decisiones arquitectÃ³nicas confirmadas (diseÃ±o, F1.6â€“F1.7)
| ID | DecisiÃ³n | Estado | Evidencia |
|---|---|---|---|
| D-ARQ-01 | Node es autoridad Ãºnica de elegibilidad y restricciones obligatorias | Confirmada (diseÃ±o) | `audit-v2/05,07,09,10` |
| D-ARQ-02 | Flujo dos fases ML `/interpret` â†’ consolidaciÃ³n BE â†’ DB/elegibilidad â†’ `/rank` | Confirmada (diseÃ±o) | `audit-v2/09,10` |
| D-ARQ-03 | Estados `compatible_segun_datos`/`incompatible`/`desconocido`; `desconocido` â‰  compatible | Confirmada (diseÃ±o) | `audit-v2/07,09` |
| D-ARQ-04 | Fallback fail-closed: sin NLP inseguro, sin relajar, sin inventar, sin garantÃ­as | Confirmada (diseÃ±o) | `audit-v2/07,09,10` |
| D-ARQ-05 | ML propone, BE valida; datos finales hidratados desde PostgreSQL | Confirmada (diseÃ±o) | `audit-v2/05,06,10` |
| D-ARQ-06 | Dietas verificables iniciales: `vegetarian`/`vegan` con evidencia; `keto` no verificable | Confirmada (diseÃ±o) | `audit-v2/09` |
| D-ARQ-07 | `confidence` informativa, no criterio de seguridad/elegibilidad | Confirmada (diseÃ±o) | `audit-v2/06,09` |
| D-ARQ-08 | Candidato descartado por restricciÃ³n obligatoria no reaparece por ranking/fallback | Confirmada (diseÃ±o) | `audit-v2/07,10` |
| D-ARQ-09 | RestricciÃ³n expresada por usuario no puede desaparecer silenciosamente | Confirmada (diseÃ±o) | `audit-v2/09,10` |

## 8. Matriz de decisiones (aprobadas y pendientes)
| ID | DecisiÃ³n | Estado | Responsable | Fase/bloque para resolver | Impacto / Tareas afectadas |
|---|---|---|---|---|---|
| DEC-001 | Copy/UX de estado `desconocido` y vista no verificada | Pendiente | Frontend/Producto | Bloque 4 | `04-frontend/*`, mensajes BEâ†’FE |
| DEC-002 | Moneda/presupuesto (reglas canónicas): moneda fija `MXN` (ISO 4217), sin conversiones automáticas ni servicios/tasas/dependencias externas; `budgetMax` = presupuesto máximo por platillo; `budgetCurrency` omitido → `MXN`; moneda distinta de `MXN` → 400 `INVALID_REQUEST`; `budgetPerPerson=true` → 400 temporal; límite máximo `100000` MXN; `budgetMax` numérico, finito, >0, <=100000, máx. 2 decimales; backend autoridad compara contra `platillos.precio` solo si ambos verificables bajo convención `MXN`; precio inválido/ausente/no verificable no compatible; presupuestos ambiguos/contradictorios en texto no filtros duros; legacy sin presupuesto válido sin restricción presupuestaria implícita. | **APROBADA (usuario, 2026-11-13). Implementación pendiente.** Evidencia de datos: `platillos.precio/precio_original` sin columna de moneda en `backend/src/db/init.sql` y `db/contract/schema.json`; convención MXN **NO VERIFICADA** en datos existentes/producción. | Backend/Producto | Antes de implementar contrato/validación/filtro presupuesto (B1/B2) | `01-backend-seguridad/02,03`, `02-machine-learning/01`, `docs/audit-v2/06,09`, B1-T02/B1-T03/B2-T01 (no completadas) |
| DEC-003 | Arquitectura V2 y retirada de compatibilidad legacy (ML v1 `/recommendations` y rutas/API legacy no forman parte del objetivo; `/interpret`+`/rank`; BE autoridad; sin fallback silencioso ML v1; FE se adapta en R4; retirada efectiva al módulo/etapa autorizada con verificación de dependencias) | **APROBADA (usuario, 2026-11-13).** Reglas: contratos V2 canónicos, sin compatibilidad funcional obligatoria con ML v1/rutas legacy (entorno pruebas), R1–R5 por etapas, ML no declara elegibilidad/BE valida/timeouts/fallback determinista seguro o estado controlado, no inventar recomendaciones. Implementación/retirada pendiente de autorización por etapa. | Backend/ML/Producto | R1 contratos; R2 `/interpret`+`/rank`; R4 FE; R5 integración | R1–R5, `docs/audit-v2/06,09`, B2, frontends (solo R4) |
| DEC-004 | Rate-limit especÃ­fico recomendador/global | Pendiente | Backend/Infra | OptimizaciÃ³n (B1/B5) | `publicRoutes`, `index.js`, despliegue |
| DEC-005 | Top-K y acotaciÃ³n de candidatos a ML | Pendiente | Backend/ML | OptimizaciÃ³n (B1/B2/B3) | consultas, payload ML, latencia |
| DEC-006 | CachÃ© de resultados/candidatos | Pendiente | Backend | OptimizaciÃ³n (B1/B3) | consistencia y seguridad (no filtrar cross-tenant) |
| DEC-007 | Umbrales numÃ©ricos de confianza/ambigÃ¼edad ML | Pendiente | ML | ValidaciÃ³n (B2/B5) | consolidaciÃ³n BE, fail-closed |
| DEC-008 | Completitud real del catÃ¡logo y criterio operativo de datos | Pendiente | Datos/Producto | Compatibilidad alimentaria (B3/B5) | verificabilidad, recall |
| DEC-009 | ConfiguraciÃ³n/despliegue real (CORS, Redis, Ã­ndices, entorno) | Pendiente | Infraestructura | Despliegue | rendimiento/seguridad operativa (NO VERIFICADO) |
| DEC-010 | Alcance definitivo endpoint global y controles anti-abuso | Pendiente | Backend/Producto/Infra | B1/B5 | seguridad, costo, UX |
| DEC-011 | Uso de endpoint legado único vs `/interpret`+`/rank` en transición | Propuesta (no aprobada; estado sin cambio). **Nota DEC-003:** arquitectura objetivo sin compatibilidad funcional obligatoria con ML v1/rutas legacy; cualquier transición operativa concreta requiere autorización por etapa y no contradice DEC-003. | Backend/ML | B2 | Integración BE↔ML, fallback, pruebas |
| DEC-012 | Contrato externo canónico del recomendador V2 (DEC-012.1–12.10: rutas canónicas objetivo, request/normalización/campos desconocidos, envelope éxito/error, no resultados verificables 200, seguridad/meta, degradación segura ML). Ref: docs/audit-v2/06,  9. | **APROBADA (usuario, 2026-11-13). Implementación PENDIENTE.** No autoriza cambios de código/consumidores/frontends ni declara implementación. DEC-001,004–011 sin cambio. DEC-002: validación entrada posible después; no activar filtro precio en producción sin verificar MXN en datos. | Backend/Producto | R1 contrato/validación/respuestas (implementación autorizada); R2 ML V2; R4 FE; R5 integración |  1-backend-seguridad/02,06, docs/audit-v2/06,09, B1-T02/B1-T06 (no cerradas) |

> Si se identifican decisiones adicionales durante implementaciÃ³n, agregar con mismo formato. **Propuesta â‰  decisiÃ³n aprobada.**

## 9. Riesgos
| ID | Riesgo | Impacto | MitigaciÃ³n documental |
|---|---|---|---|
| R1 | Datos incompletos/no verificables (JSONB, sin completitud/contaminaciÃ³n cruzada) | Menor recall por fail-closed | B3 verificabilidad; disclaimers; no relajar reglas |
| R2 | AmbigÃ¼edad/omisiÃ³n NLP en texto libre | Restricciones no verificables o riesgo si se infiere mal | B1 consolidaciÃ³n+salvaguardas, B2 confianza/ambigÃ¼edad, B5 casos |
| R3 | Latencia/costo por dos fases ML y payload de candidatos | UX/rendimiento | Top-K, timeouts, fallback (DEC-005) |
| R4 | Fallback actual inseguro y lÃ³gica duplicada (S5,Q1) | Recomendaciones incompatibles en degradaciÃ³n | B1 prioridad crÃ­tica, revalidaciÃ³n |
| R5 | Divergencia contrato/shape y bug scoring (Q3,Q6) | Regresiones y ranking incorrecto | B1/B2 contratos+tests, saneo BE |
| R6 | Aislamiento/rate-limit/validaciÃ³n insuficiente (S1,S3,S4) | Abuso, fuga cross-tenant, errores | B1/B3/B5 validaciÃ³n y casos de aislamiento |
| R7 | 9 archivos tracked modificados y untracked preexistentes | Sobrescritura/pÃ©rdida de trabajo ajeno | Reglas de protecciÃ³n, no tocar, auditar Git antes/despuÃ©s |
| R8 | Entorno/despliegue real NO VERIFICADO | Diferencias operativas | DEC-009, verificaciÃ³n en despliegue |

## 10. Estado actual comprobado vs diseÃ±o (contraste)
| Ãrea | Estado real comprobado (cÃ³digo) | Brecha vs V2 |
|---|---|---|
| Backend recomendador | `POST /api/public/menu/recommendations` y `/:restaurant_id/recommendations` en `backend/src/routes/publicRoutes.js` â†’ `menuController.getGlobalRecommendations/getPublicRecommendations`; 1 llamada directa a `${ML_SERVICE_URL}/recommendations`; fallback JS filtra alergias por substring y **omite dieta/negaciones**; razones absolutas; `limit` inconsistente (FE 8, BE 5/6, ML 5); sin validaciÃ³n Zod en request | Requiere 2 fases, consolidaciÃ³n, validaciÃ³n estricta, fallback seguro, contrato uniforme, lÃ­mite Ãºnico, revalidaciÃ³n/hidrataciÃ³n DB |
| ML | `ml-service/main.py` expone `/health` y `/recommendations` (request con `craving,diet,allergies,socialContext,limit,dishes,restaurant_id`); filtra/alergias/dieta/negaciones y rankea; `socialContext` no usado en lÃ³gica; `confidence/score` no calibrados (NO VERIFICADO) | Requiere `/interpret` y `/rank`, extracciÃ³n con ambigÃ¼edad/confianza, sin autoridad de elegibilidad, contrato V2 |
| DB | `backend/src/db/init.sql` y `db/contract/schema.json`: `platillos` con `ingredientes_principales`, `complementos`, `etiquetas_dieteticas` (JSONB), `precio`, `activo`; catÃ¡logos/receta existen, integraciÃ³n con recomendador **NO VERIFICADA**; sin bandera de completitud/contaminaciÃ³n cruzada | Verificabilidad parcial; consultas/acotaciÃ³n y necesidades aditivas a definir (sin migraciones ahora) |
| Frontend | Wizard 5 pasos, `localStorage`, `/descubrir`, servicios `features/recommendations/recommendationService.ts` (global) y `services/recommendation.ts` (por restaurante); fallback UI con datos hardcodeados; `socialContext`/`keto` en UI sin respaldo verificable | Contrato V2, estados safety/desconocido/no verificable, retiro inertes, sin datos ficticios |
| Seguridad/aislamiento | Endpoint por restaurante filtra por `restaurante_id`/activo/suscripciÃ³n (comprobado); global expone catÃ¡logo multi-restaurante activo; rate-limit pÃºblico genÃ©rico en `index.js`; auth middleware/subscription existen | ValidaciÃ³n estricta, controles global, trazabilidad, no fuga cross-tenant en todos los casos |
| Pruebas | Backend: `tests/unit/slugService.test.js`, script `node --test`; ML: `test_recommendations.py`, `tests/*`; FE: config/playwright y e2e presentes (NO ejecutar E2E) | Cobertura insuficiente para V2; ampliar unit/integraciÃ³n/contratos (sin E2E inicial) |

## 11. Criterios generales de finalizaciÃ³n (programa V2)
1. Contratos FEâ†”BEâ†”ML y respuestas/errores implementados segÃºn diseÃ±o aprobado y validados.
2. Restricciones obligatorias aplicadas por Node con consolidaciÃ³n segura, elegibilidad, revalidaciÃ³n y fallback fail-closed (sin omisiÃ³n silenciosa).
3. Estados de seguridad/verificabilidad y mensajes no absolutos en toda la cadena.
4. Consultas/candidatos acotados y datos tratados segÃºn verificabilidad disponible; migraciones solo si autorizadas y documentadas.
5. Frontend alineado a contrato y estados (conocido/desconocido/no verificable) sin inventar resultados.
6. Pruebas unitarias, integraciÃ³n y contratos cubren casos crÃ­ticos (alergias, dieta, negaciÃ³n, presupuesto, datos incompletos/desconocidos, ML caÃ­do/invÃ¡lido, aislamiento, sin resultados) con evidencia.
7. BitÃ¡cora y documentos actualizados con hechos/evidencias; sin modificaciones no autorizadas ni regresiones de protecciÃ³n del repo.


## Actualización operativa — objetivo maestro R3/R4 (2026-11-15)

R3 y R4 fueron autorizados para implementación y permanecen **PARCIALES**. Las matrices vigentes con archivos, pruebas y pendientes están en `03-base-datos/02-verificabilidad-alimentaria.md` §O y `04-frontend/README.md`; el detalle de evidencias y comandos figura en `BITACORA.md`. Las tablas históricas de este plan no sustituyen esas actualizaciones. Migraciones preparadas pero no ejecutadas; validación PostgreSQL y ML V2 positiva, concurrencia y revisión de frontend en navegador siguen pendientes. DEC-002 y DEC-012 PARCIALES; DEC-007/DEC-011 sin cambio.


## Actualización — búsqueda con un solo mensaje (2026-11-15)

Decisión funcional aprobada: el recomendador visible utiliza un textarea y un botón; el mensaje es obligatorio, no hay captura fragmentada de filtros. Las rutas existentes muestran la misma experiencia. Backend interpreta y conserva DEC-002/DEC-012, evidencia y fail-closed. Se ejecutaron B1/R3 únicamente en bases PostgreSQL sintéticas efímeras bajo autorización anterior; este corte de interfaz no ejecuta migraciones. R3/R4 y DEC-002/DEC-012 siguen PARCIALES; detalle de integración y pendientes en BITACORA y matrices R3/R4.
