# ADR-001: Arquitectura de Despliegue en AWS con S3, CloudFront y EC2 Docker

## Estado
**Aceptado** (Fecha: 2026-09-18)

---

## Contexto y Planteamiento del Problema
El sistema **MexxicanMX / menus-qr-Negocios** se compone de tres piezas de software principales:
1. **Frontend Clientes / Restaurantes (`app`):** Aplicación web SPA (React / Vite) para visualización de menús interactivos, pedidos y configuración de restaurantes.
2. **Panel Super Administrador (`panel`):** Aplicación web SPA (React / Vite / Tailwind) para control de membresías, restaurantes y supervisión global.
3. **Backend API (`backend`):** Servicio Node.js con Express, motor de persistencia PostgreSQL y microservicio auxiliar en Python (`ai-engine`).
4. **Contenido Multimedia (`cdn`):** Almacenamiento de imágenes de platillos, logotipos y catálogos digitales en alta resolución.

### Requisitos y Restricciones
- **Cero contenido mixto (HTTPS/SSL obligatorio):** Todos los frontends y endpoints de API deben operar bajo protocolo seguro TLS/SSL en el dominio institucional `oamdevsol.site`.
- **Mitigación de errores CORS:** Los frontends deben interactuar con la API sin bloqueos de navegador.
- **Optimización de costos operativos:** Evitar servicios con tarifa fija elevada innecesaria (como Application Load Balancers dedicados a $22+ USD/mes o instancias multi-AZ de RDS) en etapas iniciales y de validación.
- **Persistencia de datos fiable:** La base de datos PostgreSQL debe mantener sus datos de manera indestructible frente a reinicios o reconstrucciones de contenedores Docker.
- **Seguridad en fronteras de red:** El puerto de la base de datos (5432) nunca debe estar expuesto a la red pública (`0.0.0.0/0`).

---

## Opciones Evaluadas

### Opción 1: Monolito tradicional en una sola instancia EC2 con Nginx y Certbot (Let's Encrypt)
- **Descripción:** Servir todo (archivos estáticos compilados de React, Node.js y PostgreSQL) directamente desde una sola máquina virtual EC2 detrás de Nginx con certificados auto-renovables de Let's Encrypt.
- **Pros:** Despliegue concentrado en un solo servidor.
- **Contras:** Sobrecarga de I/O y memoria en el servidor por tráfico estático; renovación de certificados dependiente de cron jobs que fallan con frecuencia; mayor latencia geográfica al no tener CDN; riesgo de caída total si la instancia se sobrecarga.

### Opción 2: Arquitectura Serverless / Gestionada (ECS Fargate + AWS ALB + AWS RDS Multi-AZ)
- **Descripción:** Desplegar contenedores en AWS ECS Fargate, distribuir tráfico con Application Load Balancer y delegar la base de datos a PostgreSQL en Amazon RDS.
- **Pros:** Mínima administración de sistemas operativos y alta resiliencia.
- **Contras:** Costo mensual prohibitivo para proyectos en arranque (mínimo de ~$65 a $100 USD/mes solo en infraestructura base antes de recibir tráfico).

### Opción 3: Arquitectura Híbrida CloudFront + S3 + EC2 Docker + ACM (Opción Seleccionada)
- **Descripción:** 
  - Archivos estáticos de frontend alojados en **Amazon S3** con distribución global mediante **Amazon CloudFront**.
  - API Express y PostgreSQL orquestados con **Docker Compose** en una instancia **EC2 t3.small** con volumen **EBS gp3** dedicado.
  - Certificados SSL/TLS gratuitos y automáticos emitidos con **AWS Certificate Manager (ACM)** en la región `us-east-1` e inyectados directamente en las distribuciones de CloudFront.
  - La distribución de CloudFront del backend reenvía peticiones HTTPS al puerto HTTP 80 de EC2 (Nginx reverse proxy), eliminando la necesidad de balanceadores de carga de pago.

---

## Decisión Tomada
Se adopta formalmente la **Opción 3: Arquitectura Híbrida CloudFront + S3 + EC2 Docker + ACM**.

### Mapeo de Subdominios y Servicios
| Subdominio | Servicio Origen | Capa CDN / Caché | Propósito |
| :--- | :--- | :--- | :--- |
| `https://app.oamdevsol.site` | Bucket S3 (`oamdevsol-restaurant-256663926988`) | AWS CloudFront | Menú comensales y dashboard restaurantes |
| `https://panel.oamdevsol.site` | Bucket S3 (`oamdevsol-admin-256663926988`) | AWS CloudFront | Panel de control Super Admin |
| `https://cdn.oamdevsol.site` | Bucket S3 (`oamdevsol-assets-256663926988`) | AWS CloudFront | Catálogo de imágenes de menú en HD |
| `https://backend.oamdevsol.site` | Instancia EC2 (`32.192.61.156`, Nginx :80 -> Node :4000) | AWS CloudFront | API REST, Auth JWT y microservicio ML |

### Decisiones Específicas de Implementación
1. **Terminación SSL en CloudFront:** El tráfico del cliente viaja 100% cifrado por HTTPS. CloudFront se conecta internamente a la Elastic IP de EC2 (`32.192.61.156`) por HTTP estándar en el puerto 80, simplificando la configuración de Nginx y evitando la gestión manual de certificados SSL en el servidor Linux.
2. **Persistencia con EBS:** La carpeta `/var/lib/postgresql/data` del contenedor de base de datos (`mexxicanmx_db_prod`) y la caché de Redis (`app-redis-1`) se mapean al volumen externo EBS de 20 GB montado en `/mnt/ebs/postgres` y `/mnt/ebs/redis`.
3. **Gestión de Secretos:** Cero credenciales en código fuente. Las claves JWT, credenciales de base de datos y llaves de acceso residen en variables de entorno inyectadas de forma segura desde AWS Secrets Manager (`mexxicanmx/production/api`).
4. **Defensa en Profundidad (Hardening):**
   - **Helmet:** Cabeceras HTTP de seguridad estrictas (`HSTS`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `CSP`).
   - **CORS:** Restringido a orígenes explícitos basados en las variables de entorno de producción.
   - **Rate Limiting:** Límites diferenciados por sensibilidad de ruta (30 reqs/15m para login, 1000 reqs/m para restaurantes).
   - **Notificaciones Transaccionales:** Integración con la API de Resend para correos de verificación y soporte.

---

## Consecuencias y Compensaciones

### Consecuencias Positivas
- **Rendimiento Máximo en Frontend:** Las aplicaciones React se descargan en milisegundos desde los puntos de presencia (Edge Locations) de CloudFront más cercanos al usuario.
- **Cero Costo en Balanceadores:** Ahorro directo de ~$25 USD mensuales al utilizar CloudFront como terminador SSL hacia la instancia EC2.
- **Certificados SSL Automáticos:** Renovación transparente sin caída de servicio a través de AWS ACM.
- **Aislamiento de Base de Datos:** PostgreSQL se comunica a través de la red privada virtual de Docker (`menus_network`), inaccesible desde el exterior.

### Consecuencias Negativas y Mitigaciones
- **Caché en Despliegues de Frontend:** 
  - *Problema:* Al subir un nuevo build de React a S3, CloudFront puede servir versiones antiguas en caché.
  - *Mitigación:* Se ejecuta una invalidación automática de caché `aws cloudfront create-invalidation --paths "/*"` en cada script de despliegue.
- **Punto Único de Fallo en Cómputo (Single EC2):**
  - *Problema:* Si la instancia EC2 se detiene, la API queda fuera de servicio temporalmente.
  - *Mitigación:* Se cuenta con volumen EBS persistente desacoplado e imágenes Docker versionadas, permitiendo recrear la instancia en minutos ante contingencias.

---

## Referencias
- [aws_architecture.py](file:///C:/Users/Baldo/OneDrive/Escritorio/asdad/menus-qr-Negocios/aws_architecture.py)
- [backend/src/index.js](file:///C:/Users/Baldo/OneDrive/Escritorio/asdad/menus-qr-Negocios/backend/src/index.js)
- [proyecto.md](file:///C:/Users/Baldo/OneDrive/Escritorio/asdad/menus-qr-Negocios/proyecto.md)
- Directrices de seguridad: `security-and-hardening`
