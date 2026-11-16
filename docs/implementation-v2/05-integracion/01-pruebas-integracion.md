# B5-T01 — Pruebas de integración y contratos

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 5 — Integración y Validación |
| Tarea | 01 |
| Nombre | Pruebas de integración y verificación de contratos |
| Dependencias | B1–B4 (tareas relevantes completadas), B1-T06, B2-T03 |
| Estado inicial | PENDIENTE |

## B. Objetivo
Validar integración FE↔BE↔ML↔DB (con mocks/entornos controlados autorizados) contra contratos canónicos y flujos feliz/degradado, asegurando coherencia de datos, estados y errores.

## C. Estado actual
- **Comprobado:** Existen pruebas unitarias parciales (backend slug, ML tests) y artefactos E2E en FE (no ejecutar). No hay suite de integración V2 verificada.

## D. Alcance permitido (sujeto a autorización)
- Pruebas de integración y contrato (Node↔ML mock/servicio controlado, Node↔DB de prueba), fixtures, validadores de schema de respuesta, reportes de evidencia.

## E. Fuera de alcance
- E2E, pruebas en producción, modificaciones funcionales no autorizadas.

## F. Procedimiento (autorizado)
1. Preparar entorno controlado y datos de prueba (aislados, no productivos).
2. Ejecutar casos de flujo feliz: request canónico → `/interpret` → consolidación → DB → `/rank` → respuesta hidratada y segura.
3. Ejecutar casos degradados: fallo/timeout `/interpret`, fallo/timeout `/rank`, respuesta inválida/parcial, ids ajenos.
4. Verificar contrato y estructura uniforme en éxito y error.
5. Registrar resultados y desviaciones.

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-01–09, `audit-v2/06,10`.

## H. Criterios de aceptación
- [ ] Flujos feliz y degradados cumplen contratos y estados esperados.
- [ ] Datos de respuesta final provienen de DB; ML no autoritativo.
- [ ] Ninguna respuesta verificada contiene restricciones obligatorias incumplidas/desconocidas.
- [ ] Evidencia de ejecución registrada.

## I. Pruebas
- Integración/contrato: solicitud normal, negación, alergia, dieta, presupuesto, datos incompletos, ML caído en I/II, ML inválido/parcial, sin resultados, restaurante inexistente/inactivo, aislamiento.

## J. Evidencias
- Logs de ejecución, payloads anonimizados, comparativas contra esquema esperado.

## K. Riesgos y rollback
- **Riesgo:** entorno de prueba no representativo. **Mitigación:** fixtures alineados a esquema real. **Rollback:** no aplica a producto.

## L. Condición de cierre
- H cumplido o fallos documentados con estado NO CUMPLE/PARCIAL.

## M. Próxima tarea
- B5-T02 Regresiones.

## Aplazamiento frontend y alcance R5 (decisión usuario, 2026-11-13)
- **Pruebas funcionales frontend (3 interfaces):** APLAZADA HASTA R4/R5 — PENDIENTE DE VALIDACIÓN INTEGRAL. Fallos manuales previos atribuidos a falta de adaptación FE a cambios backend/contrato; no se consideran fallidas de R1.
- **R5 incluirá:** flujos de integración/contrato y validación integral UI de comensales (:3000), admin (:3001) y restaurantes (:3002) con backend+ML tras R4. R1/R2 se limitan a evidencia técnica automatizable y documentación de dependencias contractuales para R4.
