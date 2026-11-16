# B1-T05 — Aislamiento por restaurante

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 1 — Backend y Seguridad |
| Tarea | 05 |
| Nombre | Aislamiento por restaurante (multi-tenant) |
| Dependencias | B1-T01,T02; B3-T01 (consultas por scope) |
| Estado inicial | PENDIENTE |

## B. Objetivo
Garantizar que toda recomendación, candidato, ranking y respuesta se limite al `scope` autorizado (restaurante específico o global definido), impidiendo filtración de datos entre restaurantes y validando existencia/estado del restaurante.

## C. Estado actual
- **Comprobado:** `getPublicRecommendations` resuelve restaurante (UUID/slug/nombre) y filtra platillos por `p.restaurante_id = $1` y `activo=true`, validando `suscripcion_activa` (404/403). `getGlobalRecommendations` agrega platillos de restaurantes con `suscripcion_activa=true` (alcance global público por diseño actual). Consultas SQL parametrizadas en este flujo.
- **NO VERIFICADO:** controles de abuso/rate-limit específicos, comportamiento bajo concurrencia/caché cross-scope, y todos los caminos de error.

## D. Alcance permitido (sujeto a autorización)
- Validación estricta de `scope/restaurantId`, endurecimiento de consultas y revalidación de pertenencia en respuestas ML, controles específicos de endpoint global (según DEC-004/010), pruebas de aislamiento.

## E. Fuera de alcance
- Cambios de modelo de autenticación de usuarios finales, migraciones, UI, E2E.

## F. Procedimiento (autorizado)
1. Normalizar `scope` canónico y rechazar scopes inválidos.
2. Forzar filtros por `restaurante_id`/`activo`/disponibilidad en todas las consultas y en revalidación post-ML.
3. En global, limitar dominio a restaurantes/platillos permitidos y acotar volumen (DEC-005/010).
4. Asegurar que caché (si existe, DEC-006) sea por scope/clave segura y no mezcle tenants.
5. Verificar con casos de acceso cruzado, ids ajenos devueltos por ML y restaurante inexistente/inactivo.

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-05,08; contrato `scope` en `06/10`.  
**Pendientes:** DEC-004, DEC-005, DEC-006, DEC-010.

## H. Criterios de aceptación
- [ ] Endpoint por restaurante nunca retorna platillos/restaurantes fuera del `restaurantId` resuelto.
- [ ] Ids devueltos por ML fuera de candidatos/scope son descartados.
- [ ] Restaurante inexistente → 404; no disponible/inactivo → 403 (según contrato).
- [ ] Endpoint global respeta alcance definido y no expone datos no permitidos.
- [ ] Pruebas de aislamiento pasan con evidencia.

## I. Pruebas
- Integración: restaurante válido, id ajeno en respuesta ML, slug/uuid inexistente, inactivo, global acotado.
- Unit: resolución/validación de scope.

## J. Evidencias
- Consultas/condiciones revisadas, resultados de pruebas, ejemplos 404/403 y respuestas saneadas.

## K. Riesgos y rollback
- **Riesgo:** fuga cross-tenant o denegación excesiva. **Mitigación:** filtros en DB y revalidación BE. **Rollback:** revertir tarea.

## L. Condición de cierre
- H e I cumplidos; sin rutas que omitan filtro de scope.

## M. Próxima tarea
- B1-T06 Pruebas y aceptación del bloque.
## Actualización 2026-11-13 (cierre técnico/documental, esta ejecución)

### Evidencia revisada (reutilizada, sin repetir auditorías sin delta)
- **Endpoint por restaurante (`getPublicRecommendations`):** resuelve `restaurant_id` por UUID o slug/nombre/id-texto, valida existencia (`404` si no encontrado) y `suscripcion_activa` (`403` si no disponible), consulta platillos con `WHERE p.restaurante_id = $1 AND p.activo = true` (parámetros SQL), aplica validación de entrada, consolidación, evaluación de elegibilidad y filtrado contra elegibles; hidratación de datos de platillo desde DB en flujo.
- **Endpoint global (`getGlobalRecommendations`):** limita a `p.activo = true AND r.suscripcion_activa = true` con joins parametrizados implícitos (sin interpolación de input en consulta mostrada), aplica misma cadena de validación/consolidación/elegibilidad.
- **Controles autenticados de menú:** rutas `/api/menu` con auth/roles/suscripción/ownership; `approveDishVerification` y operaciones CRUD restringidas por restaurante/rol (evidencia histórica HTTP E2E: 401 sin token, 403 cross-restaurant). Admin suspensión solo cambia `activo`.
- **Pruebas relacionadas ejecutadas 2026-11-13:** suite unitaria backend **77 PASS, 0 FAIL** (incluye consolidación/validación/elegibilidad); integración PG **4 PASS, 0 FAIL**; E2E histórico **36 PASS, 0 FAIL** con casos de autorización/cross-tenant en aprobación. No se identificó suite dedicada de aislamiento V2 de recomendador.

### Criterios de aceptación (estado real)
- [x/parcial] Endpoint por restaurante acotado a restaurante resuelto y activos/disponibles según consultas/flujo observado.
- [x/parcial] Controles de acceso/ownership en operaciones autenticadas y aprobación evidenciados (401/403/cross-restaurant).
- [ ] Revalidación exhaustiva de ids/scope en respuestas ML para recomendador público (descartar ids ajenos a candidatos/scope en todos los caminos): **NO VERIFICADO** con pruebas dedicadas en esta corrida.
- [x/parcial] Restaurante inexistente/no disponible: 404/403 presentes en lógica; cobertura contractual completa: **NO VERIFICADO**.
- [ ] Endpoint global con controles de alcance/abuso/top-K/caché por scope formalmente verificados: **NO VERIFICADO/PENDIENTE** (DEC-004/005/006/010).
- [ ] Pruebas de aislamiento dedicadas pasan con evidencia integral: **NO CUMPLE** (faltan casos/suite).

### Pendientes / dependencias
- Diseñar/ejecutar pruebas unitarias/integración de aislamiento recomendador: id ajeno devuelto por ML, scope inválido, global acotado, no mezcla cross-tenant, caché segura por scope (si aplica).
- **DEC-004, DEC-005, DEC-006, DEC-010** pendientes.
- Validación funcional UI multi-tenant manual: **PENDIENTE DE EJECUCIÓN POR EL USUARIO**.

### Estado final
**PARCIAL / NO VERIFICADO** — mitigaciones de scope/ownership y filtros DB presentes con evidencia parcial; faltan pruebas y controles completos de aislamiento V2 para cierre.

## Actualización 2026-11-13 (continuación técnica, esta ejecución - evidencia nueva)
- **Prueba de integración creada y ejecutada (PostgreSQL real, Docker, mock de ML vía axios para determinismo, sin ML real):** `backend/tests/integration/b1t05Isolation.integration.test.js` → **4 PASS, 0 FAIL**.
  - Recomendación por restaurante no expone platillos de otro restaurante en fallback seguro (scope/`restaurant_id` coherente).
  - Restaurante inexistente → **404**; restaurante no disponible (`suscripcion_activa=false`) → **403**.
  - Respuesta ML con `dish.id` ajeno al scope del restaurante solicitado se filtra y no se expone cross-tenant (solo ids elegibles del scope).
  - Respuesta ML con id desconocido/inexistente se descarta sin inventar ni exponer datos.
- **Alcance cubierto:** filtros DB por `restaurante_id`/`activo` + validación de restaurante, y revalidación/saneo básico por conjunto elegible en respuesta ML (ids fuera de candidatos elegibles descartados).
- **Pendientes NO cerrados:** validación de `scope` canónico formal en contrato V2, rehidratación completa desde DB de campos autoritativos en todos los caminos ML (se observa pass-through de items saneados), endpoint global controles anti-abuso/top-K/caché por scope y pruebas dedicadas adicionales, rate-limit específico recomendador/global (**DEC-004/005/006/010**). Validación UI multi-tenant **PENDIENTE DE EJECUCIÓN POR EL USUARIO**.
- **Estado:** **PARCIAL** — evidencia de aislamiento mejorada con integración automatizada; no `CUMPLE` integral.
