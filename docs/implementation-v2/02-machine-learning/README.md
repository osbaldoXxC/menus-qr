# Bloque 2 — Machine Learning

## Corrección parcial de relevancia (2026-11-15)

`/rank` incorpora el nivel de picante declarado para ordenar candidatos elegibles ante preferencia positiva; no lo usa para seguridad ni inventa datos. `/interpret` reconoce `no lleve` y `no como` como propuestas, evita `gastar` como ingrediente y no trata `entre dulce y salado` como rango monetario. Persisten extracción incompleta de listas, semántica de ligereza y contradicciones. Pruebas ML: 36 ranking y 55 interpretación aprobadas. Véase `docs/evidencias/calidad-15-casos.md`.

**Objetivo:** separar interpretación de intención y ranking de candidatos elegibles, operando como componente que **propone** extracción y orden; la seguridad y elegibilidad final permanecen en Node.  
**Estado del bloque:** PENDIENTE (documentado; implementación no autorizada).

## Dependencias
- B1: validación, consolidación de restricciones, elegibilidad, revalidación y fallback (autoridad Node).
- B3: definición de candidatos acotados y atributos declarados para ranking.
- Decisiones: DEC-007 (umbrales confianza/ambigüedad). **DEC-003 APROBADA (2026-11-13):** arquitectura objetivo sin compatibilidad funcional obligatoria con ML v1 (`POST /recommendations`) ni rutas legacy; ML V2 = `POST /interpret` + `POST /rank`. **DEC-011** sigue como propuesta no aprobada (transición operativa concreta requiere autorización por etapa; no contradice DEC-003).

## Flujo objetivo obligatorio (DEC-003)
`React → Node → ML /interpret → Node/PostgreSQL (consolidación + elegibilidad) → ML /rank → Node (revalidación/hidratación DB) → React`.  
`/rank` recibe **solo candidatos elegibles/evaluables** acotados. No usar ML v1 como fallback silencioso de ML V2.

## Tareas
1. `01-endpoint-interpret.md` — extracción, negaciones, entidades, ambigüedades, presupuesto (propuesta).
2. `02-endpoint-rank.md` — ranking de candidatos elegibles, salida estructurada.
3. `03-contratos-y-validacion.md` — contratos I/O, versionado, validación y saneo en frontera BE.
4. `04-scoring-y-fallback.md` — scoring, correcciones (Q6), errores/timeouts y comportamiento ante degradación.

## Principios
- ML no decide seguridad alimentaria ni elegibilidad final.
- ML no accede a PostgreSQL como fuente de verdad ni inventa candidatos/campos/precios/restaurantes.
- Toda salida ML es no confiable hasta validación/revalidación en Node (timeouts, límites, sin reintentos ilimitados; errores uniformes).
- Fallback determinista solo con candidatos cuya elegibilidad sea verificable; si no, estado controlado; no inventar recomendaciones.
- `confidence` es informativa, no calibrada, no criterio de seguridad.
- Retirada efectiva de ML v1/rutas legacy se realiza en módulo/etapa autorizada verificando dependencias; FE se adapta en R4. No declarar capacidades V2 implementadas por aprobación arquitectónica.
