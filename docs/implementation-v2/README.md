# Guía documental — Implementación V2 (MexxicanMX)

**Ubicación:** `menus-qr/docs/implementation-v2/`  
**Propósito:** fuente de verdad documental para ejecutar progresivamente la implementación de la arquitectura V2 del sistema de recomendaciones (sin implementar en esta fase).  
**Estado de esta carpeta:** documentación creada en modo auditoría/solo lectura (ver `BITACORA.md`). **No autoriza** modificaciones de código, DB, configuración ni operaciones Git destructivas.

## 1. Propósito
- Traducir hallazgos y diseño de `docs/audit-v2/` (contrastados con código real) en un plan ejecutable por fases, tareas y criterios de aceptación verificables.
- Permitir retomar el trabajo sin perder contexto, restricciones, dependencias ni decisiones.
- Diferenciar hechos comprobados, propuestas, decisiones aprobadas y elementos **NO VERIFICADO**.

## 2. Navegación
| Documento / Carpeta | Contenido |
|---|---|
| `README.md` | Índice, reglas de uso, retoma, registro de avances y autorización |
| `00-plan-maestro.md` | Objetivo V2, arquitectura/flujo, responsabilidades, dependencias, roadmap, decisiones, riesgos y criterios generales |
| `BITACORA.md` | Registro de hechos comprobados (fecha, fase, tarea, estado, evidencias, decisiones, autorización) |
| `01-backend-seguridad/` | Bloque 1: validación, consolidación de restricciones, elegibilidad, fallback, aislamiento, pruebas |
| `02-machine-learning/` | Bloque 2: `/interpret`, `/rank`, contratos, scoring, errores/fallback y límites del modelo |
| `03-base-datos/` | Bloque 3: consultas/candidatos, verificabilidad alimentaria, integridad y necesidades de migración (sin ejecutar migraciones) |
| `04-frontend/` | Bloque 4: cuestionario, estados conocido/desconocido/no verificable, resultados y mensajes de seguridad |
| `05-integracion/` | Bloque 5: pruebas unitarias/integración/contratos, casos críticos, regresiones y aceptación final (sin E2E en alcance inicial) |

## 3. Orden de ejecución (bloques)
**Oficial:** 1) Backend y seguridad → 2) Machine Learning → 3) Base de datos → 4) Frontend → 5) Integración y validación.
- Dependencias técnicas pueden justificar ajustes en el orden de **tareas**, pero **no** en el orden de **bloques** sin documentar, justificar y obtener autorización explícita.
- **Primera implementación autorizable (cuando se autorice):** Bloque 1. Bloques 2–5 quedan documentados y **pendientes de autorización**.

## 4. Cómo retomar el trabajo (obligatorio antes de cualquier sesión)
1. Leer `docs/implementation-v2/README.md`.
2. Leer `00-plan-maestro.md`.
3. Leer el `README.md` del bloque correspondiente.
4. Leer el documento de la tarea actual.
5. Consultar `BITACORA.md`.
6. Comprobar el estado real de Git (`status`, rama, staged/unstaged, untracked, commits recientes).
7. Verificar que las decisiones documentadas siguen siendo compatibles con el código real (contrastar `docs/audit-v2/` y código).
8. Identificar la **última tarea autorizada** y su evidencia.
9. **No asumir** que una tarea está terminada porque aparezca marcada en un documento.
10. **No continuar** si existe contradicción importante entre documentación y código: detenerse y registrar.

## 5. Cómo registrar avances (después de cada tarea autorizada)
- Registrar solo hechos ocurridos: archivos **realmente** modificados, pruebas **ejecutadas** (comandos/resultados), desviaciones, actualización de criterios y estado con evidencia.
- Actualizar `BITACORA.md` (fecha, fase, tarea, estado, archivos, pruebas, resultados, decisiones nuevas, pendientes, autorización recibida).
- Detenerse y **esperar autorización** para la siguiente tarea.

## 6. Estados permitidos
`PENDIENTE`, `EN AUDITORÍA`, `BLOQUEADA`, `LISTA PARA AUTORIZACIÓN`, `AUTORIZADA`, `EN IMPLEMENTACIÓN`, `EN VALIDACIÓN`, `CUMPLE`, `PARCIAL`, `NO CUMPLE`, `NO VERIFICADO`.  
- No marcar `CUMPLE` sin evidencias. No avanzar automáticamente a la siguiente tarea.

## 7. Cómo consultar decisiones y reutilizar auditorías
- Confirmadas/pendientes y matriz: `00-plan-maestro.md` y `docs/audit-v2/09-decisiones-finales.md` (**DEC-002/DEC-003/DEC-012 APROBADAS 2026-11-13**; DEC-001,004–011 conservan estado actual: DEC-001/004–010 pendientes, DEC-011 propuesta no aprobada). DEC-003: arquitectura V2 y separación R1–R5. DEC-012: contrato externo canónico del recomendador V2 (rutas/request/normalización/envelope éxito-error/sin resultados verificables/safety/meta/degradación segura ML), **implementación PENDIENTE**. No declara implementación.
- **Línea base histórica y técnica:** las auditorías de `docs/audit-v2/` son la línea base histórica y técnica del proyecto. **Ninguna tarea debe repetir una auditoría ya realizada** salvo que exista evidencia de cambios posteriores, contradicciones o información insuficiente. Las tareas deben **reutilizar sus hallazgos** y concentrarse en implementar y verificar las correcciones pendientes.

## 8. Reglas de autorización y protección del repositorio
- Los documentos son **guía de control, no autorización permanente**.
- **Prohibido sin autorización explícita:** implementar funcionalidades, modificar código/config/contratos en ejecución/DB, migraciones, instalar dependencias, ejecutar pruebas que alteren estado o E2E, cambiar de rama, `checkout/reset/restore/clean/rebase/merge/commit/push`, eliminar/sobrescribir archivos existentes, modificar los 9 archivos tracked preexistentes o untracked preexistentes.
- Si un archivo a crear ya existe o hay conflicto con trabajo previo: **detenerse y reportar**.
- Principios: frontend no es fuente de confianza; **Node aplica restricciones y elegibilidad**; ML no decide seguridad alimentaria; no relajar restricciones obligatorias; error/timeout de ML nunca produce recomendación insegura; sin filtración cross-tenant; datos no verificables no se presentan como seguros.

## 9. Referencias base (solo lectura)
- `docs/audit-v2/00-inventario-arquitectura.md` … `10-flujo-definitivo-y-errores.md`
- `../audit-report.md` (workspace) — consolidado de auditoría
- Código contrastado: `backend/src/controllers/menuController.js`, `backend/src/routes/publicRoutes.js`, `backend/src/index.js`, `backend/src/middleware/*`, `ml-service/main.py`, `ml-service/tests/*`, `frontend-comensales/src/features/recommendations/*`, `frontend-comensales/src/services/recommendation*.ts`, `backend/src/db/init.sql`, `db/contract/schema.json`

> La documentación de auditoría es referencia de diseño; el estado real del código puede diferir y debe verificarse antes de implementar.
