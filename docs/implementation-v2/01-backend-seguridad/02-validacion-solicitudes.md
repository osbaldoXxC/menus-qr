# B1-T02 — Validación de solicitudes entrantes

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 1 — Backend y Seguridad |
| Tarea | 02 |
| Nombre | Validación de solicitudes entrantes (contrato externo recomendador V2) |
| Dependencias | B1-T01; DEC-002 (moneda/presupuesto, APROBADA), DEC-003 (arquitectura V2/retirada legacy, APROBADA; implementación por etapa pendiente) |
| Estado inicial | PENDIENTE |

## B. Objetivo
Definir e implementar (cuando se autorice) validación estricta de borde para endpoints de recomendación conforme al **contrato canónico externo V2** documentado en `docs/audit-v2/06-contratos-definitivos.md` (secciones R1): schema, tipos, rangos, normalización, límites (`limit` 1..10), `locale`, `requestId`, reglas de presupuesto DEC-002, tratamiento de campos desconocidos y errores uniformes 400 `INVALID_REQUEST`, sin confianza en frontend y sin relajar seguridad.

## C. Estado actual (evidencia)
- **Comprobado:** `backend/src/validators/recommendationRequest.js` valida/mapea canónico+legacy (Zod, strict), `craving/restrictions/options`, `limit` 1..10, `locale` validado/default `es-MX`, `requestId` generado/aceptado, `diet/allergies/excludedIngredients`, preserva `budget*` estructuralmente **sin enforcement DEC-002**. `buildValidationErrorResponse` produce `recommendations/meta/status/error` parcial (no envelope V2 completo con `safety`/`meta.scope/evaluatedCandidates/totalCandidates`). `menuController.js` usa validador en handlers y devuelve 400 uniforme parcial; respuestas de éxito 404/403/500 no siguen contrato V2.
- **Rutas existentes:** `POST /api/public/menu/recommendations` (global) y `POST /api/public/menu/:restaurant_id/recommendations` en `backend/src/routes/publicRoutes.js` montado en `/api/public/menu` (e index también monta en `/api/public`).

## D. Alcance permitido (sujeto a autorización por etapa)
- Validadores/schemas para request V2 canónico, normalización, rechazo de inválidos/desconocidos según política aprobada, enforcement DEC-002, generación/eco de `requestId`, `meta.limitApplied`, mapeo de errores a envelope uniforme V2, y (solo en etapa autorizada) retirada de aceptación legacy conforme DEC-003. Sin adaptar frontends en R1/R2/R3.

## E. Fuera de alcance
- Lógica de ranking ML, consultas SQL de negocio no requeridas para validación, cambios de UI/FE, migraciones, E2E, implementación de `/interpret`/`/rank`.

## F. Procedimiento (autorizado, por etapa)
1. Alinear schema canónico V2 a `docs/audit-v2/06-contratos-definitivos.md` (campos, tipos, rangos, defaults, `requestId`).
2. **DEC-002 (APROBADA):** implementar enforcement presupuestario (`MXN`, omisión→`MXN`, moneda distinta→400, `budgetPerPerson=true`→400, `budgetMax` finito/>0/<=100000/máx 2 decimales, sin conversiones). Mantener explícito: convención MXN en datos **NO VERIFICADA** en producción.
3. **DEC-003 (APROBADA):** objetivo sin compatibilidad funcional obligatoria con rutas/contratos legacy; FE se adapta en R4. Cualquier aceptación legacy transitoria existente es deuda a retirar en módulo/etapa autorizada verificando dependencias; no adelantar FE.
4. Rechazar payloads inválidos/desconocidos (según política final) con 400 `INVALID_REQUEST` y estructura uniforme V2 (`requestId/recommendations/meta/status/safety/error`).
5. Normalizar strings/arrays (trim, lower/dedupe canónico donde aplique) sin alterar semántica de seguridad.
6. Cubrir con pruebas unitarias/integración de contrato (válidos, inválidos, límites, budget DEC-002, `locale`, `requestId`, desconocidos).

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-04, contrato `06-contratos-definitivos.md`.  
**DEC-002:** APROBADA (enforcement pendiente).  
**DEC-003:** APROBADA (sin compatibilidad funcional obligatoria legacy; FE R4; retirada por etapa autorizada).  
**Pendientes:** política final de `locale` inválido (rechazar vs default documentado) [PENDIENTE DE DECISIÓN si no se fija en implementación], y decisiones que afecten contrato (ver sección 7 de `06`).

## H. Criterios de aceptación (objetivo R1)
- [ ] Requests canónicos V2 válidos aceptados; inválidos retornan 400 envelope uniforme V2 con `INVALID_REQUEST`, `requestId` y detalles por campo/razón.
- [ ] `limit` efectivo en 1..10 reflejado en `meta.limitApplied` en todas las respuestas.
- [ ] `requestId` presente en todas las respuestas (eco/generado).
- [ ] Presupuesto conforme DEC-002 validado/rechazado según reglas aprobadas (implementación pendiente).
- [ ] Campos desconocidos tratados según política V2 (sin aceptación silenciosa ambigua).
- [ ] Ninguna restricción de entrada descartada silenciosamente sin regla documentada.
- [ ] Pruebas de validación/contrato pasan con evidencia.

## I. Pruebas
- Unit: schema válido, campos extra/desconocidos, tipos/rangos, `limit`, `locale`, `requestId`, budget DEC-002 (moneda, decimales, rango, `budgetPerPerson`).
- Integración: 400/errores uniformes V2 en endpoints de recomendación (B5/B1-T06).

## J. Evidencias
- Diffs de schemas/controladores/middleware, resultados de tests, ejemplos request/response conforme `06`.

## K. Riesgos y rollback
- **Riesgo:** romper clientes durante transición. **Mitigación (DEC-003):** no compatibilidad funcional obligatoria con legacy (entorno pruebas); adaptación FE en R4; no modificar FE en R1/R2/R3. **Rollback:** revertir cambios de tarea autorizada.

## L. Condición de cierre
- H e I satisfechos, contrato alineado a `06`, bitácora actualizada, sin cambios fuera de alcance. **R1 no se declara terminada por documentación.**

## M. Próxima tarea
- B1-T03 Consolidación de restricciones obligatorias (alineada a contrato V2).

## Actualización 2026-11-13 (especificación canónica de contrato V2, esta ejecución — documental)
- **Referencia canónica:** `docs/audit-v2/06-contratos-definitivos.md` actualizado con especificación externa R1 (request/response/errores/safety/eligibilidad), reglas DEC-002, matriz de degradación segura, separación R1/R2/R4/R5 y diferencias vs implementación.
- **Estado:** [DOCUMENTADO/PROPUESTO]. Implementación y enforcement DEC-002, envelope uniforme completo y alineación de rutas/handlers de éxito y errores **PENDIENTES** (no implementados en esta ejecución). Pruebas existentes de validación/consolidación/aislamiento siguen siendo evidencia parcial (ver bitácora/06).

### Pendientes / dependencias
- **DEC-002:** enforcement en validador/flujo pendiente; convención MXN en datos **NO VERIFICADA** en producción.
- **DEC-003:** implementación/retirada por etapa autorizada pendiente (FE R4).
- **DEC-001/004/005/006/007/008/009/010/011:** pendientes según aplique (no aprobadas por esta especificación).

### Estado final
**PARCIAL** — especificación canónica documentada; implementación/contrato ejecutable/enforcement y pruebas de contrato V2 completo pendientes. B1-T02 no cerrada.
