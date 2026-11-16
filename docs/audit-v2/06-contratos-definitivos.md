# 06 — Contratos Definitivos V2 (Recomendador)

**Alcance:** especificación canónica documental del contrato externo Backend V2 del recomendador (R1) y contratos internos objetivo BE↔ML (R2). **No implementado por este documento.**  
**Fecha de actualización:** 2026-11-13.  
**Decisiones base:** DEC-002 APROBADA (presupuesto MXN, 2026-11-13), DEC-003 APROBADA (arquitectura V2 y separación R1–R5, sin compatibilidad funcional obligatoria con ML v1 ni rutas legacy API pública; FE en R4; R5 integración). **DEC-012 APROBADA (2026-11-13, contrato externo canónico recomendador V2, puntos 12.1–12.10; implementación PENDIENTE, no declara cumplimiento del código actual).** DEC-001/004/005/006/007/008/009/010/011 mantienen estado actual (no aprobadas indirectamente).
**Convenciones:** JSON UTF-8, `Content-Type: application/json`; tiempos ms; precios numéricos; `null` solo donde se indique. Ningún campo/endpoint se considera implementado por estar documentado.

**Clasificación de este documento:** [DOCUMENTADO/PROPUESTO] — especificación de diseño objetivo; la implementación actual difiere (ver sección 11).

---

## 0. Separación por etapa (obligatoria)

| Etapa | Alcance contractual | Estado |
|---|---|---|
| **R1 — Backend externo** | Contrato público V2 (request/response/errores), validación de solicitudes, seguridad y elegibilidad autoritativa en BE, degradación segura externa. Sin adaptar frontends. | Especificación: [DOCUMENTADO/PROPUESTO]. Implementación completa: **NO VERIFICADO/NO CUMPLE** (R1 no aceptado). |
| **R2 — ML interno** | Contratos BE↔ML `POST /interpret` y `POST /rank`, confianza/ambigüedad, timeouts/validación de respuestas ML, fallback/degradación coordinada. | [PROPUESTO/PENDIENTE] — `/interpret` y `/rank` **no implementados**; contrato BE↔ML no resuelto mientras DEC-007/DEC-011 sigan pendientes. |
| **R4 — Frontends** | Adaptación de comensales, restaurantes y administrador a contratos V2 definitivos; retiro de consumo legacy. | [PENDIENTE] — sin modificaciones en esta ejecución; pruebas funcionales FE aplazadas a R4/R5. |
| **R5 — Integración** | Pruebas completas de todos los módulos (3 interfaces + BE + ML V2 + DB), regresiones, seguridad, aislamiento, fallbacks. | [PENDIENTE]. |

---

## 1. Contrato externo R1 — Request (V2 canónico)

### 1.1 Endpoints objetivo (sujeto a ejecución por etapa autorizada, DEC-003)
- **Por restaurante:** `POST /api/public/menu/{restaurantId}/recommendations` (o path canónico V2 definitivo definido en implementación autorizada)
- **Global:** `POST /api/public/menu/recommendations` (o path canónico V2 definitivo)

> [PROPUESTO] Paths/naming definitivos se fijan en implementación autorizada de R1 conforme DEC-003. **Estado actual:** rutas legacy montadas bajo `/api/public/menu` (`/:restaurant_id/recommendations`, `/recommendations`) — [IMPLEMENTADO Y VERIFICADO en código/rutas como existentes, NO conforme a contrato V2 completo].

### 1.2 JSON de referencia (request)
```json
{
  "craving": {
    "text": "tacos de pastor sin cacahuate",
    "tags": ["tacos", "pastor"]
  },
  "restrictions": {
    "allergies": ["cacahuate"],
    "diet": "vegetarian",
    "excludedIngredients": ["cebolla"],
    "budgetMax": 150,
    "budgetCurrency": "MXN",
    "budgetPerPerson": false
  },
  "options": {
    "limit": 5,
    "locale": "es-MX",
    "requestId": "req_optional_client_01"
  }
}
```

### 1.3 Campos, tipos, obligatoriedad y límites

| Campo | Tipo | Obligatorio | Límite / formato | Default | Normalización / regla | Justificación V2 |
|---|---|---|---|---|---|---|
| `craving` | object | No (objeto completo opcional) | — | `{ "text":"", "tags":[] }` | Si falta, se normaliza a vacío | Intención del usuario (texto/tags) para ranking/interpretación |
| `craving.text` | string | No | 0..500 chars UTF-8 | `""` | trim; `null`/ausente → `""` | Preferencia textual libre; entrada a consolidación segura |
| `craving.tags` | string[] | No | máx 10 ítems, 1..40 chars c/u | `[]` | trim por ítem, normalización de strings; dedupe recomendado [PROPUESTO] | Señales estructuradas de intención |
| `restrictions` | object | No | — | `{}` | Objeto de restricciones/preferencias verificables | Agrupa restricciones obligatorias/preferencias |
| `restrictions.allergies` | string[] | No | máx 20, 1..40 chars c/u | `[]` | trim/lower/normalización canónica en BE; dedupe recomendado [PROPUESTO] | Restricción obligatoria de seguridad si declarada |
| `restrictions.diet` | string \| null | No | enum `none`,`vegetarian`,`vegan` (o `null`→`none`) | `none` | trim/lower; `""`/`null`→`none` | Dieta verificable soportada (V2); otras no verificables no garantizadas |
| `restrictions.excludedIngredients` | string[] | No | máx 20, 1..40 chars c/u | `[]` | trim/normalización; dedupe recomendado [PROPUESTO] | Exclusiones explícitas obligatorias si verificables |
| `restrictions.budgetMax` | number \| null | No | numérico, finito, >0, <=100000, máx 2 decimales | `null` | sin coerciones inseguras; validación estricta BE | Presupuesto máximo por platillo (DEC-002) |
| `restrictions.budgetCurrency` | string \| null | No | `MXN` única soportada | omitido → `MXN` cuando aplica `budgetMax` válido | normalizar a mayúsculas [PROPUESTO] | Moneda fija del sistema (DEC-002) |
| `restrictions.budgetPerPerson` | boolean \| null | No | `false` o `null` aceptable; `true` rechazado | `null` | — | `true` no soportado (conversión por persona fuera de alcance, DEC-002) |
| `options` | object | No | — | `{}` | — | Parámetros de respuesta/operación |
| `options.limit` | integer | No | 1..10 | `5` | entero; BE es fuente final y expone `meta.limitApplied` | Acotar resultados/costo |
| `options.locale` | string | No | BCP-47 (ej. `es-MX`), 2..35 chars | `es-MX` | trim; inválido → rechazo 400 (política propuesta, ver pendientes) | Idioma/NLP/mensajes |
| `options.requestId` | string | No | 1..128 chars `[A-Za-z0-9._:-]` | generado por BE si falta/inválido según política | trim; si no provisto BE genera | Trazabilidad end-to-end |

### 1.4 Presupuesto (DEC-002, APROBADA — reglas canónicas)
> **Implementación de enforcement:** [PROPUESTO/PENDIENTE] (no implementado). **Convención MXN en datos existentes/producción:** [NO VERIFICADO] — requiere comprobación operativa antes de habilitar filtro en producción.

1. Moneda fija: `MXN` (ISO 4217). Sin conversiones automáticas ni servicios/tasas/dependencias externas.
2. `budgetMax` = presupuesto máximo por platillo.
3. `budgetCurrency` omitido → `MXN`.
4. Moneda distinta de `MXN` → HTTP 400 `INVALID_REQUEST`.
5. `budgetPerPerson=true` → HTTP 400 temporal `INVALID_REQUEST` (no conversión por persona).
6. Límite máximo: `100000` MXN.
7. `budgetMax` debe ser numérico, finito, >0, <=100000 y máx. 2 decimales.
8. Backend es autoridad y compara contra `platillos.precio`.
9. Comparación solo si ambos valores verificables bajo convención `MXN`.
10. Precio inválido, ausente o no verificable → **no compatible** con restricción presupuestaria (fail-closed).
11. Presupuesto ambiguo/contradictorio extraído de texto → **no** filtro duro.
12. Solicitud legacy/sin presupuesto → válida, sin restricción presupuestaria implícita distinta.

### 1.5 Campos desconocidos, normalización y compatibilidad
- **Campos desconocidos:** [PROPUESTO] rechazar con 400 `INVALID_REQUEST` (`unrecognized_field`) en contrato V2 estricto para evitar ambigüedad/supresión silenciosa. **Implementación actual:** validador usa esquemas strict y reporta `unrecognized_field` en casos cubiertos — [PARCIAL, ver sección 11].
- **Normalización:** trim de strings, límites de longitud/cantidad, default de `craving/options`, `diet` vacío/null→`none`, `requestId` generado si falta. Dedupe de arrays y lowercasing canónico: [PROPUESTO donde no esté implementado].
- **DEC-003:** no conservar campos legacy por costumbre en contrato V2 objetivo. Compatibilidad funcional con rutas/contratos legacy **no obligatoria** (entorno pruebas); FE se adapta en R4. Cualquier aceptación transitoria existente es deuda a retirar en etapa autorizada — [DOCUMENTADO].

### 1.6 JSON de referencia (request mínimo válido, propuesto)
```json
{}
```
Interpretación objetivo: `craving` vacío, sin restricciones obligatorias adicionales, `options.limit=5`, `options.locale="es-MX"`, `requestId` generado por BE. [PROPUESTO; comportamiento exacto sujeto a implementación autorizada].

---

## 2. Contrato externo R1 — Response exitosa (V2 canónico)

> [PROPUESTO] Envelope uniforme para éxito y error. Solo se incluyen recomendaciones que superaron elegibilidad autoritativa en BE e hidratación/rehidratación desde DB.

### 2.1 JSON de referencia (éxito con resultados)
```json
{
  "requestId": "req_01J...",
  "recommendations": [
    {
      "dish": {
        "id": "dish-uuid",
        "restaurantId": "rest-uuid",
        "name": "Tacos al Pastor",
        "description": "Cerdo marinado...",
        "price": 95.0,
        "imageUrl": "https://...",
        "category": "Tacos",
        "dietaryTags": [],
        "ingredients": ["cerdo", "piña", "tortilla"],
        "active": true
      },
      "restaurant": {
        "id": "rest-uuid",
        "name": "Taquería X",
        "slug": "taqueria-x",
        "menuUrl": "https://.../menu/taqueria-x"
      },
      "match": {
        "score": 0.82,
        "matchPercentage": 82
      },
      "reasons": [
        { "type": "semantic_match", "text": "Coincide con tu antojo de tacos al pastor", "evidence": "tags/ingredientes declarados" },
        { "type": "restriction_check", "text": "Sin ingredientes declarados asociados a cacahuate según datos disponibles", "evidence": "ingredientes declarados" }
      ],
      "safety": {
        "overall": "compatible_segun_datos",
        "restrictions": [
          { "type": "allergy", "value": "cacahuate", "status": "compatible_segun_datos" },
          { "type": "diet", "value": "vegetarian", "status": "compatible_segun_datos" }
        ],
        "disclaimer": "Basado en información declarada del menú; no garantiza ausencia de trazas o contaminación cruzada."
      }
    }
  ],
  "meta": {
    "scope": { "type": "restaurant", "restaurantId": "rest-uuid" },
    "totalCandidates": 120,
    "evaluatedCandidates": 30,
    "returned": 1,
    "limitApplied": 5,
    "fallback": false,
    "mlUsed": true
  },
  "status": {
    "code": "ok",
    "message": null,
    "details": []
  },
  "safety": {
    "overall": "compatible_segun_datos",
    "hasUnverifiableRestrictions": false,
    "disclaimer": "Basado en información declarada del menú; no garantiza ausencia de trazas o contaminación cruzada."
  },
  "error": null
}
```

### 2.2 Especificación de campos (éxito)

| Campo | Tipo | Obligatorio | Valores permitidos / formato | Significado |
|---|---|---|---|---|
| `requestId` | string | Sí | 1..128 | Trazabilidad (eco de `options.requestId` o generado por BE) |
| `recommendations` | array | Sí | `[]` permitido | Lista ordenada de recomendaciones elegibles; vacío si no hay resultados seguros/verificables |
| `recommendations[].dish` | object | Sí (por ítem) | datos hidratados desde DB | Datos autoritativos del platillo (nunca autoritativos desde ML) |
| `recommendations[].dish.id` | string/uuid | Sí | id conocido en DB/scope | Identificador canónico |
| `recommendations[].dish.restaurantId` | string/uuid | Sí | pertenece a scope | Aislamiento/propiedad |
| `recommendations[].dish.name/description/price/imageUrl/category/dietaryTags/ingredients/active` | varios | Sí según esquema DB disponible | no inventados | Atributos declarados/hidratados; campos sensibles a privacidad según política [PENDIENTE DEC-?] |
| `recommendations[].restaurant` | object | Sí (por ítem) | DB | Restaurante del platillo (hidratado) |
| `recommendations[].match.score` | number | Sí | 0..1 (propuesto) o rango definido | Score informativo de ranking (no seguridad) |
| `recommendations[].match.matchPercentage` | integer | Sí | 0..100 | Derivado UI, no garantía |
| `recommendations[].reasons[]` | object[] | Sí | `type`, `text`, `evidence?` | Razones con evidencia declarada; sin lenguaje absoluto |
| `recommendations[].safety` | object | Sí | estados definidos | Seguridad/verificabilidad del ítem |
| `recommendations[].safety.overall` | enum | Sí | `compatible_segun_datos` \| `incompatible` \| `desconocido` | Estado agregado del ítem frente a restricciones evaluadas |
| `recommendations[].safety.restrictions[]` | array | Sí | `type,value,status` | Evaluación por restricción |
| `recommendations[].safety.restrictions[].status` | enum | Sí | `compatible_segun_datos` \| `incompatible` \| `desconocido` | `desconocido` ≠ compatible |
| `recommendations[].safety.disclaimer` | string | Sí | texto no absoluto | Límite de garantías (trazas/contaminación cruzada) |
| `meta` | object | Sí | — | Metadatos de ejecución |
| `meta.scope` | object | Sí | `{type:"restaurant"\|"global", restaurantId?}` | Alcance evaluado |
| `meta.totalCandidates` | integer | Sí | >=0 | Candidatos considerados en DB/scope (definición operativa [PROPUESTO]) |
| `meta.evaluatedCandidates` | integer | Sí | >=0 | Candidatos evaluados para elegibilidad/ranking |
| `meta.returned` | integer | Sí | >=0, <= `limitApplied` | Cantidad devuelta |
| `meta.limitApplied` | integer | Sí | 1..10 | Límite efectivo aplicado por BE |
| `meta.fallback` | boolean | Sí | true/false | Si se usó fallback determinista seguro |
| `meta.mlUsed` | boolean | Sí | true/false | Si hubo resultado ML V2 válido utilizado |
| `status` | object | Sí | — | Estado semántico de la respuesta |
| `status.code` | enum | Sí | `ok`, `no_verified_results`, `partial_results_sanitized` | Resultado controlado |
| `status.message` | string\|null | Sí | seguro, no interno | Mensaje para cliente |
| `status.details` | array | Sí | objetos no sensibles | Detalles controlados |
| `safety` | object | Sí | agregado respuesta | Resumen de seguridad/verificabilidad |
| `safety.overall` | enum | Sí | `compatible_segun_datos` \| `sin_resultados_verificables` \| `parcial` | Agregado global |
| `safety.hasUnverifiableRestrictions` | boolean | Sí | — | Indica restricciones no verificables detectadas |
| `safety.disclaimer` | string | Sí | — | Disclaimer obligatorio |
| `error` | null | Sí | `null` en éxito | Sin error en éxito |

### 2.3 JSON de referencia (éxito sin resultados verificables)
```json
{
  "requestId": "req_x",
  "recommendations": [],
  "meta": {
    "scope": { "type": "restaurant", "restaurantId": "rest-uuid" },
    "totalCandidates": 34,
    "evaluatedCandidates": 34,
    "returned": 0,
    "limitApplied": 5,
    "fallback": true,
    "mlUsed": false
  },
  "status": {
    "code": "no_verified_results",
    "message": "No fue posible verificar recomendaciones seguras con la información disponible.",
    "details": []
  },
  "safety": {
    "overall": "sin_resultados_verificables",
    "hasUnverifiableRestrictions": true,
    "disclaimer": "Basado en información declarada del menú; no garantiza ausencia de trazas o contaminación cruzada."
  },
  "error": null
}
```

> **Regla:** HTTP 200 con `recommendations: []` es respuesta controlada válida cuando no hay candidatos elegibles/verificables seguros.

---

## 3. Contrato externo R1 — Errores (uniforme)

> [PROPUESTO] Estructura uniforme para errores HTTP. **No afirmar implementación actual** salvo casos verificados en código (hoy: 400 validación parcial, 404/403 restaurante en handlers, 500 genérico con shape no uniforme; ver sección 11).

### 3.1 Estructura uniforme de error
```json
{
  "requestId": "req_y",
  "recommendations": [],
  "meta": {
    "scope": null,
    "totalCandidates": 0,
    "evaluatedCandidates": 0,
    "returned": 0,
    "limitApplied": 5,
    "fallback": false,
    "mlUsed": false
  },
  "status": {
    "code": "invalid_request",
    "message": "Solicitud inválida.",
    "details": [
      { "field": "restrictions.budgetCurrency", "reason": "unsupported_currency" }
    ]
  },
  "safety": {
    "overall": "sin_resultados_verificables",
    "hasUnverifiableRestrictions": false,
    "disclaimer": "Basado en información declarada del menú; no garantiza ausencia de trazas o contaminación cruzada."
  },
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Solicitud inválida.",
    "retryable": false,
    "details": [
      { "field": "restrictions.budgetCurrency", "reason": "unsupported_currency" }
    ]
  }
}
```

### 3.2 Catálogo de errores objetivo

| HTTP | `error.code` | `status.code` | Condición | Retryable | Notas |
|---|---|---|---|---|---|
| 400 | `INVALID_REQUEST` | `invalid_request` | Schema/tipos/rangos/campos desconocidos/DEC-002 inválido/`locale` inválido | no | Detalles por campo sin exponer internos |
| 401 | `UNAUTHENTICATED` | `unauthenticated` | Autenticación requerida cuando el endpoint lo exija | no | [PENDIENTE DEC-010/alcance: endpoints públicos actuales no exigen auth] |
| 403 | `FORBIDDEN` o `RESTAURANT_UNAVAILABLE` | `forbidden` / `restaurant_unavailable` | Sin autorización o recurso no disponible por suscripción/estado | no | Distinguir caso de negocio vs auth [PROPUESTO] |
| 404 | `NOT_FOUND` o `RESTAURANT_NOT_FOUND` | `not_found` | Restaurante/recurso no encontrado o fuera de alcance permitido | no | No filtrar existencia cross-tenant indebidamente |
| 429 | `RATE_LIMITED` | `rate_limited` | Límite de solicitudes excedido | sí (tras espera) | Políticas/umbrales [PENDIENTE DEC-004/010]; headers `Retry-After` [PROPUESTO] |
| 500 | `INTERNAL_ERROR` | `internal_error` | Error interno no recuperable | no (o según política) | Mensaje seguro, sin stack traces |
| 502 | `ML_BAD_GATEWAY` | `ml_dependency_error` | Respuesta ML inválida/no utilizable tras validación BE | depende | BE debe degradar de forma segura cuando sea posible; 502 solo si no se puede producir respuesta controlada segura [PROPUESTO] |
| 503 | `RECOMMENDATIONS_UNAVAILABLE` o `ML_UNAVAILABLE` | `service_unavailable` | ML/dependencia no disponible y sin fallback determinista verificable | sí | Preferir 200 `no_verified_results` o respuesta controlada cuando la degradación sea segura y completa; 503 si no se puede garantizar respuesta segura [PROPUESTO] |
| 504 | `ML_TIMEOUT` | `ml_timeout` | Timeout de ML y sin fallback determinista verificable | sí | Misma regla de degradación segura que 502/503 |

### 3.3 Reglas de mensajes y metadatos
- `requestId` siempre presente (eco o generado).
- Mensajes seguros, no absolutos, sin secretos/stack traces/internals.
- `details` sin datos sensibles; campo y razón estables.
- No afirmar códigos/condiciones no implementados como vigentes.

---

## 4. Seguridad y elegibilidad (R1, autoritativo BE)

| Regla | Especificación | Clasificación |
|---|---|---|
| Autoridad BE | Backend es única autoridad de validación, seguridad, elegibilidad, aislamiento y respuesta final | [DOCUMENTADO, objetivo] / [PARCIAL implementado] |
| ML no decide elegibilidad | ML propone (`/interpret`, `/rank`); BE valida, filtra, revalida y decide; ML no anula restricciones obligatorias | [DOCUMENTADO] / `/interpret`+`/rank` [NO IMPLEMENTADO] |
| Validación de IDs ML | Todo `dishId`/id devuelto por ML debe pertenecer al conjunto de candidatos elegibles/solicitados y al scope; ids ajenos/desconocidos se descartan | [DOCUMENTADO] / filtrado por elegibles [PARCIAL en código actual] |
| Rehidratación desde DB | Datos finales de platillo/restaurante/precio/activo/scope se hidratan desde PostgreSQL; ML no es fuente autoritativa de catálogo | [DOCUMENTADO] / [PARCIAL: respuestas ML se filtran/sanean parcialmente; hidratación completa canónica NO VERIFICADO] |
| Aislamiento por restaurante | Por-restaurante: solo candidatos activos del restaurante solicitado y disponible; global: solo restaurantes activos/suscripción activa según regla; sin fuga cross-tenant. 404/403 según existencia/disponibilidad | [IMPLEMENTADO Y VERIFICADO parcialmente por código/pruebas históricas e integración b1t05 en alcance probado] |
| Restricciones obligatorias | Alergias, exclusiones, dieta verificable, presupuesto verificable (DEC-002), scope/activo: no anulables por ML, no relajadas por fallback | [DOCUMENTADO] / [PARCIAL: alergias/dieta/exclusiones parciales; presupuesto enforcement PENDIENTE] |
| Desconocidos/contradicciones | `desconocido` ≠ compatible; incertidumbre/ambigüedad/no verificabilidad en restricción obligatoria → fail-closed (excluir de verificados o estado controlado). Contradicciones no relajan seguridad | [DOCUMENTADO] / [PARCIAL: consolidación/elegibilidad conservadora existente] |
| Sin candidatos no elegibles | Ninguna recomendación devuelta sin superar elegibilidad y validación BE; descartados no reaparecen por ranking/fallback | [DOCUMENTADO] / [PARCIAL, NO VERIFICADO exhaustivo] |
| Sin garantías absolutas | Prohibido “100% libre”, “garantizado”, “seguro para alérgicos”; disclaimers obligatorios | [DOCUMENTADO] / [NO VERIFICADO en todas las salidas actuales] |

---

## 5. Matriz de degradación segura (R1↔R2 objetivo)

| Escenario | Condición | Comportamiento BE (autoritativo) | `mlUsed` | `fallback` | `status.code` / HTTP | Clasificación |
|---|---|---|---|---|---|---|
| ML V2 disponible y válido | `/interpret` y/o `/rank` responden dentro de timeout con schema válido e ids pertenecientes a candidatos elegibles | Consolidar restricciones, usar ranking propuesto solo sobre elegibles, revalidar, rehidratar desde DB, responder resultados elegibles | true | false | `ok` o `partial_results_sanitized` / 200 | [PROPUESTO, R2 no implementado] |
| ML responde datos inválidos | Shape/tipos/rangos/ids fuera de candidatos/scope, campos faltantes, `requestId` inconsistente, etc. | Descartar respuesta o ítems inválidos; sanear parciales si hay válidos verificables; si no, fallback determinista sobre elegibles verificados; si no hay, estado controlado. **No usar ML v1 silencioso** | false (o según uso efectivo) | true si aplica | `partial_results_sanitized` o `no_verified_results` / 200 (preferido si seguro); 502 [PROPUESTO] solo si imposible respuesta controlada segura | [DOCUMENTADO/PROPUESTO] / [PARCIAL actual: filtrado por elegibles y fallback] |
| ML excede timeout | Timeout de llamada ML V2 | Cancelar/ignorar tardío, sin reintentos ilimitados; fallback determinista verificable o estado controlado | false | true si aplica | `no_verified_results`/200 o 504 [PROPUESTO] | [DOCUMENTADO/PROPUESTO] / [PARCIAL: timeout existe en llamada legacy `/recommendations`] |
| ML no disponible | Error de red/5xx/indisponibilidad | Igual que timeout: fallback determinista verificable o estado controlado; sin ML v1 silencioso | false | true si aplica | `no_verified_results`/200 o 503 [PROPUESTO] | [PARCIAL implementado con `/recommendations` legacy + fallback] |
| No hay candidatos elegibles | Elegibilidad BE no produce candidatos verificables seguros | No llamar ranking para inventar; responder vacío controlado | false | false/true según flujo | `no_verified_results` / 200 | [DOCUMENTADO] / [NO VERIFICADO integral] |
| Fallback determinista disponible | Existen candidatos cuya elegibilidad fue verificada por BE y pueden ordenarse/seleccionarse determinísticamente con datos declarados | Devolver solo esos candidatos, hidratados desde DB, con `fallback=true`, sin relajar restricciones | false | true | `ok` o `no_verified_results` según resultado / 200 | [PARCIAL implementado: `buildSafeFallbackRecommendations` sobre elegibles] |
| Fallback determinista no disponible | No existen candidatos verificables seguros o datos insuficientes para garantizar restricciones obligatorias | No inventar recomendaciones; responder estado controlado vacío | false | false/true | `no_verified_results` / 200 (preferido) o 503 [PROPUESTO] | [DOCUMENTADO/PROPUESTO] / [PARCIAL] |

**Principios:** sin reintentos ilimitados; timeouts acotados; toda salida ML no confiable hasta validación BE; disponibilidad/resiliencia demostrada por pruebas (no absoluta).

---

## 6. Contratos internos BE↔ML V2 (R2 — objetivo, no resuelto)

> [PROPUESTO/PENDIENTE]. **`/interpret` y `/rank` NO IMPLEMENTADOS.** No declarar contrato BE↔ML resuelto mientras **DEC-007** (umbrales confianza/ambigüedad) y **DEC-011** (transición operativa, propuesta no aprobada) sigan pendientes. DEC-003 fija que ML v1 no es fallback silencioso ni objetivo de compatibilidad funcional.

### 6.1 `POST ${ML_SERVICE_URL}/interpret`
- **Propósito:** extracción estructurada (intención, preferencias, presupuesto, restricciones, negaciones, entidades, confianza, ambigüedad) como **propuesta**. ML no declara elegibilidad.
- **Request (referencia):** `requestId`, `locale`, `craving`, `restrictions` (incl. presupuesto conforme DEC-002), contexto mínimo.
- **Response (referencia):** `requestId`, `extracted{negations,allergyMentions,dietMention,budget{amount,currency,confidence,ambiguous,perPerson,range},entities,notes}`, `meta{modelVersion,executionTimeMs}`.
- **Reglas:** ambigüedad/baja confianza en obligatoria → BE fail-closed; presupuestos ambiguos/contradictorios no filtro duro (DEC-002); timeouts/límites/sin reintentos ilimitados. [PENDIENTE DEC-007 para umbrales].

### 6.2 `POST ${ML_SERVICE_URL}/rank`
- **Propósito:** ordenar **solo candidatos elegibles/evaluables** acotados provistos por BE. Propuesta de ranking.
- **Request (referencia):** `requestId`, `scope`, `craving`, `restrictions` consolidadas, `options`, `candidates` (datos reales DB, acotados), `extracted?`.
- **Response (referencia):** `requestId`, `ranked[{dishId,score,confidence,reasons}]`, `meta{modelVersion,executionTimeMs,candidatesReceived,candidatesRanked}`.
- **Reglas:** solo `dishId` recibidos; BE descarta ids ajenos/fuera de scope/no elegibles; hidrata desde DB; `confidence` informativa no criterio de seguridad. [PENDIENTE DEC-005 top-K, DEC-007].

---

## 7. DEC-012 (APROBADA, documental) y decisiones pendientes

> **DEC-012 — Contrato externo canónico del recomendador V2: APROBADA (2026-11-13). Implementación PENDIENTE DE IMPLEMENTACIÓN.** No afirma envelope/rutas/validaciones ya implementadas ni autoriza modificar código/consumidores/frontends/ML v1. Detalle formal: `docs/audit-v2/09-decisiones-finales.md` §4.1.

| Punto | Estado | Alcance aprobado (documental) | Nota de implementación/dependencia |
|---|---|---|---|
| DEC-012.1 Rutas canónicas | [APROBADO] | Objetivo V2: `POST /api/public/menu/recommendations` (global), `POST /api/public/menu/:restaurant_id/recommendations` (por restaurante); sin alias legacy adicionales ni rutas alternativas innecesarias | Rutas existen hoy [IMPLEMENTADO Y VERIFICADO como existentes] pero cumplimiento contrato V2 [NO VERIFICADO/PENDIENTE]. No autoriza eliminar/modificar consumidores/frontends |
| DEC-012.2 Request canónico | [APROBADO] | `craving` (texto/etiquetas), `restrictions` (alergias, dieta, excluidos, presupuesto), `options` (limit, locale, requestId); ref. campos/tipos/límites este doc; sin recuperar campos legacy por compatibilidad | [PENDIENTE DE IMPLEMENTACIÓN] |
| DEC-012.3 Campos desconocidos | [APROBADO] | Rechazo 400 `INVALID_REQUEST` con información segura del campo inválido, sin internos | [PARCIAL/PENDIENTE DE IMPLEMENTACIÓN] |
| DEC-012.4 Normalización | [APROBADO] | Trim, dedupe cuando corresponda, defaults documentados, `limit`=5, `locale`=`es-MX`, `requestId` generado si falta, locale inválido→400; sin alterar significado de alergias/restricciones/ingredientes | [PARCIAL/PENDIENTE DE IMPLEMENTACIÓN] |
| DEC-012.5 Respuesta exitosa | [APROBADO] | Envelope `requestId,recommendations,meta,status,safety,error`; datos finales platillos/restaurantes desde BE/DB (no autoritativos por ML); estructura recomendación/match/razones/safety según spec | [PENDIENTE DE IMPLEMENTACIÓN] |
| DEC-012.6 Errores | [APROBADO] | Envelope uniforme de errores con códigos estables y mensajes seguros; catálogo HTTP de referencia. Controles/condiciones dependientes de DEC-004/DEC-010 siguen sujetos a esas decisiones | [PARCIAL/PENDIENTE DE IMPLEMENTACIÓN]; 429/políticas globales no aprobadas por DEC-012 |
| DEC-012.7 Sin resultados verificables | [APROBADO] | HTTP 200, `recommendations:[]`, `status.code:"no_verified_results"`, safety indicando ausencia de resultados verificables; no inventar ni devolver no elegibles | [PENDIENTE DE IMPLEMENTACIÓN] |
| DEC-012.8 Seguridad | [APROBADO] | Modelo de campos safety global/por platillo y estados según spec; BE autoridad; ML no declara elegibilidad ni relaja restricciones; disclaimer sin garantías absolutas. Copy definitivo pendiente DEC-001 | [PENDIENTE DE IMPLEMENTACIÓN]; copy [BLOQUEADO POR DEPENDENCIA: DEC-001] |
| DEC-012.9 Meta | [APROBADO] | `scope,totalCandidates,evaluatedCandidates,returned,limitApplied,fallback,mlUsed` con valores reales (no inventar contadores ni uso ML inexistente) | [PENDIENTE DE IMPLEMENTACIÓN] |
| DEC-012.10 Degradación segura ML | [APROBADO] | Sin fallback silencioso ML v1; sin inventar; fallback determinista solo con elegibles verificados por BE; validar/contrastar resultados ML con elegibles; sin verificables→estado controlado vacío; sin reintentos ilimitados; fallo ML no relaja restricciones; no implementar `/interpret`/`/rank` en esta tarea (R2) | [PENDIENTE DE IMPLEMENTACIÓN]; parámetros/umbrales DEC-007 y DEC-011 no aprobados |

### Decisiones pendientes que afectan el contrato (no aprobar)
| DEC | Afectación | Definición provisional segura (si aplica) | Estado |
|---|---|---|---|
| DEC-001 | Copy/UX `desconocido`/no verificable en FE/mensajes | Usar mensajes no absolutos y disclaimers genéricos ya definidos; copy final pendiente | [PENDIENTE DE DECISIÓN] |
| DEC-004 | Rate-limit específico recomendador/global (429, umbrales) | Mantener rate-limit público genérico existente; valores específicos no definidos | [PENDIENTE DE DECISIÓN] |
| DEC-005 | Top-K/acotación candidatos a ML | Usar `options.limit` y acotación defensiva existente; política top-K no definida | [PENDIENTE DE DECISIÓN] |
| DEC-006 | Caché resultados/candidatos | No asumir caché de recomendación; si existe en otro ámbito, no alterar | [PENDIENTE DE DECISIÓN] |
| DEC-007 | Umbrales numéricos confianza/ambigüedad ML | Fail-closed ante ambigüedad/baja confianza/no verificabilidad (sin umbrales numéricos inventados) | [PENDIENTE DE DECISIÓN] |
| DEC-008 | Completitud/verificabilidad operativa catálogo | Tratar datos insuficientes como `desconocido`/no verificable | [PENDIENTE DE DECISIÓN] |
| DEC-009 | Config/despliegue real (CORS/Redis/índices) | No asumir comportamiento productivo | [PENDIENTE DE DECISIÓN / NO VERIFICADO] |
| DEC-010 | Alcance endpoint global y controles anti-abuso | Mantener alcance actual conocido; controles específicos pendientes | [PENDIENTE DE DECISIÓN] |
| DEC-011 | Transición operativa legado vs `/interpret`+`/rank` | No usar ML v1 como fallback silencioso (DEC-003); forma de transición concreta no aprobada | [PENDIENTE DE DECISIÓN / propuesta no aprobada] |

---

## 8. Trazabilidad de decisiones aprobadas
- **DEC-002 (APROBADA):** sección 1.4 y campos budget en 1.3/6.1.
- **DEC-003 (APROBADA):** secciones 0, 1.1, 1.5, 5, 6, y principio de no compatibilidad funcional obligatoria con ML v1/rutas legacy; FE R4, integración R5.

---

## 9. Ejemplos complementarios

### 9.1 Error 400 presupuesto (DEC-002)
```json
{
  "requestId": "req_b",
  "recommendations": [],
  "meta": { "scope": null, "totalCandidates": 0, "evaluatedCandidates": 0, "returned": 0, "limitApplied": 5, "fallback": false, "mlUsed": false },
  "status": { "code": "invalid_request", "message": "Solicitud inválida.", "details": [{ "field": "restrictions.budgetCurrency", "reason": "unsupported_currency" }] },
  "safety": { "overall": "sin_resultados_verificables", "hasUnverifiableRestrictions": false, "disclaimer": "Basado en información declarada del menú; no garantiza ausencia de trazas o contaminación cruzada." },
  "error": { "code": "INVALID_REQUEST", "message": "Solicitud inválida.", "retryable": false, "details": [{ "field": "restrictions.budgetCurrency", "reason": "unsupported_currency" }] }
}
```

### 9.2 404 restaurante no encontrado
```json
{
  "requestId": "req_nf",
  "recommendations": [],
  "meta": { "scope": { "type": "restaurant", "restaurantId": null }, "totalCandidates": 0, "evaluatedCandidates": 0, "returned": 0, "limitApplied": 5, "fallback": false, "mlUsed": false },
  "status": { "code": "not_found", "message": "Recurso no encontrado.", "details": [] },
  "safety": { "overall": "sin_resultados_verificables", "hasUnverifiableRestrictions": false, "disclaimer": "Basado en información declarada del menú; no garantiza ausencia de trazas o contaminación cruzada." },
  "error": { "code": "RESTAURANT_NOT_FOUND", "message": "Recurso no encontrado.", "retryable": false, "details": [] }
}
```

---

## 10. Restricciones de documentación
- No afirma implementación de `/interpret`/`/rank`, enforcement DEC-002, ni contratos ejecutables completos.
- No modifica ni aprueba DEC pendientes.
- Frontends no modificados (R4). R1 no declarada terminada.

## 11. Diferencias entre contrato propuesto e implementación actual (evidencia)
| Área | Contrato V2 propuesto (este doc) | Implementación actual observada | Clasificación |
|---|---|---|---|
| Endpoints | Paths canónicos V2 definitivos por etapa autorizada | `POST /api/public/menu/recommendations` (global) y `POST /api/public/menu/:restaurant_id/recommendations` bajo `publicRoutes` montado en `/api/public/menu` (y también `/api/public` en index) | [IMPLEMENTADO Y VERIFICADO: rutas existen] / [NO conforme a naming/contrato V2 definitivo] |
| Request | `craving/restrictions/options` canónico, budget DEC-002 enforced, campos desconocidos rechazados de forma completa/política definida | `recommendationRequest.js`: acepta canónico+legacy, `limit` 1..10, `locale` BCP-47-like, `requestId` generado, `budget*` preservados estructuralmente **sin enforcement DEC-002**, `socialContext` aceptado en entrada legacy/ignorado en canónico | [PARCIAL] |
| 400 validación | Envelope uniforme `requestId/recommendations/meta/status/safety/error` | `buildValidationErrorResponse` devuelve `recommendations/meta{requestId,returned,limitApplied,fallback,mlUsed}/status/error` (sin `safety` agregado completo ni `meta.scope/evaluatedCandidates/totalCandidates` canónicos) | [PARCIAL] |
| Respuesta éxito | Envelope uniforme con `requestId`, `meta.scope/totalCandidates/evaluatedCandidates/returned/limitApplied/fallback/mlUsed`, `status`, `safety`, items con `dish/restaurant/match/reasons/safety` hidratados | `getPublicRecommendations/getGlobalRecommendations` devuelven `recommendations` + `meta{restaurant_id,totalCandidates,recommendedCount,fallback}`; sin `requestId` raíz, sin `status/safety` canónicos, sin `mlUsed` explícito en éxito, sin rehidratación completa canónica ni estructura de ítem V2 | [NO CUMPLE contrato V2 / PARCIAL funcional] |
| 404/403/500 negocio | Envelope uniforme y códigos estables | 404/403 restaurante devuelven `{mensaje:...}`; 500 devuelve `{mensaje:...}` (no uniforme V2) | [IMPLEMENTADO simple, NO conforme V2] |
| 429/502/503/504 | Definidos uniformemente | No evidenciados en handlers del recomendador (429 depende de rate-limit genérico middleware) | [NO VERIFICADO/NO IMPLEMENTADO como contrato] |
| Integración ML | V2 `/interpret`+`/rank`, sin ML v1 silencioso | Llama a `POST ${ML_SERVICE_URL}/recommendations` (ML v1 legado) con timeout 12s; filtra recomendados por `eligibleIds`; fallback `buildSafeFallbackRecommendations` | [IMPLEMENTADO legacy/funcional] / [NO conforme DEC-003 objetivo] |
| Seguridad/eligibilidad | Revalidación/rehidratación completa, presupuesto DEC-002, todos los obligatorios | Consolidación fail-closed (`mlExtraction:null`), elegibilidad y filtros básicos/saneo por elegibles, scope/activo/suscripción en consultas; enforcement presupuesto y rehidratación/contrato completo pendientes | [PARCIAL] |
| Pruebas | Contrato V2 completo | Evidencia registrada: unit validación 10, consolidación 15, consolidación mock 8 (simulada), integración b1t02 3, b1t05 4, b1t04PG 4, E2E B1-T04 36 histórico | [PARCIAL] |

