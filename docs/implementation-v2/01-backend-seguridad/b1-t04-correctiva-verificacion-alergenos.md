# B1-T04 Correctiva â€” VerificaciÃ³n de alÃ©rgenos, catÃ¡logo y elegibilidad (implementaciÃ³n parcial/integrada)

Estado: **PARCIAL** (servicios, integraciÃ³n en cÃ³digo y pruebas unitarias/flujo aprobadas; persistencia en BD real, UI admin completa y aprobaciÃ³n autorizada **NO VERIFICADAS/BLOQUEADAS**). Sin B1-T05.

## Componentes implementados

- `backend/src/services/allergenCatalog.js`: catÃ¡logo canÃ³nico (14 alÃ©rgenos base) y resoluciÃ³n determinista con procedencia documentada (`catalogo_base_documentado_b1t04`): normalizaciÃ³n, sinÃ³nimos/variantes, derivados/compuestos documentados (`resolveAllergensForTerm`, `resolveAllergenSet`). TÃ©rminos no mapeables/no documentados no generan equivalencias.
- `backend/src/services/catalogVerification.js`: `computeRecipeVersion`, completitud por secciones (`complete|incomplete|not_applicable_declared|pending_verification`, vacÃ­o no declarado â‡’ conservador incompleto), estados de verificaciÃ³n (`declared_unverified|reviewed|verified_approved|outdated|invalidated_by_change|conflict`) con invalidaciÃ³n por cambio de versiÃ³n, contacto cruzado (`verified_controlled|possible|unknown|not_assessed`), evaluaciÃ³n por alÃ©rgeno (`contains|may_contain|verified_absent|unknown`) y `buildConservativeVerificationMetadata` (nunca auto-verifica).
- `backend/src/services/eligibilityService.js`: evaluaciÃ³n de restricciones sobre evidencia de verificaciÃ³n/catÃ¡logo. `contains/may_contain` â‡’ incompatible para evitar; `verified_absent` â‡’ `compatible_segun_datos` solo si emitido por verificaciÃ³n vÃ¡lida; `unknown` â‡’ no elegible. Dietas requieren evidencia verificada aprobada vigente y explÃ­cita (`dietEvidence`) o quedan `desconocido`. Contradicciones/ambigÃ¼edad/extracciones no verificables bloquean; restricciones estructuradas pendientes se evalÃºan contra catÃ¡logo. ExclusiÃ³n no mapeable a alÃ©rgeno: presencia declarada â‡’ incompatible; ausencia no demostrable â‡’ `desconocido`.
- `backend/src/controllers/menuController.js`: normalizaciÃ³n de platillos, carga con metadatos para evaluaciÃ³n, `getPublicRecommendations/getGlobalRecommendations` ejecutan validaciÃ³nâ†’consolidaciÃ³nâ†’evaluaciÃ³nâ†’filtrado de resultados ML contra conjunto elegibleâ†’fallback determinista solo elegibles. `createDish/updateDish` persisten metadatos conservadores, recalculan versiÃ³n, invalidan verificaciÃ³n previa en cambios de receta/catÃ¡logo y registran auditorÃ­a best-effort; `getDishes` expone resumen de verificaciÃ³n. Compatibilidad defensiva si faltan columnas de migraciÃ³n.
- MigraciÃ³n aditiva: `backend/src/db/migrations/20261111_b1t04_catalog_verification.sql` (catÃ¡logo canÃ³nico/terminos, columnas de verificaciÃ³n en `platillos`, auditorÃ­a `platillo_verificacion_auditoria`, semillas idempotentes). **No ejecutada en BD.**

## Reglas de seguridad (implementadas en lÃ³gica)

- Ausencia textual/coincidencia faltante no implica `verified_absent`.
- `verified_absent` requiere: receta completa declarada suficiente, `verification_state` aprobado y versiÃ³n verificada == versiÃ³n actual, compuesto resuelto, contacto cruzado `verified_controlled`, sin conflictos, y assessments explÃ­citos por tÃ©rmino/alÃ©rgeno (`ingredientAllergenAssessments`) que evidencien ausencia verificada (modelo conservador, evita falsos negativos por ingredientes no documentados).
- `may_contain` y contacto cruzado `possible` bloquean elegibilidad para evitar alÃ©rgeno.
- Secciones no declaradas o incompletas, compuesto sin desglose, conflicto, verificaciÃ³n ausente/desactualizada/invalida/no aprobada â‡’ `unknown`/no elegible.
- Registros histÃ³ricos/nuevos: conservadores, no auto-verificados. ActualizaciÃ³n invalida verificaciÃ³n y no hereda aprobaciÃ³n.
- ML no autoritativo: recomendaciones ML se filtran contra elegibles calculados en Node; fallback solo elegibles.

## Flujo administrativo y permisos

- Backend: create/update acepta campos de receta/verificaciÃ³n extendidos y fuerza estado conservador (invalidaciÃ³n/versionado/auditorÃ­a best-effort). No se expone endpoint de aprobaciÃ³n verificada.
- UI `frontend-restaurantes`: **no integrada** para gestionar completitud por secciones, compuestos, contacto cruzado, assessments, evidencia dietÃ©tica, responsable/aprobaciÃ³n ni distinciÃ³n completa declarado vs aprobado.
- AprobaciÃ³n/verificaciÃ³n formal: **bloqueada** por falta de capacidad/autorizaciÃ³n explÃ­cita comprobada y flujo de evidencias; no se creÃ³ bypass.

## Pruebas (evidencia ejecutada)

- `catalogVerification.test.js`: 17 PASS (catÃ¡logo, estados, completitud, contacto cruzado, compuestos, conflictos, invalidaciÃ³n, negativos).
- `eligibilityEvaluation.test.js`: 13 PASS (integrado con evidencia verificada, incompatibilidades, desconocido conservador, dieta sin evidencia, contradicciÃ³n, mÃºltiples restricciones, exclusiones, fallback vacÃ­o/parcial, prevenciÃ³n incompatibles, trazabilidad/requestId, contacto cruzado posible e invalidaciÃ³n).
- `b1t04IntegrationFlow.test.js`: 15 PASS (negativos: derivado, compuesto no resuelto, secciones incompletas/no declaradas, contradicciÃ³n, receta invalidada/cambiada, contacto cruzado unknown/not_assessed/possible, no aprobado/sin responsable, ML no elegible y fallback sin desconocidos, dieta sin evidencia vigente; positivos: verificado completo con assessments, compuesto desglosado verificado, ausencia verificada vigente; integral: CatÃ¡logoâ†’VerificaciÃ³nâ†’Elegibilidadâ†’Filtrado MLâ†’Fallbackâ†’Respuesta sin no elegibles y fallback sin completar lÃ­mite).
- Conjunto combinado: **72 PASS, 0 FAIL** (`catalogVerification + eligibilityEvaluation + b1t04IntegrationFlow + restrictionConsolidation + recommendationValidation`).
- No ejecutado: pruebas HTTP/DB contra Postgres, migraciÃ³n aplicada, E2E/navegador.

## Limitaciones y bloqueos

- MigraciÃ³n aplicada y esquema sincronizado en entorno local Docker (ver C1/C1-F); validaciÃ³n en otros entornos/BD objetivo sigue sujeta a ejecuciÃ³n controlada.
- Sin assessments explÃ­citos y aprobaciÃ³n vigente por receta/alÃ©rgeno, platillos no pueden ser `verified_absent` (conservador) aunque no haya match textual.
- Dietas: requieren `dietEvidence` verificada y aprobada (no generada por flujo admin actual).
- Decisiones pendientes (DEC-002/003/007/008/009/011) y contrato pÃºblico V2 de estados/detalles no modificados.



## Actualizacion 2026-11-13 (ETAPA A, E2E ejecutado por usuario)
- **Flujo/endpoint:** POST /api/menu/platillos/:id/verify-approve (pproveDishVerification, auth+roles RESTAURANTE/SUPER_ADMIN) con validacion de ownership/SUPER_ADMIN, version vigente (computeRecipeVersion), completitud/conservadurismo de metadata; persiste aprobacion (erification_state=verified_approved, erified_recipe_version, erified_by, erified_at, erification_source) y auditoria best-effort.
- **Evidencia HTTP E2E (ackend/test_e2e_b1t04.js, 36 PASS, 0 FAIL):** flujo real admin+restaurante (login superadmin, registro, OTP Redis, verify-email, aprobacion admin restaurante, login restaurante), create dish, approve incompleto 400, approve completo 200, modificacion receta + stale 400/409, sin token 401, otro restaurante 403, restart backend + persistencia e invalidacion post-cambio.
- **Correcciones:** export collectAllRelevantIngredientEntries/esolveCompound en catalogVerification.js; normalizacion contacto_cruzado como objeto en menuController.normalizeDishForEvaluation.
- **Invalidacion revisada:** createDish conservador/no verificado; updateDish recalcula version e invalida aprobacion previa (limpia verified fields, estado conservador, auditoria). DELETE elimina recurso. Admin solo ctivo en suspension.
- **Regresion:** unitarias 77/77 PASS (host), B1-T04 foco 47/47 PASS. Integracion PostgreSQL 4/4 PASS es evidencia previa no re-ejecutada esta sesion.
- **Estado:** **PARCIAL (avanzado)**. Flujo critico E2E aprobado; pendiente revalidacion integracion PG en corrida actual y cualquier cierre documental/formal adicional.

