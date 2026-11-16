# 13 — R2: Implementación del contrato externo DEC-012

> DEC-012 APROBADA el 2026-11-13. Implementación autorizada en backend (no requiere nueva aprobación).
> No se alteró la arquitectura ML V2 ni los frontends. No se tocaron DEC-007/011 ni DEC-002.

## 1. Resumen

Se alinearon las dos rutas públicas de recomendaciones con el envelope canónico V2 (DEC-012.5–.9): éxito, error uniforme y `no_verified_results`. El validador ya cumplía gran parte (campos canónicos, rechazo de desconocidos, defaults, `requestId`, locale, 400 `INVALID_REQUEST`); se implementaron las brechas reales del envelope.

## 2. Archivos modificados

| Archivo | Estado | Cambio |
|---|---|---|
| `backend/src/validators/recommendationRequest.js` | modificado | +`DISCLAIMER`, `buildSafety`, `buildRecommendationSuccessResponse`, `buildHttpErrorEnvelope`; `buildValidationErrorResponse` ampliado (top-level `requestId`, `safety`, `error.retryable`, meta canónica conservando `meta.requestId` legacy). Exportados los nuevos builders. |
| `backend/src/controllers/menuController.js` | modificado | `getPublicRecommendations` y `getGlobalRecommendations` devuelven el envelope canónico (éxito/`no_verified_results`); 404/403/500 ahora son envelope uniforme (`buildHttpErrorEnvelope`). Import de los nuevos builders. |
| `backend/tests/unit/dec012Contract.test.js` | **nuevo** | 16 pruebas (builders + handlers con DB/ML stub) del contrato DEC-012. |
| `docs/audit-v2/13-r2-dec012-contrato-externo.md` | nuevo | este reporte. |
| `docs/implementation-v2/BITACORA.md` | anexado | registro del corte. |

No se modificó `ml-service/*` (ML V2 intacto), ni frontends, ni esquemas/migraciones, ni rutas (nombres conservados).

## 3. Brechas encontradas y corregidas

| # | Brecha (antes) | Corrección (DEC-012) |
|---|---|---|
| 1 | Éxito devolvía `{recommendations, meta:{restaurant_id,totalCandidates,recommendedCount,fallback,mlUsed,mlReason}}` — sin `requestId`/`status`/`safety`/`error` top-level. | `buildRecommendationSuccessResponse`: envelope `requestId, recommendations, meta, status, safety, error:null`. `status.code` = `ok` \| `no_verified_results` \| `partial_results_sanitized` según resultado real. `safety.overall` = `compatible_segun_datos` \| `sin_resultados_verificables`. |
| 2 | `no_verified_results` no existía (vacío devuelto sin estado/safety). | Cuando `recommendations === []` → HTTP 200, `status.code:"no_verified_results"`, `safety.overall:"sin_resultados_verificables"`, sin inventar candidatos. |
| 3 | Errores 404/403/500 usaban `{mensaje}` (no uniforme). | `buildHttpErrorEnvelope`: 404 `NOT_FOUND`/`not_found`, 403 `RESTAURANT_UNAVAILABLE`/`restaurant_unavailable`, 500 `INTERNAL_ERROR`/`internal_error`; con `requestId`, `safety`, `error.retryable:false`, `recommendations:[]`. |
| 4 | Envelope de error 400 carecía de `safety`, `requestId` top-level y `error.retryable`. | `buildValidationErrorResponse` ampliado (conserva `error.code:INVALID_REQUEST`, `status.code:invalid_request`, `meta.requestId`, `recommendations:[]` — no rompe tests existentes). |
| 5 | `meta` no exponía campos canónicos DEC-012.9 (`scope`, `evaluatedCandidates`, `returned`, `limitApplied`). | `meta` ahora incluye `scope`, `totalCandidates`, `evaluatedCandidates`, `returned`, `limitApplied`, `fallback`, `mlUsed` (+ `requestId`, `restaurant_id`, `recommendedCount`, `mlReason` legacy transitorios para no romper consumidores/tests actuales). |

**Ya implementado (no duplicado):** validador estricto con `.strict()` (rechazo de campos desconocidos → 400 `INVALID_REQUEST`), defaults (`limit=5`, `locale=es-MX`, `requestId` generado), rechazo de `locale` inválido, `diet` enum, límites de longitud/cantidad, mapeo legacy determinista, sin aceptar campos de seguridad/elegibilidad del frontend.

## 4. Pruebas ejecutadas y resultados

```
# DEC-012 contract (nuevo) — builders + handlers (DB/ML stub)
node --test tests/unit/dec012Contract.test.js
# -> # tests 16  # pass 16  # fail 0

# Regresión unitaria completa (R2 + fundo + validador + DEC-012)
node --test tests/unit/dec012Contract.test.js tests/unit/r2MlV2Integration.test.js \
  tests/unit/recommendationValidation.test.js tests/unit/restrictionConsolidation.test.js \
  tests/unit/restrictionConsolidation.mockExtraction.test.js tests/unit/eligibilityEvaluation.test.js \
  tests/unit/catalogVerification.test.js
# -> # tests 114  # pass 114  # fail 0

# ML V2 Python (intacto, no tocado este corte)
python -m unittest tests.test_r2_interpret tests.test_r2_rank
# -> Ran 85 tests ... OK
```

Casos cubiertos (16): envelope de validación uniforme; errores HTTP uniformes (404/403/500); éxito → `ok`/`compatible_segun_datos`/`error:null`; sin resultados → `no_verified_results`/`sin_resultados_verificables`; fallback con resultados → `partial_results_sanitized`; handler por-restaurante éxito (keys, scope, `restaurant_id` legacy, `limitApplied`, `returned`, `mlUsed`); handler sin candidatos → 200 `no_verified_results`; campo desconocido → 400; locale inválido → 400 (detalle locale); body vacío → defaults (`limit 5`, `requestId` generado `req_`); restaurante inexistente → 404 envelope; restaurante inactivo → 403 envelope; global éxito (scope global); global sin candidatos; ambas rutas mismo contrato (mismas keys); `requestId` del cliente se propaga.

## 5. Casos no verificables (este entorno)

- **Pruebas de integración con PostgreSQL real** (`b1t02Validation.integration.test.js`, `b1t05Isolation.integration.test.js`, `b1t04Postgres.integration.test.js`): requieren Docker/PostgreSQL activo (no disponible en este entorno de solo código). No se ejecutaron. `b1t05` afirma `meta.restaurant_id` (conservado como legacy para no romperlo) y usa `limit:10` (válido bajo 1..10); `b1t02` afirma 400 `INVALID_REQUEST` para `limit:11` (conservado). Se preservaron las aserciones existentes; los cambios son aditivos.
- **Pruebas pytest del ML** (`test_fuzzy_negation`, `test_tfidf_fuzzy`, `test_ml_service`): pytest no instalado; no ejecutables (no se instalaron dependencias). No afectadas (no se tocó `ml-service` este corte).
- **Frontends**: fuera de alcance (R4); no verificados.

## 6. DEC-012 — antes / después

| Punto | Antes | Después |
|---|---|---|
| 12.1 Rutas canónicas | Rutas existen (legacy-named) | Rutas conservadas (sin renombrar; renombrado = R4). Handler responde contrato V2. |
| 12.2 Request canónico | Validador canónico+legacy ya presente | Sin cambio (ya cumplía). |
| 12.3 Campos desconocidos | `.strict()` → 400 `INVALID_REQUEST` | Sin cambio (ya cumplía); verificado por test. |
| 12.4 Normalización/defaults | trim, defaults (`limit=5`, `locale=es-MX`, `requestId` generado), locale inválido→400 | Sin cambio (ya cumplía); verificado por tests (defaults, locale inválido). |
| 12.5 Respuesta exitosa | **Faltaba** envelope | **Implementado**: `requestId,recommendations,meta,status,safety,error`. |
| 12.6 Errores | 400 parcial uniforme; 404/403/500 `{mensaje}` | **Implementado**: envelope uniforme 400/404/403/500 con códigos estables. |
| 12.7 Sin resultados verificables | **Faltaba** | **Implementado**: 200, `recommendations:[]`, `status.code:"no_verified_results"`. |
| 12.8 Seguridad (safety) | **Faltaba** campo `safety` | **Implementado** (respuesta): `safety.overall`, `hasUnverifiableRestrictions`, `disclaimer` no absoluto. Safety por-ítem (restructura `match`/`reasons`/`safety[]` por item) **pendiente** (no implementado para no romper forma de ítem existente usada por tests/consumidores). |
| 12.9 Meta | `restaurant_id,totalCandidates,recommendedCount,fallback,mlUsed,mlReason` | **Ampliado**: +`scope,evaluatedCandidates,returned,limitApplied`; legacy conservado transitoriamente. |
| 12.10 Degradación segura ML | Ya sin fallback V1 (retirado), fallback solo elegibles | Sin cambio (ya cumplía post-retirada V1). |

## 7. Decisión con conflicto detectada (requiere confirmación)

- **`options.limit` máximo:** el spec aprobado DEC-012/06 §1.3 y §2.2 define `options.limit` **1..10** (default 5) y `meta.limitApplied` 1..10. La instrucción de este corte decía "Límite máximo de recomendaciones: 5". **No se cambió** (permanece 1..10/default 5): (a) es el contrato aprobado, (b) es el comportamiento ya implementado y validado por tests existentes (`limit:8` válido, `limit:11` rechazado), (c) cambiarlo rompería `recommendationValidation` y `b1t05` y desviaría de DEC-012/06. El limit no es una "brecha demostrada". **Punto a confirmar:** si se desea máximo 5 (más restrictivo que el aprobado), requiere actualizar el spec 06 + los tests afectados.

## 8. Pendientes restantes de R2

- **DEC-007** (umbrales numéricos ML) — pendiente de aprobación.
- **DEC-011** (transición operativa) — pendiente de aprobación.
- **DEC-002** (presupuesto MXN) — aprobada, **enforcement no implementado** (no en este corte).
- **Safety por-ítem y restructura de `match`/`reasons[]`** del contrato full (DEC-012.5/12.8) — no implementado (preserva forma de ítem actual para no romper tests/consumidores; requiere coordinación con R4 para adaptar frontends).
- **Campos meta legacy transitorios** (`restaurant_id`, `recommendedCount`, `mlReason`, `meta.requestId`) — conservados para no romper consumidores/tests; retiro en R4.
- **`mlUsed: !!interpretOk || true`** — saneo pendiente (propuesta en `12-r2-retirada-ml-v1.md` §5.5); no requiere decisión nueva.
- **Dedupe de arrays** (DEC-012.4 "donde corresponda") — propuesta, no implementada (menor).
- **Validación UI / integración full con PostgreSQL real** — diferida (R4/R5 o entorno Docker).

**R2 permanece EN PROGRESO.** No se declara terminado globalmente: pendientes DEC-007/011 (aprobación), DEC-002/safety-por-ítem (implementación), y validación integral.

## 9. Restricciones cumplidas

Sin commits/push/PR/merge/rebase/ops destructivas. Sin frontends. Sin esquemas/migraciones. Sin dependencias instaladas. Sin browser E2E. Cambios git preexistentes preservados. DEC-007/011/002 no alterados. Rutas no renombradas. `/interpret`/`/rank` no alterados.


## 10. Continuaci?n 2026-11-15 ? contrato y evidencia delta

- Se rechazan campos legacy en el nivel ra?z; el request p?blico se limita a `craving`, `restrictions` y `options`. Se deduplican valores id?nticos tras trim en tags, alergias y exclusiones. Se conserva el l?mite aprobado 1..10, por defecto 5.
- Se a?ade `match`, `reasons` estructurados y `safety` por platillo a partir de las evaluaciones del backend; solo se presentan candidatos evaluados como elegibles. Las razones externas son texto controlado, no afirmaciones libres de ML. Se detectan restricciones no verificables desde las evaluaciones de candidatos.
- `mlUsed` es falso cuando un ranking vac?o o inv?lido obliga al fallback; describe el uso del ranking para la respuesta, no la mera disponibilidad de `/interpret`.
- La regresi?n Node afectada (contrato DEC-012, R2, validaci?n, consolidaci?n, elegibilidad y cat?logo) pas?: 117 pruebas, 0 fallos. Los handlers usan DB y ML simulados; esto no demuestra integraci?n real. Docker CLI existe pero el motor no estaba disponible; no se ejecut? PostgreSQL real.
- Cumplimiento a?n parcial: DEC-002 sigue sin enforcement; los campos de presupuesto existentes no est?n validados seg?n esa decisi?n. El modelo ?ntegro de datos por platillo y la integraci?n real deben contrastarse con el contrato y datos reales; no se declara DEC-012 ni R2 completos. DEC-007 y DEC-011 siguen pendientes de aprobaci?n; R4/R5 y validaci?n integral permanecen pendientes. Los campos legacy de salida siguen presentes.


## 11. Cierre tecnico delta 2026-11-15

**Estado: PARCIAL.** DEC-012 remite a 06 seccion 1.3, que fija `options.limit` entero 1..10, default 5; se conserva y se verifica 10 valido / 11 invalido.

### Campos de salida
- Exigidos: envelope, `dish` canonico (id, restaurantId, name, description, price, imageUrl, category, dietaryTags, ingredients, active cuando los datos existen), restaurant, match, reasons, safety y meta definidos en 06 seccion 2.2.
- Ningun campo legacy adicional esta explicitamente autorizado como parte del contrato. No existe una clausula expresa que prohiba campos adicionales en la salida.
- Sin justificacion contractual propia: `meta.requestId`, `meta.restaurant_id`, `meta.recommendedCount`, `meta.mlReason`; `matchScore`, `matchPercentage`, `tags`; y los nombres de platillo `nombre`, `descripcion`, `precio`, `url_imagen`, `categoria_nombre`, `etiquetas_dieteticas`, `ingredientes_principales`, `nivel_picante`, `porcion`. Se mantienen aditivamente para consumidores y pruebas actuales; su retirada coordinada corresponde a R4. `reasons` se emite con la estructura canonica.

### Cambios y limites
La proyeccion publica obtiene el platillo de la fila consultada y de la evaluacion de elegibilidad del backend. Se agregaron nombres canonicos y restaurantId; precio, categoria y arrays ausentes o invalidos no se fabrican en la respuesta. No se alteraron el esquema, la elegibilidad ni DEC-002. Los metadatos y campos legacy permanecen. La puntuacion determinista preexistente de fallback es una convencion de orden, no una medicion de similitud verificada; requiere definicion contractual adicional. El validador sigue admitiendo campos de presupuesto sin enforcement de DEC-002: no se afirma cumplimiento de esa parte. Se necesita validar los datos y el contrato integralmente con una base aislada y el proceso backend actualizado.

### Evidencia ejecutada
- `node --test` sobre dec012Contract, r2MlV2Integration, recommendationValidation, restrictionConsolidation, mockExtraction, eligibilityEvaluation y catalogVerification: **119 PASS, 0 FAIL**. Las pruebas de handlers usan stubs DB/ML.
- Docker Desktop 4.48.0, Engine 28.5.1, Compose 2.40.0; contexto desktop-linux; Ubuntu y docker-desktop WSL2 en ejecucion. Desde sandbox Docker y WSL dieron acceso denegado; consulta autorizada fuera del sandbox confirmo motor activo. PostgreSQL, ML y backend figuraban healthy.
- HTTP local real: health backend y ML 200; global limit 11 400 INVALID_REQUEST; restaurante inexistente 404 NOT_FOUND; global limit 1 200 con `mlUsed=true` y `fallback=false`. El proceso backend activo conservaba la proyeccion anterior del platillo: estos resultados no verifican el codigo editado. No se reinicio ni altero el entorno.
- Las pruebas de integracion existentes insertan, actualizan y eliminan fixtures. PostgreSQL activo usa volumen persistente; no se ejecutaron contra este. Sin pruebas de aislamiento HTTP real con datos controlados ni integracion reproducible PostgreSQL+ML del nuevo codigo.

Archivos de este corte: `backend/src/controllers/menuController.js`, `backend/tests/unit/dec012Contract.test.js`, este informe y `docs/implementation-v2/BITACORA.md`. Para declarar CUMPLE: resolver la semantica del score fallback y presupuesto segun decisiones aplicables, comprobar el contrato completo y el aislamiento con datos controlados en entorno autorizado, y ejecutar integracion HTTP del codigo actualizado con PostgreSQL y ML reales. R2 sigue en progreso; DEC-007/011 no aprobadas.


## 12. Integracion real Docker aislada 2026-11-15

**Estado: PARCIAL.** Se verificaron los flujos detallados abajo con servicios reales y datos sinteticos; el contrato de presupuesto DEC-002 no esta implementado por instruccion expresa y la escala numerica del score fallback sigue sin semantica aprobada como coincidencia. No se presenta DEC-012 como completa. R2 sigue en progreso.

### Entorno y trazabilidad
`backend/tests/integration/dec012-isolated/compose.yaml` crea el proyecto `codex-dec012-isolated`, con red interna propia; PostgreSQL 16/pgvector y Redis usan tmpfs exclusivos, sin volumenes persistentes del proyecto principal. Credenciales sinteticas; fuentes y esquema montados en solo lectura. Imagenes locales por SHA: backend `35a336c7d31a`, ML `823a2cfb7b28`, Postgres `a36250871de0`, Redis `9d317178ecea`. Los puertos 127.0.0.1:41473/41474 se reservaron en Compose; Docker Desktop no los publico en la red interna, por lo que las pruebas HTTP se ejecutaron dentro del backend. Segundo backend con ML apuntando a 127.0.0.1:1 simula la caida sin alterar ML real. NODE_ENV=test evita migraciones automaticas del backend. Schema y fixtures se aplicaron exclusivamente a PostgreSQL efimero.

Huella SHA-256 de `menuController.js`, host y contenedor: `5d0a80b4f1cfb174133c3101a8701b4d45451134e440bab5f3f64d0155f84992`. Contenedores backend reiniciados tras editar; no se reinicio el entorno principal. SQL real en la base aislada: 4 platillos sinteticos, 3 activos; la respuesta y las pruebas compararon sus valores con fixtures. La red aislada contiene unicamente los cinco contenedores de prueba.

### Resultado
- HTTP real, `http.test.js`: **8 PASS, 0 FAIL**. Ambas rutas, envelopes, requestId generado/propagado, locale, limites 10/11/default 5, datos y nulos, exclusiones por seguridad, restaurante vacio, dos scopes y platillo inactivo.
- ML V2 real: respuestas validas y `mlUsed=true`, `fallback=false`; logs del servicio registraron llamadas reales `/interpret` y `/rank`. Fallo de ML: instancia separada sin servicio ML, `fallback=true`, `mlUsed=false`, candidatos exclusivamente elegibles y alergia no verificable vacia. Esto es un fallo inducido, no un mock de ML.
- Se detecto y corrigio una omision insegura: con texto libre y fallo de interpretacion se responde vacio `no_verified_results` y `hasUnverifiableRestrictions=true`, en ambos endpoints. Prueba fallo antes y paso tras la correccion. El enfoque es conservador tambien para textos que solo expresen preferencias.
- Python ML V2 unittest: **85 PASS**; regresion Node afectada: **119 PASS, 0 FAIL**. Unit tests de handlers siguen usando stubs; HTTP usa PostgreSQL y ML reales salvo la prueba de caida descrita.
- El fallback existente ordena por nombre/id y genera score ordinal 0.90, 0.89...; no es probabilidad, confianza de ML ni similitud medida. Se anadio aviso en `reasons`, pero los campos `match.score`/porcentaje siguen pudiendo parecer una medicion de coincidencia. Resolver su representacion exige decision de contrato sin inventar umbrales DEC-007. `meta.mlUsed` representa uso de ranking, y es false en fallback; no informa por separado una interpretacion valida utilizada previamente.
- Legacy se conserva por consumidores actuales, adaptacion/remocion en R4. Presupuesto DEC-002 sigue sin enforcement por restriccion del corte; no se aprobaron DEC-007 ni DEC-011.

Archivos: `backend/src/controllers/menuController.js`, `backend/tests/integration/dec012-isolated/{compose.yaml,fixtures.sql,http.test.js,README.md}`, este informe y BITACORA. Se dejan servicios de prueba activos para inspeccion; su PostgreSQL en tmpfs es efimero. No se ejecutaron operaciones destructivas, ni se instalaron paquetes, ni se modificaron datos o volumenes principales.


## 13. DEC-002 presupuesto: implementacion conservadora

**DEC-002: PARCIAL. DEC-012: PARCIAL. R2: EN PROGRESO.** El esquema `platillos.precio` es numerico pero no tiene moneda ni evidencia operativa de convencion MXN; no se autoriza inferirla. El filtro de presupuesto estructurado conserva seguridad por fail-closed: ningun candidato es elegible si la moneda no puede verificarse. Esto impide comprobar funcionalmente precios compatibles sobre el catalogo actual y no constituye enforcement operativo completo.

- El validador admite presupuesto numerico finito >0 y <=100000 con hasta dos decimales; admite null como ausencia; rechaza tipos no numericos, NaN/Infinity, divisa distinta de MXN y budgetPerPerson=true. La moneda faltante para presupuesto activo es MXN. La precision usa representacion decimal, sin tolerancia monetaria.
- Consolidacion conserva presupuesto estructurado con origen backend; presupuestos de extraccion ML, ambiguos o contradictorios no reemplazan la restriccion ni crean filtros duros. Sin presupuesto explicito no se crea limite. La resolucion futura de presupuestos textuales no ambiguos requiere evidencia de intencion y moneda; esta implementacion no convierte salida ML en autoridad.
- Elegibilidad usa un comparador exacto en centavos que solo produce compatible/incompatible cuando recibe evidencia interna confiable de MXN. Las pruebas unitarias usan evidencia sintetica para menor, igual y mayor; el flujo real no dispone de tal fuente y siempre marca la moneda desconocida. No se anade interruptor ni atributo de moneda desde cliente. Precios ausentes/invalidos son desconocidos y nunca elegibles con presupuesto.
- El conjunto elegible se determina antes de ranking; sin evidencia monetaria no se envia candidato a /rank ni al fallback. En fallo de interpretacion y de ML completo no se relaja presupuesto. Una caida exclusiva de /rank con candidatos con presupuesto no pudo ejercitarse realmente: no existen candidatos monetariamente verificables en el esquema actual. El manejo general de caida de rank se cubre con stubs R2; no confundir con integracion real de presupuesto.
- HTTP real aislado: 10 grupos PASS, 0 FAIL, ambas rutas y backend con ML inaccesible; PostgreSQL contenia precios sinteticos 10.00, 37.50 y 52.00, pero ninguna moneda demostrable, por lo que las solicitudes con presupuesto devolvieron `no_verified_results`. Node 124 PASS y ML Python 85 PASS. Huellas SHA256 en contenedor coinciden con workspace: validador 76bd1c38945aed7424e8bafc85050fae41a929084e482b85a2a60ab118db7da4; consolidacion 6190425fb9477ead4360d2f409db0fa9e0211d1a16dffa1580502a6503f4b45c; elegibilidad 7183e9941519c5160b943b0d92174998b6e411edb987b1c95e9f97feb3bbfda9.

### Score fallback: semantica y opciones
El orden determinista alfabetico genera 0.90, 0.89, etc.; se devuelve en `match.score`, `match.matchPercentage`, `matchScore` y `matchPercentage`. Es un ordinal artificial, no confianza de ML ni probabilidad o medicion de compatibilidad. La razon ya advierte esto. Opciones futuras sujetas a decision contractual: permitir score/porcentaje null cuando no hay ranking ML; definir expresamente un campo separado de orden determinista y adaptar R4; o mantener la escala solo si producto aprueba su significado y presentacion. Ninguna opcion ni umbral DEC-007 se aprueba aqui.

### Pendientes
Definir y verificar una fuente confiable de moneda MXN para cada precio o una convencion operativa autorizada y comprobada antes de habilitar comparacion efectiva; integrar esa evidencia en elegibilidad y ejecutar pruebas con candidatos menores, iguales y mayores usando PostgreSQL/ML reales, incluida caida exclusiva de /rank. Resolver tratamiento contractual de texto presupuestario no ambiguo y semantica del score; DEC-007 y DEC-011 siguen pendientes de aprobacion, R4/R5 y validacion integral pendientes.

Archivos de este corte: `backend/src/validators/recommendationRequest.js`, `backend/src/services/restrictionConsolidation.js`, `backend/src/services/eligibilityService.js`, `backend/tests/unit/dec002Budget.test.js`, `backend/tests/unit/dec012Contract.test.js`, `backend/tests/integration/dec012-isolated/http.test.js`, este informe y BITACORA. No se modificaron datos persistentes ni esquemas.


## 14. Auditoria enfocada: verificabilidad de MXN (2026-11-15)

### Evidencia y limites
- `backend/src/db/init.sql` y `db/contract/schema.json`: `platillos.precio` numeric NOT NULL y `precio_original` numeric nullable, sin moneda ni evidencia de procedencia monetaria por platillo. Consulta de `information_schema` en PostgreSQL sintetico aislado confirmo esas dos columnas; no se inspecciono produccion.
- `menuController.js` create exige presencia de nombre/precio y guarda el valor; update asigna precio con COALESCE. No hay declaracion ni trazabilidad de divisa en dichas escrituras. `NuevoPlatillo.tsx` envia precio como FormData sin moneda. No se identifico importador de catalogo en las rutas/scripts inspeccionados; no se descarta una integracion externa o escritura directa.
- `Configuracion.tsx` presenta simbolos configurables, incluido `$ (MXN/USD/CLP)`, USD, EUR y otros; `restaurantController.js` guarda configuracion visual en `configuracion_tema.config_diseno`. Ese simbolo es declaracion de presentacion, mutable y ambigua, no verificacion historica de precio. Otros componentes usan formato `currency: MXN` o texto MXN: evidencia de presentacion/inferencia, no de origen.
- DEC-002 documenta moneda unica MXN y exige evidencia antes de activar comparacion; la decision es politica documentada, no evidencia de registros existentes. No se encontro fuente autoritativa registrada que vincule cada precio vigente a MXN. Datos reales y procedencia externa no fueron inspeccionados.
- Correccion de informe previo: el comparador `evaluateBudgetPrice` existia pero no estaba conectado a la rama `budget`; elegibilidad descartaba por categoria no soportada. Se conecto con `currencyVerified=false`: sigue fail-closed, pero ahora informa moneda desconocida o precio invalido. Ninguna evidencia se invento.

### Alternativas propuestas (sin aprobacion ni migracion ejecutada)
| Opcion | Seguridad y datos historicos | Impacto y compatibilidad | Coste y pruebas |
|---|---|---|---|
| A: evidencia por platillo | Vincula declaracion MXN y evidencia al precio/version; historial desconocido hasta confirmacion individual; revocar ante alteracion sin evidencia. Mayor granularidad. | Migracion aditiva de metadatos y trazabilidad por platillo, escrituras de catalogo y DTO/panel; cargas/importadores deben actualizarse. No asumir MXN automaticamente. | Mayor carga de almacenamiento y operacion; probar cambios de precio, escritura alternativa, acceso por restaurante, concurrencia, evidencia caducada y casos menor/igual/mayor. |
| B: declaracion por restaurante ligada a version de catalogo | Recomendacion: declaracion MXN explicita por responsable autorizado, respaldada por revision del catalogo cubierto; version/snapshot y alcance precisos. Historicos fuera del alcance confirmado, contradictorios o alterados por escritores no controlados permanecen desconocidos. Declaracion global del restaurante sin cobertura/version no basta. | Migracion aditiva de evidencia/auditoria y versionado o cobertura por platillo; cambios en escrituras, consultas y panel para captura/revision. Complejidad de invalidacion en lote; no reutilizar config visual. | Intermedio; probar confirmacion, versionado, inserciones/importaciones posteriores, edicion, revocacion, multi-tenant, escrituras directas, carrera y rollback. |
| C: convencion global MXN | Menor coste solo con procedencia y control verificables de todos los escritores. El repositorio no demuestra esos requisitos; historicos y fuentes externas no quedan verificados por contrato. | Podria requerir controles centralizados y evidencia/versiones persistentes aun sin columna de moneda; cambios en validacion, operaciones y panel. No habilitable ahora por falta de evidencia. | Menor administracion recurrente pero mayor riesgo sistemico; auditar todos los escritores y probar bloqueo de cargas/ediciones no acreditadas. |

En A/B los datos sinteticos pueden probar una declaracion autoritativa simulada, pero no representan confirmacion de restaurantes reales. No se propone conversion ni soporte multimoneda: un registro que contradiga MXN se mantiene no verificable y requiere correccion o revision. Ningun procedimiento debe etiquetar datos historicos en masa sin evidencia.

### Diseno propuesto B, sujeto a autorizacion
1. Responsable autenticado del restaurante revisa catalogo y confirma expresamente que importes/versiones cubiertos son MXN; si un administrador actua, requiere autorizacion definida, evidencia y auditoria. Estado inicial desconocido; guardar alcance, version/snapshot de precio, actor, fecha, procedencia y revocacion. Acordar cobertura exacta, controles para concurrencia, cambios parciales e importaciones antes de disenar migracion.
2. Nuevos platillos solo se consideran verificados tras declaracion aplicable y transaccion de escritura controlada que vincule evidencia al valor; cambios de precio, importaciones y escrituras fuera del flujo invalidan o requieren nueva confirmacion salvo que la politica aprobada permita acreditar la nueva version atomicamente. Inconsistencias o evidencia ausente: desconocido.
3. Validacion conserva MXN unico, consolidacion conserva presupuesto; consultas SQL obtienen evidencia autoritativa y version del mismo alcance que la fila. `eligibilityService` valida evidencia y llama al comparador en centavos. `/interpret` no certifica moneda, `/rank` solo recibe elegibles, fallback usa exactamente ese conjunto; DEC-012 refleja seguridad y sin resultados. Revalidar snapshot ante concurrencia antes de respuesta.
4. Archivos existentes previsiblemente afectados: `backend/src/controllers/menuController.js`, `backend/src/services/eligibilityService.js`, `backend/src/validators/recommendationRequest.js` si cambia contrato de escritura, `backend/src/controllers/restaurantController.js` y `backend/src/routes/restaurantRoutes.js` para declaracion, `backend/src/routes/menuRoutes.js` si se modifica endpoint de platillos, `db/contract/schema.json` y `db/contract/SCHEMA.md` si existe, `backend/src/db/init.sql`, y nueva migracion aditiva a definir en `backend/src/db/migrations/`; tests de elegibilidad, aislamiento y `backend/tests/integration/dec012-isolated/`. El panel `frontend-restaurantes/src/pages/NuevoPlatillo/NuevoPlatillo.tsx` y/o `Configuracion/Configuracion.tsx` requeriria una captura y presentacion acordadas en R4; no modificado ahora. No se han fijado nombres de nuevos campos ni esquema antes de aprobar alcance.
5. Casos a implementar en DB sintetica: menor/igual/mayor y precision en centavos con evidencia valida; sin evidencia, historicos, evidencia contradictoria/revocada, precio cambiado despues de confirmar, aislamiento y carrera entre validacion y actualizacion; ML intenta reintroducir rechazados; fallo de /interpret o /rank y fallback sin relajacion; flujo sin presupuesto. Incluir HTTP real de ambas rutas con pruebas positivas y negativas; no tratar stubs como integracion.

**Autorizacion concreta pendiente:** seleccionar A, B o C y autorizar el diseno/migracion aditiva, el mecanismo y responsable de confirmacion de datos historicos, y el alcance de las adaptaciones del panel. No ejecutar migracion ni tocar datos reales sin aprobacion operativa separada cuando corresponda. DEC-002/DEC-012 siguen PARCIALES; R2 EN PROGRESO.

### Verificacion de este corte
Node: 124 PASS; HTTP real aislado: 10 grupos PASS con PostgreSQL/ML reales y prueba separada de ML inaccesible. Comparaciones con moneda verificada solo unitarias/sinteticas; no hay prueba positiva real de MXN autoritativo. Archivos editados: `backend/src/services/eligibilityService.js`, `backend/tests/unit/dec002Budget.test.js`, este informe y BITACORA.


## 15. Presupuesto opcional y propuesta B para revision

El presupuesto es opcional; sin `budgetMax` no debe consultarse moneda para elegibilidad. Prueba HTTP real aislada: texto `Quiero algo picoso` sin restricciones ni opciones devuelve resultados en ambos endpoints sin moneda verificada, default limit=5. Texto `Quiero algo picoso, pero que no tenga puerco`: /interpret ML identifica picoso y puerco; backend devuelve no_verified_results en ambos endpoints con el catalogo sintetico disponible. La exclusion inferida se considera desconocida y la ausencia de puerco no esta respaldada por evidencia de catalogo; queda pendiente demostrar un caso positivo con exclusion textual verificable, sin relajar seguridad. 12 grupos HTTP PASS, sin afirmar que el ejemplo completo devuelve candidatos verificados.

### Propuesta concreta, no ejecutada ni aprobada
Migracion aditiva propuesta con dos tablas nuevas (nombres provisionales):
1. `restaurante_moneda_confirmaciones`: id UUID PK; restaurante_id FK NOT NULL; moneda TEXT NOT NULL con CHECK moneda='MXN'; estado (`vigente`/`revocada`); actor_id, actor_tipo, confirmado_en, metodo, referencia_evidencia y revocado_en/motivo, con registro auditable. No guardar secretos ni documentos privados en referencia.
2. `platillo_precio_confirmaciones`: confirmacion_id FK, platillo_id FK, precio_confirmado NUMERIC(10,2) NOT NULL, version o hash de precio/cobertura NOT NULL, confirmado_en; unicidad por confirmacion y platillo; relacion del platillo y restaurante validada mediante FK compuesta o transaccion robusta. Ningun default MXN ni migracion de historicos como verificados. La tabla representa evidencia del precio exacto, no autorizacion para convertir divisas.

Confirmacion: el propietario autenticado del restaurante revisa una lista explicita de platillos y precios actuales; el backend obtiene actor y scope desde la sesion, crea cabecera y filas de cobertura en transaccion y verifica que los importes no cambiaron. Confirmar lote solo cubre las filas y valores revisados; nuevas filas, imports o cambios de precio requieren confirmacion adicional. Una revocacion invalida inmediatamente la cobertura. Para evitar carreras, validar/versionar en la misma transaccion y revalidar antes de responder; investigar privilegios/trigger para escrituras fuera de API y acceso DB directo. Propietario confirma solo su restaurante; superadmin solo mediante permiso explicito a definir, con motivo y evidencia trazables, sin asumir que soporte puede confirmar. Cliente no aporta actor, estado ni evidencia autoritativa.

Migracion aditiva, restricciones y plan de rollback requieren aprobacion; no se ha creado archivo SQL ni ejecutado cambios. Sin presupuesto no se exige evidencia monetaria. Con presupuesto, consulta trae evidencia y precio vinculados; elegibilidad valida estado, restaurante, version y precio; despues compara centavos. Desconocido, inconsistente o revocado no es elegible; ML no determina moneda y rank/fallback reciben solo elegibles.

R3: esquema, integridad de claves, indices, transacciones, historicos, proteccion de escritores y validacion de despliegue. R4: flujo de revision/confirmacion, estados desconocido/confirmado/revocado, permisos y accesibilidad; UI de preferencias sin presupuesto no debe exigir moneda. R5: pruebas reales con datos sinteticos para alcance, historicos, cambios, concurrencia, ambos endpoints, ranking y fallo ML. DEC-002 permanece PARCIAL hasta confirmacion autorizada y evidencia positiva real.


## 16. Restricciones naturales y evidencia de ingredientes

El ejemplo `Quiero algo picoso, pero que no tenga puerco` sigue sin producir resultados positivos verificables. ML V2 extrae preferencia picoso y exclusion puerco; la consolidacion marca la exclusion ML inferida como desconocida y la elegibilidad la bloquea. Una extraccion no demuestra que un platillo carezca del ingrediente. El catalogo actual permite evidencia especifica de alergenos y dieta, pero no dispone de evidencia verificada de ausencia de cerdo/derivados ni de una taxonomia y procedimiento aprobados para demostrarla. La falta de una palabra en la receta no demuestra ausencia.

Correccion segura: el saneamiento ya no descarta exclusiones de ML que difieren de las estructuradas; conserva el texto fuente en la trazabilidad de la inferencia y deduplica. Las diferencias siguen desconocidas/protectoras; no se convierten automaticamente en restricciones verificadas. Se rechazan respuestas ML con campos de listas/tipos malformados, activando el fallback conservador existente. Sin ML y con texto libre se responde sin resultados verificables.

Node: 126 PASS (incluye prueba de exclusion estructurada/textual distinta y extraccion malformada). HTTP aislado con PostgreSQL y ML V2 reales: 13 grupos PASS; picoso sin presupuesto devuelve resultados, frase con puerco, sin cerdo, pollo sin cebolla y mezcla con exclusion estructurada devuelven no_verified_results con catalogo sintetico no verificado; caida ML y aislamiento cubiertos. No se ha demostrado caso positivo para exclusion natural de cerdo, ni evidencia sintetica de ausencia autoritativa de cerdo; no presentar pruebas de alergeno como evidencia de cerdo. /rank no recibe candidatos para casos desconocidos por la ruta de elegibilidad existente; no se ha demostrado ranking positivo de exclusion.

Propuesta R3/R4: definir catalogo curado de equivalencias/derivados de cerdo y de otros ingredientes, evidencia de evaluacion especifica por ingrediente y receta/version aprobada, trazabilidad de fuente/responsable, completitud de todas las secciones y compuestos, invalidacion en cambios, mecanismo de confirmacion y auditoria. Separadamente definir corroboracion segura del texto original, manejo de negaciones/contradicciones y pruebas de no omision. Con evidencia sintetica explicita de ese modelo, probar compatible, incompatible y desconocido y verificar que solo elegibles llegan a /rank. No se modificaron esquemas ni se autoriza una nueva taxonomia por este reporte. DEC-002/DEC-012 y R2 siguen pendientes.
