# B1-T04 — Elegibilidad y fallback seguro

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 1 — Backend y Seguridad |
| Tarea | 04 |
| Nombre | Determinación de elegibilidad y fallback seguro |
| Dependencias | B1-T01,T02,T03; B3-T01,T02 (consultas y verificabilidad, parciales); contratos B2 |
| Estado inicial | PENDIENTE |

## B. Objetivo
Implementar la decisión final de elegibilidad en Node usando datos reales de PostgreSQL y restricciones consolidadas, aplicando estados `compatible_segun_datos/incompatible/desconocido`, revalidando/saneando respuestas ML, e incorporando fallback determinista fail-closed cuando ML falle o no sea verificable.

## C. Estado actual
- **Comprobado:** Elegibilidad parcial y divergente: ML filtra/rankea; fallback BE solo excluye alergias por substring, omite dieta/negaciones y devuelve razones absolutas (`menuController.js`). No hay revalidación estricta de ids/scope/activo/precio contra DB en respuesta final ni estados de safety V2.

## D. Alcance permitido (sujeto a autorización)
- Lógica de evaluación por candidato, motor de reglas obligatorias, integración con consultas (B3), revalidación post-`/rank`, saneo de resultados parciales, fallback determinista, hidratación de respuesta desde DB, meta/status uniforme.

## E. Fuera de alcance
- Modelo ML, UI, migraciones, E2E, cambios de despliegue.

## F. Procedimiento (autorizado)
1. Obtener candidatos reales desde PostgreSQL (scope, activos, datos declarados).
2. Evaluar obligatorias por candidato: `incompatible` → excluir; `desconocido` en obligatoria → no elegible para verificado; pasar solo si todas `compatible_segun_datos` según política.
3. Enviar a `/rank` únicamente elegibles/evaluables acotados (top-K, DEC-005).
4. Revalidar `ranked`: ids conocidos, pertenencia scope, activo, precio/datos coherentes; descartar inválidos; nunca confiar datos autoritativos de ML.
5. Si ML falla/inválido o restricción obligatoria no verificable: fallback determinista seguro sobre datos estructurados verificables; si no hay verificados → `recommendations: []`, `status.code=no_verified_results`.
6. Asegurar que descartados no reaparecen; razones/disclaimers no absolutos.

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-01,03,04,05,06,07,08,09. `audit-v2/07,10`.  
**Pendientes:** DEC-005, DEC-007, DEC-008.

## H. Criterios de aceptación
- [ ] Ningún candidato `incompatible` o con obligatoria `desconocido` (en salida verificada) es recomendado.
- [ ] Candidato descartado no reaparece por ranking/fallback.
- [ ] Respuesta ML inválida/parcial se sanea; datos finales provienen de DB.
- [ ] Fallback ante fallo ML produce solo resultados verificables o vacío `no_verified_results` sin relajar reglas.
- [ ] Lenguaje sin garantías absolutas; `safety` y `meta` coherentes.
- [ ] Pruebas unitarias e integración (mocks) para casos críticos.

## I. Pruebas
- Unit: evaluación de estados, presupuesto, dieta verificable, alérgenos/exclusiones, completitud.
- Integración: ML timeout/error/ids inválidos, sin resultados, saneo parcial.

## J. Evidencias
- Matriz candidato→estados→decisión, resultados de tests, ejemplos de respuesta `ok/no_verified_results/partial_results_sanitized`.

## K. Riesgos y rollback
- **Riesgo:** regresión de recall; **Riesgo crítico:** fuga de inseguros si regla mal aplicada. **Mitigación:** fail-closed y casos de seguridad prioritarios. **Rollback:** revertir tarea.

## L. Condición de cierre
- H e I satisfechos con evidencia; revisión de seguridad de casos alimentarios crítica.

## M. Próxima tarea
- B1-T05 Aislamiento por restaurante.
## Actualización 2026-11-13 (cierre técnico/documental, esta ejecución)

### Evidencia revisada/reutilizada (no rehacer sin causa)
- **Código/rutas revisados:** `menuRoutes.js`/`menuController.js` (`createDish`, `updateDish`, `approveDishVerification`, `deleteDish`, `getDishes`), `adminController.js`, `authRoutes.js`/`authController.js`, `catalogVerification.js`, `eligibilityService.js`. Create/update conservadores (sin auto-verificación, sin heredar aprobación), recálculo de versión e invalidación de aprobación previa en cambios de receta (`update_recipe_invalidated_verification`), auditoría best-effort, `DELETE` elimina recurso, suspensión admin solo `UPDATE platillos SET activo=false` (sin mutar receta/versionado). Ownership/roles/superadmin en aprobación verificados en flujo.
- **Pruebas esta ejecución (2026-11-13):** integración PostgreSQL real `tests/integration/b1t04Postgres.integration.test.js` → **4 PASS, 0 FAIL** (`b1t04_test`, Docker). Unitarias foco `catalogVerification + eligibilityEvaluation + b1t04IntegrationFlow` → **47 PASS, 0 FAIL**. Suite unitaria completa conocida (6 archivos) → **77 PASS, 0 FAIL**.
- **Evidencia histórica válida (no re-ejecutada):** HTTP E2E `backend/test_e2e_b1t04.js` → **36 PASS, 0 FAIL** (usuario, 2026-11-13, stack Docker): login superadmin, registro/OTP Redis/verify-email/aprobación admin restaurante, login restaurante, create, approve incompleto 400, approve completo 200 con `verified_approved`/`verifiedBy`/`verifiedAt`/`verificationSource`, update receta + stale 400/409, sin token 401, cross-restaurant 403, restart backend + persistencia e invalidación.
- **DB/esquema (esta ejecución):** PostgreSQL 16.14, extensión `vector` 0.8.6, tablas B1-T04 (`alergenos_canonicos`, `alergeno_terminos`, `platillo_verificacion_auditoria`), índices/constraints públicos presentes. Docker 8/8 servicios operativos, health/connectividad básica OK.

### Criterios de aceptación (estado real, resumido)
- [x/parcial] Elegibilidad conservadora y filtrado de no elegibles/inseguros demostrados en unit/integración/E2E histórico.
- [x] Revalidación/invalidación por versión/cambio de receta y persistencia post-restart evidenciadas (E2E histórico + PG integración).
- [x] Aislamiento de aprobación (401/403/cross-tenant) evidenciado en E2E histórico.
- [x] Fallback/reglas no relajan restricciones obligatorias según evidencia ejecutada.
- [ ] Cierre formal `CUMPLE` de la tarea/bloque: pendiente consolidación final de todos los criterios documentados (incl. C2/UI admin completa si aplica), aceptación documental completa y pruebas E2E manuales UI de 3 frontends — **PENDIENTE DE EJECUCIÓN POR EL USUARIO**.

### Pruebas manuales UI (PENDIENTE DE EJECUCIÓN POR EL USUARIO)
- No ejecutadas por Kilo (prohibido navegador/E2E automatizado). Registrar resultado real: comensales (consulta menús, recomendaciones), restaurantes (login, gestión de platillos), admin/superadmin (login, consulta/aprobación restaurantes, aprobación/rechazo recetas incompletas, invalidación tras modificar receta).
- **URLs locales:** comensales `http://localhost:3000`, restaurantes `http://localhost:3002`, admin `http://localhost:3001`, API `http://localhost:4000/health`, ML `http://localhost:8000/health`.
- **Comandos PowerShell (entorno local):** `cd C:\Users\Baldo\OneDrive\Escritorio\git\menus-qr; docker compose ps; docker compose logs --tail 50 backend; docker compose logs --tail 50 ml-service`
- **Cuentas:** usar cuentas locales existentes/configuradas (p.ej. superadmin local conocido del entorno) — **sin exponer contraseñas/OTP/JWT en documentación**.

### Pendientes / dependencias
- E2E manual UI (usuario), aceptación formal/documental completa, cualquier criterio C2/UI admin fuera de evidencia técnica actual.
- DEC-005/007/008 y dependencias B2/B3 para alcance V2 completo.

### Estado final
**PARCIAL (avanzado)** — evidencia técnica crítica revalidada/válida; no `CUMPLE` hasta cierre formal y validación manual UI por usuario.

## Actualización 2026-11-13 (aplazamiento frontend R4/R5, decisión usuario)
- **Decisión registrada (usuario, revisión manual en http://localhost:3000/3001/3002):** los 3 frontends presentan fallos por falta de adaptación a modificaciones de backend/contrato.
- **Estado pruebas funcionales frontend:** APLAZADA HASTA R4/R5 — PENDIENTE DE VALIDACIÓN INTEGRAL.
- **Impacto en R1/B1-T04:** no se clasifican como fallidas de R1, no se repiten pruebas visuales ahora, no se detiene trabajo técnico, no se marca R1 incompleto **únicamente** por frontend. **No se declara R1 aceptado** si faltan criterios técnicos R1.
- **Criterio de interfaz:** cualquier requisito de interfaz obligatorio para aceptación R1 se **conserva** en el plan/criterios oficiales y su ejecución queda **diferida** a R4/R5 (sin cambiar criterios técnicos de forma unilateral). Adaptación FE → R4; validación integral 3 interfaces → R5.
