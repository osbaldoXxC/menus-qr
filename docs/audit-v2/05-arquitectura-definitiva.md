# 05 — Arquitectura Definitiva del Recomendador V2

**Alcance:** cierre documental (Fases 1.6–1.7). Solo lectura del código funcional.  
**Base de evidencia:** `audit-report.md`, `00`–`04`, `09`, `10`, inspección de `backend/src/controllers/menuController.js`, `backend/src/routes/publicRoutes.js`, `backend/src/index.js`, `ml-service/main.py`, `frontend-comensales/src/features/recommendations/*`, `backend/src/db/init.sql`.

## 1. Resolución de inconsistencias del informe

| Tema | Estado definitivo | Justificación | Evidencia | Riesgo si no se corrige |
|---|---|---|---|---|
| Estado Fase 0 | **CUMPLE** (inventario y protección documental completos) | Se identificó workspace/repo/rama/remotos/commits, 9 tracked modificados, untracked, módulos, skills y riesgos; no se ejecutaron acciones destructivas | `audit-report.md` Fase 0; `git status`, `git log`, `git remote -v` | Subestimar riesgo de sobrescribir trabajo ajeno |
| Naturaleza de la auditoría | **Documental/estática: CUMPLE**. **Validación por ejecución: NO VERIFICADO** | No se ejecutaron suites de pruebas, lint, typecheck ni arranques de servicios; hallazgos se basan en lectura de código/contratos | `04-validacion-y-plan.md` Fase 7 | Confundir inspección con prueba en runtime |
| Conclusiones comprobadas | Flujo FE→BE→ML→BE→FE, endpoints, contratos de forma, fallback JS y sus omisiones, uso inerte de `socialContext`, límites inconsistentes, consultas y filtros observables en código | Rutas/controladores/servicios/ML/schema leídos directamente | `00`–`03`, código fuente citado | N/A |
| Conclusiones inferidas (no demostradas en runtime) | Impacto real de rendimiento con datos de producción, comportamiento ante carga, índices efectivos desplegados, configuración real de entorno, calibración de scores, cobertura real de datos de menú, bug Q6 en ejecución | No hay ejecución/perfilado ni BD desplegada inspeccionada | Fase 7, limitaciones | Priorizar mal o asumir defectos no reproducidos |
| Modificaciones funcionales durante auditoría | **Ninguna comprobada** | Solo se generaron/actualizaron artefactos documentales de auditoría (`audit-report.md`, `menus-qr/docs/audit-v2/*`); 9 tracked modificados preexistentes permanecen listados como tales y no fueron revertidos | Sección cierre `audit-report.md`; restricción explícita de solo lectura | Pérdida de trazabilidad si se altera código |

## 2. Principios de arquitectura definitiva

1. **Autoridad única de seguridad alimentaria y restricciones obligatorias:** Backend (Node.js). ML no decide elegibilidad final.
2. **Fuente de verdad de datos:** PostgreSQL (platillos activos, restaurante, precio, atributos declarados).
3. **ML como intérprete/rankeador acotado:** ML **propone** extracción y orden; BE **consolida, decide y revalida**. ML no inventa platos, campos ni restaurantes.
4. **Contrato explícito y versionable:** un único contrato por frontera, validado en backend (borde de confianza).
5. **Incertidumbre explícita:** estado `compatible_segun_datos` / `incompatible` / `desconocido` por restricción; `desconocido` **nunca** equivale a `compatible`.
6. **Fallback seguro (fail-closed para restricciones):** si no se puede comprobar una condición obligatoria, no se recomienda como verificada; ante incapacidad global, responder sin recomendaciones verificadas.
7. **Sin invención:** UI, backend y ML no fabrican resultados, razones absolutas ni garantías.
8. **No omisión silenciosa (F1.7):** ninguna restricción expresada por el usuario (estructurada o en texto) puede desaparecer sin tratamiento explícito; si no es verificable, se trata como `desconocido` o conduce a `no_verified_results`.

## 3. Arquitectura de componentes (objetivo)

```
[Frontend Comensal]
  - Captura intención (texto principal) + restricciones estructuradas + presupuesto (si aplica)
  - Normaliza UI; NO decide seguridad
        |
        v  (Request FE→BE, validado)
[Backend Node.js - Orquestador/Autoridad]
  - Valida schema, límites, scope, rate-limit; genera/propaga requestId
  - Fase I: llama ML /interpret (texto→extracción) y CONSOLIDA restricciones obligatorias
  - Consulta PostgreSQL (datos reales) y aplica elegibilidad determinista + incertidumbre
  - Fase II: llama ML /rank solo con candidatos elegibles/evaluables acotados
  - Revalida respuesta ML (ids/scope/activo/precio/restricciones), hidrata desde DB
  - Ensambla respuesta FE (sin invención) + safety/meta/status
        |                           ^
        v                           | (ML→BE: extracted / ranked)
[ML Service FastAPI]                |
  - /interpret: extrae entidades, negaciones, alergias/dietas/presupuesto, confianza, ambigüedad (propone)
  - /rank: ordena candidatos entregados con evidencia (propone)
  - Sin autoridad de elegibilidad final; sin acceso a DB como verdad

[PostgreSQL]
  - restaurantes, platillos, categorías, catálogos/recetas (si se adoptan)
  - Atributos declarados: ingredientes, complementos, etiquetas, precio, activo
```

> **Actualización F1.7:** se adopta flujo de **dos fases ML** (interpretación y ranking) para que restricciones expresadas solo en texto se consoliden en BE antes del filtrado por DB y del ranking, manteniendo autoridad de Node. Detalle normativo en `09-decisiones-finales.md` y `10-flujo-definitivo-y-errores.md`.

## 4. Responsabilidades por capa (sin duplicación contradictoria)

| Capa | Responsabilidades | No debe hacer |
|---|---|---|
| **Frontend (React)** | Capturar `craving.text`, restricciones estructuradas, presupuesto; mostrar estados loading/vacío/error/disclaimer; presentar `safety` y razones con evidencia declarada; respetar `meta.limitApplied` | Afirmar "libre de"/compatibilidad garantizada; filtrar seguridad como autoridad; inventar platos/restaurantes; inferir dietas no verificadas |
| **Backend (Node.js)** | Validación de borde, scope, consulta PostgreSQL, consolidación de extracción ML, **decisión final de elegibilidad**, fallback seguro, revalidación anti-invención, hidratación de datos desde DB, contrato único FE, trazabilidad (`requestId`) | Confiar ciegamente en ML; relajar restricciones en fallback; omitir restricciones textuales silenciosamente; exponer detalles internos; enviar catálogo sin acotar cuando evitable |
| **ML (FastAPI)** | `/interpret`: extracción (negaciones, entidades, alergias/dietas/presupuesto, confianza/ambigüedad). `/rank`: scoring/ranking de candidatos recibidos con razones basadas en evidencia | Filtrado obligatorio final, acceso directo a DB como verdad, inventar candidatos/campos, garantizar seguridad alimentaria, producir datos autoritativos de precio/restaurante |
| **PostgreSQL** | Persistir catálogo y atributos declarados; soportar consultas por restaurante/activo y (futuro) pre-filtros; integridad referencial | Inferir compatibilidad dietética/alergénica no registrada; ejecutar NLP |

## 5. Flujo definitivo (feliz y degradado)

### 5.1 Flujo feliz (dos fases)
1. FE envía request válido.
2. BE valida, normaliza, resuelve scope y genera/propaga `requestId`.
3. **Fase I — `/interpret`:** ML propone extracción; BE consolida restricciones obligatorias (estructuradas + textuales determinables), resuelve contradicciones sin relajar seguridad y marca ambigüedades/omisiones riesgosas como `desconocido`.
4. BE obtiene candidatos activos desde PostgreSQL (datos reales), aplica filtros duros verificables y evalúa elegibilidad por candidato (`compatible_segun_datos`/`incompatible`/`desconocido`).
5. **Fase II — `/rank`:** BE envía solo candidatos elegibles/evaluables acotados; ML devuelve `ranked`.
6. BE revalida ids/pertenencia/activo/precio/restricciones, descarta inválidos/parciales según política, hidrata desde DB y ordena respuesta final.
7. FE muestra resultados con `safety`/disclaimers y sin garantías absolutas.

### 5.2 Flujo degradado (ML no disponible o respuesta inválida)
1. BE detecta timeout/error/shape inválido en `/interpret` o `/rank`.
2. BE ejecuta **fallback determinista seguro**:
   - Aplica solo restricciones estructuradas **verificables** con datos declarados disponibles.
   - Si una restricción obligatoria depende del texto y no es verificable sin ML, se trata como `desconocido` (fail-closed) → no produce recomendación verificada que la ignore.
   - Excluye candidatos `incompatible` y `desconocido` para restricciones obligatorias en salida verificada.
   - No interpreta texto libre complejo como filtro seguro.
3. Si quedan candidatos verificables, BE devuelve ranking determinista con `meta.fallback=true`, `meta.mlUsed=false` y razones no absolutas.
4. Si no puede comprobar condiciones obligatorias con evidencia suficiente, BE devuelve `recommendations: []` y `status.code="no_verified_results"`.

Detalle normativo: `10-flujo-definitivo-y-errores.md`.

## 6. Decisiones arquitectónicas clave

| Decisión | Justificación | Impacto | Evidencia | Riesgos |
|---|---|---|---|---|
| Backend autoridad final de elegibilidad | Evita divergencia ML/JS (S5/Q1) y resultados inseguros en caída ML | Cambios en controlador, validadores y tests | `02`, `03`, `menuController.js` | Más lógica en BE; posible menor recall |
| Dos fases ML (interpretar → rankear) | Restricciones pueden venir solo en texto; BE debe consolidar y filtrar con DB antes de rankear | Contratos `/interpret` y `/rank`, consolidación en BE | `09` (F1.7), flujo actual sin fase de interpretación | Mayor latencia/complejidad; timeout y fallback |
| ML sin DB directa en V2 | Separación de concerns y consultas controladas | BE envía candidatos acotados | Arquitectura actual pasa `dishes` | Payload si no se acota (S4) |
| `socialContext` eliminado del contrato objetivo | Inerte en lógica observada | Simplifica FE/BE/ML | `01`, `main.py` | Pérdida de señal futura |
| `confidence` informativa, no garantía | Sin calibración demostrable | UI/meta no la usan para seguridad | F1.6; ausencia de calibración | Malinterpretación como certeza |
| Alergias/dietas por datos declarados (fail-closed) | Catálogo incompleto y sin garantía de contaminación cruzada | Estados de incertidumbre y disclaimers | `init.sql` JSONB, `07`, `09` | Menor recall, aceptable por seguridad |

## 7. Cambios de base de datos (evaluación, no implementación)

- **Suficiencia actual:** `platillos` con `ingredientes_principales`, `complementos`, `etiquetas_dieteticas` (JSONB) es **PARCIAL** para V2 segura.
- **Faltantes para verificabilidad:** normalización ingrediente/alérgeno, relación platillo↔ingrediente canónico, completitud de ingredientes, verificación/procedencia de etiqueta dietética, declaración de contaminación cruzada, versiones de datos.
- **Recomendación:** cambios **aditivos y compatibles** (reutilizar `ingredientes_catalogo`, `sabores_catalogo`, `receta_platillo` si son consistentes). **No crear migraciones ni modificar SQL.**

## 8. Fuera de alcance
- Implementación, migraciones, cambios de configuración, ejecución de pruebas (unit/integración/E2E) o instalación de dependencias.
- Decisiones de producto/operación no evidenciadas (copy UX final, moneda(s) soportada(s), controles definitivos de global, calibración ML).
