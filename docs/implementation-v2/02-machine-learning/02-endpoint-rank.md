# B2-T02 — Endpoint `/rank`

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 2 — Machine Learning |
| Tarea | 02 |
| Nombre | Endpoint `/rank` (ranking de candidatos elegibles) |
| Dependencias | B1-T04 (elegibilidad), B3-T01 (candidatos acotados), B2-T03 |
| Estado inicial | PENDIENTE |

## B. Objetivo
Especificar e implementar (cuando se autorice) `POST /rank` que reciba **solo candidatos elegibles/evaluables** y devuelva un orden propuesto (`ranked`) con scores/razones basadas en evidencia, sin filtrar elegibilidad final ni inventar datos.

## C. Estado actual
- **Comprobado:** `/recommendations` actual recibe `dishes` y realiza filtrado + scoring + ranking en ML (`main.py`). No existe `/rank` separado. Posible issue de estructura/scoring (Q6, inferido, NO VERIFICADO en ejecución).

## D. Alcance permitido (sujeto a autorización)
- Endpoint y modelos, lógica de scoring/ranking sobre candidatos provistos, razones con evidencia, meta de ejecución, tests.

## E. Fuera de alcance
- Acceso a DB, filtrado de seguridad obligatorio, modificación de datos de candidatos, reintroducción de descartados.

## F. Procedimiento (autorizado)
1. Definir schema entrada (`requestId`, `scope`, `craving`, `restrictions` consolidadas, `options`, `candidates`, `extracted` opcional) y salida (`ranked[]` con `dishId`, `score`, `confidence?`, `reasons[]`, `meta`) según `audit-v2/06`.
2. Rankear solo ids recibidos; no añadir ids externos.
3. Generar razones basadas en evidencia disponible (coincidencia semántica, categoría, ingredientes declarados) sin lenguaje absoluto de seguridad.
4. Manejar lista vacía y límites (`options.limit`) de forma determinista.
5. Cubrir con pruebas de ranking y no-regresión de scoring.

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-01,02,05,07,08.  
**Pendientes:** DEC-005 (top-K), calibración de `score/confidence` (NO VERIFICADO).

## H. Criterios de aceptación
- [ ] Solo devuelve `dishId` presentes en `candidates`.
- [ ] Orden y `score` en rangos definidos; `confidence` marcada como estimación.
- [ ] Sin campos autoritativos de catálogo inventados.
- [ ] Casos con 0/N candidatos manejados correctamente.
- [ ] Pruebas de ranking y regresión pasan.

## I. Pruebas
- Unit: ordenamiento, límite, candidatos vacíos, estabilidad de desempate (si se define), ausencia de ids ajenos.

## J. Evidencias
- Contrato, resultados `pytest`, ejemplos de entrada/salida.

## K. Riesgos y rollback
- **Riesgo:** regresión de relevancia (Q6) o latencia. **Mitigación:** tests y acotación. **Rollback:** revertir tarea.

## L. Condición de cierre
- H e I cumplidos y compatible con revalidación BE.

## M. Próxima tarea
- B2-T03 Contratos y validación.
