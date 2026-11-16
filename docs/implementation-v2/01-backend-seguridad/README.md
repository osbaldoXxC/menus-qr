# Bloque 1 — Backend y Seguridad

**Objetivo:** establecer una capa backend segura que controle solicitudes, consolide restricciones, determine elegibilidad de platillos y entregue respuestas verificables sin relajar seguridad ante fallos.  
**Estado del bloque:** PENDIENTE (documentado; implementación no autorizada). **Primera implementación autorizable futura:** Tarea 01 (solo tras autorización explícita).

> **Línea base:** las auditorías de `docs/audit-v2/` son la línea base histórica y técnica. Las tareas de este bloque **no repiten auditorías ya realizadas** salvo evidencia de cambios posteriores, contradicciones o información insuficiente; deben reutilizar hallazgos y concentrarse en implementar y verificar correcciones pendientes.

## Dependencias y orden de tareas
| Tarea | Depende de | Habilita |
|---|---|---|
| 01 Contraste y verificación de vigencia (auditoría backend) | Ninguna (reutiliza `audit-v2`, solo delta) | 02–06 |
| 02 Validación de solicitudes entrantes | 01, DEC-002/003 (parcial) | 03, 04, 05 |
| 03 Consolidación de restricciones | 01, 02, B2 contratos (parcial) | 04, 05 |
| 04 Elegibilidad y fallback seguro | 01–03, B3 consultas (parcial) | 05, 06, B5 |
| 05 Aislamiento por restaurante | 01, 02 | 06, B5 |
| 06 Pruebas y aceptación | 01–05 | Cierre B1 |

> Ajustes de orden entre tareas permitidos si se justifican por dependencia técnica real y se documentan; no cambiar orden de bloques.

## Principios obligatorios (no negociables)
- Frontend no es fuente de confianza.
- Node aplica restricciones y determina elegibilidad; ML no decide seguridad alimentaria.
- Platillo no verificable no se presenta como seguro (`desconocido` ≠ compatible).
- Error/timeout/invalidación de ML nunca produce recomendación insegura ni relaja restricciones.
- Sin filtración cross-tenant; sin relajar restricciones obligatorias para "conseguir resultados".
- Respuestas/datos finales de catálogo hidratados desde PostgreSQL; ML no autoritativo.

## Tareas
1. `01-auditoria-inicial.md` — contraste con `audit-v2` y verificación de vigencia/delta (no repetir auditoría).
2. `02-validacion-solicitudes.md` — schema, normalización de borde, límites, errores.
3. `03-consolidacion-restricciones.md` — estructuradas+texto, ambigüedad, contradicciones, no omisión silenciosa.
4. `04-elegibilidad-y-fallback.md` — estados, filtros obligatorios, fallback fail-closed, revalidación.
5. `05-aislamiento-restaurantes.md` — scope, tenancy, controles global.
6. `06-pruebas-y-aceptacion.md` — criterios, casos unitarios/integración/seguridad (sin E2E).

## Fuera de alcance del bloque (hasta autorización)
- Migraciones DB, cambios de despliegue, E2E, implementación de UI, modificación de 9 archivos tracked/untracked preexistentes o de código fuera del alcance autorizado por tarea.
