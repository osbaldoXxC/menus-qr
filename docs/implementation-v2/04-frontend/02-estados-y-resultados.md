# B4-T02 — Estados, resultados y mensajes de seguridad

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 4 — Frontend |
| Tarea | 02 |
| Nombre | Presentación de recomendaciones y estados de verificabilidad |
| Dependencias | B1-T04,T06 (contrato/respuestas), B4-T01, DEC-001 |
| Estado inicial | PENDIENTE |

## B. Objetivo
Representar fielmente en UI los resultados, estados `safety` (`compatible_segun_datos`, `incompatible` cuando aplique en detalle, `desconocido`), disclaimers, ausencia de resultados verificables y errores, sin inventar datos ni garantizar seguridad.

## C. Estado actual
- **Comprobado:** `DescubrirResultados.tsx` consume respuesta global, muestra recomendaciones/swipe/drawer y ante error o vacío usa `FALLBACK_RECOMMENDATIONS` hardcodeados (platillos/restaurantes ficticios según auditoría). No representa estados `safety` V2 ni `no_verified_results` canónico.

## D. Alcance permitido (sujeto a autorización)
- Componentes de resultados/listado/detalle, manejo de estados de respuesta, mensajes y disclaimers, eliminación de datos ficticios como fallback de recomendación real.

## E. Fuera de alcance
- Cálculo de elegibilidad, modificación de ML/DB, E2E.

## F. Procedimiento (autorizado)
1. Mapear `status.code`, `meta`, `safety` y `error` del contrato `audit-v2/06,10` a estados UI.
2. Implementar vistas/estados: cargando, resultados verificados, `no_verified_results`, error recuperable/no recuperable.
3. Mostrar `desconocido` y restricciones no verificables de forma explícita y no compatible (DEC-001 para copy).
4. Incluir disclaimer: información declarada, sin garantía de ausencia de trazas/contaminación cruzada; prohibir lenguaje absoluto.
5. Eliminar fallback con platos/restaurantes inventados; usar estado vacío/informativo.

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-03,04,05,07; FE no autoritativo.  
**Pendientes:** DEC-001 (copy/UX exacta de `desconocido`).

## H. Criterios de aceptación
- [ ] UI refleja correctamente `ok`, `no_verified_results`, `partial_results_sanitized` y errores.
- [ ] Ningún estado `desconocido` se presenta como compatible/seguro.
- [ ] No se muestran recomendaciones ficticias como resultados reales.
- [ ] Disclaimers y lenguaje no absoluto presentes.
- [ ] Datos de platillo/restaurante mostrados provienen de respuesta BE.

## I. Pruebas
- Unit/component (sin E2E): render por estado, ausencia de fallback ficticio, presencia de disclaimers y etiquetas de seguridad.

## J. Evidencias
- Capturas/descripciones de estados, resultados de tests, payloads de ejemplo renderizados.

## K. Riesgos y rollback
- **Riesgo:** mensajes confusos o falsa sensación de seguridad. **Mitigación:** revisión de copy con DEC-001. **Rollback:** revertir tarea.

## L. Condición de cierre
- H cumplido y coherencia con contrato BE verificada.

## M. Próxima tarea
- B5-T01 Pruebas de integración y contratos (tras autorización de B5).

## Aplazamiento y preparación R4 (decisión usuario, 2026-11-13)
- **Pruebas funcionales frontend:** APLAZADA HASTA R4/R5 — PENDIENTE DE VALIDACIÓN INTEGRAL.
- **R4 (adaptación requerida, sin implementar ahora):** eliminar fallback UI con datos hardcodeados ficticios; mapear status.code/meta/safety/error canónicos (ok, 
o_verified_results, partial_results_sanitized, errores uniformes) cuando backend los exponga; representar compatible_segun_datos/desconocido/no verificable sin garantías absolutas; hidratar datos desde respuesta BE. Actualmente respuestas de recomendación devuelven ecommendations/meta simplificado (sin safety/status/error V2 completo en éxito), por lo que R4 depende de estabilización contractual BE.
- **R5:** validación integral de las 3 interfaces con backend+ML.
