# 📋 INFORME TÉCNICO DE DEVOPS: ISSUES #29 Y #33
**Proyecto:** MexxicanMX — Menús QR  
**Repositorio:** `https://github.com/osbaldoXxC/menus-qr`  
**Rol:** Ingeniera DevOps — Katherine Daniela Gómez Merino (Kate)  
**Colaborador en Issue #33:** Kevin Rojas Martínez  
**Tech Lead / Supervisor:** Álvarez Martínez Osbaldo  
**Fecha de Ejecución:** 28 de Octubre de 2026  

---

## 1. RESUMEN EJECUTIVO

El presente informe documenta la implementación de la infraestructura base de Integración Continua (CI) en GitHub Actions para el repositorio `menus-qr`, la resolución controlada del **Issue #29** (Error de Sintaxis YAML / Esquema) y la preparación técnica, delimitación y diseño del **Issue #33** (Comando Inexistente en Runner Linux, Exit Code 127), reservando expresamente la ejecución, captura y cierre de este último para **Kevin Rojas Martínez**.

---

## 2. SELECCIÓN DE SKILLS Y JUSTIFICACIÓN

Para garantizar un estándar riguroso de ingeniería sin desvíos de alcance ni modificaciones invasivas, se utilizaron las siguientes directrices y skills:

| Skill | Estado | Instrucciones / Enfoque Aplicado | Justificación en los Tickets #29 y #33 |
| :--- | :---: | :--- | :--- |
| **`scope-guard`** | Activa | Delimitación estricta de archivos afectados. Prohibición de tocar código de aplicación o tareas ajenas (#30, #31, #32). | Impidió alterar componentes de backend o frontends y contuvo los cambios exclusivamente a `.github/workflows/ci.yml` y documentación técnica. |
| **`feature-audit`** | Activa | Auditoría previa profunda en 3 fases: inspección de estado Git, verificación de contratos de workflow y evaluación de riesgos antes de programar. | Permitió detectar la ausencia inicial de `.github/workflows/ci.yml` y planificar la inducción controlada sin alterar las ramas `main` o `develop`. |
| **`code-quality`** | Activa | Reglas de código limpio, sintaxis estricta, indentación canónica (2 espacios en YAML), nombres declarativos y trazabilidad. | Aseguró que el archivo de workflow cumpla con la especificación oficial de GitHub Actions y mantenga un diseño mantenible con matriz en paralelo. |
| **`git-flow-github`** | Activa | Convenciones de Git Flow: ramas `feature/issue-<num>-<responsable>`, commits bajo **Conventional Commits** (`test:`, `fix:`) y protección de `main`/`develop`. | Garantizó la creación de ramas aisladas para Katherine y la preservación del historial sin aplicar `push` ni `merge` no autorizados. |

---

## 3. AUDITORÍA PREVIA DEL REPOSITORIO

Antes de iniciar cualquier edición de archivos, se auditó el entorno local y remoto:
- **Ruta local:** `C:\Users\Baldo\OneDrive\Escritorio\git\menus-qr`
- **Ramas base verificadas:** `main` y `develop` (actualizadas y sincronizadas con `origin`).
- **Estado de tickets en GitHub:** Confirmados abiertos en `osbaldoXxC/menus-qr`:
  - `Issue #29: ci: inducir y diagnosticar error de sintaxis YAML / claves invalidas en pipeline`
  - `Issue #33: runner: inducir y solucionar comando inexistente o falta de herramienta en runner`
- **Diagnóstico del Workflow:** No existía el directorio `.github/workflows/` ni el archivo `ci.yml` en la raíz. La infraestructura de CI requería construcción desde cero.
- **Control de Cambios:** Las modificaciones previas en `GUIA.md` fueron resguardadas de forma segura en la rama `chore/actualizar-guia-equipo`, dejando la rama base `develop` 100% limpia.

---

## 4. INFRAESTRUCTURA BASE DEL PIPELINE (`.github/workflows/ci.yml`)

Katherine construyó la arquitectura base del workflow adaptada a los módulos reales de MexxicanMX:
1. **Eventos disparadores:** `push` en `develop`, `main`, `feature/**`, `fix/**` y `pull_request` en `develop`, `main`.
2. **Job `backend-test`:**
   - Entorno: `ubuntu-latest`.
   - Runtime: Node.js 22 con caché automática referenciando `backend/package-lock.json`.
   - Instalación reproducible: `npm ci` dentro de `backend/`.
   - Ejecución de pruebas: `NODE_ENV=test npm test` (invocando la suite nativa `node --test`).
3. **Job `frontends-build`:**
   - Estrategia matricial: `app: [ admin, frontend-comensales, frontend-restaurantes ]`.
   - Instalación reproducible: `npm ci` en cada frontend.
   - Compilación de producción: `npm run build` con Vite y TypeScript.
   - **Conservación de Artefactos (Diapositiva 8):** Uso de `actions/upload-artifact@v4` resguardando la carpeta `dist/` de cada aplicación con retención de 1 día antes de la destrucción del runner.

---

## 5. DESARROLLO DEL ISSUE #29 — RESPONSABILIDAD DE KATHERINE

* **Rama de trabajo:** `feature/issue-29-kate-devops`
* **Archivo intervenido:** `.github/workflows/ci.yml`

### A. Inducción Controlada del Fallo
Se introdujo una violación deliberada de la especificación de GitHub Actions sustituyendo la clave canónica `steps:` por `steps_action:` con indentación rota (6 espacios) bajo `jobs.backend-test`:
```yaml
jobs:
  backend-test:
    name: Backend - Pruebas Unitarias
    runs-on: ubuntu-latest
      steps_action:
        - name: Descargar código fuente
          uses: actions/checkout@v4
```
* **Commit de Inducción generado:**  
  `e93c8ff test: forzar error de sintaxis yaml en ci`

### B. Síntoma y Mensaje Esperado en GitHub Actions
GitHub Actions valida estáticamente el esquema YAML antes de provisionar runners. Al no coincidir con el esquema oficial, el workflow es rechazado inmediatamente con:
```text
Invalid workflow file: .github/workflows/ci.yml#L13
mapping values are not allowed in this context / unexpected key 'steps_action'
```

### C. Causa Raíz
1. **Estructura jerárquica inválida:** YAML no admite claves anidadas con niveles de sangría inconsistentes bajo un mapeo escalar.
2. **Directiva desconocida:** El parser de GitHub Actions únicamente admite `steps:` como contenedor de la lista de tareas de un job. La clave `steps_action:` no forma parte de la especificación.

### D. Corrección Aplicada
Se restauró la directiva canónica `steps:` alineada a 4 espacios (bajo el job indentado a 2 espacios):
```yaml
jobs:
  backend-test:
    name: Backend - Pruebas Unitarias
    runs-on: ubuntu-latest
    steps:
      - name: Descargar código fuente
        uses: actions/checkout@v4
```
* **Commit de Corrección generado:**  
  `98790a7 fix: corregir estructura yaml y clave canonica steps`

### E. Estado del Issue #29: `PARCIAL`
- **Implementación y Commits locales:** Completados al 100% con hashes reales `e93c8ff` y `98790a7`.
- **Pendiente:** Ejecución remota de push y toma de capturas web en GitHub Actions (requiere autorización expresa del Tech Lead según directrices de no publicar sin consentimiento).

---

## 6. DESARROLLO DEL ISSUE #33 — TRABAJO COMPARTIDO

El Issue #33 aborda el fallo por comando inexistente en Linux (`exit code 127`). Se delimitaron estrictamente las responsabilidades:

### PARTE A: PREPARACIÓN REALIZADA POR KATHERINE (DEVOPS)
1. **Inspección del Job:** Se confirmó que el job idóneo es `backend-test` dentro de `.github/workflows/ci.yml`.
2. **Rama asignada:** Se creó la rama `feature/issue-33-kate-kevin` a partir de la versión funcional del pipeline.
3. **Propuesta técnica de inducción:** Insertar un paso temporal antes de la ejecución de pruebas con la herramienta ficticia:
   ```yaml
         - name: Ejecutar herramienta de reporte no disponible
           working-directory: backend
           run: |
             herramienta-inventada-qr --reporte
             npm test
   ```
4. **Comportamiento esperado en Linux:**
   - La terminal de Ubuntu devolverá: `line 1: herramienta-inventada-qr: command not found`.
   - Código de terminación: `Process completed with exit code 127`.
   - El shell `bash` aborta inmediatamente deteniendo la ejecución de `npm test` en cascada.
5. **Procedimiento de restauración documentado:** Retirar la llamada a `herramienta-inventada-qr --reporte`, dejando el step limpio con `npm test`.

---

### PARTE B: TAREAS RESERVADAS EXPRESAMENTE PARA KEVIN ROJAS MARTÍNEZ

**Kevin debe ejecutar personalmente las siguientes acciones:**
1. Cambiarse a la rama preparada:
   ```bash
   git checkout feature/issue-33-kate-kevin
   ```
2. Insertar el bloque de inducción en `.github/workflows/ci.yml` en la línea previa a `npm test`.
3. Crear el commit de prueba:
   ```bash
   git add .github/workflows/ci.yml
   git commit -m "test: invocar comando inexistente en el runner"
   ```
4. Subir la rama a GitHub con autorización del líder:
   ```bash
   git push origin feature/issue-33-kate-kevin
   ```
5. **Captura 1 de Kevin (Failed):** Tomar captura del log en GitHub Actions mostrando el error `command not found` y `exit code 127`.
6. Retirar la línea del comando inexistente y guardar el archivo limpio.
7. Crear el commit de solución:
   ```bash
   git add .github/workflows/ci.yml
   git commit -m "fix: remover comando inexistente y restablecer ejecucion limpia"
   ```
8. Subir la corrección (`git push origin feature/issue-33-kate-kevin`).
9. **Captura 2 de Kevin (Passed):** Tomar captura del job `backend-test` en verde.
10. Completar la fila del Issue #33 en la **Ficha de Trabajo** (`GUIA.md`).

---

## 7. MATRIZ DE COMMITS REALES EN EL REPOSITORIO

| Rama | Hash Real | Mensaje de Commit | Estado |
| :--- | :---: | :--- | :--- |
| `chore/actualizar-guia-equipo` | `e608923` | `docs(guia): actualizar manual de operaciones y matriz de roles para el equipo` | Local (Preserva `GUIA.md`) |
| `feature/issue-29-kate-devops` | `e93c8ff` | `test: forzar error de sintaxis yaml en ci` | Local (Inducción #29) |
| `feature/issue-29-kate-devops` | `98790a7` | `fix: corregir estructura yaml y clave canonica steps` | Local (Reparación #29) |
| `feature/issue-33-kate-kevin` | Base `98790a7` | Lista para la inducción y commits de Kevin | Local (Preparada) |

---

## 8. CHECKLIST DE CONFORMIDAD Y ESTADO FINAL

| Elemento / Criterio | Responsable | Estado | Observaciones |
| :--- | :---: | :---: | :--- |
| **Infraestructura Base CI (`ci.yml`)** | Katherine | **CUMPLE** | Implementada con Node 22, 3 frontends, backend y `upload-artifact@v4`. |
| **Issue #29 — Inducción y Corrección** | Katherine | **PARCIAL** | Commits locales generados; pendiente push a remoto para capturas web. |
| **Issue #33 — Preparación y Diseño** | Katherine | **CUMPLE** | Rama creada, propuesta técnica documentada y procedimiento listo. |
| **Issue #33 — Ejecución y Cierre** | Kevin | **PENDIENTE** | Reservado para ejecución, capturas y ficha de trabajo de Kevin. |
| **Control de Git Flow** | Katherine / Líder | **CUMPLE** | Ramas protegidas (`main`/`develop` intactas), sin commits invasivos ni push forzado. |
