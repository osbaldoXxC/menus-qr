# 10 — Flujo Definitivo, Contratos de Error y Revisión de Coherencia (Fase 1.7)

**Alcance:** especificación documental cerrada para diseño V2. No implementado.  
**Complementa:** `05` (arquitectura), `06` (contratos), `07` (reglas), `09` (decisiones).

## 1. Flujo definitivo end-to-end (coherente FE/BE/ML/DB)

### 1.1 Flujo feliz (dos fases ML)
1. **FE → BE (request):** envía intención y restricciones (`06`, `09`).
2. **BE validación inicial:** schema, tipos, rangos, `options.limit` (1..10), `locale` (BCP-47), normalización, `requestId` (genera si falta), rate-limit, resolución de `scope` (restaurante/global).
3. **BE → ML `/interpret` (fase I):** texto + restricciones estructuradas + locale.
4. **ML → BE (extracción):** `extracted` con entidades, negaciones, alergias/dietas/presupuesto propuestos, confianza y ambigüedades.
5. **BE consolidación (autoridad):** fusiona estructurado + extracción según `09`; resuelve contradicciones (no relajar); marca `desconocido` ante ambigüedad/omisión riesgosa; determina restricciones obligatorias verificables.
6. **BE → PostgreSQL:** obtiene candidatos reales (activos, scope correcto, datos declarados); aplica pre-filtros duros verificables (precio numérico, scope, activo) y prepara evaluación por candidato.
7. **BE elegibilidad:** excluye `incompatible`; para salida verificada excluye candidatos con obligatoria `desconocido` (fail-closed). Construye conjunto elegible acotado.
8. **BE → ML `/rank` (fase II):** solo candidatos elegibles/evaluables + intención + restricciones consolidadas.
9. **ML → BE:** `ranked` propuesto.
10. **BE revalidación final:** verifica ids ∈ candidatos enviados, pertenencia a scope, `active`, datos reales desde DB (precio/restaurante/ingredientes/estado), que ningún descartado reaparezca, coherencia con restricciones obligatorias; descarta ítems inválidos/parciales según política.
11. **BE → FE:** respuesta canónica con `dish/restaurant` hidratados desde PostgreSQL (nunca desde ML), `safety`, `meta`, `status`.

### 1.2 Flujos degradados y de error

| Condición | Fase | Acción BE | Respuesta |
|---|---|---|---|
| Request inválido | 2 | Rechazo inmediato | 400 `INVALID_REQUEST` |
| Restaurante no encontrado | 2/6 | — | 404 `RESTAURANT_NOT_FOUND` |
| Restaurante inactivo/no disponible | 2/6 | — | 403 `RESTAURANT_UNAVAILABLE` |
| Rate limit excedido | 2 | — | 429 `RATE_LIMITED` |
| ML `/interpret` no disponible/timeout/error | 3 | No inferir texto; consolidar solo estructurado; marcar textuales como no verificables si aplican | Continúa a fallback seguro |
| ML `/interpret` inválido/ambiguo crítico | 4 | Tratar extracción como no confiable (`desconocido` donde corresponda) | Continúa a fallback seguro |
| Restricción obligatoria solo textual y no verificable | 5 | Fail-closed | 200 `no_verified_results` |
| ML `/rank` no disponible o respuesta inválida | 8/9 | Descartar ranking ML; ranking determinista sobre elegibles verificados | 200 `meta.fallback=true` |
| ML devuelve ids inválidos/ajenos/parciales | 10 | Eliminar ítems inválidos; si quedan válidos responder con ellos; si resultado utilizable vacío tras saneo aplicar fallback/ranking determinista sobre elegibles | 200 con lista saneada o `no_verified_results` (ver 3.4) |
| Sin candidatos tras filtros obligatorios | 7/10 | — | 200 `no_verified_results` |
| Error interno no recuperable | cualquiera | No filtrar seguridad; log interno | 503 `RECOMMENDATIONS_UNAVAILABLE` (excepcional) |

## 2. Políticas transversales de contrato

### 2.1 `requestId`
- **Formato:** string opaco (recomendado prefijo `req_` + ULID/UUID generado por BE si FE no envía uno válido).
- **Obligatorio:** en trazas internas y en respuestas/meta; FE puede enviarlo (`options.requestId` o header `X-Request-Id`) pero BE **normaliza/genera** si falta o es inválido.
- **Propagación:** FE→BE→ML(`/interpret`,`/rank`)→BE→FE.

### 2.2 `limit` y `locale`
- **`options.limit`:** integer 1..10, default 5. BE es **fuente única**; `meta.limitApplied` refleja valor efectivo. Valores fuera de rango → 400.
- **`options.locale`:** BCP-47, default `es-MX`, whitelist configurable (propuesta: `es-MX`, `es`). Usado para NLP/mensajes; inválido → 400 o fallback a default (decisión de implementación: **propuesta** rechazar inválido).

### 2.3 Fuente de verdad de datos (anti-invención)
- **BE** hidrata `dish`, `restaurant`, `price`, `active`, `ingredients`, `dietaryTags` desde **PostgreSQL** para la respuesta final.
- **ML** no es autoritativo para precio, restaurante, ingredientes, disponibilidad ni ids; solo propone `ranked`/`extracted`/`reasons` de apoyo.
- BE rechaza o descarta cualquier campo autoritativo proveniente de ML.

### 2.4 Validaciones de dominio (BE)
- `scope`/`restaurantId` resuelto y existente; restaurante disponible/activo según regla pública actual.
- Candidatos: `active=true`, pertenecientes al scope, precio numérico válido cuando se evalúa presupuesto.
- Candidato descartado por restricción obligatoria **no** puede reingresar por ranking, reordenamiento ni fallback.

## 3. Contrato de errores y respuestas (BE → FE)

### 3.1 Estructura uniforme (todas las respuestas)

```json
{
  "recommendations": [],
  "meta": {
    "requestId": "req_01J...",
    "scope": { "type": "restaurant", "restaurantId": "..." },
    "totalCandidates": 0,
    "evaluatedCandidates": 0,
    "returned": 0,
    "limitApplied": 5,
    "fallback": false,
    "mlUsed": false
  },
  "status": {
    "code": "ok",
    "message": null,
    "details": []
  },
  "error": null
}
```

En error HTTP (4xx/5xx) se mantiene estructura uniforme:

```json
{
  "recommendations": [],
  "meta": { "requestId": "req_01J...", "returned": 0, "limitApplied": 5, "fallback": false, "mlUsed": false },
  "status": { "code": "invalid_request", "message": "Solicitud inválida.", "details": [] },
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Solicitud inválida.",
    "details": [{ "field": "options.limit", "reason": "must_be_between_1_and_10" }]
  }
}
```

### 3.2 Códigos HTTP y `error.code`

| HTTP | `error.code` / `status.code` | Cuándo |
|---|---|---|
| 200 | `status.code="ok"` | Resultados verificados entregados |
| 200 | `status.code="no_verified_results"` | Sin resultados o ninguno verificable con restricciones obligatorias |
| 200 | `status.code="partial_results_sanitized"` | Se entregan resultados válidos tras descartar ítems/parciales inválidos de ML (sin relajar seguridad) |
| 400 | `INVALID_REQUEST` | Schema, tipos, enums, rangos, `limit/locale` inválidos |
| 403 | `RESTAURANT_UNAVAILABLE` | Restaurante no disponible/suscripción inactiva |
| 404 | `RESTAURANT_NOT_FOUND` | Scope restaurante inexistente |
| 429 | `RATE_LIMITED` | Límite de tasa |
| 503 | `RECOMMENDATIONS_UNAVAILABLE` | Falla interna que impide respuesta segura |

### 3.3 `status.code` (éxito HTTP 200)
- `ok`: `recommendations.length > 0`, todos verificados según política.
- `no_verified_results`: vacío por ausencia de elegibles verificados (incluye ML caído + no verificable).
- `partial_results_sanitized`: subconjunto válido tras saneo; `meta` debe reflejar conteos.

### 3.4 Resultados parcialmente inválidos (ML)
- **Política confirmada:** BE descarta cada elemento inválido (id desconocido, fuera de scope, inactivo, precio inconsistente, forma inválida). **No** completa con datos de ML.
- Si quedan ≥1 válidos y verificados → 200 `partial_results_sanitized` con `recommendations` saneadas.
- Si ninguno queda válido → aplicar fallback determinista sobre elegibles verificados; si no hay → 200 `no_verified_results`.

### 3.5 Ejemplos

**ML no disponible, restricciones estructuradas verificables satisfechas:**
```json
{
  "recommendations": [/* hidratados desde PostgreSQL */],
  "meta": { "requestId": "req_a", "returned": 2, "limitApplied": 5, "fallback": true, "mlUsed": false },
  "status": { "code": "ok", "message": "Resultados generados con verificación determinista.", "details": [] },
  "error": null
}
```

**ML no disponible y restricción obligatoria depende de texto no verificable:**
```json
{
  "recommendations": [],
  "meta": { "requestId": "req_b", "returned": 0, "limitApplied": 5, "fallback": true, "mlUsed": false },
  "status": { "code": "no_verified_results", "message": "No fue posible verificar restricciones expresadas en el texto con la información disponible.", "details": [] },
  "error": null
}
```

**ML devuelve ids inválidos (todos):**
```json
{
  "recommendations": [],
  "meta": { "requestId": "req_c", "returned": 0, "limitApplied": 5, "fallback": true, "mlUsed": false },
  "status": { "code": "no_verified_results", "message": "No se obtuvieron resultados verificables.", "details": [] },
  "error": null
}
```

## 4. Coherencia FE/BE/ML/DB (comprobación documental)

| Verificación | Resultado |
|---|---|
| Contratos encadenados (FE→BE→ML interpret/rank→BE→FE) | Coherentes en `05`,`06`,`09`,`10`; `candidates/ranked` basados en ids reales, respuesta final hidratada por BE desde DB |
| Restricciones obligatorias no omitibles por fallo de ML | Cubierto por fase I + consolidación BE + salvaguardas + fail-closed + fallback seguro |
| Fallback no relaja reglas | Confirmado (solo estructurado verificable, sin NLP inseguro, sin recuperar descartados) |
| Sin afirmaciones alimentarias no verificables | Lenguaje y disclaimers definidos (`07`,`09`) |
| Ranking no recupera descartados | Elegibilidad previa y revalidación final (`05`,`07`,`10`) |
| `confidence` no garantía | Confirmado (`06`,`09`) |

## 5. Elementos no verificables en repositorio (pendientes)
- Calibración real de ML, umbrales de confianza numéricos, métricas de calidad.
- Completitud y veracidad real de datos de menú/ingredientes/etiquetas en BD de producción.
- Configuración efectiva de despliegue (CORS/rate-limits/Redis/índices/moneda operativa).
- Catálogo UI/copy final para estados `desconocido` y decisiones de producto de endpoint global/versionado.
