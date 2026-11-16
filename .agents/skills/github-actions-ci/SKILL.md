---
name: github-actions-ci
description: Diseñar y validar CI de GitHub Actions para MexxicanMX con pruebas reales, servicios aislados y permisos mínimos.
metadata:
  version: "1.0.0"
  source: "Guía local basada en documentación oficial de GitHub, revisada 2026-11-16"
---

# GitHub Actions CI

Inspecciona workflows, manifiestos y pruebas antes de modificarlos. Separa pruebas unitarias, integración real y E2E; nunca presentes una prueba omitida o simulada como integración real. Si faltan prerrequisitos, muestra el fallo o regístralo explícitamente como pendiente.

Usa `push`, `pull_request` y ejecución manual cuando se soliciten; limita permisos, tiempos y concurrencia. En PR no ejecutes código no confiable con secretos privilegiados. Fija Actions a commits verificados y revisa las fuentes antes de añadirlas. No agregues despliegues ni cambies reglas de protección de ramas sin autorización.

Los servicios de pruebas deben tener credenciales sintéticas, datos deterministas y aislamiento de bases reales. Comprueba readiness, propaga fallos y conserva logs o resultados cuando existan. Verifica YAML y workflows y ejecuta localmente los comandos viables; distingue CI preparado de CI realmente publicado.

Referencias: [seguridad](https://docs.github.com/en/actions/reference/security/secure-use), [servicios PostgreSQL](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers), [eventos](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
