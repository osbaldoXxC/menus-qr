# B2-T04 — Scoring, correcciones y manejo de errores/fallback (ML)

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 2 — Machine Learning |
| Tarea | 04 |
| Nombre | Scoring y fallback del servicio ML |
| Dependencias | B2-T01–T03, B1-T04 |
| Estado inicial | PENDIENTE |

## B. Objetivo
Asegurar que el scoring/ranking sea coherente, explicable con evidencia y robusto ante errores, timeouts y entradas límite, manteniendo a ML dentro de su rol no autoritativo.

## C. Estado actual
- **Comprobado:** `main.py` implementa TF-IDF, fuzzy/Levenshtein, heurísticas, negaciones y dieta, con pesos configurables; genera razones (algunas absolutas según auditoría). Posible bug de estructura en rama de scoring (Q6, inferido). Tests ML existentes (`test_recommendations.py`, `tests/*`) **NO VERIFICADOS** en ejecución en esta misión.

## D. Alcance permitido (sujeto a autorización)
- Refactor/corrección de scoring (incl. Q6 si se confirma), normalización de razones no absolutas, manejo de excepciones/timeouts, respuestas de error controladas, ajuste de meta, pruebas.

## E. Fuera de alcance
- Elegibilidad final, acceso DB, lógica de fallback de negocio en BE (B1), UI.

## F. Procedimiento (autorizado)
1. Revisar y, si aplica, corregir rutas de scoring y cálculo de `score/confidence` (marcar calibración como NO VERIFICADO/DEC-007).
2. Eliminar lenguaje absoluto en razones generadas por ML; basar en evidencia textual/de atributos provistos.
3. Garantizar fallos controlados (sin stack traces al cliente vía BE), tiempos acotados, sin reintentos ilimitados.
4. **DEC-003 (APROBADA):** ante fallo/timeout/respuesta inválida de ML V2, BE aplica fallback determinista solo con candidatos cuya elegibilidad sea verificable; si no es posible, responder estado controlado (`no_verified_results` u otro definido). No usar ML v1 como fallback silencioso. No inventar recomendaciones. ML v1 `/recommendations` no es parte del objetivo arquitectónico (retirada por etapa autorizada).
5. Ejecutar y ampliar pruebas ML relevantes.

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-04,07,08; `audit-v2/07,09`.  
**Pendientes:** DEC-007 (umbrales/calibración).

## H. Criterios de aceptación
- [ ] Scoring produce resultados deterministas dentro de lo esperado para fixtures definidos.
- [ ] Sin razones/claims absolutos de seguridad.
- [ ] Errores/timeouts no provocan respuestas inseguras (degradación manejada por BE).
- [ ] Pruebas ML relacionadas pasan con evidencia.

## I. Pruebas
- Unit: normalización, negaciones, dietas, presupuesto (si aplica), ranking básico, manejo de candidatos vacíos/entrada límite.

## J. Evidencias
- Resultados `pytest`, diffs de lógica y ejemplos de salida.

## K. Riesgos y rollback
- **Riesgo:** cambio de relevancia percibida. **Mitigación:** pruebas de regresión. **Rollback:** revertir tarea.

## L. Condición de cierre
- H e I cumplidos y coherencia con B1/B2-T03.

## M. Próxima tarea
- B3-T01 Consultas y candidatos (tras autorización de B3).
