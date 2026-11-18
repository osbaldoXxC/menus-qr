# 🔒 Contrato Técnico Cerrado y Decisiones Pendientes de Facturación Real — Issue #43

**Responsable:** `Felix_G` (`@Felixgarciaf`)  
**Issue:** [#43 — `[R4/R5][Security] Login de comensales, rol nuevo, plan gratuito 5/semana y acceso de pago`](https://github.com/osbaldoXxC/menus-qr/issues/43)  
**Estado de Autenticación, Rol `COMENSAL`, Cuota Semanal y Entitlements:** **IMPLEMENTADO Y VERIFICADO**  
**Estado de Pasarela de Cobro / Facturación Real:** **BLOQUEADO POR DECISIÓN DE PRODUCTO (NO AUTORIZADO)**

---

## 1. Bloqueo de Producto Obligatorio: Activación de Facturación Real

Conforme a `ISSUE-02-LOGIN-COMENSALES.md` y `TEC-02-AUTH-CUOTAS-AUDITORIA-DB.md`, el sistema cuenta con la tabla y motor de verificación autoritativa `comensal_entitlements` (`FREE` / `PAID` con validación de `status = 'ACTIVE'` y ventana `valid_from <= NOW() < valid_until`), pero **queda estrictamente bloqueado cualquier cobro real, captura de tarjetas o simulación de checkout exitoso** hasta que el dueño de producto defina y autorice por escrito los siguientes 5 puntos:

| # | Decisión Comercial / Técnica Pendiente | Opciones / Parámetros Requeridos | Impacto en el Sistema |
| :-: | :--- | :--- | :--- |
| **1** | **Precio y moneda del Plan de Pago de Comensal** | Monto exacto en `MXN` (con/sin IVA incluido). | Requerido para crear el `Price ID` en la pasarela y mostrarlo en UI sin valores inventados. |
| **2** | **Proveedor / Pasarela de Pagos Oficial** | Stripe / MercadoPago / Conekta (con soporte de webhooks firmados con HMAC). | Prohibido almacenar PAN/CVV en MexxicanMX; toda captura debe ocurrir en hosted checkout del proveedor. |
| **3** | **Periodicidad y Regla de Renovación** | Semanal / Mensual / Anual, y si existe periodo de gracia (`past_due`) ante fallo de cobro. | Define el cálculo de `valid_until` al procesar el evento `invoice.paid` del webhook. |
| **4** | **Política de Cancelación y Reembolsos** | Cancelación al final del periodo (`cancel_at_period_end`) vs. revocación inmediata por contracargo/reembolso. | Al vencer o revocarse (`EXPIRED` / `REVOKED`), el usuario transita automáticamente a `FREE` conservando su cuenta. |
| **5** | **Mecanismo de Activación Segura (Webhook)** | Endpoint dedicado de webhook con verificación de firma criptográfica del proveedor e idempotencia por `event_id`. | Jamás se activa `PAID` por redirección del navegador (`?success=true`) ni por flags enviados desde el cliente. |

---

## 2. Contrato Cerrado de API, Reservas, Idempotencia y Transición `PAID` $\to$ `FREE`

### 2.1 Semántica HTTP y Envelope `DEC-012` para el Recomendador
Todas las rutas del recomendador (`POST /api/public/menu/recommendations`, `POST /api/public/menu/:restaurant_id/recommendations` y sus alias en `/api/public/...`) mantienen el envelope `DEC-012` (`buildHttpErrorEnvelope` / `buildRecommendationSuccessResponse`):

1. **Sin sesión o token expirado (`HTTP 401`):**
   - `status.code = 'auth_required'`, `error.code = 'AUTH_REQUIRED'`, `error.retryable = false`.
2. **Sesión válida pero con rol distinto a `COMENSAL` (`RESTAURANTE` / `SUPER_ADMIN`) (`HTTP 403`):**
   - `status.code = 'forbidden_role'`, `error.code = 'FORBIDDEN_ROLE'`, `error.retryable = false`.
3. **Cuota semanal agotada (`used = 5`) (`HTTP 429`):**
   - `status.code = 'quota_exceeded'`, `error.code = 'QUOTA_EXCEEDED'`, `error.retryable = false`.
   - Incluye `meta.quota = { plan: 'FREE', limit: 5, used: 5, reserved: 0, remaining: 0, windowStartUtc, windowEndUtc, resetsAt, timezone: 'America/Mexico_City' }`.
   - **Se bloquea antes de consultar platillos o invocar `/interpret` y `/rank` en `ml-service`.**
4. **Último cupo temporalmente reservado en vuelo (`used < 5` y `used + reserved = 5`) (`HTTP 429`):**
   - `status.code = 'quota_slot_busy'`, `error.code = 'QUOTA_SLOT_BUSY'`, `error.retryable = true`.
   - Distingue un cupo en proceso de los 5 usos ya consumidos.
5. **Reintento idempotente con el mismo `request_key`:**
   - **En vuelo (`status = 'RESERVED'` vigente):** `HTTP 409` (`status.code = 'operation_in_progress'`, `error.code = 'OPERATION_IN_PROGRESS'`, `retryable = true`).
   - **Payload o restaurante distinto con la misma `request_key`:** `HTTP 409` (`status.code = 'invalid_request'`, `error.code = 'IDEMPOTENCY_KEY_MISMATCH'`, `retryable = false`).
   - **Completado previamente con consumo (`status = 'CONSUMED'`):** Devuelve `HTTP 200` recuperando el `response_snapshot` original (`meta.idempotentReplay = true`) **sin descontar otro uso**.
6. **Confirmación Atómica y Reservas Vencidas (`RESERVATION_EXPIRED`):**
   - El plazo de reserva (`RESERVATION_TTL_MS = 30000 ms` por defecto, escalable según `ML_SERVICE_TIMEOUT`) se verifica atómicamente al finalizar (`status = 'RESERVED' AND execution_token = $2 AND reservation_expires_at > clock_timestamp()`).
   - Si una ejecución tardía intenta confirmar una reserva ya vencida, la confirmación es rechazada, **no se entregan las recomendaciones** y se responde `HTTP 504` (`error.code = 'RESERVATION_EXPIRED'`, `retryable = true`).
7. **Fijación de Ventana en Cruce de Lunes `00:00` (`America/Mexico_City`) y Transición `PAID` $\to$ `FREE`:**
   - Toda operación pertenece a la ventana semanal (`window_start_utc`, `window_end_utc`) capturada en el instante de la reserva (`RESERVED`).
   - Los usos ejecutados mientras un entitlement `PAID` estaba activo se registran con `plan_applied = 'PAID'` y no consumen el contador `used` del plan `FREE`. Si el plan `PAID` vence o se revoca a mitad de semana, el comensal pasa a `FREE` conservando sus 5 usos gratuitos semanales para el resto de esa ventana.
