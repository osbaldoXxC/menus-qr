# [R4/R5][Security] Login de comensales, rol nuevo, plan gratuito 5/semana y acceso de pago

**Responsable propuesto:** `Felix_G`  
**Tipo:** Feature full-stack + seguridad + UX + persistencia  
**Prioridad:** ALTA  
**Documento técnico:** `docs/asignaciones/felix-g/TEC-02-AUTH-CUOTAS-AUDITORIA-DB.md`  
**Dependencias de decisión:** precio, plataforma de pago, periodo de suscripción y reglas de reembolsos; reutilizar infraestructura de auth existente.

## Historia de usuario

**Como** comensal que quiere recibir recomendaciones personalizadas, **quiero** registrarme/iniciar sesión y utilizar un plan gratuito limitado o un plan de pago, **para** acceder al recomendador con una experiencia clara, sin perder mis búsquedas ni poner en riesgo mis datos.

## Comportamiento de producto aprobado para esta especificación

- Nadie puede utilizar las búsquedas de recomendaciones sin sesión autenticada de comensal.
- Nuevo rol conceptual: `COMENSAL` (mapear a las convenciones y permisos actuales; no reutilizar `ADMIN` ni `RESTAURANTE`).
- Plan gratuito: **5 búsquedas útiles con recomendaciones por semana calendario**; lunes 00:00 a domingo 23:59:59.999, zona `America/Mexico_City`.
- `no_verified_results`, 5xx, errores de red y solicitudes rechazadas por validación **no consumen** cuota gratuita; sí se aplican límites antiabuso.
- Plan de pago **activo**: recomendaciones sin cuota semanal del producto, pero con rate limiting y protecciones técnicas comunes.
- No confiar en valores `plan`, `role`, `remaining` o `isPaid` suministrados por el cliente.
- El precio, proveedor, checkout y momento de activación de pago quedan **pendientes de decisión**; no cobrar ni simular un pago exitoso.

## Alcance funcional

### A. Sesión y nuevo rol

1. Inspeccionar mecanismos de login, refresh, cookies y control de roles existentes. Reutilizarlos donde corresponda.
2. Añadir rol `COMENSAL` sin romper el acceso actual de restaurantes y administradores.
3. Permitir registro e inicio de sesión de comensales con un mecanismo de autenticación compatible con el proyecto y aprobado; no inventar un proveedor externo.
4. Gestionar login/logout, sesión expirada, recuperación de sesión/credenciales conforme al patrón existente y mensajes de error sin filtración de cuentas.
5. Proteger **ambos endpoints** públicos actuales del recomendador o introducir una capa compatible aprobada, sin dejar rutas equivalentes sin guardia; revisar integración del menú público para no bloquear lecturas públicas que no sean recomendaciones.
6. Cerrar accesos directos, impersonación y escalamiento horizontal/vertical (anti-IDOR, autorización por recurso).

### B. Planes, cuota y estado

1. El backend es la única autoridad de permisos y contador.
2. Mostrar al comensal gratuito `Usos disponibles: N de 5` y cuándo se renuevan.
3. Al alcanzar cinco búsquedas útiles, bloquear una sexta sin llamar al ranking completo ni descontar de más; devolver un error/estado claro, con semántica de contrato autorizada.
4. El plan de pago con suscripción válida evita el límite semanal, **no** los límites antiabuso.
5. Evitar dobles cobros de cuota por reintentos, clics dobles, refresh, fallos HTTP o respuestas tardías: idempotencia por solicitud y operación atómica.
6. Al vencer o revocarse el pago, pasar a plan gratuito conforme a las reglas de transición documentadas, sin pérdida de cuenta ni historial.
7. No almacenar datos de tarjeta bancaria en MexxicanMX ni activar una suscripción a partir de una redirección frontend sin webhook validado o mecanismo seguro equivalente.

### C. UX, diseño y animación

- Respetar **exactamente** la identidad visual ya existente: familias tipográficas, colores naranja/rosa, espaciado, sombras y responsive.
- Crear pantalla/modal de login y registro coherente con el inicio de MexxicanMX; **no** rediseñar la página principal o la pantalla de resultados con swipe.
- Añadir una animación **original, ligera y breve** de entrada o transición de login (sin bloquear la interacción), sin copiar recursos de terceros; `prefers-reduced-motion` obligatorio.
- Estados: cargando, validando, credenciales erróneas, cuenta bloqueada, sesión expirada, límite gratuito, pago activo/inactivo y error de red.
- Restaurar el antojo previamente escrito tras autenticación sin disparar búsquedas automáticas o duplicadas.
- Accesibilidad WCAG 2.1 AA, teclado, foco visible, contrastes, ARIA donde corresponda; móvil/desktop, claro/oscuro.

### D. Historial y esquema de base de datos

- Migraciones SQL/Prisma versionadas y compatibles con esquema actual.
- Registro de cambios de **estructura**: versión, responsable, fecha, checksum, archivos y rollback/plan de reversión verificado.
- Registro de modificaciones **de datos relevantes**: cuenta/rol, plan/suscripción, cambios administrativos de cuota, revocaciones y transiciones, con actor, timestamp, acción, objeto afectado, motivo y metadatos sanitizados.
- No registrar contraseñas, tokens, datos de tarjeta, secretos ni payloads completos sensibles.
- Respetar historial existente; no duplicar sistemas de auditoría si ya hay uno.

## Skills a usar (si existen)

`security-audit`, `scope-guard`, `feature-audit`, `code-quality`, `performance-optimization`, frontend UI, accesibilidad, testing. Leer instrucciones reales. Para decisiones visuales reutilizar las Skills de Impeccable, UI UX Pro Max y Frontend Design solo si están instaladas y son apropiadas, sin habilitar automatizaciones inseguras.

## Fuera de alcance — NO tocar

- No reescribir ranking, ML V2, catálogo, ingredientes, precio verificado, decisiones de seguridad alimentaria ni resultado swipe.
- No cambiar suscripciones de **restaurantes** ni planes comerciales previos sin aprobación: distinguir planes del restaurante de los **planes de comensal**.
- No hacer modificaciones destructivas de BD ni ejecutar migraciones sobre producción/base principal por defecto.
- No implementar una pasarela de pago, establecer precios, guardar tarjetas ni habilitar cobros reales sin aprobación específica.
- No cambiar roles anteriores ni otorgar a `COMENSAL` permisos de `ADMIN`/`RESTAURANTE`.
- No modificar repositorios ajenos, archivos `.env` o secretos; no publicar/mergear sin autorización.

## Criterios de aceptación funcional

- [ ] Cuenta no autenticada no puede consumir el recomendador (incluidas rutas equivalentes); endpoints públicos de lectura no relacionados siguen funcionando.
- [ ] Registro/login/logout del rol COMENSAL probados en frontend y backend sin romper sesiones actuales de otros roles.
- [ ] El backend determina el rol, plan y titular; anti-IDOR y rechazo de privilegios alterados comprobados.
- [ ] Cuenta gratuita recibe 5 búsquedas útiles en una misma semana; la sexta devuelve bloqueo explícito, sin ejecutar una recomendación completa.
- [ ] Error HTTP 5xx, validación fallida y `no_verified_results` no consumen uso. Un resultado válido sin recomendaciones tampoco se contabiliza.
- [ ] Dos solicitudes concurrentes cerca del límite no pueden superar la cuota ni descontar doble.
- [ ] Reintentos con el mismo ID de operación mantienen exactamente un consumo y un resultado consistente.
- [ ] Nuevo periodo semanal se calcula determinísticamente en `America/Mexico_City`; probar cambio de semana y DST/tz de forma robusta.
- [ ] Suscripción vigente permite más de 5 búsquedas; suscripción vencida/revocada no se considera activa.
- [ ] No existe acceso de pago habilitado por manipulación de localStorage, JWT sin verificar o respuesta del frontend.
- [ ] Animación de login visible, coherente con la marca, accesible y con reduced-motion.
- [ ] Diseño preserva fuentes, colores, responsive y ambas temáticas; ningún cambio regresivo en pantalla original de resultados.
- [ ] Tablas/migraciones y auditorías registran autor/fecha/acción/motivo, sin datos sensibles.
- [ ] Pruebas unitarias, integración DB, seguridad, API y build pasan en un entorno aislado reproducible.
- [ ] BITACORA contiene cambios reales, responsables, fecha, pruebas, bloqueos y enlaces a migraciones.

## Bloqueos y decisiones

**Bloqueo de producto obligatorio:** precio, proveedor y período de suscripción no están definidos. Implementar el sistema de **entitlements** y su verificación segura es posible; habilitar cobros reales **no está autorizado** sin decisión y contrato explícitos.

**Bloqueo técnico obligatorio:** si las migraciones existentes, el sistema de roles, la auth o el arranque con `runMigrations()` no permiten implementación segura, registrar inmediatamente en la bitácora y comentar en el issue con @mención al responsable. No modificar producción para desbloquearse.

## Entregables

- Código funcional de login/registro/guardias/roles/cuota **en rama autorizada**.
- Migraciones propuestas y pruebas SQL/Prisma en base aislada; no aplicar a base persistente principal sin autorización.
- Pruebas de concurrencia, cuota, idempotencia, expiración y acceso.
- Diseño/animación de login y evidencias de verificación disponible.
- Registro real en `docs/implementation-v2/BITACORA.md` y evidencia de cambios de datos/estructura.
- Documento de decisiones pendientes para activar facturación real.

**Definición de terminado:** autenticación y cuotas comprobadas extremo a extremo en entorno seguro; *facturación real* permanece bloqueada hasta autorización. No declarar cobros funcionales si no hay proveedor integrado.
