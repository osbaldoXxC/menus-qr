# Guía técnica — Issue 02: autenticación, cuota semanal y auditoría de base de datos

**Responsable propuesto:** `Felix_G` · **Estado:** diseño técnico previo, verificar contra el repositorio real.  
**Objetivo:** autenticación de `COMENSAL`, plan gratis (5 búsquedas útiles/semana), plan de pago activo sin cuota semanal, UI/animación coherente y trazabilidad en PostgreSQL.

> **Importante:** Este documento contiene nombres de estructuras **propuestos**, no afirmaciones sobre las tablas que hoy existen. Inspeccionar el esquema, Prisma/SQL y middleware antes de crear archivos o migraciones.

## A. Descubrimiento y dependencias

1. Revisar `AGENTS.md`, estructura real de backend/frontend, roles, login existente, cookies, JWT, refresh, CSRF, seguridad y migraciones.
2. Confirmar rutas actuales `POST /api/public/menu/recommendations` y `POST /api/public/menu/:restaurant_id/recommendations`, y cualquier alias realmente activo. Alcance: bloquear la **función de recomendación**, no el menú público en general.
3. Separar **plan de restaurante** (Estándar/Premium u otros existentes) de **plan de comensal** (GRATIS/PAGO). Los entitlements deben ser conceptos distintos, no sobrescribir suscripciones de restaurantes.
4. Revisar si hay proveedor de pago, tabla de clientes, restricciones de rol, auditoría y migraciones previas antes de definir nuevos modelos.
5. Confirmar que ningún arranque o test sobre la base principal ejecute automáticamente `runMigrations()` sin control. No reiniciar ese stack para ejecutar migraciones.
6. Skills: `security-audit`, `scope-guard`, `performance-optimization`, `feature-audit`, frontend/UI y accesibilidad; leer archivos realmente presentes, no instalar herramientas sin aprobación.

## B. Contrato funcional y límites

| Aspecto | Regla de implementación |
| --- | --- |
| Identidad | Sesión autenticada y verificada en backend para consumir recomendaciones |
| Nuevo rol | `COMENSAL`, con privilegios de lectura/recomendación; jamás permisos de administrador o restaurante |
| Gratis | 5 búsquedas que terminan con >=1 recomendación por semana calendario local |
| Zona y periodo | `America/Mexico_City`, lunes 00:00 → siguiente lunes 00:00 (intervalo semiabierto) |
| Vacíos y errores | `no_verified_results`, errores HTTP, fallas de DB/ML o requests inválidos no consumen cuota; rate limit global sí aplica |
| Pago | Sin cuota semanal mientras entitlement esté `ACTIVE` y su vigencia sea comprobada en backend |
| Seguridad | Rate limits por cuenta/IP, permisos, anti-IDOR, CSRF/cookies, detección de abuso y cuotas atómicas |
| Pagos | No establecer precio ni procesar tarjetas sin decisión de producto/proveedor; no asumir plan pago por un flag del cliente |
| Historial | Registrar operaciones de roles/planes/cuota y DDL versionado, sin datos sensibles |

**Cambio de criterio comercial:** si el dueño del producto confirma que las 5 búsquedas deben incluir resultados vacíos, modificar explícitamente las pruebas y el contrato; no cambiar la regla de forma silenciosa.

## C. Diseño propuesto de datos — adaptar a modelo real

Propuesta conceptual, **no SQL listo para producción**:

### `consumer_profile` o extensión equivalente

- `user_id` FK único a la identidad de usuario existente.
- `role` referenciado en el sistema actual de roles (idealmente no duplicarlo en perfil).
- `created_at`, `updated_at` UTC.
- Evitar almacenar email u otros datos privados por duplicado si ya existen.

### `consumer_entitlement` / `subscription` (si no existe equivalente)

- `id`, `user_id`, `plan_code` (`FREE`, `PAID`).
- `status` (`ACTIVE`, `EXPIRED`, `CANCELED`, `SUSPENDED`, ... compatible con modelo real).
- `valid_from`, `valid_until` (nulo si contrato permite) UTC.
- `provider`, `provider_customer_ref`, `provider_subscription_ref` si se autoriza integración de pagos.
- `source`, `reason`, `created_at`, `updated_at`, `version` para auditoría/concurrencia.
- Restricciones: una fuente autoritativa por cuenta o resolución determinista de múltiples entitlements.

### `consumer_usage_event`

- `id`, `user_id`, `request_key`, `operation_type=RECOMMENDATION`, `window_start_utc`, `window_end_utc`, `status` (`RESERVED`, `CONSUMED`, `RELEASED`), `created_at`, `finalized_at`.
- Índice único `(user_id, operation_type, request_key)` contra reintentos/duplicados.
- Índice `(user_id, window_start_utc, status)` para conteo/limpieza.
- Nunca incluir craving textual, alergias ni ingredientes en audit logs de cuota por defecto.

### `consumer_usage_window` (opcional, según transacciones y carga)

- `user_id`, `window_start_utc`, `used`, `reserved`, `updated_at`, `version`.
- Unique `(user_id, window_start_utc)`.
- `used` nunca negativo ni mayor a cinco para FREE; contadores consistentes con eventos.
- Alternativa: contar eventos bajo lock transaccional por cuenta/ventana. Elegir una sola fuente de verdad.

### `data_change_audit` o equivalente existente

- `id`, `occurred_at_utc`, `actor_user_id` (o servicio identificado), `action`, `entity_type`, `entity_id`, `request_id`, `reason`, `before_summary`, `after_summary`, `migration_version`, `correlation_id`.
- Resúmenes sanitizados y limitados; no almacenar contraseñas, sesiones, tokens, datos bancarios, IPs completas si no son necesarias.
- Autoridad de escritura solo en backend con autorización; integridad transaccional donde corresponda.

### Historial estructural de BD

El sistema de migraciones existente debe registrar: versión, nombre de archivo, checksum, ejecución, resultado, fecha, responsable/verificador y esquema afectado. Si no hay tabla de historial, preferir adaptar la infraestructura existente en vez de duplicar mecanismos. Documentar plan de rollback / forward fix y migración de `role` sin romper datos antiguos.

## D. Cuota segura bajo concurrencia

**Requisito clave:** un contador leído y luego incrementado fuera de transacción NO es suficiente. Evitar TOCTOU.

Propuesta de transacciones (adaptar al driver real):

1. Validar sesión, rol, autorización, formato de solicitud y rate limit.
2. Resolver entitlement vigente del usuario usando datos confiables.
3. Para `PAID` activo: autorizar sin contador semanal (mantener rate limits). Registrar solicitud si existe infraestructura y está permitido.
4. Para `FREE`: calcular ventana de semana mexicana de modo determinista; convertir sus límites a instantes UTC para persistencia. Asegurar idempotencia con `request_key` generado y ligado a la operación/sesión del usuario, no aceptarlo ciegamente del cliente.
5. **Reservar cupo atómicamente** mediante transacción y lock por usuario/ventana o actualización condicional de contador (`used + reserved < 5`). Si no hay cupo, bloquear antes de ejecutar ML/DB intensivos.
6. Ejecutar la búsqueda. Si completa con al menos una recomendación válida, finalizar **exactamente una** reserva como `CONSUMED`; si no hay resultados o hay error, `RELEASED`, sin descuento.
7. Ante crash/timeout, el sistema debe recuperar reservas abandonadas mediante vencimiento controlado y reconciliación idempotente, sin permitir sobrepasar cinco consumos reales.
8. El uso y la transición del evento se registran de forma transaccional; retry con mismo `request_key` no debe cobrar otra vez ni devolver resultado incompatible.

**No encerrar una llamada HTTP externa a ML dentro de una transacción PostgreSQL larga**. Reservar primero, cerrar transacción, ejecutar la búsqueda y finalizar con otra transacción corta. Definir TTL de reserva razonable, y proteger concurrencia durante expiración y recuperación. Antes de codificar, demostrar el algoritmo con tests de concurrencia.

### Respuestas del API (adaptarse a contratos existentes)

- No alterar silenciosamente envelope DEC-012; si un código de bloqueo `quota_exceeded` necesita ampliación del catálogo público, proponer y obtener decisión primero.
- El cliente nunca acepta contadores del frontend como autoridad.
- Consultar cuota por endpoint autorizado, sin exponer datos de otra cuenta.
- Respuesta de bloqueo: mensaje claro, saldo 0, renovación calculada, opción de consultar planes (sin checkout ficticio).

## E. Seguridad de autenticación

- Reutilizar cuentas/sesiones existentes; no inventar autenticación paralela si el backend ya tiene auth reutilizable.
- Refresh tokens en cookies `HttpOnly`, `Secure` en HTTPS, `SameSite` y CSRF coherentes con topología del proyecto; access token de vida corta según convención vigente. No almacenar secretos en localStorage.
- Password hashing seguro (si usa password) con parámetros vigentes; evitar filtración de existencia de cuenta, enumeración, fuerza bruta.
- Roles en backend + autorización por recurso, no `isAdmin` de request; anti-IDOR para cuota y perfil.
- Logout/revocación real. Rotación refresh, invalidación de sesiones y manejo de expiración.
- Nunca reutilizar credenciales de prueba en producción; no crear cuentas privilegiadas por seed.
- No mezclar plan `PAID` con rol `ADMIN`, ni rol `COMENSAL` con permisos de negocio.
- Ante alergias u otras restricciones, conservar todas las validaciones V2 antes y después de ranking.

## F. Diseño de frontend y animación

Conservar el diseño actual de MexxicanMX: mismos tokens, familia tipográfica, colores base, CTA, navegación y componentes visuales. Inspirarse en el inicio original, no construir un formulario genérico ni cambiar el resultado con swipe.

Flujo propuesto: visitante intenta buscar → vista de login/registro accesible → autenticación → retorno al antojo escrito → acción explícita del usuario para buscar (sin disparo automático) → loader bouncy original (respetar 1.5 s para uso normal) → resultados.

- Animación de login original, ligera, orientada a acción (opacidad/traslación contenida), con alternativa de movimiento reducido.
- Inputs con etiquetas visibles, contraseñas con campo seguro, estados de error útiles y sin revelar información privada.
- Indicador de usos gratis (`3 de 5 restantes`, fecha de renovación) alimentado por backend. No mostrar una «compra exitosa» sin verificación real.
- Pago activo: mostrar plan sin prometer acceso ilimitado absoluto a la infraestructura; mantiene rate limits antiabuso.
- Accesibilidad WCAG 2.1 AA, focos y navegación de teclado, modo claro/oscuro y mobile.

## G. Migraciones y su trazabilidad

1. Elaborar diseño de migraciones en archivos nuevos y versionados; adaptar claves/índices/FK al esquema real, sin modificar migraciones ya aplicadas.
2. Planificar migración compatible, idempotencia donde aplique, lock y tiempo de despliegue, rollback/forward-fix sin `DROP` destructivo.
3. **Ejecutar solamente sobre BD PostgreSQL aislada**, con servicios de pruebas distintos a persistentes. No `down -v`, `prune`, `TRUNCATE`, `DROP` masivos.
4. Capturar antes/después: catálogo de tablas e índices; versión aplicada; conteos de usuarios existentes; validación de roles antiguos; scripts ejecutados y resultados reales.
5. Historial DDL: registrar quién preparó/revisó/ejecutó la migración, cuándo, evidencia y commit SHA cuando exista; nunca atribuir a otro actor una migración automática.
6. Historial DML: auditar `CREATE/UPDATE/REVOKE` de role, subscription, cuota ajustada y sus relaciones; preferir eventos auditables con identidad del actor.
7. Probar reversión segura cuando sea posible; si es irreversible, documentar forward-fix y requerir aprobación antes de ejecutar fuera del entorno aislado.

## H. Batería mínima de pruebas

| Prueba | Aceptación |
| --- | --- |
| Usuario anónimo consulta recomendación | Rechazo de autenticación en todas las rutas de recomendación |
| Usuario autenticado con rol restaurante intenta cuota de otro | Denegado; roles originales no se rompen |
| Cuenta gratis realiza 5 búsquedas útiles | 5 consumos exactos |
| Sexta solicitud gratis | Bloqueada antes de ML, error/estado claro |
| Búsqueda sin resultados | No consume cuota; sí rate-limit |
| Error 5xx o ML caído | No consume cuota; reserva se libera/recupera |
| Dos solicitudes simultáneas con 1 uso disponible | Máximo una termina consumida |
| Reintento con mismo `request_key` | No duplica cargo |
| Cruce domingo→lunes Ciudad de México | Ventana correcta sin reset manual destructivo |
| Cambio de horario/diferencias UTC | Cálculo usando biblioteca/zona confiable, no offsets fijos |
| Cuenta de pago activa | Más de 5 búsquedas permitidas con antiabuso |
| Suscripción vencida | Aplica cuota gratis o decisión de transición explícita |
| `isPaid` falso/verdadero manipulado en cliente | No altera autorización |
| Refresh/logout | Sesión y cookies protegidas, logout invalida acceso |
| Migración en BD efímera | Aplica y registra versión, conserva roles anteriores |
| DML auditado | Actor, fecha, acción y motivo sin secretos |
| Login animado, tema oscuro, mobile | Accesible; marca preservada; reduced-motion |
| Contrato recomendador V2 | No regresiones de seguridad ni interacción de resultados |

## I. Rendimiento

Usar Skill de optimización para revisar: consultas de contador (índices únicos), latencia por auth/entitlement, query plans en entorno aislado, lock contention, N+1, caché de lectura sin usarla como autoridad de cuota. Hacer pruebas de ráfaga concurrente controladas. **No sacrificar consistencia por velocidad**.

## J. Bloqueos que requieren aviso inmediato

- Falta mecanismo reusable de auth, permisos o acceso al esquema real.
- No se sabe si `runMigrations()` afectará una BD persistente.
- Los endpoints públicos son consumidos por otras funciones y el bloqueo global tendría regresiones.
- Falta precio, pasarela o aprobación de condiciones de pago.
- No se puede verificar actor o integridad del historial de cambios.
- Existe riesgo de exponer credenciales o afectar cuentas reales.

En cada caso: **detener únicamente la operación riesgosa**, registrar en BITACORA con fecha/hora y usuario real, comentar issue con @mención de responsable y continuar tareas independientes seguras.

## K. Entrega por checkpoints

- **Checkpoint 1:** auditoría de auth/esquema, diseño de roles y migraciones, pruebas de compatibilidad.
- **Checkpoint 2:** sesión y guardias de recomendaciones.
- **Checkpoint 3:** cuota de 5, idempotencia, concurrencia, entitlements `PAID`.
- **Checkpoint 4:** UI de login, animación, temas, accesibilidad.
- **Checkpoint 5:** migraciones auditadas en entorno efímero, pruebas integrales, bitácora y bloqueo documentado de cobros reales.

Cada checkpoint debe tener evidencia. No declarar implementación completa solo por compilar; no llamar *facturación integrada* a una función de entitlements no conectada a una pasarela autorizada.
