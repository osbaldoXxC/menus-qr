---
name: docker-engineering
description: Auditar, construir y probar Dockerfiles y Compose de MexxicanMX de forma reproducible, aislada y sin pérdida de datos.
metadata:
  version: "1.0.0"
  source: "Guía local basada en documentación oficial de Docker, revisada 2026-11-16"
---

# Docker Engineering

Antes de modificar, inspecciona Dockerfiles, contextos, `.dockerignore`, imágenes, volúmenes, redes, usuarios, healthchecks y versiones realmente ejecutadas. Valida Compose con `docker compose config --quiet`; no imprimas secretos interpolados.

Para builds usa lockfiles y capas reproducibles, excluye `.env`, credenciales y dependencias locales del contexto, y revisa usuarios, puertos y caché. Verifica soporte y vulnerabilidades de las versiones con fuentes oficiales; compara compatibilidad antes de cambiar versiones mayores. No supongas que una etiqueta mutable tiene el mismo contenido en cada ejecución.

Prueba integraciones en un proyecto Compose separado con credenciales sintéticas y almacenamiento temporal. Comprueba readiness y conectividad reales. No apuntes las pruebas a datos persistentes o producción. Nunca ejecutes `down -v`, prune ni elimines volúmenes o datos como parte de esta tarea. Documenta pruebas ejecutadas y bloqueos, diferenciando inspección de ejecución.

Reutiliza la skill local `docker-compose-patterns` para detalles de Compose. Referencias: [Docker build](https://docs.docker.com/build/building/best-practices/), [Compose](https://docs.docker.com/compose/), [Node releases](https://nodejs.org/en/about/previous-releases).
