# Validación Técnica, Propuesta V2 y Plan (Fases 7-10)

## Fase 7 — Validación técnica (solo auditoría, sin E2E)
| Verificación | Estado | Evidencia/Comando | Resultado |
|---|---|---|---|
| Inventario pruebas recomendación | CUMPLE | `find ... *recommend*` → `ml-service/test_recommendations.py`, `ml-service/tests/test_ml_service.py` y otros, `frontend-comensales/tests/e2e/recommendations.spec.ts` (NO ejecutado) | Pruebas unitarias/integración ML existen; E2E frontend presente pero excluida |
| Ejecución lint/typecheck/tests | NO VERIFICADO | No ejecutado en esta auditoría para evitar efectos en entorno/tiempos (dependencias `node_modules` voluminosas, entorno mixto) | Requiere autorización/entorno controlado; ejecutar `node --test` en backend, `pytest` en `ml-service`, `tsc`/`eslint` en frontends |
| Dependencias | PARCIAL | Inspección `package.json`, `requirements.txt` | ML usa spaCy+modelo+sklearn; backend axios/pg/redis/helmet/zod; FE axios/react/vite/playwright (dev) |
| Contratos estáticos | PARCIAL | Revisión de código | Divergencias documentadas (límites, socialContext, fallback) |

> **Restricción respetada:** No se ejecutaron pruebas E2E (Playwright/Cypress/Selenium) ni suites indirectas.

## Fase 8 — Diseño de propuesta V2 (recomendado)

### Objetivo
Texto natural como entrada principal; restricciones obligatorias verificables; ML interpreta/rankea candidatos reales; backend valida y es autoridad final; sin invención.

### Arquitectura recomendada (Rediseño intermedio, evolución segura)
1. **Frontend**: campo principal `craving.text`; chips opcionales; alergias estructuradas (obligatorias si se declaran) y dieta solo si verificable; eliminar/ocultar `socialContext` si no aporta; estados claros (loading/vacío/error/disclaimer).
2. **Backend (autoridad)**: validar request (Zod), normalizar, resolver restaurante/scope, obtener candidatos de PostgreSQL con pre-filtros SQL cuando sea posible, llamar ML con lote acotado, **revalidar** respuesta ML (existencia, pertenencia, activo, precio, restricciones) y construir respuesta final. Fuente única de `limit`.
3. **ML**: solo extracción de intención/entidades/negaciones/presupuesto y ranking de candidatos entregados; salida estructurada (ids + scores + razones basadas en evidencia). Sin inventar datos.
4. **PostgreSQL**: mantener fuente de verdad; mejorar calidad con etiquetas normalizadas y relación ingredientes-platillo (aprovechar tablas existentes `ingredientes_catalogo`/`receta_platillo`); migraciones aditivas y compatibles.
5. **Fallback**: determinista y **seguro** — aplicar mismas restricciones obligatorias (alergias/dieta/negaciones) o devolver "sin resultados compatibles" con explicación; nunca relajar filtros ni inventar.

### Contrato objetivo (resumen)
- **Request FE→BE:** `{ restaurantId?: string, craving: { text: string, tags?: string[] }, restrictions?: { allergies?: string[], diet?: string|null, excludedIngredients?: string[] }, budgetMax?: number|null, limit?: number }`
- **BE→ML:** `{ requestId, locale, craving, restrictions, budgetMax, candidates:[{id,nombre,descripcion,precio,ingredientes,etiquetas,categoria,activo,restauranteId}], limit }`
- **ML→BE:** `{ ranked:[{dishId, score, confidence, reasons:[{type,evidence}]}], extracted:{negations[],entities[],budgetMax?,diet?}, meta }`
- **BE→FE:** `{ recommendations:[{dish,restaurant,matchPercentage,reasons[],safetyNotes[]}], meta:{totalCandidates,returned,fallback,limitApplied} }`

### Decisiones funcionales
- **Alergias:** restricciones estructuradas obligatorias; mensaje cauteloso (datos declarados, no contaminación cruzada).
- **Dietas:** solo "compatible según datos declarados" cuando hay evidencia; `keto`/otras sin datos verificables → no ofrecer como garantía.
- **Acompañante/socialContext:** eliminar o diferir hasta tener uso real.
- **Presupuesto:** extraer del texto si confianza suficiente; validar contra `precio` real.
- **Sin resultados:** respuesta clara, mantener restricciones.

## Fase 9 — Plan de implementación priorizado (requiere autorización futura)

| Prioridad | Tarea | Problema que resuelve | Archivos afectados (prob.) | Riesgo | Validación |
|---|---|---|---|---|---|
| Crítica | Fallback seguro en backend (aplicar dieta/negaciones/alergias) y mensajes no absolutos | S5,S10 | `backend/src/controllers/menuController.js`, `ml-service/main.py` | Cambios en resultados | Unit tests reglas, integración BE-ML caída |
| Crítica | Validación estricta de request y límite único | S1,Q3 | controller/routes/backend validators, FE services, ML model | Compatibilidad | Contratos/tests |
| Alta | Revalidación de respuesta ML en backend (anti-invención/inconsistencia) | S4/reglas | controller backend | Latencia menor | Tests integración |
| Alta | Limpiar campos inertes (`socialContext`) y alinear FE wizard/contrato | Q2, UX | `CuestionarioWizard.tsx`, services, controller, ML | Cambio UX | Unit/component (no E2E) |
| Alta | Corregir bug/anidar scoring ML y reforzar pruebas | Q6 | `ml-service/main.py`, `tests/*` | Regresión ranking | `pytest` |
| Media | Pre-filtrado/top-K en DB y control de payload a ML | Q4,S4 | controller/queries SQL | Complejidad SQL | Integración/perf |
| Media | Mejorar calidad de datos dietas/ingredientes (modelo gradual) | datos | `init.sql`/migraciones, carga datos | Migración | Migraciones controladas |
| Baja | Observabilidad (logger estructurado, métricas) | Q8 | backend/ml | Bajo | Smoke/manual |

## Fase 10 — Cierre
- **Fases 0-9:** documentadas con evidencia en código y árbol del repo; Fase 7 de ejecución de pruebas marcada **NO VERIFICADA** (sin ejecución) respetando restricción de no pruebas E2E y no modificación de entorno.
- **No se modificó código fuente de aplicación**; solo se generaron artefactos de auditoría (`audit-report.md`, `menus-qr/docs/audit-v2/*`).
- **Pendientes críticos:** seguridad de fallback ante caída ML, validación de entrada, consistencia de límites/contratos, veracidad de datos para dietas/alergias.
