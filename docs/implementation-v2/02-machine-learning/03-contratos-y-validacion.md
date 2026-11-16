# B2-T03 — Contratos y validación (ML)

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 2 — Machine Learning |
| Tarea | 03 |
| Nombre | Contratos de entrada/salida y validación de respuestas |
| Dependencias | B1-T02, B2-T01,T02, `audit-v2/06,10` |
| Estado inicial | PENDIENTE |

## B. Objetivo
Asegurar contratos explícitos y versionables entre Node y ML (`/interpret`, `/rank`) y validación/saneo estricto en la frontera de Node para cualquier respuesta ML (shape, tipos, ids, rangos, parciales).

## C. Estado actual
- **Comprobado:** Contrato actual BE→ML es payload único a `/recommendations` con `dishes` y campos legacy; BE verifica parcialmente (`Array.isArray(recommendations)`) antes de pass-through; sin esquema de invalidación fina ni saneo de elementos parciales.

## D. Alcance permitido (sujeto a autorización)
- Schemas/modelos Pydantic y validadores Node, versionado de contrato interno, manejo de respuestas parciales/inválidas, mapeo de errores de contrato, documentación de compatibilidad (DEC-011).

## E. Fuera de alcance
- Lógica de negocio de elegibilidad (BE), UI, DB.

## F. Procedimiento (autorizado)
1. Formalizar modelos de request/response para `/interpret` y `/rank`.
2. En BE, validar respuestas antes de uso: estructura, `requestId`, pertenencia de `dishId` a candidatos, rangos, campos obligatorios.
3. Descartar ítems inválidos; si quedan válidos → `partial_results_sanitized` cuando aplique; si no → fallback/`no_verified_results` según `10`.
4. Rechazar como no confiable respuestas con shape inválido total.
5. Documentar estrategia de transición desde `/recommendations` (DEC-011) sin perder garantías.

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-04,05,08,09; ML no autoritativo.  
**DEC-003 (APROBADA, 2026-11-13):** contratos V2 canónicos objetivo; ML v1 (`/recommendations`) y rutas legacy no forman parte del objetivo (no fallback silencioso). Retirada efectiva por módulo/etapa autorizada verificando dependencias.  
**Pendientes:** DEC-011 (propuesta no aprobada; transición operativa concreta no autorizada ni asumida), DEC-007 (confianza/umbrales).

## H. Criterios de aceptación
- [ ] Schemas ML y validadores BE definidos y alineados a `06/10`.
- [ ] Respuestas inválidas/parciales no contaminan la salida final.
- [ ] `dishId` ajenos o candidatos no elegibles nunca se exponen como recomendación.
- [ ] Errores de contrato generan degradación segura.
- [ ] Pruebas de contrato (válido, inválido, parcial) pasan.

## I. Pruebas
- Unit/integración: shape erróneo, campos faltantes, ids ajenos, scores fuera de rango, parciales mixtos.

## J. Evidencias
- Definiciones de schema, resultados de tests, ejemplos de saneo.

## K. Riesgos y rollback
- **Riesgo:** incompatibilidad durante transición. **Mitigación:** DEC-011 y mapeo determinista. **Rollback:** revertir tarea.

## L. Condición de cierre
- H e I cumplidos; contratos publicados en docs.

## M. Próxima tarea
- B2-T04 Scoring y fallback (ML).
