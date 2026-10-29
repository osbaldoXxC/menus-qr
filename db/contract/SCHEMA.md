# Contrato de esquema — MexxicanMX

Generado bajo contrato de esquema. **No editar a mano.**
Ningun nombre fuera de este archivo puede usarse en consultas, modelos o DTOs.

## Contenido
- Extensiones
- Tipos enum
- Tablas
- Vistas

## Extensiones

- `vector` 0.7.0

## Tipos enum

- `layout_style`: `LISTA_SIMPLE`, `CUADRICULA_FOTOS`, `TARJETAS_DETALLADAS`

## Tablas

### `public.restaurantes`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `nombre_negocio` | character varying | no |  |
| `descripcion` | text | si |  |
| `email` | character varying | no |  |
| `password_hash` | text | no |  |
| `nombre_dueno` | character varying | si | `''::character varying` |
| `ubicacion_lat` | double precision | si |  |
| `ubicacion_lng` | double precision | si |  |
| `suscripcion_activa` | boolean | si | `true` |
| `rol` | character varying | no | `'RESTAURANTE'::character varying` |
| `plan` | character varying | si | `'basico'::character varying` |
| `estado` | character varying | si | `'pendiente'::character varying` |
| `suscripcion_expira_en` | timestamp with time zone | si |  |
| `dias_licencia` | integer | si | `30` |
| `ultimo_pago` | date | si |  |
| `email_verificado` | boolean | si | `false` |
| `slug` | character varying | si |  |
| `reset_token` | character varying | si |  |
| `reset_token_expires` | timestamp with time zone | si |  |
| `fecha_vencimiento` | timestamp with time zone | si |  |
| `dias_acceso_permitidos` | integer | si | `0` |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- UNIQUE: `email` (restaurantes_email_key)

### `public.configuracion_tema`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `restaurante_id` | uuid | no |  |
| `logo_url` | text | si |  |
| `banner_url` | text | si |  |
| `color_primario` | character varying | si | `'#E63946'::character varying` |
| `color_fondo` | character varying | si | `'#F1FAEE'::character varying` |
| `fuente_familia` | character varying | si | `'Sans-Serif'::character varying` |
| `layout_type` | layout_style | si | `'TARJETAS_DETALLADAS'::layout_style` |
| `banner_promocional_activo` | boolean | si | `false` |
| `banner_promocional_texto` | text | si |  |
| `config_diseno` | jsonb | si | `'{}'::jsonb` |
| `updated_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- FK: `restaurante_id` → `restaurantes.id`
- UNIQUE: `restaurante_id` (configuracion_tema_restaurante_id_key)

### `public.refresh_tokens`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('refresh_tokens_id_seq'::regclass)` |
| `restaurante_id` | uuid | no |  |
| `token` | text | no |  |
| `expires_at` | timestamp with time zone | no |  |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- FK: `restaurante_id` → `restaurantes.id`

### `public.horarios_restaurante`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `restaurante_id` | uuid | no |  |
| `dia_semana` | integer | si |  |
| `hora_apertura` | time without time zone | no |  |
| `hora_cierre` | time without time zone | no |  |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- FK: `restaurante_id` → `restaurantes.id`

### `public.categorias_restaurante`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `restaurante_id` | uuid | no |  |
| `nombre` | character varying | no |  |
| `orden` | integer | si | `0` |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- FK: `restaurante_id` → `restaurantes.id`
- UNIQUE: `nombre` (categorias_restaurante_restaurante_id_nombre_key)

### `public.platillos`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `restaurante_id` | uuid | no |  |
| `nombre` | character varying | no |  |
| `descripcion` | text | si |  |
| `precio` | numeric | no |  |
| `precio_original` | numeric | si |  |
| `url_imagen` | text | si |  |
| `categoria_id` | uuid | si |  |
| `tamano_porcion_id` | uuid | si |  |
| `activo` | boolean | si | `true` |
| `ingredientes_principales` | jsonb | si | `'[]'::jsonb` |
| `complementos` | jsonb | si | `'[]'::jsonb` |
| `nivel_picante` | integer | si | `0` |
| `porcion` | character varying | si | `''::character varying` |
| `etiquetas_dieteticas` | jsonb | si | `'[]'::jsonb` |
| `estado_ia` | character varying | si | `'pendiente'::character varying` |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- FK: `restaurante_id` → `restaurantes.id`
- FK: `categoria_id` → `categorias_restaurante.id`
- FK: `tamano_porcion_id` → `tamanos_porcion.id`

### `public.ingredientes_catalogo`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `nombre` | character varying | no |  |
| `es_alergeno_comun` | boolean | si | `false` |
| `es_origen_animal` | boolean | si | `false` |

- PK: `id`
- UNIQUE: `nombre` (ingredientes_catalogo_nombre_key)

### `public.sabores_catalogo`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `nombre` | character varying | no |  |

- PK: `id`
- UNIQUE: `nombre` (sabores_catalogo_nombre_key)

### `public.usuarios_comensales`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `nombre` | character varying | si |  |
| `email` | character varying | si |  |
| `auth_provider` | character varying | si |  |
| `deleted_at` | timestamp with time zone | si |  |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- UNIQUE: `email` (usuarios_comensales_email_key)
- **Soft delete activo**: toda lectura debe filtrar `deleted_at IS NULL`.

### `public.receta_platillo`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `platillo_id` | uuid | no |  |
| `ingrediente_id` | uuid | no |  |
| `tipo_ingrediente` | character varying | si | `'PRINCIPAL'::character varying` |
| `es_modificable` | boolean | si | `true` |

- PK: `platillo_id`, `ingrediente_id`
- FK: `platillo_id` → `platillos.id`
- FK: `ingrediente_id` → `ingredientes_catalogo.id`

### `public.perfil_sabor_platillo`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `platillo_id` | uuid | no |  |
| `sabor_id` | uuid | no |  |

- PK: `platillo_id`, `sabor_id`
- FK: `platillo_id` → `platillos.id`
- FK: `sabor_id` → `sabores_catalogo.id`

### `public.interacciones_feed`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `usuario_id` | uuid | si |  |
| `platillo_id` | uuid | no |  |
| `tipo_interaccion` | character varying | no |  |
| `fecha_timestamp` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- FK: `usuario_id` → `usuarios_comensales.id`
- FK: `platillo_id` → `platillos.id`

### `public.historial_suscripciones`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `restaurante_id` | uuid | no |  |
| `plan_anterior` | character varying | si |  |
| `plan_nuevo` | character varying | no |  |
| `fecha_cambio` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |
| `razon` | character varying | si |  |
| `accion` | character varying | si |  |
| `admin_id` | uuid | si |  |
| `detalles` | text | si |  |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- FK: `restaurante_id` → `restaurantes.id`

### `public.tamanos_porcion`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `nombre` | character varying | no |  |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`

### `public.cocinas_catalogo`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `nombre` | character varying | no |  |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`

### `public.platillo_cocina`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `platillo_id` | uuid | no |  |
| `cocina_id` | uuid | no |  |

- PK: `platillo_id`, `cocina_id`
- FK: `platillo_id` → `platillos.id`
- FK: `cocina_id` → `cocinas_catalogo.id`

### `public.soporte_conversaciones`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `restaurante_id` | uuid | no |  |
| `asunto` | character varying | si | `'Asunto General'::character varying` |
| `comentario_calificacion` | text | si |  |
| `admin_id` | uuid | si |  |
| `calificacion` | integer | si |  |
| `fecha_creacion` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |
| `fecha_cierre` | timestamp with time zone | si |  |
| `ultima_actividad` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |
| `mensajes_restaurante_count` | integer | si | `0` |
| `leido_admin` | boolean | si | `false` |
| `leido_restaurante` | boolean | si | `true` |
| `estado` | character varying | si | `'abierta'::character varying` |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- FK: `restaurante_id` → `restaurantes.id`

### `public.soporte_mensajes`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `conversacion_id` | uuid | no |  |
| `remitente_tipo` | character varying | no |  |
| `remitente_id` | uuid | si |  |
| `mensaje` | text | no |  |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- FK: `conversacion_id` → `soporte_conversaciones.id`

### `public.soporte_auditoria`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `conversacion_id` | uuid | no |  |
| `accion` | character varying | no |  |
| `usuario_id` | uuid | si |  |
| `usuario_tipo` | character varying | si |  |
| `detalles` | text | si |  |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`
- FK: `conversacion_id` → `soporte_conversaciones.id`

### `public.audit_logs`

| Columna | Tipo | Nulable | Default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `usuario_id` | uuid | no |  |
| `accion` | character varying | no |  |
| `detalles` | jsonb | si |  |
| `ip_address` | character varying | si |  |
| `created_at` | timestamp with time zone | si | `CURRENT_TIMESTAMP` |

- PK: `id`

## Vistas

_Sin vistas._
