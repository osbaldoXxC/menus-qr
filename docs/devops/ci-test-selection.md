# Selección de pruebas para CI

- **Esenciales:** autenticación y separación de roles; aislamiento entre restaurantes; restricciones y recomendaciones; contratos HTTP y datos en PostgreSQL/Redis; ML; construcción y configuración de imágenes; recorridos E2E de comensal, restaurante y administración.
- **Obsoletas:** no se identificó ninguna cuya retirada estuviera justificada; no se eliminaron pruebas.
- **Redundantes:** hay cobertura compartida entre suites de integración, pero usan preparaciones y topologías diferentes; se conservan hasta demostrar equivalencia.
- **No críticas:** advertencias de Fast Refresh sobre módulos que también exportan contexto; no afectan el build ni bloquean lint. Los avisos moderados de dependencias requieren revisión independiente.

Las pruebas E2E usan únicamente datos sintéticos y una base aislada. El paso de auditoría de paquetes de producción rechaza vulnerabilidades altas y críticas conocidas; su resultado depende del registro npm en el momento de ejecución.
