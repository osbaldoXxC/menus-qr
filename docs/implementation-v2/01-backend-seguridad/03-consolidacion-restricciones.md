# B1-T03 — Consolidación de restricciones obligatorias

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 1 — Backend y Seguridad |
| Tarea | 03 |
| Nombre | Consolidación de restricciones obligatorias (texto + estructuradas) |
| Dependencias | B1-T01,T02; B2-T01 (contrato `/interpret`, sujeto a autorización) o estrategia de transición; DEC-007, DEC-008 |
| Estado inicial | PENDIENTE |

## B. Objetivo
Consolidar en Node el conjunto de restricciones obligatorias a partir de entrada estructurada y extracción ML (`/interpret`), resolviendo contradicciones sin relajar seguridad, marcando ambigüedad/omisión como `desconocido` cuando corresponda y garantizando que ninguna restricción del usuario desaparezca silenciosamente.

## C. Estado actual
- **Comprobado:** No existe fase `/interpret` ni consolidación en BE; restricciones de texto se delegan implícitamente al flujo ML único actual o se pierden en fallback JS (que ignora dieta/negaciones). `socialContext` se transmite pero es inerte (a eliminar en contrato objetivo).

## D. Alcance permitido (sujeto a autorización)
- Módulo/lógica de consolidación en backend, integración con respuesta de `/interpret`, reglas de precedencia/contradicción, salvaguardas ante omisiones detectables, representación interna de estados por restricción.

## E. Fuera de alcance
- Implementar modelo NLP en ML (B2), cambios de esquema DB, UI, E2E.

## F. Procedimiento (autorizado)
1. Consumir `extracted` (negaciones, alergias/dietas/presupuesto, entidades, confianza, ambigüedad) y fusionar con `restrictions` estructuradas.
2. Prioridad: estructurado válido y regla protectora prevalecen; contradicción no relaja seguridad.
3. Marcar `desconocido` ante ambigüedad, baja confianza (según DEC-007), omisión riesgosa o dependencia no verificable de texto cuando ML no es confiable.
4. Aplicar salvaguarda: si texto contiene indicios de restricción obligatoria no reflejada con confianza, no omitir silenciosamente (fail-closed).
5. Producir conjunto obligatorio consolidado para elegibilidad (B1-T04) con trazabilidad por `requestId`.

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-01,02,03,04,09. `docs/audit-v2/09,10`.  
**Pendientes:** DEC-007 (umbrales), manejo operativo de contradicciones en `status/details` (propuesta en diseño).

## H. Criterios de aceptación
- [ ] Toda restricción estructurada obligatoria se preserva en consolidación.
- [ ] Restricciones inferidas de texto solo se aplican como obligatorias si son determinables/no ambiguas según política; de lo contrario `desconocido`/fail-closed.
- [ ] Contradicciones resueltas sin relajar seguridad y con registro interno/trazable.
- [ ] Casos: "sin cacahuate" en texto, ambigüedad, ML omite, contradicción, ML caído → comportamientos conforme `09/10`.
- [ ] Pruebas unitarias de consolidación con evidencia.

## I. Pruebas
- Unit: fusión, precedencia, ambigüedad, omisión, contradicción, ausencia de `/interpret`.
- Integración (B5): flujo con mock `/interpret`.

## J. Evidencias
- Casos de prueba, logs/trazas de `requestId` (sin datos sensibles), matriz entrada→restricción consolidada.

## K. Riesgos y rollback
- **Riesgo:** falsos negativos (recall) o, si se implementa mal, omisión. **Mitigación:** fail-closed y cobertura de casos críticos. **Rollback:** revertir tarea autorizada.

## L. Condición de cierre
- H e I cumplidos; decisión de umbrales documentada o explícitamente pendiente sin bloquear lógica fail-closed.

## M. Próxima tarea
- B1-T04 Elegibilidad y fallback seguro.
## Actualización 2026-11-13 (cierre técnico/documental, esta ejecución)

### Evidencia revisada/reutilizada (no rehacer sin causa)
- Implementación existente: `backend/src/services/restrictionConsolidation.js` — normalización de categorías/valores, preservación de origen (`structured`/`ml_extraction`), estados `compatible_segun_datos`/`incompatible`/`desconocido`, manejo de extracción ausente/no verificable/ambigua (ítem y global), contradicciones estructurado vs extracción (protective/fail-closed), omisión posible ML con preservación de restricción estructurada, trazabilidad `requestId` (generado si inválido/ausente), `applyCompatibilityEvidence` determinista, issues/trace/summary conservadores.
- Integración en flujo: `backend/src/controllers/menuController.js` invoca `consolidateRestrictions` en handlers de recomendación con `structuredRestrictions` canónicas y `mlExtraction: null` (sin fase `/interpret` activa).
- Pruebas unitarias existentes: `backend/tests/unit/restrictionConsolidation.test.js` — **15 PASS, 0 FAIL** (2026-11-13, contenedor backend, suite 77/77): preservación estructurada, fusión con procedencia, contradicción, omisión, ambigüedad, ausencia, no verificable, evidencia incompatible/compatible determinista, duplicados multi-origen, contradicción no resoluble, `requestId` válido/inválido, múltiples restricciones.

### Criterios de aceptación (estado real)
- [x] Restricciones estructuradas obligatorias preservadas en consolidación (evidencia unitaria).
- [x] Comportamiento conservador ante ambigüedad/ausencia/no verificable/omisión (fail-closed, sin compatibilidad automática no evidenciada).
- [x] Contradicciones tratadas sin relajar seguridad con trazabilidad/issues/conflicts.
- [ ] Casos completos del flujo objetivo con texto/`/interpret` real (restricción solo en texto, ML omite en extracción real, contradicción con extracción real, ML caído en fase I): **PARCIAL/BLOQUEADA** — depende de B2 `/interpret` y contrato.
- [x] Pruebas unitarias de consolidación pasan con evidencia (15/15).

### Pendientes / dependencias
- **B2-T01 `/interpret` y contrato ML→BE:** no disponible/integrado; extracción textual real no verificada en esta corrida.
- **DEC-002 (APROBADA documentalmente, 2026-11-13; implementación pendiente):** reglas de presupuesto/moneda `MXN` formalizadas para contrato/validación/elegibilidad (ver plan maestro y `docs/audit-v2/09`). Consolidación debe preservar y no relajar restricciones presupuestarias estructuradas válidas y tratar presupuestos textuales ambiguos/contradictorios como no filtro duro/fail-closed según contrato; **implementación/enforcement pendiente**, no completada por esta formalización. Convención MXN en datos **NO VERIFICADA** en producción.
- **DEC-007 (umbrales confianza/ambigüedad), DEC-008 (datos/verificabilidad operativa):** pendientes; lógica permanece conservadora.
- Contradicciones en `status/details` operativos y salvaguardas BE sobre marcadores textuales detectables en ausencia de extracción fiable: **NO VERIFICADO** integralmente.
- Integración con mock `/interpret` (B5): **PENDIENTE**. No se modificó código ni se inventaron cierres de DEC.

### Estado final
**PARCIAL (bloqueada parcialmente por B2/DEC)** — servicio, integración base y pruebas unitarias existentes aprobadas con comportamiento fail-closed; falta integración/evidencia con extracción ML real y resolución de dependencias/decisiones.
