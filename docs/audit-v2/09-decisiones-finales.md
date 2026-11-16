# 09 — Decisiones Finales, Presupuesto y Verificabilidad (Fase 1.7)

**Alcance:** cierre documental (solo lectura del código). **No** modifica código, DB ni configuración.  
**Base:** `audit-report.md`, `00`–`08`, inspección estática (`menuController.js`, `main.py`, `init.sql`, `publicRoutes.js`, `index.js`, FE recomendador).  
**Leyenda de estado:** **Confirmada (diseño V2)** = decisión técnica cerrada para el contrato/arquitectura objetivo; **Propuesta** = recomendación sujeta a validación en implementación; **Pendiente** = requiere información o decisión de producto/operación no presente en el repositorio.

## 1. Cierre del problema de interpretación (restricciones en texto libre)

### 1.1 Problema
El flujo anterior asumía prefiltrado BE antes de ML, pero una restricción obligatoria puede existir solo en texto (ej. «sin cacahuate»). Si BE filtra sin interpretar texto, puede omitirla; si ML filtra sin autoridad, viola S5/Q1.

### 1.2 Decisión confirmada (diseño): dos fases ML con autoridad de Node

| Fase | Llamada | Entrada | Salida | Responsable de decisión |
|---|---|---|---|---|
| **I. Interpretación** | `POST ${ML_SERVICE_URL}/interpret` | `requestId, locale, craving.text/tags, restrictions` estructuradas, contexto mínimo | `extracted` (negaciones, alergias/dietas/presupuesto mencionados, entidades, confianza, ambigüedades) | ML **propone**; **BE valida y consolida** |
| — | (BE interno) | extracción + request estructurado | conjunto obligatorio consolidado + consulta PostgreSQL + elegibilidad verificable | **BE autoridad** |
| **II. Ranking** | `POST ${ML_SERVICE_URL}/rank` | `requestId, craving, restrictions` consolidadas, `candidates` **solo elegibles/evaluables** según política, `limit` | `ranked` (ids candidatos, score, reasons con evidencia) | ML **propone orden**; **BE revalida** |

**Justificación:** preserva autoridad de Node (BE decide elegibilidad con DB y reglas), evita enviar/rankear candidatos ya descartables por restricciones estructuradas, y captura restricciones textuales antes del filtrado por DB. **Evidencia:** requisito F1.7; hallazgos S5/Q1 (`02`,`03`); contrato actual pasa `dishes` completo sin fase de interpretación (`menuController.js`, `main.py`).

**Alternativa evaluada (rechazada):** una sola llamada «todo en uno» obliga a elegir entre (a) BE filtra sin NLP (pierde texto) o (b) ML filtra (pierde autoridad). No cumple «restricción no desaparece silenciosamente» con autoridad BE.

### 1.3 Consolidación de restricciones (BE, obligatorio)

1. Normalizar request estructurado (`restrictions.*`, `options.*`).
2. Recibir `extracted` de ML (si disponible) con `confidence` y marcas de ambigüedad por campo.
3. Construir **conjunto obligatorio candidato** = unión de restricciones estructuradas + restricciones inferidas del texto **solo** cuando sean determinables y no ambiguas según política.
4. Resolver contradicciones (ver 1.4, 2.3): la seguridad no se relaja.
5. Para cada restricción obligatoria: determinar si es **verificable** con datos disponibles; si no, estado `desconocido` (fail-closed para salida verificada).
6. Consultar PostgreSQL y aplicar elegibilidad (solo datos reales).
7. Enviar a ranking únicamente candidatos que cumplen política de elegibilidad (nunca `incompatible`; y nunca `desconocido` en restricciones obligatorias para resultados verificados).

### 1.4 Manejo de escenarios obligatorios

| Escenario | Comportamiento confirmado | Resultado |
|---|---|---|
| **ML no disponible (fase I o II)** | No interpretar texto de forma insegura. BE aplica solo restricciones estructuradas verificables; restricciones que dependan del texto (negaciones/alergias solo en texto) se tratan como **no verificables** para garantía. | `meta.mlUsed=false`, `meta.fallback=true`. Si quedan candidatos plenamente verificables respecto de obligatorias declaradas/estructuradas: ranking determinista seguro. Si existe obligación potencial solo textual no verificable: `recommendations: []`, `status.code="no_verified_results"` (no desaparición silenciosa). |
| **Negación ambigua** (ej. «sin algo quizás», doble negación confusa, alcance incierto) | ML debe marcar `ambiguity=true` o confianza baja; BE **no** la convierte en exclusión compatible. | Restricción tratada como `desconocido` (obligatoria si afecta seguridad/preferencia excluyente del usuario) → excluye de resultados verificados; respuesta puede indicar precisión requerida. |
| **ML omite una restricción posiblemente obligatoria** presente en texto | Riesgo NLP conocido. BE aplica salvaguarda: si el texto contiene marcadores de exclusión/alergia/presupuesto (patrones detectables por reglas simples en BE, sin inferencia semántica profunda) y ML no los refleja, BE marca posible restricción como `desconocido` obligatorio. | `no_verified_results` o conjunto vacío verificado; **nunca** ignorar silenciosamente. (Reglas de detección: propuesta de implementación, no regex en este doc como código). |
| **Extracción contradice restricción estructurada** | Prioridad: **no relajar**. Restricción estructurada explícita del usuario prevalece como intención declarada; si texto sugiere lo contrario (ej. texto «con queso», estructurado alergia lácteos), se mantiene la restricción protectora y se registra contradicción. | Aplicar la más restrictiva/segura; incluir nota en `status`/`safety` si se define; no recomendar incompatible. |
| **ML devuelve entidades desconocidas** | Entidades no mapeadas a catálogos/ingredientes conocidos no generan compatibilidad. | `desconocido` para la restricción asociada; no filtrar como seguro ni como match positivo sin evidencia. |

**Regla transversal:** ninguna restricción expresada por el usuario puede desaparecer silenciosamente. Si no se puede confirmar con seguridad, el sistema falla cerrado para la verificación (estado `desconocido`, sin resultado verificado).

## 2. Presupuesto (contrato inequívoco)

> **DEC-002 — APROBADA (usuario, 2026-11-13). Formalización documental; implementación pendiente.** No se asume implementación por aprobación documental; B1-T02/B1-T03/B2-T01 y criterios dependientes no se marcan completados automáticamente.

**Reglas canónicas aprobadas:**
1. Moneda fija `MXN` (ISO 4217); sin conversiones automáticas y sin servicios/tasas/dependencias externas de conversión.
2. `budgetMax` = presupuesto máximo por platillo.
3. `budgetCurrency` omitido → `MXN`.
4. Moneda distinta de `MXN` → 400 `INVALID_REQUEST`.
5. `budgetPerPerson=true` → 400 temporal (sin conversión por persona).
6. Límite máximo `100000` MXN.
7. `budgetMax` numérico, finito, >0, <=100000, máx. 2 decimales.
8. Backend es autoridad para comparar contra `platillos.precio`.
9. Comparación solo si ambos valores verificables bajo convención `MXN`.
10. Precio inválido/ausente/no verificable no compatible con restricción presupuestaria.
11. Presupuestos ambiguos/contradictorios en texto no son filtros duros.
12. Solicitudes legacy sin presupuesto siguen válidas (sin restricción presupuestaria implícita distinta).

**Evidencia y limitación de datos:** `backend/src/db/init.sql` y `db/contract/schema.json` definen `platillos.precio`/`precio_original` como numéricos sin columna de moneda; no existe moneda explícita en catálogo/BD versionada. La convención `MXN` está aprobada documentalmente pero **NO VERIFICADA** en datos existentes/producción; se requiere comprobación operativa antes de habilitar filtro presupuestario en producción.

### 2.1 Modelo de dato (objetivo)

| Campo | Tipo | Obligatorio | Valores/validación | Notas |
|---|---|---|---|---|
| `restrictions.budgetMax` | number \| null | No | Numérico, finito, > 0, <= 100000, máx 2 decimales | Presupuesto máximo por platillo. Comparación solo si `budgetMax` y `platillos.precio` verificables bajo convención `MXN`. |
| `restrictions.budgetCurrency` | string \| null | No | `MXN` (única soportada); omitido → `MXN` cuando aplica | Moneda distinta de `MXN` → 400 `INVALID_REQUEST`. Sin conversiones/tasas/servicios externos. |
| `restrictions.budgetSource` | enum | Derivado por BE | `"structured"` \| `"text_extraction"` \| `"none"` | Trazabilidad; ML propone, BE valida/autoriza. |
| `restrictions.budgetPerPerson` | boolean \| null | No | `false`/`null` permitido; `true` rechazado | `budgetPerPerson=true` → 400 temporal (sin conversión por persona). |

`extracted.budget` (ML→BE, fase I, propuesta): `{ amount: number|null, currency: string|null, confidence: "high"|"medium"|"low", ambiguous: boolean, perPerson: boolean|null, range: {min,max}|null, rawText?: string }`.

### 2.2 Fuente y prioridad
- **Prioridad:** campo estructurado válido conforme DEC-002 (`budgetMax` válido, moneda `MXN` explícita u omitida→`MXN`, `budgetPerPerson` no `true`) **prevalece** sobre extracción de texto.
- Extracción de texto puede usarse **solo** si no hay `budgetMax` estructurado válido y el valor es inequívoco, único y determinable como `MXN` dentro de límites DEC-002. Presupuestos ambiguos/contradictorios en texto **no** son filtros duros.
- Solicitudes legacy sin presupuesto siguen válidas y no reciben restricción presupuestaria implícita.

### 2.3 Contradicción texto vs estructurado
- BE mantiene el valor estructurado válido (prioridad) y registra discrepancia en meta/logs internos cuando aplique.
- Contradicciones/ambigüedades presupuestarias en texto no convierten el presupuesto en filtro duro.

### 2.4 Ambigüedades y casos
| Caso | Tratamiento (DEC-002) |
|---|---|
| Cantidad ambigua («barato», «económico», «no muy caro») | Ambiguo/contradictorio en texto → **no** filtro duro |
| Rango («entre 100 y 150») | No filtro duro salvo valor único inequívoco y válido conforme DEC-002 |
| Presupuesto por persona (`budgetPerPerson=true`) | 400 `INVALID_REQUEST` temporal |
| ML no puede determinar presupuesto | `amount=null` / ambiguo/baja confianza/contradictorio → sin restricción presupuestaria dura derivada de texto |
| Moneda omitida | `budgetCurrency` omitido → `MXN` (si `budgetMax` válido) |
| Moneda distinta de `MXN` | 400 `INVALID_REQUEST` |
| `budgetMax` inválido (no numérico/no finito/<=0/>100000/>2 decimales) | 400 `INVALID_REQUEST` |
| Precio inválido/ausente/no verificable | No compatible con restricción presupuestaria verificable (no asumir compatibilidad) |

**Autoridad:** BE valida formato/valor/moneda/reglas DEC-002 y compara contra `platillos.precio` bajo convención `MXN` verificable. ML **propone**, nunca autoriza. Sin conversiones, tasas ni dependencias externas.

## 3. Verificabilidad alimentaria

### 3.1 Criterios de estados (concretos)

| Estado | Criterio |
|---|---|
| `compatible_segun_datos` | (1) Datos del platillo **suficientes** para la restricción evaluada según criterio de completitud, (2) evaluación determinista sobre datos declarados normalizados **sin match positivo** de incompatibilidad, (3) alcance limitado a información declarada. No implica ausencia de trazas ni contaminación cruzada. |
| `incompatible` | Evidencia declarada positiva de incumplimiento (alérgeno/ingrediente excluido presente, etiqueta dietética contraria verificable, `price > budgetMax`, fuera de scope/inactivo). |
| `desconocido` | Datos insuficientes, ingrediente/alérgeno no mapeable con certeza, completitud no satisfecha, etiqueta dietética no verificable, contaminación cruzada no documentada, o ambigüedad no resuelta. **Nunca** tratado como compatible. |

**Regla:** ausencia de información ≠ ausencia de alérgenos.

### 3.2 Requisitos de datos (PostgreSQL) para declarar compatibilidad

Para **alergias/exclusiones** (`compatible_segun_datos`):
- Lista de ingredientes declarados del platillo disponible y **completa según criterio** (ver 3.4), incluyendo complementos relevantes si aplican.
- Normalización/mapeo a vocabulario de alérgenos/ingredientes (incl. sinónimos y derivados conocidos) — hoy parcial/heurístico (`main.py`, JSONB).
- Sin hallazgo del alérgeno/exclusión en campos evaluados.

Para **dieta** (`compatible_segun_datos`):
- Etiqueta dietética **verificada** o evidencia estructurada equivalente y consistente con ingredientes declarados; sin evidencia → `desconocido`.
- Vegetarian/vegan: requiere declaración verificable de ausencia de ingredientes animales pertinentes; inferencia solo textual no basta para «según datos» verificado.
- Keto: requiere criterio nutricional/etiquetado verificable; con esquema actual **no verificable de forma confiable**.

Para **contaminación cruzada:** siempre `desconocido` salvo declaración explícita y verificable del restaurante (campo/proceso no observado en esquema actual) → se comunica en disclaimer.

### 3.3 Evaluación de casos
| Caso | Tratamiento |
|---|---|
| Ingredientes completos (según criterio) | Permite evaluación; resultado `compatible_segun_datos` o `incompatible` según match |
| Ingredientes incompletos | `desconocido` para restricciones dependientes de ingredientes |
| Ingredientes desconocidos/no mapeados | `desconocido` (o `incompatible` solo si match positivo inequívoco por evidencia disponible) |
| Alérgenos identificados | `incompatible` |
| Ingredientes derivados (ej. suero, salsa con trazas declaradas, aceite de cacahuate) | `incompatible` si el mapeo alérgeno↔derivado es conocido y declarado; si derivado posible pero no declarado/mapeado → `desconocido` (no asumir ausencia) |
| Etiquetas dietéticas verificadas | Insumo para `compatible_segun_datos` de dieta (con coherencia) |
| Etiquetas no verificadas / solo heurística | `desconocido` para dieta verificada |
| Contaminación cruzada no documentada | `desconocido` + disclaimer obligatorio |
| Declarado por restaurante vs verificado | Esquema actual almacena **declarado**; «verificado» requeriría fuente/proceso/campo adicional — **no disponible** (limitación) |

### 3.4 Criterio de completitud de datos (propuesto)

**Propuesta (diseño):** un platillo es **completo para evaluación de alergias/exclusiones** cuando: (a) `ingredientes_principales` es una lista explícita no vacía de tokens normalizables, (b) se indica cobertura de componentes relevantes (p.ej. salsas/complementos) o se marca explícitamente como completo, y (c) no hay bandera de «datos pendientes». Si falta (a),(b) o existe incertidumbre → `ingredientes_completos=false` → restricciones dependientes = `desconocido`.

**Umbral operativo sugerido:** 0% de resultados verificados con datos incompletos (fail-closed). Métrica de calidad de catálogo (porcentaje de platillos completos) es objetivo de datos, no de relajación.

**Limitaciones del esquema actual (`init.sql`, evidencia `00`/`03`):** `ingredientes_principales`, `complementos`, `etiquetas_dieteticas` son JSONB sin esquema fuerte ni bandera de completitud/verificación; existen catálogos (`ingredientes_catalogo`, `sabores_catalogo`, `receta_platillo`) cuya integración con el recomendador es **NO VERIFICADA**; no hay campo de contaminación cruzada ni procedencia/verificación. **Conclusión:** verificabilidad fuerte hoy es **PARCIAL**; el sistema debe operar fail-closed.

## 4. Decisiones pendientes (resolución F1.7)

| # | Tema | Decisión | Estado | Información faltante (si aplica) |
|---|---|---|---|---|
| 1 | Dietas verificables expuestas inicialmente | Exponer solo dietas con evidencia declarada verificable por platillo: **`vegetarian` y `vegan`** cuando cumplan 3.2/3.4; **`keto` y otras NO exponer como filtro verificado** hasta contar con datos/criterio nutricional verificable. Si se solicita no soportada: tratar como `desconocido`/no verificable (no afirmar compatibilidad). | **Confirmada (diseño)** | Catálogo real de etiquetas y calidad de datos en producción **NO VERIFICADO** en repo |
| 2 | UX de restricciones desconocidas | No presentar como compatibles. Mostrar estado explícito «no verificable según datos disponibles», disclaimer y razones; por defecto **excluir de recomendaciones verificadas**; opción de vista informativa secundaria solo si producto lo aprueba, siempre marcada como no verificada (nunca `compatible_segun_datos`). | **Confirmada (diseño, regla)** / copy exacto **Pendiente** (producto) | Textos/UI finales y decisión de mostrar u ocultar lista «no verificable» |
| 3 | Alcance y controles endpoint global | Mantener alcance global **solo si** se acota (candidatos top-K, paginación/límites), rate-limit específico más estricto que público genérico, cache y observabilidad; endpoint por restaurante como vía preferente. Sin auth en alcance público actual (evidencia) pero endurecer abuso. | **Propuesta** (requiere decisión operativa) | Tráfico esperado, SLAs, política de producto y configuración real de despliegue **NO VERIFICADA** |
| 4 | **DEC-003 — Arquitectura V2 y retirada de compatibilidad legacy** (APROBADA, 2026-11-13, aprobación explícita usuario) | Arquitectura objetivo: contratos V2 canónicos. ML v1 (`POST /recommendations`) no se mantiene por compatibilidad funcional; ML V2 = `POST /interpret` + `POST /rank`. BE autoridad (validación/seguridad/elegibilidad/aislamiento/respuesta final), valida respuestas ML, timeouts/límites, sin reintentos ilimitados, sin fallback silencioso de ML v1; fallback determinista solo con candidatos verificables o estado controlado, sin inventar recomendaciones. Rutas legacy API pública no forman parte del objetivo; no compatibilidad funcional permanente con clientes legacy. FE (3 interfaces) se adapta en R4; R5 integración/validación integral. Retirada efectiva de código legacy por módulo/etapa autorizada verificando dependencias. Entorno de pruebas. **No declara implementado.** | **APROBADA (DEC-003)** | Implementación/retirada por etapas autorizadas; contratos V2 detallados/ejecutables y dependencias (DEC-007/008/011 estado actual) pendientes donde aplique |
| 5 | Uso de `confidence` | **Informativo únicamente** (estimación no calibrada). No usar como umbral de seguridad, no mostrar como garantía, no excluir/incluir por sí solo en restricciones obligatorias. | **Confirmada (diseño)** | Calibración/model metrics **NO VERIFICADAS** |
| 6 | Umbral de completitud de datos | Para recomendar como verificado: **100% de restricciones obligatorias en `compatible_segun_datos`** y completitud satisfecha (3.4) en los datos usados. Platillos bajo umbral → `desconocido` (excluidos de verificados). | **Confirmada (diseño)** | Porcentaje real de completitud del catálogo **NO VERIFICADO** |
| 7 | Comportamiento ante ambigüedad NLP | Si ambigüedad afecta restricción potencialmente obligatoria: marcar `desconocido`, fail-closed, no inferir; opcionalmente solicitar precisión al usuario (flujo UX) sin completar recomendación verificada. | **Confirmada (diseño)** | Umbrales numéricos de confianza ML **Pendiente** (calibración no disponible) |
| 8 | Estrategia de fallback | ML indisponible/inválido → BE aplica solo reglas deterministas sobre datos estructurados/verificables; ignora inferencias textuales no verificables; revalida todo; si no puede garantizar obligatorias → `no_verified_results` vacío; nunca relaja, nunca inventa, nunca usa ranking para recuperar descartados. | **Confirmada (diseño)** | — |

## 4.1 DEC-012 — Contrato externo canónico del recomendador V2

- **Estado:** APROBADA.
- **Fecha:** 2026-11-13.
- **Aprobación:** explícita del usuario.
- **Alcance:** formalización documental del contrato externo V2 del recomendador. **Implementación: PENDIENTE DE IMPLEMENTACIÓN.** No declara código/rutas/contratos ejecutables implementados ni verificados por esta aprobación.

### Puntos aprobados (exclusivos)

| Punto | Tema | Decisión aprobada |
|---|---|---|
| DEC-012.1 | Rutas canónicas | Rutas objetivo canónicas V2: POST /api/public/menu/recommendations (global) y POST /api/public/menu/:restaurant_id/recommendations (por restaurante). Sin alias legacy adicionales ni rutas alternativas innecesarias. Aprobación como objetivo V2 ≠ cumplimiento actual del código; no autoriza eliminar código, modificar consumidores ni adaptar frontends en esta tarea. |
| DEC-012.2 | Request canónico | Estructura: craving (texto y etiquetas de intención), estrictions (alergias, dieta, ingredientes excluidos y presupuesto), options (límite, locale y requestId). Referencia de campos/tipos/límites: docs/audit-v2/06-contratos-definitivos.md. No recuperar campos legacy por obligación de compatibilidad. |
| DEC-012.3 | Campos desconocidos | Rechazar campos no reconocidos con HTTP 400 INVALID_REQUEST, incluyendo información segura que identifique el campo inválido, sin revelar información interna. |
| DEC-012.4 | Normalización | Trim de cadenas; deduplicación de valores cuando corresponda; defaults documentados; limit predeterminado 5; locale predeterminado es-MX; equestId generado por backend cuando no se proporcione; rechazo de locale inválido con HTTP 400. No introducir normalizaciones que alteren el significado de alergias, restricciones o ingredientes. |
| DEC-012.5 | Respuesta exitosa | Envelope canónico completo: equestId, ecommendations, meta, status, safety, error. Datos finales de platillos/restaurantes provenientes de backend y base de datos (no autoritativos por provenir de ML). Mantener estructura de recomendación, coincidencia, razones y seguridad definida en la especificación. |
| DEC-012.6 | Errores | Envelope uniforme para errores (equestId, ecommendations, meta, status, safety, error) con códigos estables y mensajes seguros. Catálogo HTTP propuesto en la especificación como referencia del contrato. Controles/condiciones dependientes de DEC-004 y DEC-010 continúan sujetos a esas decisiones (sin inventar límites de rate limiting ni aprobar políticas globales adicionales). No afirmar que el envelope ya está implementado. |
| DEC-012.7 | Ausencia de resultados verificables | HTTP 200, ecommendations: [], status.code: "no_verified_results", estado de seguridad que indique que no existen resultados verificables. No inventar recomendaciones ni devolver candidatos que no superaron la elegibilidad. |
| DEC-012.8 | Seguridad | Modelo de seguridad global y por platillo aprobado; estados de seguridad/verificabilidad según especificación canónica. Backend conserva autoridad sobre validación, elegibilidad, restricciones, aislamiento y respuesta final. ML no puede declarar elegible un platillo ni relajar restricciones obligatorias. Disclaimer sin garantías absolutas. Modelo de campos aprobado; copy definitivo pendiente de DEC-001. |
| DEC-012.9 | Meta | Campos aprobados: scope, 	otalCandidates, evaluatedCandidates, eturned, limitApplied, allback, mlUsed. Valores deben reflejar datos reales del procesamiento (no inventar contadores ni indicar uso de ML cuando no ocurrió). |
| DEC-012.10 | Degradación segura de ML | (1) No usar ML v1 como fallback silencioso. (2) No inventar recomendaciones. (3) Fallback determinista solo con candidatos cuya elegibilidad fue verificada por backend. (4) Validar/contrastar resultados de ML con el conjunto de candidatos elegibles. (5) Sin candidatos verificables: estado controlado sin resultados. (6) Sin reintentos ilimitados. (7) Fallo de ML no relaja restricciones obligatorias. (8) No implementar /interpret ni /rank en esta tarea (R2). Parámetros operativos, umbrales de confianza y decisiones pendientes de DEC-007/DEC-011 no aprobados por DEC-012. |

### Relación con decisiones anteriores y restricciones
- **DEC-002 (APROBADA, no modificada):** presupuesto MXN vigente. Puede implementarse posteriormente la validación de entrada del presupuesto; **no activar comparación de precios en producción hasta verificar operativamente que los datos existentes utilizan MXN**. Sin conversiones, servicios externos ni tasas de cambio.
- **DEC-003 (APROBADA, no modificada):** arquitectura V2 y separación R1–R5 vigente. DEC-012 complementa, no sustituye.
- **DEC-001, DEC-004–DEC-011:** mantienen su estado actual (no aprobadas indirectamente). DEC-001 pendiente para copy/UX; DEC-004 rate limiting; DEC-005 Top-K; DEC-006 caché; DEC-007 confianza/ambigüedad; DEC-008 verificabilidad del catálogo; DEC-009 configuración/despliegue; DEC-010 alcance global/anti-abuso; DEC-011 propuesta no aprobada.
- **Clasificación:** DEC-012 [APROBADO]. Especificación contractual relacionada [DOCUMENTADO/PROPUESTO]. Implementación [PENDIENTE DE IMPLEMENTACIÓN]. Elementos sujetos a evidencia/DEC pendientes [BLOQUEADO POR DEPENDENCIA] o [NO VERIFICADO] según aplique.

## 5. Comunicación y seguridad
- Prohibido: «100% libre de», «garantizado», «seguro para alérgicos».
- Obligatorio: «según información declarada del menú», disclaimer de contaminación cruzada no documentada cuando aplique.
- `confidence` = estimación, no garantía de exactitud ni seguridad.

## 6. Trazabilidad
- **Evidencia:** `06-contratos-definitivos.md`, `07-reglas-negocio-y-seguridad.md`, `menuController.js` (fallback actual), `main.py` (extracción/ranking actual, `socialContext` inerte), `init.sql` (JSONB, catálogos).
- **Impacto:** cambios de contrato y lógica en implementación futura (ver `08`, `10`).
- **Riesgos:** menor recall por fail-closed (R1), datos incompletos, ambigüedad lingüística, falta de calibración.
