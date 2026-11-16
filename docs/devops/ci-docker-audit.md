# Auditoría Docker y CI — 2026-11-16

La preparación original está en `feature/ci-docker-testing`. Las pruebas se realizaron con proyectos Docker separados y datos sintéticos; no se ejecutaron migraciones en la base principal.

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
| Docker | PARTIAL | Configuración Compose y build limpio de `ml-proxy` PASS; stack base y R3 saludables; endpoint del proxy HTTP 200; suite Playwright CI 2/2 PASS. Docker Engine volvió a responder sin reiniciar Desktop. | Se recuperó el servicio, pero la causa interna del HTTP 500 no quedó demostrada; `integration-existing-suite` sigue fallando. |
| GitHub Actions | FAIL / PENDIENTE | [Run 43930678011](https://github.com/osbaldoXxC/menus-qr/actions/runs/43930678011): 19 jobs exitosos, 5 fallidos. `ci-summary` reflejó correctamente los fallos. | Los cambios no se han publicado; falta un run remoto autorizado. |

## Diagnóstico y revalidación CI — 2026-11-16

- Causa raíz confirmada de `backend-integration`, `r3-integration`, `integration-existing-suite` y `e2e-tests`: `ci/compose.integration.yaml` monta `../ml-service` completo sobre `/app` como solo lectura y monta `../shared` en `/app/shared`. El checkout local tenía `ml-service/shared` vacío, pero Git no lo versionaba; el runner limpio no tenía el destino y Docker no pudo crearlo dentro del montaje padre `:ro`.
- `ml-proxy` usaba la etiqueta `CI_BACKEND_IMAGE` sin una configuración `build` propia. El log remoto muestra `pull access denied`; la etiqueta compartida con `backend` podía ocultar la dependencia en un entorno con imagen local. La configuración actual declara build desde `../backend` y `pull_policy: build`.
- Se versionó `ml-service/shared/.gitkeep` para asegurar que el destino `/app/shared` exista en el checkout limpio sin quitar `:ro`.
- `ml-proxy` ahora construye desde `../backend` con `pull_policy: build` y una etiqueta propia (`CI_ML_PROXY_IMAGE`). En la primera prueba local, compartir la etiqueta del backend produjo una colisión de exportación concurrente (`image ... already exists`); `backend-fallback` también recibió etiqueta separada (`CI_BACKEND_FALLBACK_IMAGE`) para evitar el mismo conflicto. El build sin caché del proxy con una etiqueta inédita terminó correctamente.
- `ci-summary` conserva `if: always()`, la lista completa de dependencias y el fallo ante cualquier resultado distinto de `success`; no se relajó ni se usó `continue-on-error`.
- `ci/compose.r3.yaml` es un overlay y no es válido por sí solo. La validación correcta y usada por CI incluye `ci/compose.integration.yaml` y `ci/compose.r3.yaml`.
- El HTTP 500 del Engine fue transitorio en esta sesión, pero no se pudo atribuir a una causa interna concreta. Antes había 97 contenedores (79 activos); se retiraron únicamente cinco proyectos sintéticos de esta auditoría con Compose `down` sin `-v`. Después, `docker info` volvió a responder (Engine 28.5.1, Compose 2.40.0); al cierre había 64 contenedores (51 activos). No se reinició Desktop ni se borraron volúmenes. La correlación con los proyectos temporales no prueba causalidad.
- El puerto local 43000 estaba ocupado por el stack preexistente `ci-mexxicanmx-audit-backend-1`, que se conservó. Los proyectos de esta validación usaron `CI_BACKEND_PORT=43123`; el workflow en runner limpio mantiene el valor predeterminado.
- Revalidación en stacks sintéticos: Compose base y combinado R3 `config --quiet` PASS; build `ml-proxy --no-cache` con etiqueta inédita PASS. Se comprobó `/app/shared` montado en solo lectura, `ml-proxy` con Node 22.23.5 y `/health` HTTP 200. Healthchecks de los servicios R3 y del stack base: `healthy`.
- Pruebas focalizadas: DEC-012 HTTP **13/13**, B1/PostgreSQL **11/11** (incluidos los tres archivos referenciados directamente por el workflow), natural **1/1**, R3 **17/17**; backend unitarias **213/213** y sintaxis backend **52 archivos PASS** (resultados anteriores de este corte). Después de hacer que los errores al cerrar PostgreSQL/Redis fallen explícitamente, los tres archivos B1 volvieron a pasar **11/11**, sin skips. La secuencia completa del job `backend-integration` en formato JUnit y `ci/require-no-skips.py` terminó en PASS.
- Playwright CI: después de instalar el Chromium faltante en el perfil local (sin cambios a manifiestos), `ci-v2.spec.ts` pasó **2/2**. La salida se aisló en `%TEMP%`; los reportes preexistentes del workspace no se sobrescribieron.
- La última ejecución completa observada de `integration-existing-suite` (anterior al ajuste de cierre de recursos en los tests B1) ejecutó 52 tests locales sin skips: **38 PASS, 14 FAIL**. Después se repitió B1 (11/11) y el job `backend-integration` completo, pero no se volvió a ejecutar el inventario de 52. El resultado combina un registro padre e hijo por una subprueba fallida; una falla adicional es de `r3Evidence.postgres.test.js`, archivo local sin seguimiento que no está en el checkout remoto. Los casos/causas observados son:

| # | Test fallido | Causa individual observada |
|---|---|---|
| 1 | `budget-display-http.test.cjs` | Espera el backend en `127.0.0.1:4039`; el Compose único publica solo el backend en 43000 (43123 localmente). |
| 2 | `critical-regression.test.cjs` | Espera el catálogo del owner `fa...`; el setup `critical-recommendations.cjs` no se ejecutó antes del test. |
| 3 | `integrity.test.cjs` — taxonomía | El test exige la excepción de taxonomía aprobada; la migración carga `cerdo` como borrador v1. La fixture/migración no satisface el estado que afirma el test. |
| 4 | `integrity.test.cjs` — revocación | No hay evidencia revocada del owner que esta aserción espera en el orden/fixture de la suite completa. |
| 5 | `local-mxn-http.test.cjs` | Requiere variantes de backend en 4039 y 4041 que el job no inicia. |
| 6 | `local-mxn-unversioned-http.test.cjs` | Espera la base `r3_test_rollback` y backend 4044; el job crea `r3_test_isolated` con migraciones R3. |
| 7 | `mexican-language-http.test.cjs` | No se ejecuta `relevance-seed.cjs shrimp` y faltan las variantes de backend/ML que exponen sus puertos esperados. |
| 8 | `owner-flow.test.cjs` | Depende de la inicialización de estado/contraseña de `real.test.cjs`, pero el inventario ordenado por ruta ejecuta `owner-flow` primero. |
| 9 | `quality-evidence.test.cjs` | Espera un backend aislado en 4013 que el job no inicia. |
| 10–11 | `real.test.cjs` — registro padre y subprueba | Una subprueba de “sin presupuesto” falla porque datos insertados por tests anteriores contaminan la base compartida; Node reporta el fallo tanto en la subprueba como en el padre. |
| 12 | `relevance-http.test.cjs` | No se ejecuta `relevance-seed.cjs baseline`; además, la prueba espera backends/ML aislados. |
| 13 | `spicy-chicken.test.cjs` | El backend de prueba esperado en 4014 no está iniciado. |
| 14 | `r3Evidence.postgres.test.js` | Su allowlist acepta `localhost`/`127.0.0.1`, no el hostname Compose `postgres`. Es un archivo local sin seguimiento y no formará parte de un checkout limpio si no se agrega explícitamente. |

- No se eliminaron, omitieron ni relajaron pruebas. Los tres archivos B1 sí se agregarán al commit porque `.github/workflows/ci.yml` los invoca por ruta explícita; `r3Evidence.postgres.test.js` y los demás archivos ajenos al alcance permanecerán sin seguimiento.
- Estado remoto: el run 43930678011 es anterior a estos cambios y sigue siendo la única ejecución observada; no hubo push, PR, merge ni nuevo run. La suite `integration-existing-suite` requiere corregir su topología y orden/fixtures antes de poder declarar CI completo.

## Alcance real del CI

Se prepararon trabajos independientes para configuración, versiones soportadas, sintaxis backend, unitarias con JUnit/cobertura, builds y pruebas de frontend, todas las pruebas Python, builds Docker, integración HTTP y R3, persistencia, inventario de integraciones y E2E. El resumen falla si algún job requerido falla o se omite. El job `integration-existing-suite` ejecuta los archivos de integración existentes, incluidos los comparativos históricos que requieren procesos/puertos específicos; su orquestación completa aún no funciona. Las pruebas de integración no se sustituyen por mocks: se identifican las B1 que usan ML simulado.

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
