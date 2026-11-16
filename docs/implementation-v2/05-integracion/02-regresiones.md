# B5-T02 — Regresiones y casos críticos

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 5 — Integración y Validación |
| Tarea | 02 |
| Nombre | Pruebas de regresión y verificación de seguridad operativa |
| Dependencias | B5-T01, B1-T06, B2-T04 |
| Estado inicial | PENDIENTE |

## B. Objetivo
Detectar regresiones funcionales y de seguridad introducidas por la implementación V2, con foco en restricciones alimentarias, aislamiento, fallback y consistencia de contratos.

## C. Estado actual
- **Comprobado:** Cobertura previa limitada (slug unit, tests ML, E2E no ejecutados). Brechas conocidas S5,S10,Q1–Q6 documentadas en `audit-v2`.

## D. Alcance permitido (sujeto a autorización)
- Suites de regresión unitarias/integración, casos negativos, revisión de mensajes y estados, comparación con comportamiento esperado V2.

## E. Fuera de alcance
- E2E, tuning de modelo en producción, cambios funcionales no autorizados.

## F. Procedimiento (autorizado)
1. Derivar casos de regresión desde hallazgos `audit-v2` (fallback inseguro, límites, `socialContext`, lenguaje absoluto, aislamiento).
2. Ejecutar regresiones en componentes afectados tras cada bloque implementado.
3. Verificar que correcciones no reintroducen riesgos (p.ej. relajación en fallback).
4. Documentar resultados y acciones requeridas.

## G. Decisiones arquitectónicas
**Respetar:** todas las D-ARQ confirmadas; fail-closed.

## H. Criterios de aceptación
- [ ] Casos de regresión críticos (S5,S10, aislamiento, contrato, no omisión textual) pasan.
- [ ] No se detecta relajación de restricciones en degradación.
- [ ] Desviaciones registradas con estado y evidencia.

## I. Pruebas
- Regresión: fallback sin ML, dieta/negaciones/alergias, presupuesto, `limit` único, ausencia de `socialContext` funcional, mensajes no absolutos, ids ajenos, cross-tenant, `no_verified_results`.

## J. Evidencias
- Lista de casos, resultados, comparativa antes/después cuando aplique.

## K. Riesgos y rollback
- **Riesgo:** cobertura incompleta. **Mitigación:** priorizar casos de seguridad. **Rollback:** revertir cambios causantes (tarea autorizada).

## L. Condición de cierre
- H cumplido o pendientes críticos explícitos.

## M. Próxima tarea
- B5-T03 Aceptación final.

## Aplazamiento frontend y alcance R5 (decisión usuario, 2026-11-13)
- **Pruebas funcionales frontend:** APLAZADA HASTA R4/R5 — PENDIENTE DE VALIDACIÓN INTEGRAL. No registrar regresiones UI manuales como fallos R1 en esta fase; R5 cubrirá regresiones integrales de las 3 interfaces post-adaptación R4.
