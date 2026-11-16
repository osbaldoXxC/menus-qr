# 12 — R2: Retirada física de ML V1 (DEC-003)

> Objetivo arquitectónico aprobado en DEC-003. La retirada de ML V1 **no** es una nueva decisión: está autorizada.
> Continúa desde el tercer corte (endurecimiento). No se tocan frontends (R4), ni DEC-007/011, ni el contrato externo DEC-012.

## 1. Resumen ejecutivo

Se retiró físicamente el endpoint ML V1 `POST /recommendations` y todos sus componentes exclusivos, conservando los helpers compartidos que V2 (`/interpret`, `/rank`) necesita. No existe consumidor del endpoint V1 dentro del flujo V2 (verificado estáticamente). Las suites V2 siguen en verde y el backend no se vio afectado.

## 2. Inventario de V1 — ANTES / DESPUÉS

### 2.1 `ml-service/main.py` (1038 → 547 líneas; −491 líneas V1-only)

| Componente | Clasificación | Acción |
|---|---|---|
| `@app.post("/recommendations")` + `get_recommendations` | Exclusivo V1 | **Retirado** |
| Modelos V1: `CravingInput`, `RecommendationRequest`, `DishOutput`, `RestaurantOutput`, `RecommendationItem`, `RecommendationResponse` | Exclusivo V1 | **Retirado** |
| `is_allergen_present` | Exclusivo V1 (solo lo usa `get_recommendations`) | **Retirado** |
| `is_negated_term_present` | Exclusivo V1 | **Retirado** |
| `is_diet_incompatible` | Exclusivo V1 | **Retirado** |
| `generate_reasons` | Exclusivo V1 | **Retirado** |
| `PROTEIN_MAP` | Exclusivo V1 (usado solo por funciones V1 retiradas) | **Retirado** |
| `DISH_TYPE_MAP` | Exclusivo V1 | **Retirado** |
| `ALLERGEN_MAP` | Exclusivo V1 (usado solo por `is_allergen_present`) | **Retirado** |
| `normalize_text` | **Compartido** (V2 `/interpret`, `/rank`) | **Conservado** |
| `spacy_normalize_text` | **Compartido** (vía `parse_negations`) | **Conservado** |
| `levenshtein_distance` | **Compartido** (vía `fuzzy_similarity`) | **Conservado** |
| `fuzzy_similarity` | **Compartido** (`/rank`) | **Conservado** |
| `parse_negations` | **Compartido** (`/interpret`) | **Conservado** |
| `NEGATION_PATTERNS` | **Compartido** (`parse_negations`) | **Conservado** |
| `STOP_WORDS` | **Compartido** (`/rank`, `_collect_terms_from_text`) | **Conservado** |
| `WEIGHTS` | **Compartido** (`/rank`) | **Conservado** |
| bloque spaCy (`nlp`, `SPACY_AVAILABLE`) | **Compartido** (`parse_negations`) | **Conservado** |
| `TfidfVectorizer` / `cosine_similarity` | **Compartido** (`/rank`) | **Conservado** |
| `@app.get("/health")` | Necesario (Docker healthcheck) | **Conservado** |
| `if __name__ == "__main__"` | Necesario (arranque uvicorn) | **Conservado** |
| Todo el bloque V2 (`/interpret`, `/rank`, modelos `StrictModel`, helpers) | V2 | **Conservado sin cambios** |

### 2.2 Pruebas ML

| Archivo | Antes | Acción | Después |
|---|---|---|---|
| `test_recommendations.py` (raíz) | Exclusivo V1 (`get_recommendations`, `RecommendationRequest`, `CravingInput`, `is_allergen_present`, `is_diet_incompatible`) | **Eliminado** | — |
| `tests/test_allergy_filtering.py` | Exclusivo V1 (`is_allergen_present`, `ALLERGEN_MAP`, `is_negated_term_present`) | **Eliminado** | — |
| `tests/test_diet_filtering.py` | Exclusivo V1 (`is_diet_incompatible`, `PROTEIN_MAP`, `ALLERGEN_MAP`) | **Eliminado** | — |
| `tests/test_ml_service.py` | Mixto (717 líneas): importaba 4 funcs V1 + compartidos | **Adaptado**: removidos imports V1, clases `TestAllergyFiltering`/`TestNegatedTermDetection`/`TestDietFiltering`/`TestDietFilterEdgeCases` y métodos V1 de `TestIntegration` | 276 líneas, solo funciones compartidas |
| `tests/test_r2_interpret.py` | V2 (unittest, ejecutable) | **Conservado** | sin cambios |
| `tests/test_r2_rank.py` | V2 (unittest, ejecutable) | **Conservado** | sin cambios |
| `tests/test_fuzzy_negation.py` | Solo funciones compartidas (pytest) | **Conservado** | sin cambios |
| `tests/test_tfidf_fuzzy.py` | Solo funciones compartidas (pytest) | **Conservado** | sin cambios |

> `tests/test_fuzzy_negation.py` y `tests/test_tfidf_fuzzy.py` importan `pytest` (no instalado); no se ejecutan en este entorno pero solo dependen de funciones compartidas conservadas, por lo que siguen válidas.

### 2.3 Backend / Docker / config / docs

- `backend/src/routes/publicRoutes.js`: rutas `POST /recommendations` y `/:restaurant_id/recommendations` → handlers `getGlobalRecommendations`/`getPublicRecommendations` (flujo **V2**). **Conservadas** (contrato backend activo; renombrado es DEC-012/R4, fuera de alcance).
- `backend/src/controllers/menuController.js`: solo llama a `/interpret` y `/rank` vía `callMlV2Post`. **No** referencia al endpoint ML V1. Sin cambios.
- `ml-service/Dockerfile`: `CMD uvicorn main:app`. Sin referencia a tests ni a `/recommendations`. Sin cambios.
- Frontends: llaman a la API backend `/api/public/.../recommendations` (flujo V2), **no** al ML service directamente. **No modificados** (R4).

## 3. Verificación de consumidores de V1 (estática)

| Consumidor potencial | Verificado | Resultado |
|---|---|---|
| Backend (controllers/routes/services) | ✅ estático | No consume el endpoint ML `/recommendations`; solo `/interpret`+`/rank`. Las rutas backend `/recommendations` son handlers V2. |
| Frontends (comensales/restaurantes) | ✅ estático | Llaman a API backend, no al ML service. |
| Docker/compose | ✅ estático | `ml-service` expone `main:app`; sin consumidor de `/recommendations`. |
| Tests legacy | ✅ | `test_recommendations.py`, `test_allergy_filtering.py`, `test_diet_filtering.py` eliminados; `test_ml_service.py` adaptado. |
| **Consumidor externo/3rd-party o producción** | ❌ **no verificable estáticamente** | Cualquier integración externa que llame directamente al ML service `:8000/recommendations` (fuera del repo) no puede confirmarse por inspección del repo. |

> **Limitación documentada:** la verificación de consumidores **fuera del repositorio** (sistemas externos, despliegues de producción, integraciones 3rd-party) no es posible estáticamente. Antes de cualquier despliegue que pudiera depender de `/recommendations`, se requiere un inventario operacional/runtime de integraciones externas. Per DEC-003, V2 es el objetivo y V1 no se mantiene por compatibilidad funcional; la retirada se justifica porque **no existe consumidor dentro del flujo V2**.

## 4. Pruebas ejecutadas (evidencia real)

```
# V2 suites (unittest, ejecutables) — post-retirada
cd menus-qr/ml-service
python -m unittest tests.test_r2_interpret tests.test_r2_rank
# -> Ran 85 tests ... OK

# Smoke funcional de endpoints V2
python -c "..."  # interpret() + rank() con payload simple
# -> interpret OK requestId=smoke negations=['cebolla'] allergies=['mani']
# -> rank OK ranked=[('a', 0.934)]

# Backend R2 (no afectado por la retirada del ML)
cd menus-qr/backend
node --test tests/unit/r2MlV2Integration.test.js
# -> # tests 33  # pass 33  # fail 0

# Fundo (consolidación + elegibilidad)
node --test tests/unit/restrictionConsolidation.test.js tests/unit/restrictionConsolidation.mockExtraction.test.js tests/unit/eligibilityEvaluation.test.js
# -> # tests 39  # pass 39  # fail 0  (intactas)
```

- `python -c "import main"` → OK; `/interpret`, `/rank`, `/health` presentes; `/recommendations` ausente.
- Búsqueda de símbolos V1-only en `ml-service/**/*.py` (excl. cache): **0 referencias**.

> Nota: las suites pytest (`test_fuzzy_negation`, `test_tfidf_fuzzy`, `test_ml_service`) no se ejecutan este entorno (pytest no instalado; no se instalan dependencias). Su validez tras la retirada se verificó confirmando que solo importan funciones compartidas que **sí existen** en `main.py`.

## 5. Informe breve — preparación del siguiente trabajo

### 5.1 Qué falta realmente para completar R2
1. **DEC-007 (umbrales numéricos ML)**: calibración de `confidence`/ambigüedad/score — pendiente de aprobación.
2. **DEC-011 (transición operativa)**: estrategia de transición endpoint legado → V2 — pendiente de aprobación.
3. **DEC-012 (contrato externo) — implementación**: envelope canónico (`requestId`, `recommendations`, `meta`, `status`, `safety`, `error`), normalización, códigos HTTP, `no_verified_results`. Aprobada; **implementación pendiente**.
4. **DEC-002 (presupuesto MXN) — enforcement**: validación/filtrado de `budgetMax`/`budgetCurrency`/`budgetPerPerson` y comparación contra `platillos.precio` (requiere verificación operativa de que los datos usan MXN antes de activar en producción).
5. Validación manual UI de los 3 frontends (diferida a R4/R5).

### 5.2 Tareas ejecutables sin nuevas decisiones
- Implementar el enforcement de **DEC-002** (presupuesto MXN) en el validador/consolidación/eligibilidad (decisión aprobada; sujeta a verificación operativa de moneda antes de producción).
- Implementar el **envelope canónico DEC-012** en handlers `getPublicRecommendations`/`getGlobalRecommendations` (decisión aprobada; sin cambiar rutas ni frontends este corte).
- Ampliar las suites V2 (unittest) con más casos de contrato una vez definido el envelope.
- Saneo de `mlUsed` (ver 5.5) — no requiere decisión nueva, solo aclarar semántica.

### 5.3 Tareas que necesitan aprobación explícita
- **DEC-007**: umbrales numéricos.
- **DEC-011**: transición operativa.
- Renombrado/consolidación de rutas backend legacy (`/api/public/.../recommendations`) → coordinación con frontends (R4) y contrato DEC-012.
- Activación en producción del filtro de presupuesto (requiere verificación operativa de moneda).

### 5.4 Consumidores de ML V1 que falta verificar
- **Dentro del repo**: ninguno. La verificación estática confirmó que el flujo V2 (backend) no llama al endpoint ML `/recommendations`; los frontends llaman a la API backend, no al ML service; Docker/compose no lo consumen.
- **Fuera del repo (no verificable estáticamente)**: cualquier integración externa/3rd-party o despliegue de producción que llame directamente a `ml-service:8000/recommendations`. Requiere inventario operacional/runtime antes de desplegar en un entorno donde esa dependencia pudiera existir. La retirada se ejecutó sobre la base de que **no existe consumidor dentro del flujo V2** (DEC-003).

### 5.5 `mlUsed: !!interpretOk || true` — impacto y propuesta de corrección

**Ubicación:** `recommendWithMlV2`, rama `ml_v2_empty_or_invalid_items` (cuando `/rank` respondió con forma válida pero ningún item sobrevivió la sanitización → fallback determinista).

**Problema:** la expresión `!!interpretOk || true` siempre evalúa a `true`, independientemente de `interpretOk`. Es redundante y engañosa (parece depender de `interpretOk` pero no).

**Impacto:**
- **Seguridad:** nulo. Los datos finales siguen siendo del backend y los IDs se revalidan contra el conjunto de elegibles; no se inventan recomendaciones ni hay fallback a V1.
- **Semántico/meta:** `meta.mlUsed` puede sobreafirmar "uso de ML" en esta rama. DEC-012.9 exige que `mlUsed` refleje el procesamiento real y "no indicar uso de ML cuando no ocurrió". En esta rama, ML `/rank` **sí fue contactado y respondió** (`rankOk: true` en `metaExtra`), pero no produjo el resultado final (este viene del fallback). Hay ambigüedad sobre si `mlUsed` significa "ML contactado" o "ML produjo el resultado final".

**Propuesta de corrección (no implementada — requiere aclarar semántica de producto):**
1. Definir `mlUsed` = "ML V2 produjo el resultado final (ranking utilizable)". Entonces esta rama debe ser `mlUsed: false` (el resultado es fallback), conservando `metaExtra.rankOk: true` como indicador de "ML fue contactado".
2. O definir `mlUsed` = "ML V2 fue contactado y respondió". Entonces `mlUsed: true` es correcto, pero la expresión debe reescribirse como `mlUsed: true` (explícito, sin el `|| true` redundante) con un comentario que documente que esta rama solo se alcanza tras una llamada `/rank` exitosa.
3. Recomendado: opción 1 (más honesta con DEC-012.9) — `mlUsed: false` cuando el resultado final es fallback, y exponer `mlContacted`/`rankOk` por separado para trazabilidad.

No se implementa en este cierre documental (sin modificar código de producción). Queda como tarea ejecutable sin decisión nueva una vez aclarada la semántica (5.2).

## 6. Estado tras la retirada

- **ML V1 retirado físicamente** del servicio (`/recommendations`, modelos, filtros y mapas exclusivos). Helpers compartidos y V2 intactos.
- **`/interpret` y `/rank` operativos**; `/health` conservado; **sin fallback silencioso a V1** (el backend nunca lo llamaba y el endpoint ya no existe).
- **R2 global: EN PROGRESO.** Avanzado (cortes 1–3 + retirada V1). Pendientes: DEC-007, DEC-011 (aprobación) y DEC-012/DEC-002 (implementación). No se declara R2 terminado globalmente hasta resolver los criterios pendientes.
- Sin commits/push/PR. Sin frontends. Sin dependencias instaladas. Cambios git preexistentes preservados.
