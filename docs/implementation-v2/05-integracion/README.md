# Bloque 5 — Integración y Validación

## Revisión de 15 solicitudes (2026-11-15)

Las respuestas y una repetición en PostgreSQL/Node/ML V2 aislados están en `docs/evidencias/demo-local-15-consultas.json`, `quality-isolated-15-consultas.json` y `calidad-15-casos.md`. Catálogos diferentes impiden atribuir diferencias directamente al código. Hay un caso positivo R3 de precio y ausencia con revocación, pruebas unitarias y una prueba integrada previa que falló por expectativa de posición de ranking. Persisten carencias de relevancia, listas, contradicciones, presupuesto textual y trazas individuales. R5 no se declara completo.

## Consulta del catálogo sintético (2026-11-15)

El catálogo DEMO de 15 restaurantes y 120 platillos se probó por HTTP contra backend, ML V2 y PostgreSQL aislados con tmpfs. Las búsquedas por camarones, pollo, barbacoa y comida china recuperaron candidatos pertinentes; las solicitudes con presupuesto/exclusión solo retornaron platillos sintéticos anteriores con evidencia R3 y señalaron datos no verificables. El catálogo nuevo no tiene confirmaciones de moneda ni receta y no se certificó automáticamente. La prueba no conecta el frontend principal a esta base y no cubre navegación, imágenes ni validación R5 completa. Véase BITACORA.

**Objetivo:** verificar coherencia end-to-end entre React, Node, ML y PostgreSQL según contratos V2 y reglas de seguridad, con evidencia reproducible.  
**Estado del bloque:** PENDIENTE (documentado; implementación/ejecución no autorizada). **Alcance inicial sin E2E.**

## Dependencias
- B1–B4 completados y autorizados por tarea (contratos V2, lógica, datos, UI alineados).
- Decisiones: DEC-001 según aplique; **DEC-002/DEC-003 APROBADAS** (presupuesto MXN, arquitectura V2 sin compatibilidad funcional obligatoria con ML v1/rutas legacy, FE adaptado en R4). DEC-004–DEC-011 según estado/aplicabilidad real (no asumir aprobadas).
- R5 valida flujos completos, regresiones, seguridad, aislamiento, errores y fallbacks controlados con las 3 interfaces sobre V2.

## Tareas
1. `01-pruebas-integracion.md` — integración de componentes, contratos, flujos feliz/degradado.
2. `02-regresiones.md` — regresiones funcionales/seguridad, aislamiento, errores ML y consistencia.
3. `03-aceptacion-final.md` — verificación de criterios globales, revisión documental y cierre.

## Principios
- Evidencia antes de marcar `CUMPLE`.
- Casos críticos de seguridad alimentaria y aislamiento son bloqueantes.
- No incluir Playwright/Cypress/Selenium/E2E en alcance inicial.
- Contrastar resultados con `docs/audit-v2/10` y contratos vigentes.

## Aplazamiento de pruebas funcionales frontend (decisión usuario, 2026-11-13)
- **Estado:** APLAZADA HASTA R4/R5 — PENDIENTE DE VALIDACIÓN INTEGRAL.
- **Alcance R5:** ejecutar la validación integral de las 3 interfaces (:3000, :3001, :3002) contra backend y ML una vez completada la adaptación en R4. Hasta entonces, las pruebas funcionales manuales de UI no se consideran fallidas de R1 ni bloquean trabajo técnico automatizable de R1/R2; su ejecución queda diferida y registrada.
