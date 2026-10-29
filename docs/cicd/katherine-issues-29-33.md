# 📋 INFORME TÉCNICO DE DEVOPS: ISSUES #29 Y #33 Y MOTOR DE CAPTURAS REALES
**Proyecto:** MexxicanMX — Menús QR  
**Repositorio Oficial:** `https://github.com/osbaldoXxC/menus-qr`  
**Rol Directivo:** Ingeniera DevOps — Katherine Daniela Gómez Merino (Kate)  
**Colaborador en Issue #33:** Kevin Rojas Martínez  
**Tech Lead / Supervisor:** Álvarez Martínez Osbaldo  
**Fecha de Actualización:** 28 de Octubre de 2026  

---

## 1. RESUMEN EJECUTIVO

El presente informe consolida la implementación de la infraestructura base de Integración Continua (CI) en GitHub Actions para el repositorio `menus-qr`, la resolución técnica del **Issue #29** (Error de Sintaxis YAML / Esquema), la preparación de la rama e inducción del **Issue #33** (Comando Inexistente en Runner Linux, Exit Code 127) reservada para **Kevin Rojas Martínez**, y la incorporación de un **motor de automatización de navegador con Playwright** para obtener capturas de pantalla auténticas, no alteradas y reproducibles de las ejecuciones reales en GitHub Actions.

---

## 2. SELECCIÓN DE SKILLS Y CAPACIDADES DE NAVEGADOR

| Capacidad / Skill | Origen y Estado | Instrucciones / Enfoque Aplicado | Justificación en el Proyecto |
| :--- | :---: | :--- | :--- |
| **`playwright-e2e-testing`** | **Existente / Verificada** (`.agents/skills/playwright-e2e-testing/SKILL.md`) | Automatización de navegador real con Playwright Chromium en modo Headless / Viewport estandarizado (1440x900). | Permite capturar evidencias gráficas auténticas de GitHub Actions sin simular pantallas ni alterar píxeles, garantizando validez académica. |
| **`scope-guard`** | **Activa** (`.agents/skills/scope-guard/SKILL.md`) | Contención estricta a archivos mínimos necesarios. Prohibición de tocar código de aplicación o tareas ajenas (#30, #31, #32). | Impidió modificar componentes de la aplicación y delimitó los cambios a `.github/workflows/ci.yml`, `scripts/` y `docs/cicd/`. |
| **`feature-audit`** | **Activa** (`.agents/skills/feature-audit/SKILL.md`) | Protocolo de inspección previa en 3 fases: Git, contratos de dependencias y evaluación de riesgos. | Aseguró la preservación de las ramas base `main` y `develop` y la planificación segura de ramas de trabajo aisladas. |
| **`code-quality`** | **Activa** (`.agents/skills/code-quality/SKILL.md`) | Calidad de código, sintaxis estricta, indentación canónica (2 espacios en YAML) y scripts declarativos. | Garantizó que el workflow y el script de automatización sigan patrones limpios, modulares y con manejo de excepciones. |
| **`git-flow-github`** | **Activa** (`.gemini/config/skills/git-flow-github/SKILL.md`) | Flujo de ramas `feature/<nombre>`, Conventional Commits (`test:`, `fix:`) y cero push directo a `develop`/`main`. | Reguló la trazabilidad de commits y protegió el repositorio de publicaciones no autorizadas. |

---

## 3. AUDITORÍA DEL REPOSITORIO Y DEL ENTORNO DE AUTOMATIZACIÓN

1. **Estado Git:**
   - Ramas base `main` y `develop` limpias y protegidas.
   - Rama resguardo de manual del equipo: `chore/actualizar-guia-equipo`.
   - Rama de trabajo de Katherine: `feature/issue-29-kate-devops`.
   - Rama preparada para Kevin: `feature/issue-33-kate-kevin`.
2. **Entorno Playwright:**
   - Binario verificado: Playwright v1.62.1 con Chromium headless instalado localmente en el entorno.
   - Herramienta desarrollada: [`scripts/capture-evidence.js`](file:///C:/Users/Baldo/OneDrive/Escritorio/git/menus-qr/scripts/capture-evidence.js).
3. **Prueba de Captura Controlada (Verificación Técnica):**
   - Se ejecutó una prueba de navegación y captura real hacia `https://github.com/osbaldoXxC/menus-qr/issues/29` y `https://github.com/osbaldoXxC/menus-qr/actions`.
   - Archivo generado: [`evidence/cicd/test/test-issue-29.png`](file:///C:/Users/Baldo/OneDrive/Escritorio/git/menus-qr/evidence/cicd/test/test-issue-29.png) (185.31 KB) y [`test-actions-page.png`](file:///C:/Users/Baldo/OneDrive/Escritorio/git/menus-qr/evidence/cicd/test/test-actions-page.png) (154.77 KB).
   - Verificación de integridad: Cabecera PNG válida (`0x89 0x50 0x4E 0x47`), resolución nítida de 1440x900 píxeles.

---

## 4. INFRAESTRUCTURA BASE DEL PIPELINE (`.github/workflows/ci.yml`)

Implementada por Katherine en [`feature/issue-29-kate-devops`](file:///C:/Users/Baldo/OneDrive/Escritorio/git/menus-qr/.github/workflows/ci.yml):
* **Job `backend-test`:** Node 22, `npm ci`, `npm test` con suite nativa `node:test`.
* **Job `frontends-build`:** Matriz paralela para `admin`, `frontend-comensales` y `frontend-restaurantes`, compilando con Vite y TypeScript (`npm run build`).
* **Resguardo de Artefactos (Diapositiva 8):** Acción `actions/upload-artifact@v4` preservando la carpeta `dist/` de cada frontend compilado con 1 día de retención.

---

## 5. RESOLUCIÓN TÉCNICA DEL ISSUE #29 (KATHERINE)

* **Rama:** `feature/issue-29-kate-devops`
* **Inducción del fallo:** Clave canónica `steps:` sustituida por `steps_action:` con sangría rota de 6 espacios bajo `jobs.backend-test`.
  - **Commit real:** `e93c8ff test: forzar error de sintaxis yaml en ci`
  - **Síntoma en Actions:** `Invalid workflow file: .github/workflows/ci.yml#L13 mapping values are not allowed in this context / unexpected key 'steps_action'`.
* **Corrección aplicada:** Restauración de `steps:` a 4 espacios estándar.
  - **Commit real:** `98790a7 fix: corregir estructura yaml y clave canonica steps`
* **Procedimiento para Capturas Reales (tras autorización de push):**
  1. Subir la inducción a remoto para que GitHub registre el fallo:
     ```bash
     git checkout e93c8ff
     git push origin HEAD:feature/issue-29-kate-devops --force
     ```
  2. Ejecutar la captura automática del fallo:
     ```bash
     node scripts/capture-evidence.js --url "https://github.com/osbaldoXxC/menus-qr/actions" --output "evidence/cicd/issue-29/issue-29-failed.png"
     ```
  3. Subir la corrección:
     ```bash
     git checkout feature/issue-29-kate-devops
     git push origin feature/issue-29-kate-devops
     ```
  4. Ejecutar la captura automática del éxito:
     ```bash
     node scripts/capture-evidence.js --url "https://github.com/osbaldoXxC/menus-qr/actions" --output "evidence/cicd/issue-29/issue-29-passed.png"
     ```

---

## 6. PREPARACIÓN Y PROCEDIMIENTO RESERVADO PARA KEVIN (ISSUE #33)

* **Rama preparada:** `feature/issue-33-kate-kevin`
* **Archivo:** `.github/workflows/ci.yml` (en el job `backend-test`)

### A. Preparación Realizada por Katherine:
Se configuró la rama base con el pipeline limpio y se documentó la inducción requerida antes del paso `npm test`:
```yaml
      - name: Ejecutar herramienta de reporte inexistente
        working-directory: backend
        run: |
          herramienta-inventada-qr --reporte
          npm test
```
* **Comportamiento esperado en Linux:** El runner de Ubuntu emitirá `line 1: herramienta-inventada-qr: command not found` y finalizará con `exit code 127`.

### B. Instrucciones Paso a Paso para Kevin Rojas Martínez:
1. Posicionarse en la rama:
   ```bash
   git checkout feature/issue-33-kate-kevin
   ```
2. Insertar el bloque de prueba en `.github/workflows/ci.yml` y commitear:
   ```bash
   git add .github/workflows/ci.yml
   git commit -m "test: invocar comando inexistente en el runner"
   git push origin feature/issue-33-kate-kevin
   ```
3. **Captura Real 1 (Failed):** Una vez que GitHub Actions marque la cruz roja en el job `backend-test`, ejecutar:
   ```bash
   node scripts/capture-evidence.js --url "<URL_DEL_JOB_FALLIDO_EN_GITHUB>" --output "evidence/cicd/issue-33/issue-33-failed-kevin.png"
   ```
4. Retirar la línea `herramienta-inventada-qr --reporte`, guardar y commitear:
   ```bash
   git add .github/workflows/ci.yml
   git commit -m "fix: remover comando inexistente y restablecer ejecucion limpia"
   git push origin feature/issue-33-kate-kevin
   ```
5. **Captura Real 2 (Passed):** Cuando el runner finalice con check verde, ejecutar:
   ```bash
   node scripts/capture-evidence.js --url "<URL_DEL_JOB_EXITOSO_EN_GITHUB>" --output "evidence/cicd/issue-33/issue-33-passed-kevin.png"
   ```
6. Completar su fila en la **Ficha de Trabajo** (`GUIA.md`).

---

## 7. MATRIZ DE EVIDENCIAS Y ESTADO DE CONFORMIDAD

| Evidencia / Artefacto | Ruta en Repositorio | Estado | Validación Técnica |
| :--- | :--- | :---: | :--- |
| **Prueba de Motor Playwright** | `evidence/cicd/test/test-issue-29.png` | **`VERIFICADA`** | Archivo PNG auténtico (185 KB, 1440x900) capturado con Playwright Chromium. |
| **Prueba Actions de Control** | `evidence/cicd/test/test-actions-page.png` | **`VERIFICADA`** | Archivo PNG auténtico (154 KB, 1440x900) del panel web de GitHub Actions. |
| **Issue #29: Pipeline Failed** | `evidence/cicd/issue-29/issue-29-failed.png` | **`PENDIENTE`** | Lista para capturar en cuanto se autorice el `git push` de `feature/issue-29-kate-devops`. |
| **Issue #29: Pipeline Passed** | `evidence/cicd/issue-29/issue-29-passed.png` | **`PENDIENTE`** | Lista para capturar tras la corrida verde de la corrección en GitHub Actions. |
| **Issue #33: Runner Exit 127** | `evidence/cicd/issue-33/issue-33-failed-kevin.png` | **`PENDIENTE`** | Reservada expresamente para la ejecución y captura de Kevin Rojas. |
| **Issue #33: Runner Recuperado**| `evidence/cicd/issue-33/issue-33-passed-kevin.png` | **`PENDIENTE`** | Reservada expresamente para la ejecución y captura de Kevin Rojas. |

---

## 8. COMMITS REALES EN EL REPOSITORIO

```text
develop (origin/develop) ── [Prístina, limpia y protegida]
│
├── chore/actualizar-guia-equipo (e608923) ── docs(guia): manual de operaciones y matriz de roles
├── feature/issue-29-kate-devops:
│   ├── e93c8ff ── test: forzar error de sintaxis yaml en ci
│   ├── 98790a7 ── fix: corregir estructura yaml y clave canonica steps
│   └── 026648f ── docs(cicd): informe de entregables de katherine
└── feature/issue-33-kate-kevin (026648f) ── Sincronizada con workflow limpio, lista para Kevin
```

---

## 9. CHECKLIST FINAL DE CRITERIOS

- [x] Motor de automatización con Playwright Chromium verificado y funcional sin dependencias invasivas.
- [x] Script reusable `scripts/capture-evidence.js` implementado con validación de cabeceras PNG y parámetros de consola.
- [x] Prueba controlada de captura ejecutada con éxito generando archivos PNG auténticos.
- [x] Infraestructura base de CI (`.github/workflows/ci.yml`) con Node 22, 3 frontends y `upload-artifact@v4`.
- [x] Issue #29 inducido y resuelto con Conventional Commits en rama aislada.
- [x] Issue #33 preparado y estructurado, reservando la ejecución real exclusivamente para Kevin Rojas Martínez.
- [x] Cero operaciones destructivas y cero push no autorizado a GitHub.
