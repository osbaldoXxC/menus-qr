from diagrams import Diagram, Cluster, Edge
from diagrams.aws.network import CloudFront
from diagrams.aws.security import CertificateManager as ACM, SecretsManager
from diagrams.aws.storage import S3, ElasticBlockStoreEBS as ElasticBlockStore
from diagrams.aws.compute import EC2
from diagrams.aws.general import Users, InternetAlt1
from diagrams.aws.integration import SimpleNotificationServiceSnsEmailNotification as EmailService
from diagrams.onprem.database import Postgresql
from diagrams.onprem.inmemory import Redis
from diagrams.onprem.network import Nginx
from diagrams.programming.language import Nodejs
from diagrams.programming.framework import FastAPI

graph_attr = {
    "fontsize": "20",
    "pad": "1.2",
    "splines": "ortho",
    "nodesep": "1.8",
    "ranksep": "2.0",
    "compound": "true",
}

with Diagram(
    "Arquitectura Estricta AWS + Docker Compose + Secrets Manager & Resend - oamdevsol.site",
    filename="aws_architecture",
    show=False,
    direction="TB",
    graph_attr=graph_attr,
):
    users = Users("Usuarios / Clientes\n& Administradores")

    with Cluster("1. DNS Externo & Seguridad SSL"):
        hostinger_dns = InternetAlt1("Hostinger DNS Zone\n(oamdevsol.site)\nRegistros CNAME / A")
        acm = ACM("AWS Certificate Manager\nCertificado SSL Wildcard\n(*.oamdevsol.site)")

    with Cluster("2. Distribución CDN & Frontends"):
        with Cluster("AWS CloudFront CDN"):
            cloudfront = CloudFront("AWS CloudFront CDN\n(Terminación HTTPS SSL ACM)\npanel, app, backend")

        with Cluster("Almacenamiento S3 (Exactamente 3 Buckets)"):
            admin_app = S3("oamdevsol-admin-256663926988\nPanel Administración SPA\n(HTML / JS / CSS / Vite)")
            client_app = S3("oamdevsol-restaurant-256663926988\nBucket Menú / Clientes QR\n(HTML / JS / CSS / Vite)")
            assets_bucket = S3("oamdevsol-assets-256663926988\nFotos Platillos HD,\nLogos y Banners")

    with Cluster("3. VPC: 10.0.0.0/16 | Subnet Pública: 10.0.1.0/24 | Elastic IP: 32.192.61.156"):
        with Cluster("INSTANCIA AWS EC2 (t3.micro - Ubuntu 24.04 LTS)"):
            ec2_node = EC2("Servidor AWS EC2\nt3.micro (Ubuntu 24.04 LTS)\nElastic IP: 32.192.61.156")
            nginx = Nginx("NGINX REVERSE PROXY (Puerto 80)\n• Tráfico HTTP texto plano\n• Reenvía Host, Auth, X-Real-IP, Cookies")

            with Cluster("STACK DE MICROSERVICIOS DOCKER (Docker Compose)"):
                api_backend = Nodejs("app-backend-1 (Puerto 4000)\n• REST API Node.js / Express\n• JWT Auth, Rutas Menú, Mesas")
                ml_service = FastAPI("app-ml-service-1 (Puerto 8000)\n• FastAPI Python\n• Motor IA Recomendaciones")

            with Cluster("Bases de Datos & Cache (Docker Containers)"):
                postgres = Postgresql("mexxicanmx_db_prod\n• PostgreSQL 16 + pgvector\n• Catálogos + 20 Tablas limpias")
                redis = Redis("app-redis-1\n• Redis Cache 7 (Alpine)\n• Caché de sesiones y tokens")

        ebs = ElasticBlockStore("VOLUMEN EBS GP3 INDEPENDIENTE (20 GB)\n• /mnt/ebs/postgres (Datos BD persistentes)\n• /mnt/ebs/redis (Caché persistida)")

    with Cluster("4. Servicios de Seguridad y Notificaciones"):
        secrets_mgr = SecretsManager("AWS SECRETS MANAGER\nSecreto: mexxicanmx/production/api\n(DATABASE_URL, JWT_SECRET, REDIS_URL...)")
        resend_email = EmailService("Resend API (re_8ATF72...)\n• Envío de verificación y soporte\n• Transaccionales y OTP a Gmails")

    # 1. Validación de Certificado ACM desde Hostinger
    hostinger_dns >> Edge(label="1. CNAME Validación ACM", color="darkgreen", style="dashed") >> acm

    # 2. Consultas de usuarios al DNS de Hostinger
    users >> Edge(label="2. Consulta DNS", color="blue") >> hostinger_dns

    # 3. Hostinger DNS apunta CNAMEs a CloudFront y EC2
    hostinger_dns >> Edge(label="3a. CNAMEs (panel, app, backend)", color="purple") >> cloudfront
    hostinger_dns >> Edge(label="3b. Registro A (32.192.61.156)", color="darkorange") >> ec2_node

    # SSL ACM adjunto a CloudFront
    acm - Edge(color="darkgreen", style="dotted") - cloudfront

    # 4. CloudFront entrega contenido desde S3 para los Frontends SPA
    cloudfront >> Edge(label="HTTPS", color="purple") >> admin_app
    cloudfront >> Edge(label="HTTPS", color="purple") >> client_app

    # CloudFront backend pasa HTTP a EC2 / Nginx
    cloudfront >> Edge(label="HTTP Plano (backend)", color="darkorange") >> ec2_node
    ec2_node >> Edge(label="Puerto 80", color="darkorange") >> nginx

    # 5. Nginx en EC2 dirige peticiones HTTP al Backend en puerto 4000
    nginx >> Edge(label="4. Proxy local (127.0.0.1:4000)", color="darkorange") >> api_backend

    # Conexiones internas Docker Compose
    api_backend >> Edge(label="(HTTP)", color="blue") >> ml_service
    api_backend >> Edge(label="(SQL / Embeddings)", color="darkgreen") >> postgres
    ml_service >> Edge(label="(pgvector)", color="darkgreen") >> postgres
    api_backend >> Edge(label="Sesiones & Tokens", color="darkred", style="dashed") >> redis

    # Mounts persistentes en EBS
    postgres >> Edge(label="Mount /mnt/ebs/postgres", color="slategray") >> ebs
    redis >> Edge(label="Mount /mnt/ebs/redis", color="slategray") >> ebs

    # Inyección de credenciales desde Secrets Manager
    secrets_mgr >> Edge(label="Inyección Env Vars", color="magenta", style="dashed") >> api_backend

    # 5. Carga directa de fotos desde el backend a S3 (sin CDN de imágenes)
    api_backend >> Edge(label="5. Carga de fotos directa", color="brown") >> assets_bucket

    # Backend dispara envíos de correo a Resend API
    api_backend >> Edge(label="Envío Emails / OTP", color="red") >> resend_email
