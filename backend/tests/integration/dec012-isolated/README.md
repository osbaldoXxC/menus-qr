# DEC-012: integracion aislada

Este entorno usa exclusivamente imagenes locales fijadas por SHA, credenciales sinteticas, red interna separada y tmpfs para PostgreSQL y Redis. Los archivos de codigo y esquema se montan en solo lectura. Las imagenes identificadas deben existir localmente; no se descargan dependencias ni se construyen imagenes. Los puertos solicitados son 127.0.0.1:41473 y 41474; en Docker Desktop con red interna pueden no publicarse. Las pruebas se ejecutan dentro del backend aislado.

Desde la raiz del repositorio, PowerShell:

```powershell
docker compose -p codex-dec012-isolated -f backend/tests/integration/dec012-isolated/compose.yaml config --quiet
docker compose -p codex-dec012-isolated -f backend/tests/integration/dec012-isolated/compose.yaml up -d --no-build --pull never
Get-Content -Raw -Encoding UTF8 backend/tests/integration/dec012-isolated/http.test.js | docker exec -i codex-dec012-isolated-backend-1 node
docker exec codex-dec012-isolated-ml-1 python -m unittest tests.test_r2_interpret tests.test_r2_rank
```

No apuntar esta configuracion al PostgreSQL existente. El segundo backend apunta a una direccion local inaccesible para probar el fallo de ML sin detener el ML real. Los servicios aislados se dejan activos para inspeccion; su base tmpfs desaparece si se detiene PostgreSQL. No usar `down -v`, prune ni limpiar recursos del proyecto principal.
