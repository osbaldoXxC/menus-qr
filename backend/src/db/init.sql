-- MexxicanMX Database Schema (v3.0 - 100% Normalizado 3FN - IA Standby)
-- Tarea 5.2: Esquema Relacional PostgreSQL

-- 1. Habilitar extensión pgvector (Se mantiene la capacidad, aunque no se use activamente)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabla de Restaurantes (Módulo de Panel SaaS)
CREATE TABLE IF NOT EXISTS restaurantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_negocio VARCHAR(255) NOT NULL,
    descripcion TEXT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre_dueno VARCHAR(255) DEFAULT '',
    ubicacion_lat DOUBLE PRECISION,
    ubicacion_lng DOUBLE PRECISION,
    suscripcion_activa BOOLEAN DEFAULT true, -- Crítico para ABAC
    rol VARCHAR(50) NOT NULL DEFAULT 'RESTAURANTE', -- 'RESTAURANTE', 'SUPER_ADMIN'
    plan VARCHAR(50) DEFAULT 'basico', -- 'basico', 'premium'
    estado VARCHAR(50) DEFAULT 'pendiente', -- 'pendiente', 'aprobado', 'suspendido' (sync: prod default is 'pendiente')
    suscripcion_expira_en TIMESTAMP WITH TIME ZONE,
    dias_licencia INT DEFAULT 30,
    ultimo_pago DATE,
    email_verificado BOOLEAN DEFAULT false, -- (sync: prod default is false)
    -- Reserved columns for future features (currently unused):
    slug VARCHAR(255), -- For URL-friendly identifiers
    reset_token VARCHAR(255), -- For password recovery (feature reserved)
    reset_token_expires TIMESTAMP WITH TIME ZONE, -- Token expiration
    fecha_vencimiento TIMESTAMP WITH TIME ZONE, -- Subscription expiration tracking (feature reserved)
    dias_acceso_permitidos INTEGER DEFAULT 0, -- Access control (feature reserved)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN restaurantes.reset_token IS 'Reserved for future password reset feature; currently unused (auth uses email/OTP)';
COMMENT ON COLUMN restaurantes.reset_token_expires IS 'Reserved for future password reset feature';
COMMENT ON COLUMN restaurantes.fecha_vencimiento IS 'Reserved for subscription expiration tracking';
COMMENT ON COLUMN restaurantes.dias_acceso_permitidos IS 'Reserved for access control features';

-- 2.2 Configuración de Tema (Branding Premium)
DO $$ BEGIN
    CREATE TYPE layout_style AS ENUM ('LISTA_SIMPLE', 'CUADRICULA_FOTOS', 'TARJETAS_DETALLADAS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS configuracion_tema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurante_id UUID UNIQUE NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    logo_url TEXT,
    banner_url TEXT,
    color_primario VARCHAR(7) DEFAULT '#E63946',
    color_fondo VARCHAR(7) DEFAULT '#F1FAEE',
    fuente_familia VARCHAR(50) DEFAULT 'Sans-Serif',
    layout_type layout_style DEFAULT 'TARJETAS_DETALLADAS',
    banner_promocional_activo BOOLEAN DEFAULT false,
    banner_promocional_texto TEXT,
    config_diseno JSONB DEFAULT '{}'::jsonb, -- Changed from TEXT to JSONB (sync: prod uses JSONB)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.1 Tabla para manejo de Refresh Tokens (Seguridad)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Horarios_Restaurante (Normalización de horarios)
CREATE TABLE IF NOT EXISTS horarios_restaurante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    dia_semana INT CHECK (dia_semana BETWEEN 1 AND 7), -- 1=Lunes, 7=Domingo
    hora_apertura TIME NOT NULL,
    hora_cierre TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Categorias_Restaurante (ABAC - Categorías por restaurante con ordenamiento)
CREATE TABLE IF NOT EXISTS categorias_restaurante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    orden INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurante_id, nombre)
);

-- 5. Platillos (El corazón del Discovery Feed)
CREATE TABLE IF NOT EXISTS platillos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    precio_original DECIMAL(10,2) DEFAULT NULL, -- Precio regular antes de descuento (ofertas / tachado)
    url_imagen TEXT, -- Apunta a S3
    categoria_id UUID REFERENCES categorias_restaurante(id) ON DELETE SET NULL,
    tamano_porcion_id UUID, -- Foreign key to tamanos_porcion table (sync: production uses this)
    activo BOOLEAN DEFAULT true, -- Soporte para pausado lógico
    ingredientes_principales JSONB DEFAULT '[]'::jsonb,
    complementos JSONB DEFAULT '[]'::jsonb,
    nivel_picante INTEGER DEFAULT 0, -- Escala de 0 a 4
    porcion VARCHAR(100) DEFAULT '', -- Ej: "350g", "3 piezas", "500 ml"
    etiquetas_dieteticas JSONB DEFAULT '[]'::jsonb, -- Ej: ["sin_gluten", "vegano"]
    estado_ia VARCHAR(50) DEFAULT 'pendiente', -- 'pendiente', 'procesando', 'completado'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN platillos.tamano_porcion_id IS 'Foreign key to tamanos_porcion catalog; reserved for portion size normalization';

-- 6. Ingredientes_Catalogo
CREATE TABLE IF NOT EXISTS ingredientes_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) UNIQUE NOT NULL,
    es_alergeno_comun BOOLEAN DEFAULT false,
    es_origen_animal BOOLEAN DEFAULT false
);

-- 7. Sabores_Catalogo (Normalización de perfiles de sabor)
CREATE TABLE IF NOT EXISTS sabores_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) UNIQUE NOT NULL -- Ej: Picante, Dulce, Umami, Crujiente
);

-- 8. Usuarios_Comensales (Los que hacen swipe)
CREATE TABLE IF NOT EXISTS usuarios_comensales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    auth_provider VARCHAR(50), -- 'Google', 'Apple', 'Email', 'Anonimo'
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete timestamp (sync: production uses this)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN usuarios_comensales.deleted_at IS 'Soft delete timestamp; NULL means active';

-- 9. Receta_Platillo (Pivote M:M - Platillos <-> Ingredientes)
CREATE TABLE IF NOT EXISTS receta_platillo (
    platillo_id UUID REFERENCES platillos(id) ON DELETE CASCADE,
    ingrediente_id UUID REFERENCES ingredientes_catalogo(id) ON DELETE CASCADE,
    tipo_ingrediente VARCHAR(50) DEFAULT 'PRINCIPAL', -- 'PRINCIPAL', 'COMPLEMENTO'
    es_modificable BOOLEAN DEFAULT true, -- ¿Se le puede quitar la cebolla?
    PRIMARY KEY (platillo_id, ingrediente_id)
);

-- 10. Perfil_Sabor_Platillo (Pivote M:M - Platillos <-> Sabores)
CREATE TABLE IF NOT EXISTS perfil_sabor_platillo (
    platillo_id UUID REFERENCES platillos(id) ON DELETE CASCADE,
    sabor_id UUID REFERENCES sabores_catalogo(id) ON DELETE CASCADE,
    PRIMARY KEY (platillo_id, sabor_id)
);

-- 11. Interacciones_Feed (Para aprender del usuario)
CREATE TABLE IF NOT EXISTS interacciones_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios_comensales(id) ON DELETE SET NULL,
    platillo_id UUID NOT NULL REFERENCES platillos(id) ON DELETE CASCADE,
    tipo_interaccion VARCHAR(50) NOT NULL, -- 'SWIPE_DERECHA', 'SWIPE_IZQUIERDA', 'CLICK_DETALLE'
    fecha_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Historial_Suscripciones (Auditoría de cambios de plan)
CREATE TABLE IF NOT EXISTS historial_suscripciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    plan_anterior VARCHAR(50),
    plan_nuevo VARCHAR(50) NOT NULL,
    fecha_cambio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    razon VARCHAR(255),
    accion VARCHAR(100),
    admin_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE historial_suscripciones ADD COLUMN IF NOT EXISTS accion VARCHAR(100);
ALTER TABLE historial_suscripciones ADD COLUMN IF NOT EXISTS admin_id UUID;
ALTER TABLE historial_suscripciones ADD COLUMN IF NOT EXISTS detalles TEXT;

-- 13. Catálogos de Tamaños de Porción
CREATE TABLE IF NOT EXISTS tamanos_porcion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE tamanos_porcion IS 'Catalogo global de tamaños de porción (sync: production table exists, reserved for portion size normalization)';

-- 14. Catálogos de Cocinas
CREATE TABLE IF NOT EXISTS cocinas_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE cocinas_catalogo IS 'Catalogo global de cocinas (sync: production table exists, reserved for kitchen categorization)';

-- 15. Relación M:M Platillos <-> Cocinas
CREATE TABLE IF NOT EXISTS platillo_cocina (
    platillo_id UUID NOT NULL REFERENCES platillos(id) ON DELETE CASCADE,
    cocina_id UUID NOT NULL REFERENCES cocinas_catalogo(id) ON DELETE CASCADE,
    PRIMARY KEY (platillo_id, cocina_id)
);

COMMENT ON TABLE platillo_cocina IS 'Join table for many-to-many relationship between dishes and kitchen types (sync: production table exists, reserved)';

-- 16. Soporte - Conversaciones
CREATE TABLE IF NOT EXISTS soporte_conversaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    asunto VARCHAR(255) DEFAULT 'Asunto General', -- Reserved, currently unused
    comentario_calificacion TEXT, -- Reserved, currently unused
    admin_id UUID, -- ACTIVELY USED: assigned support agent
    calificacion INTEGER, -- ACTIVELY USED: support rating (1-5)
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- ACTIVELY USED
    fecha_cierre TIMESTAMP WITH TIME ZONE, -- ACTIVELY USED: when ticket closed
    ultima_actividad TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- ACTIVELY USED
    mensajes_restaurante_count INTEGER DEFAULT 0, -- ACTIVELY USED: track message count
    leido_admin BOOLEAN DEFAULT false, -- ACTIVELY USED: mark as read by admin
    leido_restaurante BOOLEAN DEFAULT true, -- ACTIVELY USED: mark as read by restaurant
    estado VARCHAR(50) DEFAULT 'abierta',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE soporte_conversaciones IS 'Support tickets/conversations with active tracking fields';
COMMENT ON COLUMN soporte_conversaciones.asunto IS 'Reserved field, currently unused';
COMMENT ON COLUMN soporte_conversaciones.comentario_calificacion IS 'Reserved field, currently unused';

-- 17. Soporte - Mensajes
CREATE TABLE IF NOT EXISTS soporte_mensajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversacion_id UUID NOT NULL REFERENCES soporte_conversaciones(id) ON DELETE CASCADE,
    remitente_tipo VARCHAR(50) NOT NULL, -- 'RESTAURANTE', 'ADMIN'
    remitente_id UUID, -- ID del restaurante o admin
    mensaje TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Auditoría de Soporte (Registro de cambios)
CREATE TABLE IF NOT EXISTS soporte_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversacion_id UUID NOT NULL REFERENCES soporte_conversaciones(id) ON DELETE CASCADE,
    accion VARCHAR(255) NOT NULL,
    usuario_id UUID,
    usuario_tipo VARCHAR(50),
    detalles TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE soporte_auditoria IS 'Audit trail for support ticket changes (sync: production table exists, reserved for audit logging)';

-- 19. Audit Logs (Registro general de auditoría del sistema)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalles JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE audit_logs IS 'System audit trail (sync: production table exists, reserved for comprehensive audit logging)';

-- Comentarios
COMMENT ON TABLE restaurantes IS 'Core business entity: restaurant registrations and access control';
COMMENT ON TABLE configuracion_tema IS 'Restaurant branding and theme configuration (1:1 with restaurantes)';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh token management for authentication';
COMMENT ON TABLE horarios_restaurante IS 'Restaurant operating hours normalized by day of week';
COMMENT ON TABLE categorias_restaurante IS 'Menu categories per restaurant with ordering';
COMMENT ON TABLE platillos IS 'Menu items with optional AI embedding support (pgvector standby mode)';
COMMENT ON TABLE ingredientes_catalogo IS 'Global ingredient catalog with allergen and dietary metadata';
COMMENT ON TABLE sabores_catalogo IS 'Global flavor profile catalog';
COMMENT ON TABLE usuarios_comensales IS 'Customer profiles with soft delete support';
COMMENT ON TABLE receta_platillo IS 'M:M relationship between dishes and ingredients';
COMMENT ON TABLE perfil_sabor_platillo IS 'M:M relationship between dishes and flavor profiles';
COMMENT ON TABLE interacciones_feed IS 'Customer activity tracking (swipes, clicks, etc)';
COMMENT ON TABLE historial_suscripciones IS 'Subscription plan change audit trail';
COMMENT ON TABLE soporte_conversaciones IS 'Support ticket/conversation management with active tracking';
COMMENT ON TABLE soporte_mensajes IS 'Support message history';
COMMENT ON TABLE soporte_auditoria IS 'Support ticket change audit trail';
COMMENT ON TABLE audit_logs IS 'System-wide audit trail for compliance';
COMMENT ON TABLE tamanos_porcion IS 'Global portion size catalog (reserved for normalization)';
COMMENT ON TABLE cocinas_catalogo IS 'Global kitchen type catalog (reserved for categorization)';
COMMENT ON TABLE platillo_cocina IS 'M:M relationship between dishes and kitchen types (reserved)';


-- 12. ÍNDICES DE OPTIMIZACIÓN DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_restaurantes_email ON restaurantes(email);
CREATE INDEX IF NOT EXISTS idx_platillos_restaurante ON platillos(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_categorias_restaurante_id ON categorias_restaurante(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_platillos_activo ON platillos(activo) WHERE activo = true;
