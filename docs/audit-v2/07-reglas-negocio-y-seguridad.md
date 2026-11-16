# 07 — Reglas de Negocio, Incertidumbre, Fallback y Ranking

**Alcance:** especificación documental (F1.6, refinado F1.7). Basado en hallazgos S5/S10/Q1–Q4/Q6 y `06`, `09`, `10`.

## 1. Estados de restricción (obligatorio)

| Estado | Significado | Uso permitido |
|---|---|---|
| `compatible_segun_datos` | Evidencia declarada disponible indica cumplimiento con datos suficientes | Puede incluirse si todas las restricciones obligatorias lo permiten |
| `incompatible` | Evidencia declarada indica incumplimiento | **Exclusión obligatoria** (nunca rankear/mostrar como compatible) |
| `desconocido` | Evidencia insuficiente para afirmar compatibilidad o incompatibilidad | **Nunca** compatible; en restricción obligatoria ⇒ **no recomendar como verificado** |

**Regla de oro:** `desconocido != compatible`. Ausencia de información ≠ ausencia de alérgenos. Ante duda, prevalece protección (fail-closed).

## 2. Tratamiento de casos de incertidumbre

| Caso | Estado típico | Representación | Comportamiento |
|---|---|---|---|
| Ingredientes incompletos (lista vacía/parcial, sin completitud) | `desconocido` para alergias/exclusiones dependientes | `reason:"ingredientes_incompletos"` | Excluir de resultados verificados si obligatorio |
| Ingredientes desconocidos/no mapeados | `desconocido` (o `incompatible` solo si match positivo inequívoco) | `reason:"ingrediente_no_reconocido"` | No asumir seguro; sin match negativo confiable sobre datos completos no hay compatibilidad |
| Ingredientes derivados (salsas, trazas declaradas, derivados de alérgeno) | `incompatible` si mapeo conocido/declarado; si posible pero no declarado/mapeado | evidencia/motivo | No asumir ausencia |
| Contaminación cruzada no documentada | `desconocido` (salvo declaración explícita verificable, no observada) | Disclaimer global + estado | Prohibido "100% libre" |
| Etiquetas dietéticas no verificadas/ausentes | `desconocido` para dieta | `reason:"etiqueta_no_verificada"` | No garantizar dieta; `keto` u otras sin evidencia verificable: no compatible |
| Negaciones ambiguas en texto | `desconocido` para exclusión inferida | extracción con `ambiguous`/baja confianza | No inferir exclusión segura; fail-closed |
| Presupuesto ambiguo ("barato", rango incierto, por persona no convertible) | No filtro duro verificable | `extracted.budget.ambiguous=true` o monto nulo | No aplicar como obligatorio; señal blanda solo si no excluye |
| Restricción obligatoria solo en texto no verificable (ML caído/ambiguo) | `desconocido` | consolidación BE | No omisión silenciosa; `no_verified_results` si afecta verificación |

## 3. Política por tipo de restricción

| Restricción | Tipo | Fuente de verificación | Regla |
|---|---|---|---|
| Alergias declaradas | **Obligatoria** | Ingredientes/complementos/campos declarados normalizados + mapeo alérgenos/derivados | `incompatible` si match positivo; `compatible_segun_datos` solo con datos suficientes y sin match; `desconocido` si datos insuficientes → excluir de verificados |
| Exclusiones explícitas | **Obligatoria** | Igual que alergias | Igual regla |
| Dieta solicitada | **Obligatoria** (cuando se exige) | Etiqueta/atributo dietético **verificado** coherente con ingredientes declarados | Sin evidencia verificable → `desconocido`. Vegetarian/vegan solo con evidencia declarada verificable; `keto` no verificable con esquema actual → no compatible |
| Presupuesto numérico explícito y validado | **Obligatoria (filtro duro)** | `precio` en PostgreSQL + moneda validada | `incompatible` si `precio > budgetMax`; `compatible_segun_datos` si `<=`; `desconocido` si precio ausente/inválido/no comparable |
| Presupuesto inferido de texto (no inequívoco) | No obligatorio | ML propone, BE valida | No aplicar como duro si ambiguo/baja confianza/contradictorio |
| Craving/semántica | **Preferencia/ranking** | ML + señales textuales | No excluye por sí sola; influye en orden |
| Scope/restaurante/activo/precio válido | **Obligatoria** | PostgreSQL/BE | `incompatible` si no cumple |

## 4. Interpretación de texto y consolidación (F1.7)

- **Fase I (`/interpret`):** ML propone extracción con confianza/ambigüedad; **BE consolida y decide** (autoridad).
- **Fusión:** unión de restricciones estructuradas + inferencias textuales **determinables y no ambiguas**.
- **Contradicción estructurado vs texto:** prevalece seguridad y la restricción explícita/protectora; no relajar.
- **Salvaguarda:** indicios textuales de restricción obligatoria no reflejados con confianza → BE marca `desconocido` (no desaparición silenciosa).
- **ML no disponible/ambiguo en I:** restricciones dependientes de texto no verificables → `desconocido`/fail-closed.

## 5. Fallback de Node.js cuando ML no responde o es inválido

### 5.1 Capacidades en fallback
| Categoría | ¿BE puede validar sin ML? | Acción |
|---|---|---|
| Restricciones estructuradas verificables (presupuesto numérico, alergia/exclusión con datos suficientes, scope/activo) | Sí, si datos suficientes | Filtro determinista y estados por evidencia |
| Interpretaciones NLP (negaciones complejas, extracción desde texto ambiguo) | No de forma segura | No inferir; si era obligación del usuario → `desconocido`/no verificado |
| No comprobables (ingredientes incompletos, contaminación cruzada, dieta no verificable) | No | `desconocido`, excluir de verificados |
| Solicitudes ambiguas | Parcial | `no_verified_results` o precisión requerida; no inventar |

### 5.2 Algoritmo seguro
1. Validar request y scope.
2. Obtener candidatos desde PostgreSQL (datos reales).
3. Evaluar restricciones obligatorias: `incompatible` → descartar; `desconocido` → no elegible para verificado; solo pasan `compatible_segun_datos` en todas las obligatorias.
4. No usar texto libre para filtrar de forma heurística insegura.
5. Si vacío → `recommendations: []`, `status.code="no_verified_results"`, `meta.fallback=true`, `meta.mlUsed=false`.
6. Si hay resultados → ranking determinista simple y razones cautelosas.
7. **Prohibido:** relajar reglas, afirmar compatibilidad absoluta, inventar datos.

## 6. Ranking (candidatos reales)

1. **Elegibilidad (duros):** scope, activo, disponibilidad, sin `incompatible`; para salida verificada sin `desconocido` en obligatorias.
2. **Preferencias (solo elegibles):** semántica/intención, tags/categoría, señales blandas (sin excluir por incertidumbre insegura).
3. **Orden:** score descendente + desempates deterministas.

- Descartado en (1) **nunca** reaparece por ranking o fallback.
- `score`/`confidence` = señales no garantizadas.

## 7. Verificabilidad y completitud de datos (criterio de diseño)

- **`compatible_segun_datos` (alergia/exclusión):** datos suficientes/completos según criterio, evaluación determinista sin match positivo, alcance limitado a lo declarado.
- **Criterio de completitud (propuesto):** ingredientes declarados explícitos no vacíos y normalizables, cobertura relevante (incl. complementos/salsas cuando aplique) o marca de completitud; sin bandera pendiente. Si no se cumple → `ingredientes_completos=false` ⇒ dependientes `desconocido`.
- **Umbral de salida verificada:** 100% de restricciones obligatorias en `compatible_segun_datos` con datos completos aplicables.
- **Limitación actual:** JSONB sin completitud/verificación/contaminación cruzada; catálogos normalizados con integración NO VERIFICADA → operación fail-closed.

## 8. Comunicación de seguridad
- Usar: "según ingredientes/etiquetas declarados", "no se detectaron ingredientes declarados asociados a…".
- Evitar: "100% libre", "garantizado", "seguro para alérgicos".
- Disclaimer obligatorio cuando aplique (contaminación cruzada no documentada, datos declarados).

## 9. Trazabilidad
| Hallazgo | Mitigación |
|---|---|
| S5 (fallback inseguro) | §§4–5 fail-closed, sin NLP inseguro |
| S10 (afirmaciones absolutas) | §8 |
| Q1 (duplicación) | BE autoridad, ML propone |
| Q2/Q3 | Contrato `06` sin `socialContext`, límite único |
| Q6 | Revalidación BE, saneo y ranking controlado |
| F1.7 (texto) | Dos fases + consolidación + no omisión silenciosa (`09`,`10`) |
