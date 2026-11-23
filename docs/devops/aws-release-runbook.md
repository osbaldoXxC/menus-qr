# Publicación AWS: preparación y límites

El flujo `cd-production.yml` se inicia manualmente en `main`, exige un CI satisfactorio del mismo commit y un entorno `production` con revisores. El job de aprobación no obtiene credenciales AWS; el job posterior, sin entorno, utiliza OIDC restringido al sujeto inmutable de `main`. No ejecutar el flujo ni aplicar Terraform sin aprobación expresa.

## Destinos y requisitos pendientes

- Restaurante: `app.oamdevsol.site`, bucket `oamdevsol-restaurant-256663926988`, distribución `E1K516ITL1YDZ3`.
- Administración: `panel.oamdevsol.site`, bucket `oamdevsol-admin-256663926988`, distribución `E1NK74NZM8UYXZ`.
- API: `backend.oamdevsol.site`, EC2 `i-000928567783f36af`, región `us-east-1`.
- Comensales: no se encontró un destino SPA separado. Una opción para revisar es `menu.oamdevsol.site` con el certificado comodín existente y una distribución dedicada; definir su bucket, política de acceso, enrutamiento de SPA y DNS antes de continuar. No se ha creado ningún recurso ni cambiado DNS. El flujo exige bucket y distribución distintos de restaurante y administración, y un `index.html` inicial que pueda respaldar.
- Crear el entorno GitHub `production` con revisores obligatorios. Configurar allí `MEXXICANMX_DINER_BUCKET`, `MEXXICANMX_DINER_DISTRIBUTION`, `MEXXICANMX_DINER_URL` y `MEXXICANMX_PUBLIC_MENU_URL`; la última debe ser la URL del comensal seguida de `/menu`.
- El rol Terraform `mexxicanmx-ci-deploy` y el documento `MexxicanMX-DeployRelease` no existen todavía. Configurar las variables Terraform `diner_bucket_name` y `diner_distribution_id`, revisar el plan actualizado y solicitar aprobación antes de aplicarlo. Se conserva el rol legado `aws-git` y la política compartida con `githubmexxican`.

## Artefactos y recuperación

El flujo guarda imágenes Docker comprimidas y los `index.html` anteriores bajo `s3://oamdevsol-cfn-templates-256663926988/mexxicanmx/releases/<commit>/<run>-<attempt>/`; publica los activos estáticos bajo prefijos versionados y cambia los tres `index.html` únicamente después de desplegar backend. Se invalidan las distribuciones y se comparan los HTML públicos con los construidos; también se consulta la salud de API y base de datos.

SSM genera en `/mnt/ebs/mexxicanmx-backups/<commit>/<run>-<attempt>/` un volcado PostgreSQL en formato personalizado y verifica tanto gzip como su catálogo con `pg_restore --list`. Guarda los identificadores de imagen anteriores y restaura esas imágenes si falla el healthcheck. Si falla la publicación estática, el workflow intenta restaurar los tres `index.html` e invocar el rollback SSM; no elimina objetos o volúmenes.

El respaldo de base de datos está en el mismo EBS que la base: permite recuperación lógica local, pero no cubre pérdida de instancia o volumen. Antes de producción se necesita un respaldo externo con permisos y retención revisados, y ensayar una restauración con datos autorizados. Una restauración sintética se ha probado localmente; no implica que el respaldo productivo exista ni se haya restaurado. Revisar espacio disponible y migraciones de arranque antes de cada primera ejecución.

## Orden de aprobación

1. Revisar el commit candidato y autorizar únicamente el push de su rama y, si se desea, el PR en borrador.
2. Después de un CI remoto satisfactorio, revisar por separado el merge y la configuración del destino de comensales, DNS y protección del entorno.
3. Generar un plan Terraform con los identificadores finales; autorizar y aplicar ese plan por separado. No modificar ni desvincular políticas compartidas.
4. Solo tras CI verde, OIDC real, restauración y preflight verificables, autorizar explícitamente el lanzamiento de `cd-production.yml` y aprobar el entorno protegido.
