# Bloque 3 — Base de Datos

## Evidencia sintética aislada (2026-11-15)

`quality-evidence.test.cjs` creó un platillo exclusivamente en `r3_test_isolated` y confirmó precio MXN exacto y ausencia de cerdo mediante dueño sintético autenticado y contratos R3 reales. Ambos endpoints lo devolvieron con presupuesto y exclusión; tras revocar la ausencia, el endpoint del restaurante dejó de devolverlo. No se certificaron históricos ni se modificó la base principal. No implica que las 15 consultas tengan datos suficientes ni que R3 esté completo.

## Catálogo sintético aislado (2026-11-15)

`backend/tests/integration/r3-isolated/demo-catalog.cjs` carga exclusivamente en `r3_test_isolated` y exige que todos los correos existentes terminen en `@example.invalid`. Usa IDs estables, transacción, comprobación de colisiones y `ON CONFLICT DO NOTHING`; dos ejecuciones dejaron 15 restaurantes y 120 platillos DEMO, sin imágenes. La base usa tmpfs y no tiene puertos publicados; no es la base principal ni un catálogo persistente de desarrollo. No se crearon evidencias R3 para moneda, receta, alérgenos o trazas, ni se certificaron datos de establecimientos reales. Los precios e ingredientes son sintéticos. Faltan fotografías pertinentes con licencia y procedencia, y evidencias sintéticas explícitas por contrato R3 si se requieren casos positivos de presupuesto o exclusión para estos nuevos platillos.

**Objetivo:** garantizar consultas acotadas y datos suficientes (según disponibilidad real) para determinar elegibilidad y soportar ranking, preservando integridad y aislamiento.  
**Estado del bloque:** PENDIENTE (documentado; **no autoriza migraciones**).

## Dependencias
- B1: reglas de elegibilidad/estados y necesidades de filtrado.
- B2: atributos requeridos por interpretación/ranking.
- Decisiones: DEC-005 (top-K), DEC-008 (completitud), datos de producción **NO VERIFICADOS**.

## Estado real (comprobado)
- `backend/src/db/init.sql`, `db/contract/schema.json`: `platillos` con `ingredientes_principales`, `complementos`, `etiquetas_dieteticas` (JSONB), `precio`, `activo`, `restaurante_id`; catálogos (`ingredientes_catalogo`, `sabores_catalogo`, `receta_platillo`) existen pero integración con recomendador **NO VERIFICADA**. Sin bandera de completitud ni declaración de contaminación cruzada.

## Tareas
1. `01-consultas-y-candidatos.md` — selección acotada, filtros por scope, eficiencia e integridad de consulta.
2. `02-verificabilidad-alimentaria.md` — datos necesarios para estados, brechas del esquema y necesidades aditivas de migración (documentadas, no ejecutadas).

## Principios
- PostgreSQL es fuente de verdad; no inferir compatibilidad no registrada.
- Cambios de esquema solo aditivos/compatibles y **únicamente con autorización y plan de migración** (fuera de esta documentación).
- Fail-closed ante datos incompletos/no verificables.
