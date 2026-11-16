# B5-T03 — Aceptación final y cierre documental

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 5 — Integración y Validación |
| Tarea | 03 |
| Nombre | Aceptación final, revisión cruzada y cierre |
| Dependencias | B5-T01,T02; B1–B4 en estados finales documentados |
| Estado inicial | PENDIENTE |

## B. Objetivo
Confirmar con evidencia que el programa V2 cumple los criterios generales de finalización, que la documentación refleja el estado real y que no quedan contradicciones críticas sin registrar.

## C. Estado actual
- **Comprobado:** Implementación V2 no iniciada; esta aceptación final solo podrá completarse tras ejecución autorizada de bloques y pruebas.

## D. Alcance permitido (sujeto a autorización)
- Consolidación de evidencias, actualización de estados, revisión cruzada de documentos, reporte final de aceptación.

## E. Fuera de alcance
- Nuevas funcionalidades, E2E, despliegue, cambios no autorizados.

## F. Procedimiento (autorizado)
1. Verificar cumplimiento de criterios del `00-plan-maestro.md` (§11).
2. Revisar consistencia entre contratos, código implementado y documentación.
3. Confirmar que todas las tareas tienen estado basado en evidencia y que pendientes/NO VERIFICADO están explícitos.
4. Actualizar `BITACORA.md` y emitir informe de aceptación.
5. Registrar decisión de liberación o bloqueo.

## G. Decisiones arquitectónicas
**Respetar:** todas las confirmadas; pendientes deben estar explícitas con impacto.

## H. Criterios de aceptación
- [ ] Criterios generales 1–7 del plan maestro satisfechos con evidencia.
- [ ] Sin recomendaciones inseguras en casos críticos verificados.
- [ ] Contratos y flujos coherentes FE↔BE↔ML↔DB.
- [ ] Documentación y bitácora consistentes y completas.
- [ ] Decisiones pendientes identificadas sin presentarse como aprobadas.

## I. Pruebas
- Consolidación de resultados B1–B5 (unit, integración, contrato, regresión) sin E2E.

## J. Evidencias
- Matriz de trazabilidad criterio↔evidencia, reportes de tests, revisiones documentales.

## K. Riesgos y rollback
- **Riesgo:** cierre con evidencia insuficiente. **Mitigación:** exigir trazabilidad por criterio. **Rollback:** mantener estado PARCIAL/NO CUMPLE hasta subsanar.

## L. Condición de cierre
- H cumplido y autorización de cierre registrada.

## M. Próxima tarea
- Ninguna dentro de implementación V2; siguientes pasos operativos (despliegue/optimización) requieren planificación y autorización separadas.

## Aplazamiento frontend y aceptación integral (decisión usuario, 2026-11-13)
- **Pruebas funcionales frontend:** APLAZADA HASTA R4/R5 — PENDIENTE DE VALIDACIÓN INTEGRAL.
- **Criterio de aceptación final:** debe incluir validación integral de las 3 interfaces (comensales, admin, restaurantes) con backend+ML tras adaptación R4. Mientras tanto, conservar requisitos de interfaz obligatorios del plan sin cambiarlos unilateralmente; su ejecución queda diferida y documentada, no como fallo técnico de R1.
