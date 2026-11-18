# 📋 Informe de Auditoría QA — ML V2 con 30 Frases Reales (`Issue #42`)

- **Responsable QA:** `Felix_G` (`@Felixgarciaf`)
- **Issue:** [#42 — `[R2/R5][QA] Auditar ML V2 con 30 frases reales, documentar causas y bloqueos`](https://github.com/osbaldoXxC/menus-qr/issues/42)
- **Documento Técnico Rector:** [`docs/asignaciones/felix-g/TEC-01-AUDITORIA-ML.md`](../asignaciones/felix-g/TEC-01-AUDITORIA-ML.md)
- **Fecha y Hora de Ejecución (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Rama de Trabajo:** `feature/issue-42-felix-auditoria-ml` (creada desde `main` @ `4f6df83`)
- **Archivo JSON de Evidencia Reproducible:** [`docs/evidencias/ml-v2-30-frases-felix-g.json`](./ml-v2-30-frases-felix-g.json)
- **Modificaciones Funcionales Aplicadas:** `SIN CAMBIOS FUNCIONALES` (cumplimiento estricto de `scope-guard` e `ISSUE-01-ML-30-FRASES.md`).

---

## 1. Declaración del Entorno Exacto y Preflight (Sección A de `TEC-01`)

| Parámetro de Entorno | Valor Verificado |
| :--- | :--- |
| **Workspace Local** | `c:\Users\felix\Desktop\integradora-menu` |
| **Revisión de Código (`HEAD` base)** | `4f6df83f5563c51b4168b945895ac9e3dbd32e15` (`main`) |
| **Versión Vocabulario Mexicano** | `shared/mexican-spanish-v1.json` (`1.0.0-draft`, 75 conceptos / 350 formas) |
| **Runtimes de Evaluación** | Node.js `v24.22.1` + Python `3.13.7` (`NODE_ENV=test`, `DISABLE_STARTUP_DDL=true`) |
| **Dataset Fijo Auditado** | `synthetic_demo_v1` (`backend/tests/integration/r3-isolated/demo-catalog.cjs`): **15 restaurantes DEMO, 120 platillos activos** (sin certificaciones R3 ni moneda MXN confirmada, idéntico a la condición inicial sin certificar) |
| **Skills Verificadas (`.agents/skills/`)** | `scope-guard`, `feature-audit`, `security-audit`, `code-quality`, `performance-optimization`, `test-selection` (incorporadas vía `.agents.rar`) |
| **Riesgo de Migración al Arranque** | Verificado en `backend/src/config/db.js:184-186`: `runMigrations()` se ejecuta automáticamente si `NODE_ENV !== 'test'` y `!startupDdlDisabled()`. No se reinició ni migró ninguna base de datos persistente. |

### 📊 Resumen Cuantitativo de Clasificación (30/30 Filas)

- **`PASS`:** 8 casos
- **`NO-VERIFICABLE` (Abstención segura fail-closed por DEC-002 / R3):** 9 casos
- **`FAIL-RELEVANCIA`:** 7 casos
- **`FAIL-SEGURIDAD` (Histórico en contenedor sin reiniciar — Caso 20 «No lleve leche»):** 1 caso (Severidad **CRÍTICA**)
- **`BLOQUEADO` (Por ausencia de `docs/evidencias/demo-local-30-consultas.json` en Git):** 5 casos

---

## 2. Matriz Completa de los 30 Casos Auditados

| # | Frase Literal | Categoría | Intención y Restricciones Esperadas | Interpretación Real (`/interpret` + `linguistic.py`) | Candidatos (Antes $\to$ Elegibles R3 $\to$ Relevantes) | Origen de Datos | Endpoint y Status (`HTTP` + `status.code`) | `requestId` | Latencia (`ms`) | Evaluación | Severidad | Capa / Componente Responsable | Conclusión con Fundamento y Vínculo JSON |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- | :--- | :--- | :-: | :-: | :-: | :--- | :--- |
| 1 | Quiero unos camaronsitos | Morfología / Diminutivo + Errata | Recuperar platillos con camarón (normalizar camaronsitos -> camaron) | prefs=`[camaronsitos,camaron]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 12` | `ml-service/tests/test_mexican_language.py:20` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c01` | `8.87 ms` | **`PASS`** | `BAJA` | NINGUNA (Flujo nominal) | Ejecución determinista verificada en código actual (4f6df83); 5 recomendaciones coherentes. ([JSON caseId=1](./ml-v2-30-frases-felix-g.json)) |
| 2 | Algo bien enchiloso | Preferencia de Picante (Mexicanismo) | Priorizar platillos con nivel_picante > 0 declarados en catálogo | prefs=`[bien,enchiloso,picante]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 120` | `ml-service/tests/test_mexican_language.py:20` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c02` | `28.456 ms` | **`FAIL-RELEVANCIA`** | `MEDIA` | Capa 7: primaryFoodRelevance.js + Ranking (/rank) | Al no mencionarse una familia de alimento primario en 'Algo bien enchiloso' / 'Que pique machín', selectRelevantFood() no filtra por categoría y /rank mezcla platillos con nivel_picante=3 y nivel_picante=0 por similitud TF-IDF/tokens. ([JSON caseId=2](./ml-v2-30-frases-felix-g.json)) |
| 3 | Que pique machín | Preferencia de Picante Intenso | Priorizar platillos con mayor nivel_picante declarado | prefs=`[pique,machin,picante]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 120` | `ml-service/tests/test_mexican_language.py:21` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c03` | `26.618 ms` | **`FAIL-RELEVANCIA`** | `MEDIA` | Capa 7: primaryFoodRelevance.js + Ranking (/rank) | Al no mencionarse una familia de alimento primario en 'Algo bien enchiloso' / 'Que pique machín', selectRelevantFood() no filtra por categoría y /rank mezcla platillos con nivel_picante=3 y nivel_picante=0 por similitud TF-IDF/tokens. ([JSON caseId=3](./ml-v2-30-frases-felix-g.json)) |
| 4 | Que no pique nadita | Restricción de Picante Cero | Filtrar estrictamente platillos con nivel_picante === 0 (requiresNoSpice) | prefs=`[no,pique,nadita]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 117` | `ml-service/tests/test_mexican_language.py:21` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c04` | `22.484 ms` | **`PASS`** | `BAJA` | NINGUNA (Flujo nominal) | Ejecución determinista verificada en código actual (4f6df83); 5 recomendaciones coherentes. ([JSON caseId=4](./ml-v2-30-frases-felix-g.json)) |
| 5 | Un caldito | Morfología / Diminutivo de Platillo | Priorizar caldos/sopas; evitar rellenar con platillos ajenos si hay restricción | prefs=`[caldito,caldo]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 1` | `ml-service/tests/test_mexican_language.py:22` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c05` | `1.215 ms` | **`PASS`** | `BAJA` | Capa 7: primaryFoodRelevance.js | primaryFoodRelevance restringe correctamente a la familia 'caldo' y devuelve únicamente 'Caldo de pollo'. ([JSON caseId=5](./ml-v2-30-frases-felix-g.json)) |
| 6 | Algo bien llenador | Atributo Subjetivo / Porción | No inventar evidencia de saciedad; ordenar por similitud léxica sólo sobre elegibles | prefs=`[bien,llenador]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 120` | `ml-service/tests/test_mexican_language.py:22` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c06` | `19.629 ms` | **`FAIL-RELEVANCIA`** | `MEDIA` | Capa 3/7: /interpret + primaryFoodRelevance.js + /rank | 'Algo bien llenador' extrae el concepto 'llenador' (preference), pero ningún platillo del catálogo declara porción/saciedad verificable y selectRelevantFood() no aplica restricción, por lo que /rank devuelve los primeros 5 platillos con score base 0.55. ([JSON caseId=6](./ml-v2-30-frases-felix-g.json)) |
| 7 | Traigo 80 varos | Presupuesto Coloquial MXN | Corroborar presupuesto <= 80 MXN; abstenerse (no_verified_results) si precio no está certificado en MXN | prefs=`[traigo,80,varos]`, excl=`[[]]`, budget=`(amt=80.0, amb=False)` | `120 -> 0` | `ml-service/tests/test_mexican_language.py:23` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c07` | `2.202 ms` | **`NO-VERIFICABLE`** | `MEDIA` | Capa 6: eligibilityService.js (DEC-002 evaluateBudgetPrice) | Abstención segura (no_verified_results): el presupuesto textual se corrobora en restrictionConsolidation.js, pero en modo estricto (sin LOCAL_MXN_BUDGET ni evidencia de moneda certificada por el restaurante) evaluateBudgetPrice() devuelve estado 'desconocido' (budget_currency_unverified). ([JSON caseId=7](./ml-v2-30-frases-felix-g.json)) |
| 8 | No más de cien pesos | Presupuesto Escrito MXN | Corroborar presupuesto <= 100 MXN; abstenerse si no hay evidencia MXN certificada | prefs=`[no,mas,cien,pesos]`, excl=`[[]]`, budget=`(amt=100.0, amb=False)` | `120 -> 0` | `ml-service/tests/test_mexican_language.py:23` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c08` | `1.396 ms` | **`NO-VERIFICABLE`** | `MEDIA` | Capa 6: eligibilityService.js (DEC-002 evaluateBudgetPrice) | Abstención segura (no_verified_results): el presupuesto textual se corrobora en restrictionConsolidation.js, pero en modo estricto (sin LOCAL_MXN_BUDGET ni evidencia de moneda certificada por el restaurante) evaluateBudgetPrice() devuelve estado 'desconocido' (budget_currency_unverified). ([JSON caseId=8](./ml-v2-30-frases-felix-g.json)) |
| 9 | Algo bara | Presupuesto Ambiguo / Económico | Detectar mención económica sin monto numérico (budget.ambiguous=True) sin aplicar tope arbitrario | prefs=`[bara,economico]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 120` | `ml-service/tests/test_mexican_language.py:24` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c09` | `19.413 ms` | **`FAIL-RELEVANCIA`** | `MEDIA` | Capa 3/4: _extract_budget_proposal + hasUnresolvedTextBudget | 'Algo bara' activa mentions_money=True por 'bara'/'econ' con budget.ambiguous=True (amount_not_determinable), pero hasUnresolvedTextBudget() sólo bloquea si el texto coincide con el regex de unidades monetarias explícitas (pesos/varos/mxn), dejando pasar 120 candidatos sin filtro de precio. ([JSON caseId=9](./ml-v2-30-frases-felix-g.json)) |
| 10 | Sin nada de puerco | Exclusión Alimentaria Explícita | Extraer puerco/cerdo (ignorar 'nada') y exigir evidencia certificada de ausencia (R3) | prefs=`[sin,nada,puerco]`, excl=`[puerco]`, budget=`(amt=None, amb=False)` | `120 -> 0` | `ml-service/tests/test_mexican_language.py:24` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c10` | `1.498 ms` | **`NO-VERIFICABLE`** | `MEDIA` | Capa 4/6: restrictionConsolidation.js + eligibilityService.js (R3) | Abstención segura fail-closed (no_verified_results): la exclusión ('puerco'/'carne'/'camaronsitos') es detectada por /interpret y las guardias del backend, y como el catálogo DEMO no tiene certificaciones R3 de ausencia completa en las 9 secciones de receta, el backend descarta los 120 candidatos. ([JSON caseId=10](./ml-v2-30-frases-felix-g.json)) |
| 11 | No como carne, pero sí pescado | Exclusión Compuesta con Excepción | Extraer exclusión de carne y rol exception para pescado; abstenerse sin evidencia R3 de ausencia de carne | prefs=`[no,como,carne,pero,si]`, excl=`[carne]`, budget=`(amt=None, amb=False)` | `120 -> 0` | `ml-service/tests/test_mexican_language.py:25` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c11` | `0.645 ms` | **`NO-VERIFICABLE`** | `MEDIA` | Capa 4/6: restrictionConsolidation.js + eligibilityService.js (R3) | Abstención segura fail-closed (no_verified_results): la exclusión ('puerco'/'carne'/'camaronsitos') es detectada por /interpret y las guardias del backend, y como el catálogo DEMO no tiene certificaciones R3 de ausencia completa en las 9 secciones de receta, el backend descarta los 120 candidatos. ([JSON caseId=11](./ml-v2-30-frases-felix-g.json)) |
| 12 | No lleve leche | Exclusión Crítica de Alérgeno (Lácteos) | Extraer 'leche' en excludedIngredients y bloquear cualquier platillo sin ausencia certificada (Caso 20 histórico en BITACORA) | prefs=`[no,lleve,leche]`, excl=`[leche]`, budget=`(amt=None, amb=False)` | `120 -> 0` | `ml-service/tests/test_mexican_language.py:25` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c12` | `0.502 ms` | **`FAIL-SEGURIDAD`** | `CRÍTICA` | Capa 3/4/8: Desfase de contenedor en ejecución (BITACORA Caso 20) vs Código actual (4f6df83) | HALLAZGO CRÍTICO DOCUMENTADO: En el código actual (4f6df83), parse_negations('No lleve leche') extrae ['leche'] y evaluateEligibility bloquea los 120 candidatos (statusCode='no_verified_results'). Sin embargo, en la corrida previa contra localhost:4000 con contenedor desactualizado (BITACORA 2026-11-15 Caso 20), /interpret devolvió excludedIngredients=[] y recomendó un licuado con leche declarada. ([JSON caseId=12](./ml-v2-30-frases-felix-g.json)) |
| 13 | Un pollito con verduras | Alimento Principal + Calificador | Filtrar familia primaria 'pollo' (primaryFoodRelevance) y priorizar coincidencia con verduras | prefs=`[pollito,verduras,pollo,verdura]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 1` | `ml-service/tests/test_mexican_language.py:26` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c13` | `1.43 ms` | **`PASS`** | `BAJA` | Capa 7: primaryFoodRelevance.js | selectRelevantFood() detecta familia primaria 'pollo' y calificador requerido 'verdura', devolviendo exactamente 'Pollo con verduras'. ([JSON caseId=13](./ml-v2-30-frases-felix-g.json)) |
| 14 | Un postrecito frío | Categoría / Temperatura | Extraer concepto 'postre' + 'frio'; advertir que primaryFoodRelevance no restringe 'postre' como familia cerrada | prefs=`[postrecito,frio,postre]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 0` | `ml-service/tests/test_mexican_language.py:26` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c14` | `0.844 ms` | **`FAIL-RELEVANCIA`** | `MEDIA` | Capa 7: primaryFoodRelevance.js + /rank | En 'Un postrecito frío', primaryFoodRelevance filtra por la familia 'postre' si coincide en nombre/ingredientes principales, pero los platillos de la categoría 'Postres' ('Pastel de chocolate', 'Flan de vainilla', etc.) no contienen la palabra 'postre' en su nombre ni en ingredientes_principales, provocando 0 candidatos relevantes (no_relevant_candidates -> no_verified_results) porque dishMatchesFamily() no inspecciona categoria_nombre. ([JSON caseId=14](./ml-v2-30-frases-felix-g.json)) |
| 15 | Quiero algo dulce, pero no empalagoso | Preferencia Sensorial con Negación No-Ingrediente | Tratar 'empalagoso' como preferencia/textura pero observar que parse_negations no debe tratar adjetivos subjetivos como alérgenos | prefs=`[dulce,pero,no,empalagoso]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 120` | `ml-service/tests/test_mexican_language.py:27` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c15` | `31.073 ms` | **`FAIL-RELEVANCIA`** | `MEDIA` | Capa 3/5: hasOmittedTextExclusion (menuController.js:918) + restrictionConsolidation.js | En 'Quiero algo dulce, pero no empalagoso', ni 'dulce' ni 'empalagoso' filtran por categoría 'Postres'/'Panadería' en primaryFoodRelevance.js, por lo que /rank devuelve platillos de panadería/postres o generales sin verificar dulzor. ([JSON caseId=15](./ml-v2-30-frases-felix-g.json)) |
| 16 | Quiero un pollito | Alimento Principal Diminutivo | Devolver exclusivamente platillos de la familia 'pollo' (sin mezclar conchas/pizzas) | prefs=`[pollito,pollo]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 25` | `backend/tests/integration/r3-isolated/mexican-language-http.test.cjs:22` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c16` | `3.546 ms` | **`PASS`** | `BAJA` | NINGUNA (Flujo nominal) | Ejecución determinista verificada en código actual (4f6df83); 5 recomendaciones coherentes. ([JSON caseId=16](./ml-v2-30-frases-felix-g.json)) |
| 17 | No quiero gastar más de 100 varos | Operador Monetario Negativo Coloquial | Corroborar tope de 100 MXN; abstenerse sin evidencia MXN certificada | prefs=`[no,gastar,mas,100,varos]`, excl=`[[]]`, budget=`(amt=100.0, amb=False)` | `120 -> 0` | `ml-service/tests/test_mexican_language.py:49` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c17` | `1.319 ms` | **`NO-VERIFICABLE`** | `MEDIA` | Capa 6: eligibilityService.js (DEC-002 evaluateBudgetPrice) | Abstención segura (no_verified_results): el presupuesto textual se corrobora en restrictionConsolidation.js, pero en modo estricto (sin LOCAL_MXN_BUDGET ni evidencia de moneda certificada por el restaurante) evaluateBudgetPrice() devuelve estado 'desconocido' (budget_currency_unverified). ([JSON caseId=17](./ml-v2-30-frases-felix-g.json)) |
| 18 | Como unos 100 pesos | Presupuesto Aproximado | Marcar budget.ambiguous=True (approximate_budget) y no convertir aproximación en filtro duro | prefs=`[como,100,pesos]`, excl=`[[]]`, budget=`(amt=None, amb=True)` | `120 -> 120` | `backend/tests/integration/r3-isolated/mexican-language-http.test.cjs:39` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c18` | `21.279 ms` | **`PASS`** | `BAJA` | Capa 3/5: _extract_budget_proposal + hasUnresolvedTextBudget | 'Como unos 100 pesos' se clasifica con notes=['approximate_budget'] y budget.ambiguous=True; hasUnresolvedTextBudget() permite explícitamente presupuestos aproximados sin bloquear ni imponer tope falso, marcando safety.priceVerified=false. ([JSON caseId=18](./ml-v2-30-frases-felix-g.json)) |
| 19 | No más de ciento veinte pesos | Monto Escrito Compuesto | Marcar compound_written_amount_not_supported y bloquear en hasUnresolvedTextBudget (fail-closed) | prefs=`[no,mas,ciento,veinte,pesos]`, excl=`[[]]`, budget=`(amt=None, amb=True)` | `120 -> 0` | `ml-service/tests/test_mexican_language.py:51` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c19` | `0.452 ms` | **`NO-VERIFICABLE`** | `BAJA` | Capa 3/5: _extract_budget_proposal + hasUnresolvedTextBudget | 'No más de ciento veinte pesos' activa compound_written_amount_not_supported (budget.ambiguous=True) y hasUnresolvedTextBudget() bloquea la búsqueda en modo fail-closed (no_verified_results) al existir operador de máximo explícito ('No más de'). ([JSON caseId=19](./ml-v2-30-frases-felix-g.json)) |
| 20 | No me molesta que pique | Permiso de Picante (Doble Negación) | Asignar role='permitted' a picante, no filtrar nivel_picante > 0 ni bonificar como exigencia | prefs=`[no,molesta,pique]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 120` | `backend/tests/integration/r3-isolated/mexican-language-http.test.cjs:47` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c20` | `23.732 ms` | **`PASS`** | `BAJA` | NINGUNA (Flujo nominal) | Ejecución determinista verificada en código actual (4f6df83); 5 recomendaciones coherentes. ([JSON caseId=20](./ml-v2-30-frases-felix-g.json)) |
| 21 | Quiero una tortita | Ambigüedad Léxica (Torta vs Tortita) | Clasificar 'tortita' como ambiguous_contextual sin asumir equivalencia automática con torta | prefs=`[tortita]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 120` | `ml-service/tests/test_mexican_language.py:42` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c21` | `11.456 ms` | **`FAIL-RELEVANCIA`** | `MEDIA` | Capa 2/7: shared/mexican-spanish-v1.json + primaryFoodRelevance.js | 'Quiero una tortita' marca 'tortita' como ambiguous_contextual en linguistic.py (no se incluye en foodFamilies().request de primaryFoodRelevance.js), por lo que selectRelevantFood() no restringe candidatos (constrained=False) y /rank devuelve 5 platillos no relacionados con torta. ([JSON caseId=21](./ml-v2-30-frases-felix-g.json)) |
| 22 | Sin camaronsitos | Exclusión con Errata/Diminutivo | Bloquear de forma conservadora (fail-closed) al detectar exclusión con typo_contextual | prefs=`[sin,camaronsitos]`, excl=`[camaronsitos]`, budget=`(amt=None, amb=False)` | `120 -> 0` | `ml-service/tests/test_mexican_language.py:41` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c22` | `0.469 ms` | **`NO-VERIFICABLE`** | `MEDIA` | Capa 4/6: restrictionConsolidation.js + eligibilityService.js (R3) | Abstención segura fail-closed (no_verified_results): la exclusión ('puerco'/'carne'/'camaronsitos') es detectada por /interpret y las guardias del backend, y como el catálogo DEMO no tiene certificaciones R3 de ausencia completa en las 9 secciones de receta, el backend descarta los 120 candidatos. ([JSON caseId=22](./ml-v2-30-frases-felix-g.json)) |
| 23 | Quiero camarones pero sin picante | Alimento Principal + Sin Picante | Filtrar familia 'camaron' + nivel_picante === 0 únicamente | prefs=`[camarones,pero,sin,picante,camaron]`, excl=`[[]]`, budget=`(amt=None, amb=False)` | `120 -> 11` | `backend/tests/integration/r3-isolated/mexican-language-http.test.cjs:51` + `synthetic_demo_v1` | `HTTP 200` (`ok`) | `audit-felix-c23` | `3.772 ms` | **`PASS`** | `BAJA` | NINGUNA (Flujo nominal) | Ejecución determinista verificada en código actual (4f6df83); 5 recomendaciones coherentes. ([JSON caseId=23](./ml-v2-30-frases-felix-g.json)) |
| 24 | Quiero algo dulce como pan, pero solo tengo 100 pesos | Antojo + Presupuesto Explícito | Corroborar presupuesto <= 100 MXN; requerir evidencia MXN certificada | prefs=`[dulce,como,pan,pero,solo]`, excl=`[[]]`, budget=`(amt=100.0, amb=False)` | `120 -> 0` | `backend/tests/integration/r3-isolated/single-message.test.cjs:31` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c24` | `1.126 ms` | **`NO-VERIFICABLE`** | `MEDIA` | Capa 6: eligibilityService.js (DEC-002 evaluateBudgetPrice) | Abstención segura (no_verified_results): el presupuesto textual se corrobora en restrictionConsolidation.js, pero en modo estricto (sin LOCAL_MXN_BUDGET ni evidencia de moneda certificada por el restaurante) evaluateBudgetPrice() devuelve estado 'desconocido' (budget_currency_unverified). ([JSON caseId=24](./ml-v2-30-frases-felix-g.json)) |
| 25 | Quiero algo picoso sin puerco, y tengo 100 pesos | Picante + Exclusión + Presupuesto | Exigir ausencia certificada de cerdo y precio MXN certificado <= 100 | prefs=`[picoso,sin,puerco,tengo,100]`, excl=`[puerco]`, budget=`(amt=100.0, amb=False)` | `120 -> 0` | `backend/tests/integration/r3-isolated/single-message.test.cjs:31` + `synthetic_demo_v1` | `HTTP 200` (`no_verified_results`) | `audit-felix-c25` | `1.187 ms` | **`NO-VERIFICABLE`** | `MEDIA` | Capa 4/6: restrictionConsolidation.js + eligibilityService.js (R3) | Abstención segura fail-closed (no_verified_results): la exclusión ('puerco'/'carne'/'camaronsitos') es detectada por /interpret y las guardias del backend, y como el catálogo DEMO no tiene certificaciones R3 de ausencia completa en las 9 secciones de receta, el backend descarta los 120 candidatos. ([JSON caseId=25](./ml-v2-30-frases-felix-g.json)) |
| 26 | [BLOQUEADO: Frase #26 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83] | Bloqueo de Evidencia Fuente | Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido | `N/A (Archivo fuente ausente)` | `N/A` | Referencia `BITACORA.md` (no versionado en `4f6df83`) | `N/A` (`blocked_missing_source_artifact`) | `audit-felix-c26` | `N/A` | **`BLOQUEADO`** | `ALTA` | EVIDENCIA-FUENTE-GIT | Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible. ([JSON caseId=26](./ml-v2-30-frases-felix-g.json)) |
| 27 | [BLOQUEADO: Frase #27 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83] | Bloqueo de Evidencia Fuente | Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido | `N/A (Archivo fuente ausente)` | `N/A` | Referencia `BITACORA.md` (no versionado en `4f6df83`) | `N/A` (`blocked_missing_source_artifact`) | `audit-felix-c27` | `N/A` | **`BLOQUEADO`** | `ALTA` | EVIDENCIA-FUENTE-GIT | Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible. ([JSON caseId=27](./ml-v2-30-frases-felix-g.json)) |
| 28 | [BLOQUEADO: Frase #28 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83] | Bloqueo de Evidencia Fuente | Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido | `N/A (Archivo fuente ausente)` | `N/A` | Referencia `BITACORA.md` (no versionado en `4f6df83`) | `N/A` (`blocked_missing_source_artifact`) | `audit-felix-c28` | `N/A` | **`BLOQUEADO`** | `ALTA` | EVIDENCIA-FUENTE-GIT | Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible. ([JSON caseId=28](./ml-v2-30-frases-felix-g.json)) |
| 29 | [BLOQUEADO: Frase #29 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83] | Bloqueo de Evidencia Fuente | Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido | `N/A (Archivo fuente ausente)` | `N/A` | Referencia `BITACORA.md` (no versionado en `4f6df83`) | `N/A` (`blocked_missing_source_artifact`) | `audit-felix-c29` | `N/A` | **`BLOQUEADO`** | `ALTA` | EVIDENCIA-FUENTE-GIT | Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible. ([JSON caseId=29](./ml-v2-30-frases-felix-g.json)) |
| 30 | [BLOQUEADO: Frase #30 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83] | Bloqueo de Evidencia Fuente | Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido | `N/A (Archivo fuente ausente)` | `N/A` | Referencia `BITACORA.md` (no versionado en `4f6df83`) | `N/A` (`blocked_missing_source_artifact`) | `audit-felix-c30` | `N/A` | **`BLOQUEADO`** | `ALTA` | EVIDENCIA-FUENTE-GIT | Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible. ([JSON caseId=30](./ml-v2-30-frases-felix-g.json)) |

---

## 3. Diagnóstico Detallado de Hallazgos y Bloqueos (Sección G de `TEC-01`)

### [ML-30-C12] Caso Crítico de Negación de Alérgeno: «No lleve leche» (Desfase Contenedor vs. Código Fail-Closed)
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** **CRÍTICA**
- **Frase literal:** `No lleve leche`
- **Comportamiento esperado:** Extraer `'leche'` como ingrediente/alérgeno excluido, exigir evidencia certificada de ausencia (`VERIFIED_ABSENT` en las 9 secciones de receta R3) y jamás recomendar un platillo con leche declarada.
- **Comportamiento observado:**
  1. **En la corrida histórica previa (`BITACORA.md` 2026-11-15, Caso 20):** El servicio activo en `localhost:4000` / `ml-service:8000` (que ejecutaba una imagen previa sin recargar el código de `parse_negations`) devolvió `excludedIngredients: []` y recomendó un **licuado con leche declarada** (`HTTP 200`, `status.code: 'ok'`).
  2. **En el código actual (`4f6df83`):** `ml-service/main.py:128` (`r'\bno\s+(?:lleve|traiga|como|puedo comer)\s+([a-z]+)'`) y `ml-service/linguistic.py:56` extraen `'leche'` en `excludedIngredients: ['leche']`. Adicionalmente, `hasOmittedTextExclusion()` en `backend/src/controllers/menuController.js:918-940` actúa como guardia independiente en el backend: incluso si ML omitiese `'leche'`, el backend detecta la omisión (`unverifiedText = true`) y vacía `eligibleDishes`, devolviendo `status.code: 'no_verified_results'` (`0 recomendaciones`).
- **`requestId` y endpoint:** `audit-felix-c12` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos)
- **Etapa donde se produce:** Capa 3 (`/interpret`) y Capa 4/5 (Sincronización de proceso en contenedor Docker vs. `hasOmittedTextExclusion` en `menuController.js`).
- **Evidencia que lo demuestra:** `ml-service/main.py:128-137`, `backend/src/controllers/menuController.js:918-940`, `backend/tests/integration/r3-isolated/critical-regression.test.cjs:16-36` y Caso 12 en `docs/evidencias/ml-v2-30-frases-felix-g.json`.
- **Riesgo:** Riesgo vital de salud alimentaria (reacción alérgica o intolerancia severa a lácteos) si el contenedor principal sirve tráfico con una versión en memoria anterior a la guardia `hasOmittedTextExclusion`.
- **Acción recomendada (sin implementar):** Verificar que el despliegue de `backend` y `ml-service` recargue el código del commit `4f6df83` con `DISABLE_STARTUP_DDL=true` para no disparar `runMigrations()` sobre la base persistente, y agregar un healthcheck de versión de contrato (`vocabularyVersion: '1.0.0-draft'`) en `/health`.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` · Mitigado en código fuente (`4f6df83`), pendiente recarga segura del contenedor principal.

---

### [ML-30-C14] Falso Negativo de Relevancia en Categorías: «Un postrecito frío» devuelve 0 candidatos (`no_relevant_candidates`)
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** **ALTA**
- **Frase literal:** `Un postrecito frío`
- **Comportamiento esperado:** Recuperar los platillos de la categoría `Postres` (como `Flan de vainilla`, `Gelatina de fresa`, `Pay de limón`, `Mousse de cacao`) y priorizar los fríos.
- **Comportamiento observado:** `primaryFoodFamilies('Un postrecito frío')` identifica la familia `postre` (porque `'postrecito'` está en `forms.diminutive` de `postre` en `shared/mexican-spanish-v1.json`). Sin embargo, `dishMatchesFamily()` en `backend/src/services/primaryFoodRelevance.js:47-58` **únicamente busca los términos `['postre', 'postres', 'postrecito', 'postrecitos']` dentro de `dish.nombre` y `dish.ingredientes_principales`**, ignorando por completo `dish.categoria_nombre` (`'Postres'`). Como ningún platillo del restaurante `Dulce Comal DEMO` se llama literalmente «Postre de...», `selectRelevantFood()` filtra los 120 candidatos a **0** y devuelve `status.code: 'no_verified_results'` (`mlReason: 'no_relevant_candidates'`).
- **`requestId` y endpoint:** `audit-felix-c14` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (8 platillos en categoría `Postres`)
- **Etapa donde se produce:** **Capa 7 (`backend/src/services/primaryFoodRelevance.js:52`)** — Primer punto observable donde se pierden los 8 candidatos válidos.
- **Evidencia que lo demuestra:** En `primaryFoodRelevance.js:52`: `const texts = [dish.nombre, ...namesFromIngredients(dish.ingredientes_principales)].map(normalize);` (no incluye `dish.categoria_nombre`).
- **Riesgo:** Falsos vacíos sistemáticos (`no_verified_results`) cuando el comensal pide una categoría (`postre`, `desayuno`, `mariscos`, `pan dulce`) cuyo término figura en `categoria_nombre` pero no se repite en el nombre individual del platillo.
- **Acción recomendada (sin implementar):** En un issue futuro autorizado, incluir `dish.categoria_nombre` en `dishMatchesFamily()` cuando el concepto de `mexican-spanish-v1.json` tenga `category === 'food_category'`.
- **Bloqueo / @mención / estado:** Documentado para `@osbaldoXxC` · `ABIERTO` (sin modificar código funcional).

---

### [ML-30-C21] Ambigüedad No Restrictiva en «Quiero una tortita»: Recomendación de Platillos Ajenos
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** **MEDIA**
- **Frase literal:** `Quiero una tortita`
- **Comportamiento esperado:** Abstenerse o solicitar aclaración si `'tortita'` es ambiguo (entre *torta* en pan y *tortita* de papa/camarón), sin rellenar con 5 platillos inconexos (arroz, avena, barbacoa).
- **Comportamiento observado:** En `shared/mexican-spanish-v1.json`, `'tortita'` está clasificada bajo `forms.ambiguous_contextual` del concepto `torta`. En `backend/src/services/linguisticVocabulary.js:20`, `foodFamilies()` sólo carga `['equivalence', 'diminutive', 'typo_contextual']` y excluye `ambiguous_contextual`. En consecuencia, `primaryFoodFamilies('Quiero una tortita')` devuelve `[]` (`constrained: false`), enviando los 120 platillos del catálogo a `/rank`, el cual devuelve 5 platillos irrelevantes (`Arroz a la mexicana`, `Arroz con camarones`, etc.) con score base `0.55`.
- **`requestId` y endpoint:** `audit-felix-c21` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1`
- **Etapa donde se produce:** **Capa 2/7 (`linguisticVocabulary.js:20` $\to$ `primaryFoodRelevance.js:27-39` $\to$ `/rank`)**.
- **Evidencia que lo demuestra:** Caso 21 en `docs/evidencias/ml-v2-30-frases-felix-g.json` (`relevanceConstrained: false`, `eligibleCount: 120`, `statusCode: 'ok'` con 5 platillos ajenos).
- **Riesgo:** Incumplimiento de la regla de calidad: *«ausencia de coincidencia no debe rellenarse con irrelevantes»*.
- **Acción recomendada (sin implementar):** Cuando `linguistic.analyze()` detecte una mención de alimento con `role === 'ambiguous'` (`tortita`), tratarla como restricción de relevancia no verificable o exigir coincidencia literal de `'tortita'`/`'torta'` en vez de dejar `constrained: false`.
- **Bloqueo / @mención / estado:** Documentado para `@osbaldoXxC` · `ABIERTO`.

---

### [ML-30-C02 / C03 / C06 / C09 / C15] Relleno con Score Base `0.55` en Peticiones de Atributo/Preferencia sin Alimento Primario
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** **MEDIA**
- **Frases literales afectadas:**
  - Caso 2: `Algo bien enchiloso`
  - Caso 3: `Que pique machín`
  - Caso 6: `Algo bien llenador`
  - Caso 9: `Algo bara`
  - Caso 15: `Quiero algo dulce, pero no empalagoso`
- **Comportamiento esperado:** En Caso 2 y 3 devolver únicamente platillos picantes (`nivel_picante > 0`); en Caso 9 abstenerse o exigir precio verificado bajo; en Caso 6 y 15 no devolver platillos arbitrarios con score artificial `0.55`.
- **Comportamiento observado:**
  1. En **Caso 2 y 3**, `/rank` bonifica los 3 platillos del catálogo con `nivel_picante = 3` (`score: 0.87`), pero como el límite es 5, rellena los lugares 4 y 5 con platillos de `nivel_picante = 0` (`score: 0.275` / `0.3827`).
  2. En **Caso 9 (`Algo bara`)**, `_extract_budget_proposal` detecta `mentions_money=True` y `ambiguous=True` (`amount_not_determinable`), pero `hasUnresolvedTextBudget()` (`menuController.js:979`) sólo se activa si el texto contiene números o la palabra `pesos/varos/mxn`, dejando pasar los 120 candidatos sin filtro monetario.
  3. En **Caso 15 (`Quiero algo dulce, pero no empalagoso`)**, `parse_negations` no captura `pero no empalagoso` y `primaryFoodRelevance` no asocia `'dulce'` con las categorías `Panadería`/`Postres`, devolviendo platillos salados (`Arroz a la mexicana`) si no hay match léxico.
- **Etapa donde se produce:** Capa 5 (`hasUnresolvedTextBudget` en `menuController.js:979`) y Capa 7 (`_rank_candidates_internal` en `ml-service/main.py:549-575`).
- **Acción recomendada (sin implementar):** (1) Ampliar `hasUnresolvedTextBudget` para bloquear cuando `extraction.budget.ambiguous === true` y `notes` contenga `amount_not_determinable`; (2) No rellenar hasta `limit=5` en `/rank` cuando `raw_score == 0` y existen preferencias explícitas insatisfechas.

---

### [ML-30-C26 a C30] Bloqueo de Trazabilidad por Archivo Fuente Ausente (`docs/evidencias/demo-local-30-consultas.json`)
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** **ALTA (Bloqueo de Evidencia Original)**
- **Frases literales:** Casos `26` al `30` (5 entradas cuyo texto original no figura en los archivos de prueba versionados en `main` @ `4f6df83`).
- **Comportamiento esperado:** Extraer las 30 frases literales de `docs/evidencias/demo-local-30-consultas.json`.
- **Comportamiento observado:** En `docs/implementation-v2/BITACORA.md` (entrada `2026-11-15 — Treinta solicitudes contra servicios locales activos`) se documenta que `docs/evidencias/demo-local-30-consultas.json` y `backend/tests/integration/demo-local-30-requests.cjs` fueron generados localmente, pero **no fueron añadidos al commit `e310896` ni al PR #41**. En el repositorio existen exactamente 25 frases literales verificables (`15` en `ml-service/tests/test_mexican_language.py` y `10` en `backend/tests/integration/r3-isolated/*.cjs`).
- **Regla aplicada:** Conforme a `ISSUE-01-ML-30-FRASES.md` (*«Existen 30/30 casos identificados a partir de la fuente original; si hay faltantes se documenta bloqueo, sin completar con frases inventadas»*), se mantienen los 5 registros con `evaluation: 'BLOQUEADO'` sin inventar ninguna frase.
- **Bloqueo / @mención / estado:** Notificado a `@osbaldoXxC` en el Issue #42 · `ABIERTO`.

---


---

### 3.1 Catálogo Individual Completo de Hallazgos (`FAIL-*` y `BLOQUEADO` — Criterio de Aceptación #8)

### [ML-30-C02] FAIL-RELEVANCIA — Preferencia de Picante (Mexicanismo)
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Algo bien enchiloso`
- **Comportamiento esperado:** Priorizar platillos con nivel_picante > 0 declarados en catálogo
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Camarones con chipotle ($87 MXN, picante=3, score=0.8651), Chilaquiles rojos ($73 MXN, picante=3, score=0.8651), Mole con pollo ($45 MXN, picante=3, score=0.8651)).
- **`requestId` y endpoint:** `audit-felix-c02` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 7: primaryFoodRelevance.js + Ranking (/rank)`
- **Evidencia que lo demuestra:** `Al no mencionarse una familia de alimento primario en 'Algo bien enchiloso' / 'Que pique machín', selectRelevantFood() no filtra por categoría y /rank mezcla platillos con nivel_picante=3 y nivel_picante=0 por similitud TF-IDF/tokens.` ([Registro JSON `caseId=2`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** Evitar rellenar con candidatos de nivel_picante=0 cuando el usuario exige explícitamente comida muy picante ('enchiloso'/'que pique machín').
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C03] FAIL-RELEVANCIA — Preferencia de Picante Intenso
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Que pique machín`
- **Comportamiento esperado:** Priorizar platillos con mayor nivel_picante declarado
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Camarones con chipotle ($87 MXN, picante=3, score=0.8651), Chilaquiles rojos ($73 MXN, picante=3, score=0.8651), Mole con pollo ($45 MXN, picante=3, score=0.8651)).
- **`requestId` y endpoint:** `audit-felix-c03` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 7: primaryFoodRelevance.js + Ranking (/rank)`
- **Evidencia que lo demuestra:** `Al no mencionarse una familia de alimento primario en 'Algo bien enchiloso' / 'Que pique machín', selectRelevantFood() no filtra por categoría y /rank mezcla platillos con nivel_picante=3 y nivel_picante=0 por similitud TF-IDF/tokens.` ([Registro JSON `caseId=3`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** Evitar rellenar con candidatos de nivel_picante=0 cuando el usuario exige explícitamente comida muy picante ('enchiloso'/'que pique machín').
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C06] FAIL-RELEVANCIA — Atributo Subjetivo / Porción
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Algo bien llenador`
- **Comportamiento esperado:** No inventar evidencia de saciedad; ordenar por similitud léxica sólo sobre elegibles
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Arroz a la mexicana ($87 MXN, picante=0, score=0.55), Arroz con camarones ($87 MXN, picante=0, score=0.55), Arroz con champiñones ($80 MXN, picante=0, score=0.55)).
- **`requestId` y endpoint:** `audit-felix-c06` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 3/7: /interpret + primaryFoodRelevance.js + /rank`
- **Evidencia que lo demuestra:** `'Algo bien llenador' extrae el concepto 'llenador' (preference), pero ningún platillo del catálogo declara porción/saciedad verificable y selectRelevantFood() no aplica restricción, por lo que /rank devuelve los primeros 5 platillos con score base 0.55.` ([Registro JSON `caseId=6`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** No rellenar hasta limit=5 con score base 0.55 cuando raw_score == 0 o cuando el calificador ('con verduras', 'dulce', 'llenador') no consta en los datos.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C09] FAIL-RELEVANCIA — Presupuesto Ambiguo / Económico
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Algo bara`
- **Comportamiento esperado:** Detectar mención económica sin monto numérico (budget.ambiguous=True) sin aplicar tope arbitrario
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Arroz a la mexicana ($87 MXN, picante=0, score=0.55), Arroz con camarones ($87 MXN, picante=0, score=0.55), Arroz con champiñones ($80 MXN, picante=0, score=0.55)).
- **`requestId` y endpoint:** `audit-felix-c09` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 3/4: _extract_budget_proposal + hasUnresolvedTextBudget`
- **Evidencia que lo demuestra:** `'Algo bara' activa mentions_money=True por 'bara'/'econ' con budget.ambiguous=True (amount_not_determinable), pero hasUnresolvedTextBudget() sólo bloquea si el texto coincide con el regex de unidades monetarias explícitas (pesos/varos/mxn), dejando pasar 120 candidatos sin filtro de precio.` ([Registro JSON `caseId=9`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** Actualizar hasUnresolvedTextBudget() (menuController.js:977) para bloquear cuando extraction.budget.notes incluya 'amount_not_determinable'.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C12] FAIL-SEGURIDAD — Exclusión Crítica de Alérgeno (Lácteos)
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `CRÍTICA`
- **Frase literal:** `No lleve leche`
- **Comportamiento esperado:** Extraer 'leche' en excludedIngredients y bloquear cualquier platillo sin ausencia certificada (Caso 20 histórico en BITACORA)
- **Comportamiento observado:** HTTP 200 (no_verified_results): candidateCount=120 -> eligibleAfterR3=0 -> afterSpice=0 -> eligibleForRank=0 -> returned=0 (0 recomendaciones).
- **`requestId` y endpoint:** `audit-felix-c12` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 3/4/8: Desfase de contenedor en ejecución (BITACORA Caso 20) vs Código actual (4f6df83)`
- **Evidencia que lo demuestra:** `HALLAZGO CRÍTICO DOCUMENTADO: En el código actual (4f6df83), parse_negations('No lleve leche') extrae ['leche'] y evaluateEligibility bloquea los 120 candidatos (statusCode='no_verified_results'). Sin embargo, en la corrida previa contra localhost:4000 con contenedor desactualizado (BITACORA 2026-11-15 Caso 20), /interpret devolvió excludedIngredients=[] y recomendó un licuado con leche declarada.` ([Registro JSON `caseId=12`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Riesgo crítico de seguridad alimentaria por alérgeno lácteo si el contenedor no está actualizado.
- **Acción recomendada (sin implementar):** Recargar contenedores principales con DISABLE_STARTUP_DDL=true para activar la guardia hasOmittedTextExclusion (4f6df83) sin correr migraciones implícitas.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C14] FAIL-RELEVANCIA — Categoría / Temperatura
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Un postrecito frío`
- **Comportamiento esperado:** Extraer concepto 'postre' + 'frio'; advertir que primaryFoodRelevance no restringe 'postre' como familia cerrada
- **Comportamiento observado:** HTTP 200 (no_verified_results): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=0 -> returned=0 (0 recomendaciones).
- **`requestId` y endpoint:** `audit-felix-c14` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 7: primaryFoodRelevance.js + /rank`
- **Evidencia que lo demuestra:** `En 'Un postrecito frío', primaryFoodRelevance filtra por la familia 'postre' si coincide en nombre/ingredientes principales, pero los platillos de la categoría 'Postres' ('Pastel de chocolate', 'Flan de vainilla', etc.) no contienen la palabra 'postre' en su nombre ni en ingredientes_principales, provocando 0 candidatos relevantes (no_relevant_candidates -> no_verified_results) porque dishMatchesFamily() no inspecciona categoria_nombre.` ([Registro JSON `caseId=14`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** Incluir dish.categoria_nombre en dishMatchesFamily() (primaryFoodRelevance.js:52) cuando el concepto tenga category === 'food_category'.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C15] FAIL-RELEVANCIA — Preferencia Sensorial con Negación No-Ingrediente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Quiero algo dulce, pero no empalagoso`
- **Comportamiento esperado:** Tratar 'empalagoso' como preferencia/textura pero observar que parse_negations no debe tratar adjetivos subjetivos como alérgenos
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Omelette de champiñón ($73 MXN, picante=0, score=0.8597), Arroz con champiñones ($80 MXN, picante=0, score=0.8228), Ensalada de nopales ($45 MXN, picante=0, score=0.8228)).
- **`requestId` y endpoint:** `audit-felix-c15` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 3/5: hasOmittedTextExclusion (menuController.js:918) + restrictionConsolidation.js`
- **Evidencia que lo demuestra:** `En 'Quiero algo dulce, pero no empalagoso', ni 'dulce' ni 'empalagoso' filtran por categoría 'Postres'/'Panadería' en primaryFoodRelevance.js, por lo que /rank devuelve platillos de panadería/postres o generales sin verificar dulzor.` ([Registro JSON `caseId=15`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** No rellenar hasta limit=5 con score base 0.55 cuando raw_score == 0 o cuando el calificador ('con verduras', 'dulce', 'llenador') no consta en los datos.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C21] FAIL-RELEVANCIA — Ambigüedad Léxica (Torta vs Tortita)
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `MEDIA`
- **Frase literal:** `Quiero una tortita`
- **Comportamiento esperado:** Clasificar 'tortita' como ambiguous_contextual sin asumir equivalencia automática con torta
- **Comportamiento observado:** HTTP 200 (ok): candidateCount=120 -> eligibleAfterR3=120 -> afterSpice=120 -> eligibleForRank=120 -> returned=5 (Sopa de tortilla ($66 MXN, picante=0, score=0.7077), Arroz a la mexicana ($87 MXN, picante=0, score=0.55), Arroz con camarones ($87 MXN, picante=0, score=0.55)).
- **`requestId` y endpoint:** `audit-felix-c21` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `Capa 2/7: shared/mexican-spanish-v1.json + primaryFoodRelevance.js`
- **Evidencia que lo demuestra:** `'Quiero una tortita' marca 'tortita' como ambiguous_contextual en linguistic.py (no se incluye en foodFamilies().request de primaryFoodRelevance.js), por lo que selectRelevantFood() no restringe candidatos (constrained=False) y /rank devuelve 5 platillos no relacionados con torta.` ([Registro JSON `caseId=21`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Recomendación irrelevante o falso vacío perceptible por el comensal.
- **Acción recomendada (sin implementar):** Tratar menciones con role === 'ambiguous' ('tortita') como filtro estricto o abstención segura en vez de dejar constrained=false.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `DOCUMENTADO`

---

### [ML-30-C26] BLOQUEADO — Bloqueo de Evidencia Fuente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `ALTA`
- **Frase literal:** `[BLOQUEADO: Frase #26 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83]`
- **Comportamiento esperado:** Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido
- **Comportamiento observado:** No ejecutado: el archivo fuente docs/evidencias/demo-local-30-consultas.json no fue incluido en el repositorio (commit 4f6df83).
- **`requestId` y endpoint:** `audit-felix-c26` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `EVIDENCIA-FUENTE-GIT`
- **Evidencia que lo demuestra:** `Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible.` ([Registro JSON `caseId=26`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Falta de trazabilidad sobre el caso original por archivo no versionado en Git.
- **Acción recomendada (sin implementar):** Incorporar al repositorio docs/evidencias/demo-local-30-consultas.json y backend/tests/integration/demo-local-30-requests.cjs para destrabar la frase literal original.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `BLOQUEADO`

---

### [ML-30-C27] BLOQUEADO — Bloqueo de Evidencia Fuente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `ALTA`
- **Frase literal:** `[BLOQUEADO: Frase #27 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83]`
- **Comportamiento esperado:** Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido
- **Comportamiento observado:** No ejecutado: el archivo fuente docs/evidencias/demo-local-30-consultas.json no fue incluido en el repositorio (commit 4f6df83).
- **`requestId` y endpoint:** `audit-felix-c27` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `EVIDENCIA-FUENTE-GIT`
- **Evidencia que lo demuestra:** `Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible.` ([Registro JSON `caseId=27`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Falta de trazabilidad sobre el caso original por archivo no versionado en Git.
- **Acción recomendada (sin implementar):** Incorporar al repositorio docs/evidencias/demo-local-30-consultas.json y backend/tests/integration/demo-local-30-requests.cjs para destrabar la frase literal original.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `BLOQUEADO`

---

### [ML-30-C28] BLOQUEADO — Bloqueo de Evidencia Fuente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `ALTA`
- **Frase literal:** `[BLOQUEADO: Frase #28 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83]`
- **Comportamiento esperado:** Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido
- **Comportamiento observado:** No ejecutado: el archivo fuente docs/evidencias/demo-local-30-consultas.json no fue incluido en el repositorio (commit 4f6df83).
- **`requestId` y endpoint:** `audit-felix-c28` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `EVIDENCIA-FUENTE-GIT`
- **Evidencia que lo demuestra:** `Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible.` ([Registro JSON `caseId=28`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Falta de trazabilidad sobre el caso original por archivo no versionado en Git.
- **Acción recomendada (sin implementar):** Incorporar al repositorio docs/evidencias/demo-local-30-consultas.json y backend/tests/integration/demo-local-30-requests.cjs para destrabar la frase literal original.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `BLOQUEADO`

---

### [ML-30-C29] BLOQUEADO — Bloqueo de Evidencia Fuente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `ALTA`
- **Frase literal:** `[BLOQUEADO: Frase #29 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83]`
- **Comportamiento esperado:** Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido
- **Comportamiento observado:** No ejecutado: el archivo fuente docs/evidencias/demo-local-30-consultas.json no fue incluido en el repositorio (commit 4f6df83).
- **`requestId` y endpoint:** `audit-felix-c29` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `EVIDENCIA-FUENTE-GIT`
- **Evidencia que lo demuestra:** `Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible.` ([Registro JSON `caseId=29`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Falta de trazabilidad sobre el caso original por archivo no versionado en Git.
- **Acción recomendada (sin implementar):** Incorporar al repositorio docs/evidencias/demo-local-30-consultas.json y backend/tests/integration/demo-local-30-requests.cjs para destrabar la frase literal original.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `BLOQUEADO`

---

### [ML-30-C30] BLOQUEADO — Bloqueo de Evidencia Fuente
- **Fecha/hora (`America/Mexico_City`):** `2026-11-17T21:12:00-06:00`
- **Autor GitHub:** `@Felixgarciaf`
- **Severidad:** `ALTA`
- **Frase literal:** `[BLOQUEADO: Frase #30 ausente — docs/evidencias/demo-local-30-consultas.json no versionado en commit 4f6df83]`
- **Comportamiento esperado:** Recuperar frase literal de docs/evidencias/demo-local-30-consultas.json sin inventar contenido
- **Comportamiento observado:** No ejecutado: el archivo fuente docs/evidencias/demo-local-30-consultas.json no fue incluido en el repositorio (commit 4f6df83).
- **`requestId` y endpoint:** `audit-felix-c30` · `POST /api/public/menu/recommendations`
- **Revisión de código + dataset:** Commit `4f6df83` · Dataset `synthetic_demo_v1` (120 platillos / 15 restaurantes DEMO)
- **Etapa donde se produce:** `EVIDENCIA-FUENTE-GIT`
- **Evidencia que lo demuestra:** `Política de bloqueos ISSUE-01-ML-30-FRASES.md: prohibido inventar frases faltantes cuando docs/evidencias/demo-local-30-consultas.json no está disponible.` ([Registro JSON `caseId=30`](../evidencias/ml-v2-30-frases-felix-g.json))
- **Riesgo:** Falta de trazabilidad sobre el caso original por archivo no versionado en Git.
- **Acción recomendada (sin implementar):** Incorporar al repositorio docs/evidencias/demo-local-30-consultas.json y backend/tests/integration/demo-local-30-requests.cjs para destrabar la frase literal original.
- **Bloqueo / @mención / estado:** Reportado a `@osbaldoXxC` en Issue #42 · `BLOQUEADO`


---

## 4. Auditoría de Rendimiento (Sección E de `TEC-01` y Skill `performance-optimization`)

### 4.1 Métricas Reales Medidas en la Batería (25 Casos Ejecutables sobre 120 Candidatos)

| Métrica | Valor Medido (`ms`) | Observación Técnica |
| :--- | :---: | :--- |
| **Muestras ejecutadas (`N`)** | `25` | Casos 1 a 25 (Casos 26–30 en `BLOQUEADO`) |
| **Latencia Mínima (`min`)** | `0.452 ms` | Casos bloqueados tempranamente por guardias (`eligibleForRank=0`) |
| **Latencia Mediana (`p50`)** | **`2.202 ms`** | Ejecución local de `/interpret` + consolidación + elegibilidad R3 + `/rank` |
| **Latencia Percentil 95 (`p95`)** | **`28.456 ms`** | Casos que evalúan distancia de Levenshtein sobre los 120 candidatos en `/rank` |
| **Latencia Máxima (`max`)** | `31.073 ms` | Arranque en frío + scoring completo de 120 candidatos |
| **Latencia Promedio (`mean`)** | `9.385 ms` | Promedio aritmético de las 25 corridas |

### 4.2 Cuellos de Botella Arquitectónicos Detectados en Código (Sin Instrumentación Invasiva)

1. **Doble ejecución de `enrichCandidates()` por cada búsqueda (Redundancia de consultas SQL):**
   - **Ubicación:** `backend/src/controllers/menuController.js` líneas `1200` y `1265` (en `getPublicRecommendations`) y líneas `1330` y `1374` (en `getGlobalRecommendations`).
   - **Diagnóstico:** En cada petición HTTP, el controlador ejecuta la consulta principal de `platillos` + `enrichCandidates()` (que consulta `platillo_evidencia_*` y `taxonomia_alimentaria` en PostgreSQL) antes de llamar a ML V2, y **vuelve a ejecutar `enrichCandidates()` completo sobre todos los candidatos** dentro de `revalidateEvidenceRecommendations()` apenas unos milisegundos después.
   - **Impacto:** Duplica las lecturas a PostgreSQL por cada request. En `getGlobalRecommendations` además hace una tercera consulta `SELECT p.id, p.restaurante_id, p.precio... WHERE p.id = ANY($1::uuid[])` (`L1270`).
   - **Propuesta de optimización (para autorización posterior):** Revalidar en `revalidateEvidenceRecommendations()` únicamente los **IDs preseleccionados por el ranking** (`mlV2.recommendations`, máximo 5–10 IDs) en lugar de re-enriquecer los `120+` candidatos completos del catálogo.
2. **Re-entrenamiento de `TfidfVectorizer` y bucle $O(C \times T \times W)$ de `levenshtein_distance` en Python puro en `/rank`:**
   - **Ubicación:** `ml-service/main.py:492-535`.
   - **Diagnóstico:** En cada llamada a `/rank`, se instancia y ajusta (`fit_transform`) un `TfidfVectorizer(ngram_range=(1, 2))` desde cero y luego, para cada candidato y término que no coincide exactamente, se ejecuta `levenshtein_distance` en Python puro contra cada palabra de `nombre` e `ingredientes_principales`.
   - **Impacto:** Con 120 candidatos toma ~`20–28 ms` en CPU; cerca del tope de 200 candidatos con textos largos puede superar los `60 ms` de CPU bloqueando el worker síncrono de FastAPI.

---

## 5. Recomendaciones Técnicas Priorizadas (Para Autorización Posterior)

| Prioridad | Componente / Archivo | Hallazgo Asociado | Recomendación Técnica Propuesta (No implementada en este issue) |
| :---: | :--- | :--- | :--- |
| **P0 (Crítica)** | Infraestructura / `compose.yml` + `backend` | `[ML-30-C12]` («No lleve leche») | Recargar los contenedores principales (`backend` y `ml-service`) con `DISABLE_STARTUP_DDL=true` para garantizar que la guardia `hasOmittedTextExclusion` y el extractor de negaciones del commit `4f6df83` estén activos en memoria sin ejecutar `runMigrations()`. |
| **P1 (Alta)** | Repositorio Git (`docs/evidencias/`) | `[ML-30-C26..C30]` (Bloqueo de 5 frases) | Incorporar al repositorio `docs/evidencias/demo-local-30-consultas.json` y `backend/tests/integration/demo-local-30-requests.cjs` para completar las 5 filas bloqueadas. |
| **P1 (Alta)** | `backend/src/services/primaryFoodRelevance.js:52` | `[ML-30-C14]` («Un postrecito frío») | Incluir `dish.categoria_nombre` en `dishMatchesFamily()` cuando la familia léxica corresponda a `category === 'food_category'` (p. ej. `postre`, `desayuno`), evitando falsos `no_relevant_candidates`. |
| **P2 (Media)** | `backend/src/services/primaryFoodRelevance.js` + `linguisticVocabulary.js` | `[ML-30-C21]` («Quiero una tortita») | Evitar que términos marcados como `ambiguous_contextual` (`tortita`) dejen `constrained: false` y rellenen con 5 platillos irrelevantes; abstenerse o filtrar por coincidencia explícita. |
| **P2 (Media)** | `backend/src/controllers/menuController.js:977` | `[ML-30-C09]` («Algo bara») | Hacer que `hasUnresolvedTextBudget()` también detecte menciones monetarias ambiguas sin cifra (`notes: ['amount_not_determinable']`) cuando la política exija presupuesto verificable. |
| **P3 (Rendimiento)** | `backend/src/controllers/menuController.js:1264` | Doble lectura SQL en `revalidateEvidenceRecommendations` | Limitar `revalidateEvidenceRecommendations()` a los `dish.id` presentes en `mlV2.recommendations` (máx. 10 filas) en lugar de re-consultar y re-evaluar todo el catálogo de entrada. |
