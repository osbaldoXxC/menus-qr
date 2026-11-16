# Auditoría Docker y CI — 2026-11-16

La preparación está en `feature/ci-docker-testing`. Las pruebas se realizaron con proyectos Docker separados y datos sintéticos; no se ejecutaron migraciones en la base principal. El workflow está preparado en `.github/workflows/ci.yml`: su ejecución en GitHub depende de publicar esta rama.

## Inventario y resultados

| Componente | Estado | Pruebas y evidencia | Pendientes |
|---|---|---|---|
| Backend | PASS | 213 unitarias; 11 integraciones B1 con PostgreSQL y Redis sintéticos; 13 HTTP DEC-012. | El servicio local activo aún usa la imagen anterior; reconstruirlo requiere operación autorizada. |
| PostgreSQL | PASS | R3: 11 pruebas HTTP/SQL y 5 de integridad; dato sintético persistió tras reiniciar un contenedor propio. | Las migraciones R3 se aplicaron solo a tmpfs de prueba, no a datos históricos. |
| Redis | PASS | PING y persistencia de dato sintético tras reinicio aislado. | Revisar la política de persistencia del entorno real según necesidades. |
| ML Service | PASS | 152 pruebas pytest en imagen aislada sin red; 97 pruebas `unittest` V2/vocabulario; integración HTTP real. | Revisar periódicamente dependencias y hashes de Python. |
| AI Engine | PASS | Build de imagen y HTTP 200; healthcheck sintético saludable. | No hay pruebas funcionales automatizadas; dependencias sin versiones fijadas. |
| Frontend Comensales | PASS | Builds Docker dev/prod, pruebas de componentes y dos recorridos E2E sintéticos. | La suite anterior de cuestionario por pasos fue retirada por obsoleta; no se asegura cobertura integral. |
| Frontend Restaurantes | PASS | Builds Docker dev/prod; 14 pruebas SSR compartidas. | Faltan recorridos E2E de propietario. |
| Admin | PASS | Builds Docker dev/prod con `npm ci`. | No hay pruebas automatizadas de su funcionalidad ni E2E de superadministrador. |
| Docker | BLOCKED | Compose de desarrollo, producción y pruebas validados; 9 imágenes construidas; almacenamiento aislado probado. | No se verificó `ai-engine/Dockerfile.dev` con un build independiente ni se pudo completar el escaneo de imágenes con Scout. |
| GitHub Actions | NOT TESTED | YAML validado con actionlint 1.7.12 verificado por SHA-256; configuración local preparada. | Aún no publicado ni ejecutado. El job de todas las integraciones incluye pruebas que dependen de puertos y fixtures históricos no preparados por el Compose actual y puede fallar; debe corregirse sin ocultar fallos. |

## Alcance real del CI

Se prepararon trabajos independientes para configuración, versiones soportadas, sintaxis backend, unitarias con JUnit/cobertura, builds y pruebas de frontend, todas las pruebas Python, builds Docker, integración HTTP y R3, persistencia, inventario de integraciones y E2E. El resumen falla si algún job requerido falla o se omite. El job `integration-existing-suite` ejecuta los archivos de integración existentes, incluidos los comparativos históricos que requieren procesos/puertos específicos; no hay evidencia de que esa orquestación completa funcione todavía. Las pruebas de integración no se sustituyen por mocks: se identifican las B1 que usan ML simulado.

El workflow usa credenciales sintéticas, `tmpfs` para datos de integración, healthchecks, límites de tiempo, permisos de lectura y Actions fijadas a SHA. El job de persistencia crea volúmenes propios del proyecto CI y no usa `down -v`. En este equipo quedaron los volúmenes sintéticos `ci-persistence-mexxicanmx-20261116-a_pg-test` y `ci-persistence-mexxicanmx-20261116-a_redis-test`; no se eliminaron.

## Imágenes, dependencias y seguridad

- Los contenedores principales observados ejecutaban Node 18.20.8, Python 3.11.18 en ML, Python 3.10.22 en AI Engine, PostgreSQL 16.14/pgvector 0.8.6 y Redis 8.8.0. Docker Engine 28.5.1 y Compose 2.40.0 respondieron.
- Node 18 y 20 y Python 3.10 están fuera de soporte según [Node.js](https://nodejs.org/en/about/previous-releases) y [Python](https://www.python.org/downloads/release/python-31022/). Se presentaron tres alternativas y el usuario eligió Node 22/Python 3.11. Los Dockerfiles preparados usan Node 22.23.5 y Python 3.11.18; no se recrearon los servicios principales con esas imágenes.
- Las construcciones de comensales y restaurantes informaron cada una 20 vulnerabilidades npm (15 altas, 5 moderadas); admin informó 17 (7 altas, 10 moderadas). Son recuentos de npm durante build, no una clasificación exhaustiva por CVE ni prueba de explotabilidad. No se ejecutó `npm audit fix`.
- Docker Scout sobre la imagen privada quedó bloqueado por revisión automática debido a la posible salida de capas o metadatos a un servicio externo. No se ha demostrado ausencia de vulnerabilidades en las imágenes.
- Los Dockerfiles frontend usan `nginx:alpine` mutable; AI Engine no fija versiones transitivas; varios servicios se ejecutan como root. Se reforzaron `.dockerignore` y `npm ci`, pero siguen pendientes revisión de usuarios/permisos, fijación de imágenes y actualización controlada de dependencias.
- `ai-engine` ya tiene healthcheck preparado en ambos Compose; el servicio activo no fue recreado para aplicarlo.

## Skills y fuentes

Se crearon y validaron `.agents/skills/docker-engineering/SKILL.md` y `.agents/skills/github-actions-ci/SKILL.md`, versión local 1.0.0, basadas en documentación oficial y sin instalar ejecutables externos como skills. Se revisaron [Docker Skills](https://github.com/docker/skills), [buenas prácticas de build](https://docs.docker.com/build/building/best-practices/) y [seguridad de Actions](https://docs.github.com/en/actions/reference/security/secure-use). Se reutilizó la skill local `docker-compose-patterns`.

## Activación y protección de ramas

Revisar el diff y publicar únicamente con autorización. En GitHub, crear un ruleset o regla de protección para la rama de destino, exigir los checks correspondientes y revisiones antes del merge; no se han modificado reglas de protección. No activar como obligatorios jobs que todavía no tienen sus fixtures y dependencias resueltos. No hay despliegue automático.
