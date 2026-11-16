# B3-T02 — Verificabilidad alimentaria y calidad de datos

## A. Identificación
| Campo | Valor |
|---|---|
| Fase/Bloque | 3 — Base de Datos |
| Tarea | 02 |
| Nombre | Verificabilidad de ingredientes, alérgenos y dietas |
| Dependencias | B1-T03,T04; B3-T01; DEC-008; `audit-v2/07,09` |
| Estado inicial | PENDIENTE |

## B. Objetivo
Determinar y documentar qué datos son necesarios para declarar estados `compatible_segun_datos/incompatible/desconocido`, evaluar brechas del esquema actual y especificar (sin ejecutar) necesidades aditivas de migración/integridad para mejorar verificabilidad.

## C. Estado actual
- **Comprobado:** `platillos` almacena `ingredientes_principales`, `complementos`, `etiquetas_dieteticas` como JSONB y `porcion`/`nivel_picante`; existen `ingredientes_catalogo`, `sabores_catalogo`, `receta_platillo` (integración con recomendador NO VERIFICADA). No hay bandera de completitud, procedencia/verificación de etiquetas ni declaración de contaminación cruzada. Datos declarados, no verificados externamente.

## D. Alcance permitido (sujeto a autorización)
- Documentación de modelo de datos objetivo, mapeos alérgeno↔ingrediente/derivado, criterios de completitud, consultas de lectura para evaluación, especificación de cambios aditivos (tablas/campos/índices/vistas) **propuestos**.

## E. Fuera de alcance
- Ejecutar migraciones, modificar `init.sql`/esquema en ejecución, cargar/editar datos de producción, inferir compatibilidad no registrada.

## F. Procedimiento (autorizado, futuro)
1. Definir campos mínimos para verificabilidad (ingredientes normalizados, cobertura de complementos/salsas, completitud, fuente/verificación de etiqueta, contaminación cruzada declarada/desconocida).
2. Mapear uso de catálogos/receta existentes vs JSONB actual y brechas.
3. Proponer cambios aditivos compatibles y plan de migración/rollback (documental, para autorización separada).
4. Definir consultas/joins para evaluación determinista en BE.
5. Establecer manejo de datos desconocidos/incompletos como `desconocido` (fail-closed).

## G. Decisiones arquitectónicas
**Respetar:** D-ARQ-03,04,06,09; ausencia de información ≠ ausencia de alérgenos.  
**Pendientes:** DEC-008 (completitud real del catálogo), disponibilidad de fuente verificada.

## H. Criterios de aceptación
- [ ] Requisitos de datos por restricción (alergia, exclusión, dieta, presupuesto) documentados y trazables.
- [ ] Brechas del esquema actual listadas con evidencia.
- [ ] Propuesta de cambios aditivos (si necesaria) documentada sin ejecutarse.
- [ ] Regla fail-closed para datos incompletos/desconocidos especificada.

## I. Pruebas
- (Cuando se autorice implementación) consultas contra dataset de prueba con casos completo/incompleto/desconocido; verificación de estados resultantes.

## J. Evidencias
- Mapeo de campos/tablas, ejemplos de registros declarados, especificación de migración propuesta (no aplicada).

## K. Riesgos y rollback
- **Riesgo:** asumir verificabilidad inexistente. **Mitigación:** fail-closed y disclaimers. **Rollback:** no aplica (documental); migraciones futuras requerirían plan propio.

## L. Condición de cierre
- H cumplido; necesidades de migración marcadas como propuestas pendientes de autorización.

## M. Próxima tarea
- B4-T01 Auditoría y definición del cuestionario (tras autorización de B4).


## N. Propuesta integrada R3: evidencia de precio e ingredientes (2026-11-15)

> Actualización de autorización: diseño aprobado por el usuario; implementación R3/R4 autorizada por objetivo maestro. El SQL conceptual histórico de N.2 no es la migración ejecutable. En particular SUPER_ADMIN no puede confirmar por otro restaurante. Véase O para implementación actual y límites.

**Estado: PROPUESTA PARA APROBACION.** No es migracion ejecutable ni autoriza alterar datos. DEC-002 y DEC-012 siguen PARCIALES; DEC-007/011 no se modifican. La seleccion B es para planificacion, no aprobacion de ejecutar una migracion ni de verificar historicos. Presupuesto omitido nunca exige evidencia monetaria.

### N.1 Reutilizacion y separacion
`platillos` ya contiene secciones de ingredientes JSONB, `verification_metadata`, `verification_state`, `current_recipe_version`, `verified_recipe_version`, actor y fecha; existe `platillo_verificacion_auditoria`. `computeRecipeVersion` y evaluaciones actuales existen, pero su contrato de version, persistencia, actor y cobertura de escritores debe endurecerse antes de confiarlo en produccion. La integridad real y el esquema desplegado no fueron verificados. Reutilizar esas columnas para receta y auditoria; no crear otra copia de receta. `receta_platillo` y `ingredientes_catalogo` existen pero su sincronizacion con JSONB no esta demostrada: una sola fuente canonica debe acordarse, sin fusion silenciosa. La evidencia monetaria y las afirmaciones especificas de ingredientes son independientes de alergenos/contaminacion cruzada.

### N.2 SQL de referencia propuesto (NO EJECUTAR)
DDL conceptual a revisar contra schema vivo y migraciones antes de autorizar; nombres y restricciones son propuesta. Actor se obtiene de la sesion, no del cliente. Los IDs de actor se conservan como referencia logica hasta acordar identidad y retencion.

```sql
-- Acceso tenant con FKs compuestas; primero auditar duplicados e integridad.
ALTER TABLE platillos ADD CONSTRAINT uq_platillo_restaurante UNIQUE (id, restaurante_id);

CREATE TABLE confirmacion_moneda_restaurante (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid NOT NULL REFERENCES restaurantes(id),
  moneda char(3) NOT NULL CHECK (moneda = 'MXN'),
  actor_id uuid NOT NULL, actor_tipo text NOT NULL CHECK (actor_tipo IN ('RESTAURANTE','SUPER_ADMIN')),
  confirmado_en timestamptz NOT NULL DEFAULT now(), procedencia text NOT NULL,
  revocado_en timestamptz, revocado_por uuid, motivo_revocacion text,
  UNIQUE (id, restaurante_id),
  CHECK ((revocado_en IS NULL AND revocado_por IS NULL AND motivo_revocacion IS NULL) OR
         (revocado_en IS NOT NULL AND revocado_por IS NOT NULL AND motivo_revocacion IS NOT NULL AND length(trim(motivo_revocacion)) > 0))
);
CREATE TABLE confirmacion_precio_platillo (
  confirmacion_id uuid NOT NULL, restaurante_id uuid NOT NULL, platillo_id uuid NOT NULL,
  precio_confirmado numeric(10,2) NOT NULL CHECK (precio_confirmado >= 0),
  version_precio text NOT NULL CHECK (length(version_precio) > 0),
  PRIMARY KEY (confirmacion_id, platillo_id),
  FOREIGN KEY (confirmacion_id, restaurante_id) REFERENCES confirmacion_moneda_restaurante(id, restaurante_id),
  FOREIGN KEY (platillo_id, restaurante_id) REFERENCES platillos(id, restaurante_id)
);
CREATE INDEX idx_precio_evidencia_platillo ON confirmacion_precio_platillo(restaurante_id, platillo_id);
CREATE INDEX idx_moneda_vigente_restaurante ON confirmacion_moneda_restaurante(restaurante_id, confirmado_en DESC) WHERE revocado_en IS NULL;

-- Taxonomia curada y versionada; sinonimos y derivados tienen direccion distinta.
CREATE TABLE exclusion_grupo_version (
  grupo text NOT NULL, version integer NOT NULL CHECK (version > 0),
  estado text NOT NULL CHECK (estado IN ('borrador','aprobada','retirada')),
  fuente text NOT NULL, aprobado_por uuid, aprobado_en timestamptz,
  PRIMARY KEY (grupo, version),
  CHECK (estado <> 'aprobada' OR (aprobado_por IS NOT NULL AND aprobado_en IS NOT NULL))
);
CREATE TABLE exclusion_termino (
  grupo text NOT NULL, version integer NOT NULL, termino_normalizado text NOT NULL,
  relacion text NOT NULL CHECK (relacion IN ('sinonimo','derivado')),
  fuente text NOT NULL, PRIMARY KEY (grupo, version, termino_normalizado),
  FOREIGN KEY (grupo, version) REFERENCES exclusion_grupo_version(grupo, version)
);
-- Una evidencia especifica, NO una garantia de ausencia de alergeno o trazas.
CREATE TABLE platillo_ausencia_confirmada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurante_id uuid NOT NULL, platillo_id uuid NOT NULL,
  grupo text NOT NULL, taxonomia_version integer NOT NULL, receta_version text NOT NULL,
  actor_id uuid NOT NULL, actor_tipo text NOT NULL CHECK (actor_tipo IN ('RESTAURANTE','SUPER_ADMIN')),
  confirmado_en timestamptz NOT NULL DEFAULT now(), procedencia text NOT NULL,
  revocado_en timestamptz, revocado_por uuid, motivo_revocacion text,
  FOREIGN KEY (platillo_id, restaurante_id) REFERENCES platillos(id, restaurante_id),
  FOREIGN KEY (grupo, taxonomia_version) REFERENCES exclusion_grupo_version(grupo, version),
  CHECK ((revocado_en IS NULL AND revocado_por IS NULL AND motivo_revocacion IS NULL) OR
         (revocado_en IS NOT NULL AND revocado_por IS NOT NULL AND motivo_revocacion IS NOT NULL AND length(trim(motivo_revocacion)) > 0))
);
CREATE INDEX idx_ausencia_vigente ON platillo_ausencia_confirmada(restaurante_id, platillo_id, grupo) WHERE revocado_en IS NULL;
```

La lista curada inicial propuesta se revisa antes de cargar datos: grupo `cerdo` con sinonimos `cerdo`, `puerco`, `carne de cerdo` y derivado dirigido `manteca de cerdo`; no asumir que un termino generico como `manteca`, `gelatina` o `chorizo` tenga origen porcino. Relacion derivado -> grupo no implica que todos los miembros sean sinonimos intercambiables. `cebolla` requiere su propia cobertura revisada. Terminos no resueltos, compuestos, sustituciones o contradicciones permanecen desconocidos. Versiones aprobadas se vuelven inmutables; una nueva version o retirada invalida declaraciones cuya cobertura ya no es demostrable.

### N.3 Integridad, permiso y ciclo de vida
- Confirmacion MXN: propietario autenticado revisa explicitamente el conjunto y valores; servicio bloquea/lee las filas (`FOR UPDATE`) en orden consistente, verifica version esperada, crea cabecera y cobertura atomicamente. No hay backfill de historicos; cada fila vieja es desconocida hasta revisada. Ediciones/importaciones crean nueva version y dejan la evidencia anterior no vigente; no se considera verificado solo por escribir desde API.
- Receta: propietario declara secciones completas y ausencia concreta solo con fundamento; la verificacion debe referenciar version de receta vigente y taxonomia aprobada. Reutilizar metadatos vigentes, no inferir ausencia de listas vacias ni descripcion; componentes/derivados inciertos y contradicciones bloquean. Verificar el comportamiento real de `evaluateVerificationStatus`: no basta confiar solo en bandera o en actor JSON. Para alergenos, conservar controles de contaminacion cruzada y reglas separadas; la ausencia alimentaria no garantiza trazas.
- El propietario confirma/revoca solo sus propios registros con identidad server-side, transaccion y control de recurso. SUPER_ADMIN solo con permiso operativo explicito a definir, motivo y auditoria; no se presupone autorizacion para soporte. Confirmaciones son inmutables excepto revocacion auditada; BD deniega cambios directos a rol de aplicacion salvo funciones/autorizaciones definidas. La auditoria existente tiene FK ON DELETE CASCADE: evaluar retencion y alternativa append-only antes de depender de ella.
- Una lectura previa a /rank puede quedar obsoleta: validar snapshot y elegibilidad de nuevo en transaccion antes de responder, incluyendo version de receta, precio, estado de evidencia, taxonomia, activo y scope; si cambio o se revoco, descartar/recalcular sin devolver dato viejo. Politica de writers directos/importadores y permisos DB o triggers obligatorios, con pruebas; transacciones de API por si solas no cubren escrituras externas.
- FKs, unicidad, CHECK, politicas de actualizacion y tabla de estados se validan frente a produccion antes de migrar. Crear indices para consultas por tenant y version; revisar planes y bloqueo. Migracion coordinada aditiva, sin defaults que confirmen, ensayada y reversible con despliegue expand/contract; rollback deshabilita lectores nuevos y preserva evidencia/auditoria, nunca borra datos sin autorizacion.

### N.4 Flujo y archivos de implementacion futuros
Validacion DEC-012 conserva presupuesto opcional; /interpret propone intencion, backend corrobora span/origen con reglas revisadas y ambiguedad; `restrictionConsolidation.js` conserva exclusiones estructuradas/textuales sin descartarlas, no transforma una extraccion no corroborada en hecho. Consultas de `menuController.js` traen evidencia vigente por restaurante y platillo, y `eligibilityService.js` combina restricciones con evidencia: incompatible descarta, desconocido bloquea; /rank y fallback reciben solo elegibles; revalidar antes de respuesta DEC-012. No dejar que ML certifique moneda, taxonomia o compatibilidad.

R3: especificar migracion unica aditiva de las tablas propuestas y cambios de integridad de las estructuras existentes; actualizar `db/contract/schema.json`, `db/contract/SCHEMA.md`, `backend/src/db/init.sql`, migracion nueva bajo `backend/src/db/migrations/`, `catalogVerification.js`, `eligibilityService.js`, `restrictionConsolidation.js`, `menuController.js`, endpoints de confirmacion/revocacion y pruebas. R4: `frontend-restaurantes/src/pages/NuevoPlatillo/NuevoPlatillo.tsx` y/o `Configuracion/Configuracion.tsx` para revision, confirmacion, revocacion e incertidumbre; sin exigir moneda sin presupuesto. R5: escenarios HTTP y concurrencia aislados. Archivos exactos de endpoints y migracion nuevos se fijaran al aprobar implementacion; esta propuesta no los crea.

### N.5 Aceptacion y evidencia disponible
Pruebas futuras con evidencia sintetica: picoso sin presupuesto; picoso sin puerco y pollo sin cebolla; correlacion texto/span/ML y ambiguedad; receta confirmada sin cerdo, con cerdo/derivado, incompleta, desactualizada, revocada y contradictoria; aliases aprobados versus terminos ambiguos; MXN menor/igual/mayor y moneda desconocida; ataques cross-tenant, condiciones de carrera, actualizacion directa, /rank adversarial, indisponibilidad ML, fallback y no_verified_results. Probar ambos endpoints con PostgreSQL y ML reales aislados tras implementar; no confundir resultados con mocks.

Pruebas ejecutadas para esta preparacion: `tests/unit/r3Preparation.test.js` 3 PASS: conserva texto/origen de exclusion inferida y confirma que se bloquea; evalua separadamente evidencia sintetica del alergeno cacahuate y version de receta; compara precio sintetico con bandera de evidencia inyectada. No demuestra que una exclusion textual de cerdo se corrobore o sea elegible, ni verifica MXN real o integracion con PostgreSQL. La ruta positiva de ingredientes y la evidencia monetaria real todavia no existen.

## O. Implementación autorizada R3/R4 — seguimiento 2026-11-15

> Validación posterior autorizada: las migraciones B1, R3 y taxonomía borrador sí se ejecutaron exclusivamente en bases sintéticas `tmpfs` de los proyectos Docker `codexr3nov15isolated`, `codexr3nov15run2` y `codexr3nov15run3`. No se aplicaron a bases persistentes. La migración R3 también se ensayó con error antes de COMMIT en `r3_test_rollback`: no quedaron tabla ni columna R3. Los estados de la tabla histórica siguiente se complementan con la evidencia de BITACORA.

La migración `backend/src/db/migrations/20261115_r3_catalog_evidence.sql` es **pendiente de ejecución y validación SQL real**. Se contrasta con `init.sql`, migración B1-T04 y contrato JSON local; no representa el estado desplegado. No se modifica el contrato generado para fingir que estas tablas existen en una BD viva.

| ID | Objetivo y dependencia | Estado | Archivos / evidencia | Pendiente |
|---|---|---|---|---|
| R3-T01 | Persistencia aditiva; B1-T04 | PARCIAL | Migración R3; revisiones UUID, FKs compuestas, checks, índices, triggers | Ejecutar SQL en aislamiento autorizado y contrastar schema vivo |
| R3-T02 | Servicios; T01 contractual | PARCIAL | `catalogEvidence.js`, repositorio y servicio homónimos; tests sintéticos positivos | Persistencia real |
| R3-T03 | Permisos; T02 | PARCIAL | Actor de sesión + rol vivo + tenant, validación estricta, auditoría obligatoria | IDOR y permisos SQL bajo rol de aplicación real |
| R3-T04 | Invalidación; T01 | PARCIAL | Triggers sobre platillos, receta_platillo, ingredientes_catalogo y taxonomía; revisiones previenen ABA | Carreras/locks/triggers reales y ensayo de restauración |
| R3-T05 | Elegibilidad; T02 | PARCIAL | Presupuesto opcional, centavos, ausencia específica, corroboración textual limitada, relectura tras rank | Positivos PostgreSQL + ML y revocación concurrente real |
| R3-T06 | Pruebas; T01–05 | PARCIAL | 183 unitarias PASS; DB/ML simulados. Test PostgreSQL preparado opt-in | Autorización independiente de migración aislada |
| R3-T07 | Documentación; anteriores | PARCIAL | Esta matriz y BITACORA | Consolidar resultados finales R4 |

### Contratos y escrituras
- `GET /api/menu/platillos/:id/evidence`: snapshot del platillo, huellas, estado MXN, historia y taxonomía revisada.
- `POST /api/menu/evidence/currency`: `currency=MXN`, `source`, `catalogFingerprint`, `dishes[{id,price,priceRevision}]`. Cobertura explícita de 1–100 filas; huella del conjunto cubierto, no certificación de todo el restaurante. Nuevos platillos quedan desconocidos.
- `POST /api/menu/platillos/:id/evidence/absence`: `source`, `recipeVersion`, `recipeRevision`, `group`, `taxonomyVersion`, `taxonomyRevision`, `sections` explícitas para nueve secciones de composición. No incluye ni acredita contaminación cruzada.
- `POST /api/menu/evidence/:kind/:evidenceId/revoke`: `reason`; kinds `currency|absence`. No puede restaurarse evidencia revocada.
- 400 entrada inválida; 403 actor/rol; 404 recurso ajeno o inexistente; 409 snapshot obsoleto; 422 receta insuficiente/contradictoria; 503 esquema no disponible. Nunca se acepta `verified:true`.
- JSON de receta es la fuente de este flujo; receta relacional coexistente sin sincronización comprobada se marca desconocida. Escritores relacionales invalidan revisiones. No se fusionan fuentes silenciosamente.
- Lectura de seguridad en una sentencia SQL sin caché. Tras rank se obtiene nuevo snapshot y se filtran revisiones/candidatos/evidencia. El instante de lectura final es el punto de validación; cambios posteriores a enviar una respuesta no pueden evitarse por un cliente HTTP.
- Datos sin columnas R3 conservan evidencia desconocida y recomendaciones sin presupuesto/restricciones continúan. Confirmaciones privadas sin migración devuelven 503.

### Plan para solicitar autorización independiente (no ejecutar ahora)
1. Autorizar exclusivamente PostgreSQL descartable, nombre `r3_test_*`, fixtures sintéticos y red aislada; verificar que no usa volúmenes persistentes principales. Confirmar versión y prerequisitos B1-T04 mediante consultas de esquema.
2. Revisar rol SQL: aplicación sin superuser, ownership de tablas, BYPASSRLS, DDL ni permiso de deshabilitar triggers/truncar. La identidad de sesión es responsabilidad del backend; una conexión SQL administrativa puede eludir sus permisos. Revisar grants antes de exponer confirmaciones.
3. Aplicar migración R3 una sola vez en transacción con `lock_timeout=5s`; cualquier error revierte el archivo. No incorporar a auto-migración del arranque. No ejecutar el SQL conceptual N.2.
4. Cargar solo taxonomía sintética revisada para pruebas (cerdo/puerco/carne de cerdo y derivado dirigido manteca de cerdo); documentar actor/procedencia. Catálogo real y nuevas versiones requieren revisión humana explícita, no auto-certificación histórica.
5. Ejecutar test PostgreSQL preparado con `R3_INTEGRATION_AUTHORIZED=yes` y `R3_TEST_DATABASE_URL`, luego contratos HTTP con backend/ML reales, carreras en dos conexiones, imports, restauraciones y revocación. El test preparado no aplica migraciones y usa rollback; no sustituye los escenarios concurrentes/HTTP pendientes.
6. Rollback: ante fallo de aplicación SQL, rollback transaccional. Tras éxito, deshabilitar nuevas confirmaciones y retirar lectores nuevos preservando evidencia/auditoría; no borrar tablas/columnas. Restauraciones físicas/superuser requieren detener confirmaciones y poner evidencia en cuarentena antes de reabrir; no se garantiza invalidación si se deshabilitan triggers.

DEC-002/DEC-012 siguen **PARCIALES**: hay positivos sintéticos, no evidencia integrada positiva nueva. DEC-007/011 sin cambio.

### Actualización del corte R3/R4
- `20261115_r3_taxonomy_draft.sql` prepara solo el grupo propuesto en estado `borrador`, sin aprobación automática. No ejecutado; requiere la migración R3. Un revisor autorizado debe comprobar cobertura y aprobar la versión mediante procedimiento controlado antes de que sirva para confirmar ausencias.
- El backend solo admite como presupuesto textual corroborado frases completas de forma limitada, por ejemplo «Tengo 37.50 pesos y quiero tacos», cuando coincide la extracción ML. No afirma cobertura de todas las formulaciones. Los presupuestos estructurados siguen siendo el camino explícito; texto ambiguo no se convierte arbitrariamente en filtro.
- Las exclusiones textuales contrastan cláusulas completas y rechazan menciones contradictorias. Compuestos sin desglose, preparaciones genéricas y orígenes ambiguos permanecen desconocidos. La ausencia de ingrediente no acredita alérgenos ni trazas.
- El endpoint anterior `verify-approve` también rechaza superadministrador y verifica el rol persistido dentro de la transacción; un token antiguo no mantiene privilegios si cambió el rol. La prueba usa DB simulada.
- **Limitación operativa:** las FKs de evidencia retenida impiden borrar físicamente un platillo o restaurante referenciado. Debe acordarse un procedimiento de baja que preserve trazabilidad antes de aplicar migración; no se implementó borrado ni se eliminó evidencia.
- **Riesgo de concurrencia:** todos los locks/triggers y el snapshot de revalidación solo se han ejercitado con dobles. No se garantiza comportamiento bajo restauraciones físicas, permisos SQL privilegiados ni carreras reales hasta ensayar PostgreSQL con roles y procesos de escritura reales. El motor puede detectar deadlocks; API devuelve 409 para reintento, pero falta medir y validar.
- **Comprobación actual:** backend 192 PASS / 0 FAIL con Node; unitarias y handlers con DB/ML simulados. `r3Evidence.postgres.test.js` omitida (1 SKIP) sin conexión ni migración. Docker contexto `desktop-linux`, CLI 28.5.1, Compose 2.40.0; la tubería del motor no es accesible desde este entorno. No se alteró Docker.
- **Regresión posterior:** 199 PASS / 0 FAIL; incluye revocación/consulta simuladas y omisiones totales/parciales de exclusiones por ML en ambos handlers. El análisis textual sigue limitado: casos ambiguos se bloquean conservadoramente y no se considera un parser completo.
