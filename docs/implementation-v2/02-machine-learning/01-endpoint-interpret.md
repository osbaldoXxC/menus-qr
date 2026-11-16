# B2-T01 — Endpoint `/interpret`

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 2 — Machine Learning |
| Tarea | 01 |
| Nombre | Endpoint `/interpret` (extracción de intención y restricciones) |
| Dependencias | B1-T02,T03 (contrato/consumo), `audit-v2/06,09,10` |
| Estado inicial | PENDIENTE |

## B. Objetivo
Especificar e implementar (cuando se autorice) `POST /interpret` para extraer de texto y contexto estructurado: entidades, negaciones, menciones de alergias/dieta, presupuesto, confianza y ambigüedad, como **propuesta** para consolidación en Node.

## C. Estado actual
- **Comprobado:** `ml-service/main.py` expone `/health` y `/recommendations` (interpretación implícita + filtrado + ranking en una sola llamada). No existe `/interpret`. Extracción de negaciones y NLP (TF-IDF, fuzzy, spaCy opcional) presente en lógica actual; `socialContext` inerte.

## D. Alcance permitido (sujeto a autorización)
- Endpoint, modelos request/response, lógica de extracción, señales de confianza/ambigüedad, tiempos/meta, tests en `ml-service/tests/*`.

## E. Fuera de alcance
- Filtrado final de elegibilidad, acceso a DB, decisión de seguridad, cambios de frontend/backend fuera del contrato acordado.

## F. Procedimiento (autorizado)
1. Definir schema entrada/salida según `audit-v2/06,09` (`requestId`, `locale`, `craving`, `restrictions`; salida `extracted` con `negations`, `allergyMentions`, `dietMention`, `budget{amount,currency,confidence,ambiguous,perPerson,range}`, `entities`, `notes`, `meta`).
2. Implementar extracción determinística/ML sin inventar restricciones no sustentadas; marcar ambigüedad explícitamente.
3. No omitir señales relevantes: si hay indicio de restricción, reflejarlo con confianza/ambigüedad adecuada para que BE pueda fail-closed.
4. Asegurar respuesta válida ante texto vacío/ambiguo (sin excepción no controlada).
5. Cubrir pruebas unitarias de extracción y casos lingüísticos críticos.

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-01,02,04,07,09; BE autoridad.  
**DEC-002 (APROBADA documentalmente, 2026-11-13; implementación pendiente):** en extracción de presupuesto, ML propone únicamente (nunca autoriza). Moneda objetivo única `MXN`; sin conversiones/tasas/servicios externos. Si `budgetPerPerson` implícito/explicitado en texto como por persona, señalar para rechazo/control conservador en BE (regla: `budgetPerPerson=true` → 400 temporal en contrato estructurado). Presupuestos ambiguos/contradictorios/rangos no inequívocos en texto deben marcarse `ambiguous=true` o baja confianza y **no** constituir filtro duro. Valor numérico, si se propone, debe ser único y compatible con límites DEC-002 (finito, >0, <=100000, máx. 2 decimales) o marcarse no determinable. Solicitudes legacy sin presupuesto permanecen válidas. Convención MXN en datos **NO VERIFICADA** en producción.  
**Pendientes:** DEC-007 (umbrales numéricos de confianza), idioma/locales soportados, DEC-003/DEC-011 (versionado/transición contractual, no resueltos).

## H. Criterios de aceptación
- [ ] Contrato request/response implementado y documentado.
- [ ] Negaciones, alergias, dieta y presupuesto (cuando identificables) extraídos con marcadores de confianza/ambigüedad, alineados a DEC-002 (`MXN`, sin conversión, ambigüedad/no determinable conservador, `perPerson` señalizado).
- [ ] Casos ambiguos no se devuelven como certezas ni como filtros duros aplicables sin validación BE.
- [ ] ML no emite decisiones de elegibilidad ni datos de catálogo.
- [ ] Pruebas unitarias relevantes pasan con evidencia.

## I. Pruebas
- Unit: "sin cacahuate", negaciones múltiples/ambiguas, presupuesto explícito MXN, presupuesto ambiguo/rango/contradictorio, presupuesto "por persona", moneda distinta/no determinable, dieta mencionada, texto vacío, contradicciones señalables.

## J. Evidencias
- Especificación de contrato, resultados `pytest` en `ml-service`, ejemplos JSON.

## K. Riesgos y rollback
- **Riesgo:** falsos negativos/positivos en extracción. **Mitigación:** ambigüedad + fail-closed en BE. **Rollback:** revertir tarea autorizada. **DEC-003:** ML v1 `/recommendations` no es objetivo de compatibilidad funcional ni fallback silencioso; retirada/transición por módulo/etapa autorizada (DEC-011 sigue propuesta no aprobada).

## L. Condición de cierre
- H e I cumplidos y contrato alineado con BE.

## M. Próxima tarea
- B2-T02 Endpoint `/rank`.
