# B3-T01 — Consultas y selección de candidatos

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 3 — Base de Datos |
| Tarea | 01 |
| Nombre | Consultas de candidatos (acotadas y seguras) |
| Dependencias | B1-T04,T05; DEC-005, DEC-010 |
| Estado inicial | PENDIENTE |

## B. Objetivo
Definir e implementar (cuando se autorice) consultas SQL que obtengan candidatos reales, mínimos y acotados por `scope`, activos y disponibles, con soporte a filtros verificables y eficiencia suficiente, sin exponer datos cross-tenant.

## C. Estado actual
- **Comprobado:** Consultas en `menuController.js` seleccionan platillos activos por restaurante o globalmente (`r.suscripcion_activa=true`) con joins a categoría/restaurante; global sin límite/top-K en DB y envía conjunto amplio a ML. Índices efectivos y planes de ejecución **NO VERIFICADOS**.

## D. Alcance permitido (sujeto a autorización)
- Ajustes de queries en capa backend/DB access, parámetros de acotación (top-K), filtros deterministas en SQL cuando sean verificables, revisión de índices necesarios (documentar; crear solo si autorizado).

## E. Fuera de alcance
- Migraciones no autorizadas, cambios de esquema, acceso ML directo a DB.

## F. Procedimiento (autorizado)
1. Definir criterios de selección por scope (restaurante/global) y campos mínimos requeridos para elegibilidad/ranking.
2. Introducir acotación (LIMIT/top-K, pre-filtros) alineada a DEC-005 sin sesgar seguridad.
3. Asegurar filtros obligatorios en SQL: `restaurante_id` (cuando aplique), `activo`, disponibilidad.
4. Evaluar necesidad de índices (precio, restaurante_id, activo, categoría) y documentar; aplicar solo con autorización.
5. Medir/validar comportamiento con datos de prueba controlados (NO producción).

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-02,05,08; aislamiento B1-T05.  
**Pendientes:** DEC-005, DEC-006, DEC-010.

## H. Criterios de aceptación
- [ ] Consultas retornan solo candidatos del scope solicitado y activos/disponibles.
- [ ] Volumen enviado a ML acotado según política definida.
- [ ] No hay regresión de aislamiento cross-tenant.
- [ ] Rendimiento aceptable en escenario de prueba documentado (o NO VERIFICADO si no medible).

## I. Pruebas
- Integración: resultados por scope, límites, ausencia de datos ajenos; revisión de parámetros SQL.

## J. Evidencias
- Queries finales, planes/tiempos si se miden, resultados de pruebas.

## K. Riesgos y rollback
- **Riesgo:** excluir candidatos relevantes o degradar rendimiento. **Mitigación:** top-K conservador y pruebas. **Rollback:** revertir consultas de tarea.

## L. Condición de cierre
- H cumplido con evidencia o NO VERIFICADO explícito en métricas.

## M. Próxima tarea
- B3-T02 Verificabilidad alimentaria.
