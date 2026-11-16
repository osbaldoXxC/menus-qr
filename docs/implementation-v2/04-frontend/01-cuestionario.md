# B4-T01 — Auditoría y definición del cuestionario

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 4 — Frontend |
| Tarea | 01 |
| Nombre | Cuestionario: antojo, alergias, dieta y presupuesto |
| Dependencias | B1-T02 (contrato request V2), DEC-001, DEC-002 (APROBADA), DEC-003 (APROBADA: contratos V2 sin compatibilidad funcional obligatoria legacy; FE se adapta en R4) |
| Estado inicial | PENDIENTE |

## B. Objetivo
Auditar el cuestionario actual y definir (luego implementar cuando se autorice) una captura coherente con V2: intención/antojo, alergias, dieta verificable y presupuesto (cuando aplique), eliminando campos inertes y alineando al contrato canónico.

## C. Estado actual
- **Comprobado:** `CuestionarioWizard.tsx` (5 pasos) captura `craving` (texto+tags), `diet`, `allergies`, `socialContext`; persiste en `localStorage` y navega a `/descubrir`. `socialContext` es inerte en backend/ML. Opciones de dieta incluyen valores no verificables (p.ej. `keto`) según auditoría. Dos servicios de recomendación coexisten con contratos/endpoints distintos.

## D. Alcance permitido (sujeto a autorización)
- Componentes del wizard/páginas de descubrir, servicios de recomendación FE, tipos/interfaces, validaciones de UI, mapeo a contrato canónico y retiro de campos inertes.

## E. Fuera de alcance
- Lógica de seguridad en FE, cambios backend/ML/DB, E2E, diseño visual no requerido por contrato/seguridad (salvo lo necesario para estados).

## F. Procedimiento (autorizado)
1. Contrastar UI actual con contrato `audit-v2/06` y decisiones DEC-001/002/003.
2. Definir campos visibles y obligatorios/opcionales: antojo, alergias, dieta (solo opciones verificables), presupuesto (si aplica y definido).
3. Eliminar o neutralizar `socialContext` y opciones no verificables en flujo canónico.
4. Unificar uso de servicio/endpoint según contrato y compatibilidad aprobada.
5. Validar en UI formatos básicos (sin sustituir validación BE) y manejar estados de error de request.

## G. Decisiones arquitectónicas
**Respetar:** Frontend no autoritativo; no afirmar seguridad; contrato canónico.  
**Pendientes:** DEC-001 (copy), DEC-002 (moneda/formato presupuesto), DEC-003 (endpoint/versión).

## H. Criterios de aceptación
- [ ] Request enviado coincide con contrato canónico (o mapeo aprobado).
- [ ] No se envían campos inertes como obligatorios funcionales (`socialContext` retirado o ignorado según transición).
- [ ] Dietas mostradas como verificables/compatibles según política aprobada.
- [ ] Presupuesto capturado con formato definido o marcado pendiente si DEC-002 no resuelto.
- [ ] Sin lógica de filtrado de seguridad en FE.

## I. Pruebas
- Unit/component (autorizado, sin E2E): render de pasos, validaciones de formulario, payload generado, manejo de errores.

## J. Evidencias
- Capturas o descripciones de payloads, resultados de tests, diff de componentes/servicios.

## K. Riesgos y rollback
- **Riesgo:** confusión de usuario o ruptura de flujo. **Mitigación:** copy claro y compatibilidad. **Rollback:** revertir tarea.

## L. Condición de cierre
- H cumplido y alineación con contrato BE verificada.

## M. Próxima tarea
- B4-T02 Estados y presentación de resultados.

## Aplazamiento y preparación R4 (decisión usuario, 2026-11-13)
- **Pruebas funcionales frontend:** APLAZADA HASTA R4/R5 — PENDIENTE DE VALIDACIÓN INTEGRAL. No ejecutar ni repetir validación visual/funcional de UI en R1/R2.
- **R4 (adaptación requerida, sin implementar ahora):** alinear wizard/request al contrato BE→FE/BE↔ML definitivo (payload canónico craving/restrictions/options, equestId/limit/locale, mapeo legacy según DEC-003), retirar/neutralizar socialContext y dietas no verificables (keto) según política, unificar servicios/endpoints de recomendación, reflejar estados/errores uniformes. Inspección de contratos actual sugiere brechas: servicios FE coexisten y usan contratos/endpoints distintos al objetivo V2; backend acepta canónico+legacy pero respuesta de éxito aún no es contrato V2 completo uniforme.
- **R5:** validación integral de las 3 interfaces con backend+ML tras adaptación R4.
