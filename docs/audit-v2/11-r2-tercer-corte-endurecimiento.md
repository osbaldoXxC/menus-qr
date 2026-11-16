# R2 — TERCER CORTE: Endurecimiento, validación y resiliencia de ML V2

> Continúa R2 desde los dos cortes ya implementados. No se reiniciaron endpoints ni se re-auditó R1.
> Este corte amplía pruebas, revisa resiliencia y clasifica referencias de ML V1. **No se elimina nada físicamente.**

## 0. Preservación del trabajo anterior

- Rama: `v2-segunda-version` (sin cambios de rama, sin commits/push/PR/merge/rebase).
- Los 3 archivos de prueba modificados en este corte son **untracked** (creados en el corte 2); el código de producción (`ml-service/main.py`, `backend/src/controllers/menuController.js`, servicios) **no fue modificado**.
- Los 17 archivos tracked con cambios (`git diff --stat`) son trabajo preexistente de los cortes 1/2 y permanecen **intactos** (sin sobreescritura).
- No se instalaron dependencias. No se ejecutaron pruebas E2E de navegador.

## 1. Archivos modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `ml-service/tests/test_r2_interpret.py` | prueba (untracked) | +25 casos nuevos de `/interpret` (Objetivo A) |
| `ml-service/tests/test_r2_rank.py` | prueba (untracked) | +15 casos nuevos de `/rank` (Objetivo B) |
| `backend/tests/unit/r2MlV2Integration.test.js` | prueba (untracked) | +import `evaluateEligibility`, +11 casos nuevos de integración/resiliencia (Objetivos C/D) |
| `docs/audit-v2/11-r2-tercer-corte-endurecimiento.md` | doc | este reporte |

**Código de producción sin cambios.** El endurecimiento se logró mediante pruebas que demuestran los comportamientos requeridos; no se identificaron brechas que requirieran modificar `main.py` ni `menuController.js`.

## 2. Casos nuevos de prueba (51 casos nuevos)

### Objetivo A — `/interpret` (+25)
Conservadurismo ante ambigüedad/contradicción; ninguna inferencia convierte una restricción desconocida en condición de seguridad confirmada.

- Contradicción alergia explícita vs mención en texto → prevalece la explícita.
- Texto sin info de restricciones → la extracción no crea afirmación de seguridad (sin campos `safe/compatible/verified`).
- Dieta no inferida del texto cuando estructurada es `none`; normalización de variantes (`vegetariana/vegana/sin_gluten/gluten_free`).
- Dietas contradictorias texto vs estructurada → gana la estructurada.
- Negaciones múltiples separadas por coma preservadas; término negado aparece en exclusiones.
- Alergias + exclusiones simultáneas expandidas.
- Presupuesto: formatos `$80`, `80 pesos`, `$80.50`, `mxn 120`; por persona (`por persona/cabeza/cada quien/c/u/por integrante`); rango con guion ambiguo; monto fuera de rango → `None`; sin contexto monetario → `None`.
- `requestId` demasiado largo → saneado (no se devuelve tal cual); exactamente 128 aceptado.
- Entradas largas: texto de 500 aceptado; listas de alergias/exclusiones largas acotadas a 20.
- Campos desconocidos rechazados (`budgetFoo`); forma estricta de `extracted` y de la respuesta.
- Entrada totalmente vacía → `ambiguous=true`, `confidence<=0.5`.

### Objetivo B — `/rank` (+15)
Ranking limitado estrictamente a candidatos; ML nunca devuelve info autoritativa ni agrega candidatos.

- Scores acotados `[0, 0.99]` y finitos incluso con texto vacío.
- Razones: 1 a 3, cada una `<=240` chars.
- Candidatos externos en `extracted.preferences` nunca agregados al ranking.
- `limit` 0 y 11 rechazados; `requestId` >128 rechazado, =128 aceptado, eco en respuesta.
- `meta` con `candidateCount` y `returned`.
- Ordenamiento determinista con tiebreak por nombre luego id.
- Texto vacío ranquea todos los candidatos (sin filtrado por relevancia).
- Forma estricta de `RankResponse` y de cada `RankItem`.
- Duplicados conservan la primera ocurrencia; múltiples IDs vacíos filtrados.
- Respuesta limitada a candidatos recibidos aunque el texto mencione IDs externos.

### Objetivo C — Integración backend (+7)
- Reintentos acotados a máx 1 (con `ML_SERVICE_RETRIES=5` → 2 llamadas; sin la var → 1 llamada). **No hay reintentos ilimitados.**
- `rank` con `ranked` no-arreglo → fallback.
- Razones truncadas a 240 y máximo 3.
- Datos finales provienen exclusivamente del backend (nombre/restaurante reales; score ML acotado).
- Flujo completo `interpret→consolidate→eligibility→rank` (sin restricciones → todos elegibles).
- **Fail-closed** con alergia no verificable → sin elegibles → lista vacía (`no_eligible_candidates`), no recomendaciones inventadas.

### Objetivo D — Resiliencia (+4)
- ML indisponible (interpret+rank fallan) → fallback solo sobre elegibles.
- `interpret` OK pero `rank` con timeout → fallback seguro sobre elegibles.
- `requestId` inconsistente entre endpoints → `rank` descartado (no confiable) → fallback.
- `interpret` OK, `rank` devuelve solo IDs externos → descartados → fallback determinista.

## 3. Comandos ejecutados y resultados reales

```
# Python (unittest, sin pytest — spaCy ausente y gestionado: SPACY_AVAILABLE=False)
cd menus-qr/ml-service
python -m unittest tests.test_r2_interpret tests.test_r2_rank -v
# -> Ran 85 tests ... OK   (52 interpret + 33 rank)

# Node (node:test)
cd menus-qr/backend
node --test tests/unit/r2MlV2Integration.test.js
# -> # tests 33  # pass 33  # fail 0

# Verificación de fundación (consolidación + elegibilidad)
node --test tests/unit/restrictionConsolidation.test.js tests/unit/restrictionConsolidation.mockExtraction.test.js tests/unit/eligibilityEvaluation.test.js
# -> # tests 39  # pass 39  # fail 0
```

**Resultado real:** 85 pruebas Python OK + 33 pruebas Node OK + 39 pruebas de fundación OK. Cero fallos. Todas las pruebas se ejecutaron (no se declararon aprobadas sin ejecución).

### Limitación documentada
- `pytest` no está instalado en el entorno; se usó `python -m unittest` (las suites R2 usan `unittest`). `conftest.py` (pytest) no aplica a estas suites.
- `spaCy`/`es_core_news_sm` no instalados → `SPACY_AVAILABLE=False`; las pruebas de negación/extracción se basan en la ruta regex (determinista). En un entorno con spaCy los resultados de `parse_negations` podrían diferir; las aserciones se mantuvieron robustas (pertenencia/intersección, no igualdad exacta frágil).
- No se ejecutaron pruebas E2E de navegador (excluidas por alcance).

## 4. Objetivo D — Revisión de resiliencia (comportamiento real y límites)

| Escenario | Comportamiento verificado | Límite |
|---|---|---|
| ML temporalmente indisponible | `interpret` y `rank` fallan controlados → fallback determinista **solo sobre candidatos elegibles verificados** | No hay disponibilidad absoluta; degradación segura, no inventa resultados |
| ML lento | timeout (`ML_SERVICE_TIMEOUT`, default 12000ms) → descarte seguro → fallback | El umbral numérico es configurable (DEC-007: no se inventan umbrales aquí) |
| `interpret` OK, `rank` falla | fallback sobre elegibles; `mlUsed` refleja uso parcial | Resultado final siempre autoritativo del backend |
| `interpret` falla, `rank` OK | `mlExtraction=null` → consolidación preserva restricciones explícitas; elegibilidad fail-closed | Flujo continúa de forma segura |
| Respuestas inconsistentes entre endpoints | `requestId` mismatch por endpoint → descarte del endpoint no confiable → fallback | Validación estricta por endpoint, no global |
| Errores de serialización | `callMlV2Post` valida `data` sea objeto no-arreglo; variantes invalidas (null/string/número/arreglo) → descarte | No se prueba inyección de error de serialización interna (fuera de alcance aislado) |

**No se promete disponibilidad absoluta.** La recuperación es siempre fail-closed: ante cualquier fallo/ambigüedad, el backend conserva la autoridad y solo devuelve datos reales de candidatos elegibles, o lista vacía. No existe fallback silencioso a ML V1 (verificado: el controlador solo llama a `/interpret` y `/rank` vía `callMlV2Post`).

## 5. Objetivo E — Referencias legacy de ML V1 (clasificación, sin eliminar)

Barrido de `/recommendations` en `*.js/*.py/*.ts/*.tsx/*.json` (excluyendo `node_modules/.git/docs/evidencias`).

### ML service (`ml-service/main.py`)
| Elemento | Clasificación |
|---|---|
| Endpoint `@app.post("/recommendations")` (`get_recommendations`) | **Legacy sin consumidor V2** — el backend V2 no lo llama. Seguro para retirar tras verificar consumidores externos. |
| Modelos V1 (`CravingInput`, `RecommendationRequest`, `DishOutput`, `RestaurantOutput`, `RecommendationItem`, `RecommendationResponse`) | **Legacy (V1-only)** — retirar junto con el endpoint. |
| `is_allergen_present`, `is_negated_term_present`, `is_diet_incompatible`, `generate_reasons`, `PROTEIN_MAP`, `DISH_TYPE_MAP`, `ALLERGEN_MAP` | **V1-only** (todos sus usos están dentro de `get_recommendations`/helpers V1). |
| `normalize_text`, `fuzzy_similarity`, `levenshtein_distance`, `parse_negations`, `spacy_normalize_text`, `NEGATION_PATTERNS`, `STOP_WORDS`, `WEIGHTS`, uso de `TfidfVectorizer`/`cosine_similarity` | **Compartida y necesaria para V2** (`/interpret` y `/rank` las usan). **No retirar.** |
| `_safe_request_id`, `_extract_budget_proposal`, `_normalize_diet_value`, `_collect_terms_from_text`, `_candidate_to_dish_dict`, `_rank_candidates_internal` | **V2 (necesaria)**. |

### Backend
| Referencia | Clasificación |
|---|---|
| `routes/publicRoutes.js`: `POST /recommendations` → `getGlobalRecommendations`; `POST /:restaurant_id/recommendations` → `getPublicRecommendations` | **Consumidor activo (flujo V2 detrás de ruta con nombre legacy)**. Los frontends dependen de estas rutas. Renombrar/retirar = cambio de contrato externo (DEC-012, **excluido este corte**). |
| `controllers/menuController.js`: llamadas ML | Solo `/interpret` y `/rank` (`callMlV2Post`). **No existe llamada a ML V1** → sin fallback silencioso. |
| `tests/unit/r2MlV2Integration.test.js` | Aserciones que **verifican que no se llama a `/recommendations` (V1)**. **Necesaria** (guarda contra regresión). |

### Tests legacy de V1
| Archivo | Clasificación |
|---|---|
| `ml-service/test_recommendations.py` (22 refs a `get_recommendations`/`RecommendationRequest`) | **Legacy (consume V1 directamente)**. Se rompería al retirar V1; retirar en conjunto con el endpoint. |

### Frontends (`frontend-comensales`, `frontend-restaurantes`)
- `recommendationService.ts` y `recommendation.ts` llaman a `${API_URL}/api/public/recommendations` y `/api/public/menu/:id/recommendations` — **rutas del backend (flujo V2), no el endpoint ML V1**. Consumidores activos del contrato backend. **Fuera de alcance** (frontends no se modifican este corte).

### Conclusión E
El endpoint ML V1 `/recommendations` no tiene consumidor dentro del flujo V2. Su retiro físico requiere: (a) confirmar que ningún consumidor externo llama directamente al ML service, (b) retirar/actualizar `test_recommendations.py`, (c) coordinar con DEC-012 (contrato externo). **No se elimina nada en este corte** (per instrucción: la retirada física de ML V1 requiere verificar consumidores y dependencias).

## 6. Criterios de aceptación

1. ✅ Interpretación conservadora ante ambigüedad y contradicciones (Objetivo A, 25 pruebas).
2. ✅ Ranking limitado estrictamente a candidatos elegibles (Objetivo B, 15 pruebas).
3. ✅ Validación robusta de respuestas ML (Objetivo C: estructura, scores, razones, requestId).
4. ✅ Manejo controlado de fallos y timeouts (Objetivo D: 4 pruebas de resiliencia; reintentos acotados a máx 1).
5. ✅ Ausencia de fallback silencioso a ML V1 (verificado en código y pruebas).
6. ✅ Datos finales siempre autoritativos del backend (prueba de hidratación).
7. ✅ Pruebas reproducibles para los casos nuevos (unittest + node:test, ejecutadas).
8. ✅ Preservación del trabajo anterior (sin commits, sin tocar tracked/producción).

## 7. Riesgos pendientes

- **`mlUsed` semántico:** en `recommendWithMlV2`, la rama "items inválidos/vacíos" usa `mlUsed: !!interpretOk || true` (siempre `true`). No es un riesgo de seguridad (los datos siguen siendo del backend y los IDs se revalidan contra elegibles), pero la bandera puede sobreafirmar "uso de ML". Ver propuesta de corrección en el informe de cierre de R2.
- **Umbral de timeout `ML_SERVICE_TIMEOUT` (default 12000ms)** no calibrado en runtime (DEC-007: no se inventan umbrales). Requiere aprobación de umbrales numéricos.
- **spaCy ausente en el entorno de prueba** → la ruta NLP de `parse_negations` no se ejercita aquí; posible divergencia en entornos con spaCy.

> Nota: el **retiro físico de ML V1** (listado como pendiente en la redacción original de este corte) fue ejecutado posteriormente como objetivo arquitectónico aprobado en DEC-003. Ver `docs/audit-v2/12-r2-retirada-ml-v1.md`.

## 8. Trazabilidad de decisiones (corregida)

| Decisión | Estado | Nota |
|---|---|---|
| DEC-002 (presupuesto/moneda MXN) | **APROBADA** (2026-11-13) | Implementación/enforcement pendiente. |
| DEC-003 (arquitectura V2, retirada de compatibilidad legacy) | **APROBADA** (2026-11-13) | Autoriza la retirada de ML V1. |
| DEC-007 (umbrales numéricos confianza/ambigüedad ML) | **PENDIENTE DE APROBACIÓN** | No se modificaron umbrales. |
| DEC-011 (transición operativa endpoint legado) | **PENDIENTE DE APROBACIÓN** | No se declaró aprobada. |
| DEC-012 (contrato externo canónico del recomendador V2) | **APROBADA** (2026-11-13) | Implementación del contrato externo pendiente. No se modificó este corte. |

**Pendientes que requieren aprobación explícita:** DEC-007, DEC-011. **Renombrado de rutas backend legacy** (`/api/public/.../recommendations`) requiere coordinación con frontends (R4) y el contrato externo DEC-012.

## 9. Estado de R2 después de este corte

R2 queda **endurecido y validado** en lo cubierto por los criterios de aceptación del tercer corte. Tercer corte **APROBADO** como corte de endurecimiento y validación. R2 global permanece **EN PROGRESO** mientras existan pendientes: calibración de umbrales (DEC-007, pendiente de aprobación), transición operativa (DEC-011, pendiente de aprobación) e implementación del contrato externo (DEC-012, aprobada, implementación pendiente). La retirada física de ML V1 se ejecutó posteriormente (DEC-003); ver `12-r2-retirada-ml-v1.md`.
