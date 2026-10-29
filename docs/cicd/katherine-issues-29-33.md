# 📋 INFORME TÉCNICO DE DEVOPS: ISSUES #29 Y #33 Y MOTOR DE CAPTURAS REALES
**Proyecto:** MexxicanMX — Menús QR  
**Repositorio Oficial:** `https://github.com/osbaldoXxC/menus-qr`  
**Rol Directivo:** Ingeniera DevOps — Katherine Daniela Gómez Merino (Kate)  
**Colaborador en Issue #33:** Kevin Rojas Martínez  
**Tech Lead / Supervisor:** Álvarez Martínez Osbaldo  
**Fecha de Cierre de Katherine:** 28 de Octubre de 2026  

---

## 1. RESUMEN EJECUTIVO

El presente informe certifica la finalización exitosa de las responsabilidades directivas y técnicas de **Katherine Daniela Gómez Merino (Kate)** en el área de Infraestructura y CI/CD:
1. **Infraestructura Base de CI/CD:** Pipeline canónico `.github/workflows/ci.yml` con Node.js 22, backend y matriz de 3 frontends reales (`admin`, `frontend-comensales`, `frontend-restaurantes`) con empaquetado de artefactos `actions/upload-artifact@v4`.
2. **Issue #29 (Error de Sintaxis YAML):** Completado al 100% (**`CUMPLE`**), con dos ejecuciones reales en GitHub Actions y sus capturas de pantalla auténticas obtenidas mediante Playwright.
3. **Issue #33 (Comando Inexistente en Linux):** Preparación técnica completada y ejecución/corrección verificadas por **Kevin Rojas Martínez** en `feature/issue-33-kate-kevin`; el runner mostró el error real `command not found` con código `127` y después completó la corrida corregida en verde.

---

## 2. SELECCIÓN DE SKILLS Y CAPACIDADES DE NAVEGADOR

| Capacidad / Skill | Origen y Estado | Instrucciones / Enfoque Aplicado | Justificación en el Proyecto |
| :--- | :---: | :--- | :--- |
| **`playwright-e2e-testing`** | **Existente / Verificada** (`.agents/skills/playwright-e2e-testing/SKILL.md`) | Automatización de navegador real con Playwright Chromium en modo Headless / Viewport estandarizado (1440x900). | Permitió capturar evidencias gráficas auténticas de GitHub Actions sin simular pantallas ni alterar píxeles, garantizando validez académica. |
| **`scope-guard`** | **Activa** (`.agents/skills/scope-guard/SKILL.md`) | Contención estricta a archivos mínimos necesarios. Prohibición de tocar código de aplicación o tareas ajenas (#30, #31, #32). | Impidió modificar componentes de la aplicación y delimitó los cambios a `.github/workflows/ci.yml`, `scripts/`, `evidence/` y `docs/cicd/`. |
| **`feature-audit`** | **Activa** (`.agents/skills/feature-audit/SKILL.md`) | Protocolo de inspección previa en 3 fases: Git, contratos de dependencias y evaluación de riesgos. | Aseguró la preservación de las ramas base `main` y `develop` y la planificación segura de ramas de trabajo aisladas. |
| **`code-quality`** | **Activa** (`.agents/skills/code-quality/SKILL.md`) | Calidad de código, sintaxis estricta, indentación canónica (2 espacios en YAML) y scripts declarativos. | Garantizó que el workflow y el script de automatización sigan patrones limpios, modulares y con manejo de excepciones. |
| **`git-flow-github`** | **Activa** (`.gemini/config/skills/git-flow-github/SKILL.md`) | Flujo de ramas `feature/<nombre>`, Conventional Commits (`test:`, `fix:`) y cero push directo a `develop`/`main`. | Reguló la trazabilidad de commits y protegió el repositorio de publicaciones no autorizadas. |

---

## 3. INFRAESTRUCTURA BASE DEL PIPELINE (`.github/workflows/ci.yml`)

Implementada y validada en GitHub Actions:
* **Job `backend-test`:** Node 22, `npm ci`, `npm test` con suite nativa `node:test` (Ejecutado con éxito en 12s).
* **Job `frontends-build`:** Matriz paralela para `admin` (14s), `frontend-comensales` (52s) y `frontend-restaurantes` (1m 6s), compilando con Vite y TypeScript (`npm run build`).
* **Resguardo de Artefactos (Diapositiva 8):** Acción `actions/upload-artifact@v4` preservando la carpeta `dist/` de cada frontend:
  - `dist-admin` (Generado y verificado en GitHub)
  - `dist-frontend-comensales` (Generado y verificado en GitHub)
  - `dist-frontend-restaurantes` (Generado y verificado en GitHub)

---

## 4. RESOLUCIÓN DEFINITIVA Y EVIDENCIAS DEL ISSUE #29 (KATHERINE)
* **Estado:** **`CUMPLE`**

### A. Ejecución Real 1 — Pipeline Fallido (`Failed`)
* **Rama de prueba:** `feature/issue-29-kate-fail-test`
* **Commit publicado:** [`e93c8ff`](file:///C:/Users/Baldo/OneDrive/Escritorio/git/menus-qr) `test: forzar error de sintaxis yaml en ci`
* **ID de la Corrida en GitHub:** `40819689060`
* **URL Oficial:** https://github.com/osbaldoXxC/menus-qr/actions/runs/40819689060
* **Resultado observado:** Rechazo estático en 0s con anotación:  
  `Invalid workflow file: .github/workflows/ci.yml#L13 - You have an error in your yaml syntax on line 13`
* **Archivo de Evidencia:** [`evidence/cicd/issue-29/issue-29-failed.png`](file:///C:/Users/Baldo/OneDrive/Escritorio/git/menus-qr/evidence/cicd/issue-29/issue-29-failed.png) (60.75 KB, 1440x900 px, PNG auténtico verificado).

### B. Ejecución Real 2 — Pipeline Exitoso (`Passed`)
* **Rama oficial de Katherine:** `feature/issue-29-kate-devops`
* **Commit publicado:** [`9ca9b3b`](file:///C:/Users/Baldo/OneDrive/Escritorio/git/menus-qr) `feat(cicd): motor de captura real con playwright y actualizacion de informe`
* **ID de la Corrida en GitHub:** `40820241296`
* **URL Oficial:** https://github.com/osbaldoXxC/menus-qr/actions/runs/40820241296
* **Resultado observado:** Los 4 jobs completados en verde (`✓`) y los 3 artefactos compilados subidos con éxito.
* **Archivo de Evidencia:** [`evidence/cicd/issue-29/issue-29-passed.png`](file:///C:/Users/Baldo/OneDrive/Escritorio/git/menus-qr/evidence/cicd/issue-29/issue-29-passed.png) (84.19 KB, 1440x900 px, PNG auténtico verificado).

---

## 5. PREPARACIÓN Y PROCEDIMIENTO RESERVADO PARA KEVIN (ISSUE #33)
* **Estado de Fase DevOps:** **`CUMPLE` (Preparación terminada)**
* **Estado de Ejecución:** **`COMPLETADO` (Kevin Rojas Martínez, 29 de octubre de 2026)**
* **Rama:** `feature/issue-33-kate-kevin`, publicada con los commits de inducción y corrección; el workflow final quedó limpio.

### Instrucciones Paso a Paso para Kevin Rojas:
1. Cambiarse a la rama:
   ```bash
   git checkout feature/issue-33-kate-kevin
   ```
2. Insertar en `.github/workflows/ci.yml` (en el job `backend-test` antes de `npm test`):
   ```yaml
         - name: Ejecutar herramienta de reporte inexistente
           working-directory: backend
           run: |
             herramienta-inventada-qr --reporte
             npm test
   ```
3. Crear el commit de prueba y subir:
   ```bash
   git commit -am "test: invocar comando inexistente en el runner"
   git push origin feature/issue-33-kate-kevin
   ```
4. **Captura 1 de Kevin (Failed - Exit 127):**  
   Consultar el ID con `gh run list --branch feature/issue-33-kate-kevin` y ejecutar:
   ```bash
   node scripts/capture-evidence.js --url "https://github.com/osbaldoXxC/menus-qr/actions/runs/<ID_DEL_RUN>" --output "evidence/cicd/issue-33/issue-33-failed-kevin.png"
   ```
5. Retirar el comando inexistente y commitear la solución:
   ```bash
   git commit -am "fix: remover comando inexistente y restablecer ejecucion limpia"
   git push origin feature/issue-33-kate-kevin
   ```
6. **Captura 2 de Kevin (Passed):**  
   Cuando el pipeline finalice en verde:
   ```bash
   node scripts/capture-evidence.js --url "https://github.com/osbaldoXxC/menus-qr/actions/runs/<ID_DEL_RUN_VERDE>" --output "evidence/cicd/issue-33/issue-33-passed-kevin.png"
   ```
7. Completar la fila del Issue #33 en la **Ficha de Trabajo** (`GUIA.md`).

---

## 6. 📊 MATRIZ RESUMEN DE EVIDENCIAS Y CLASIFICACIÓN FINAL

| Evidencia / Artefacto | Ruta en el Repositorio | Estado | Validación Técnica |
| :--- | :--- | :---: | :--- |
| **Issue #29: Pipeline Failed** | `evidence/cicd/issue-29/issue-29-failed.png` | **`VERIFICADA`** | Run `40819689060` (60.75 KB). Muestra el rechazo real por sintaxis YAML. |
| **Issue #29: Pipeline Passed** | `evidence/cicd/issue-29/issue-29-passed.png` | **`VERIFICADA`** | Run `40820241296` (84.19 KB). Muestra los 4 jobs en verde y 3 artefactos subidos. |
| **Motor Playwright Reusable** | `scripts/capture-evidence.js` | **`VERIFICADA`** | Script modular con Playwright Chromium y validación de cabeceras binarias. |
| **Issue #33: Fallo Exit 127** | `evidence/cicd/issue-33/issue-33-failed-kevin.png` | **`VERIFICADA`** | Run `40896488728`; commit `02698632c63b2a77812525525c9e61439ae55b88`. El log muestra `command not found` y exit code `127`. |
| **Issue #33: Corrida Verde** | `evidence/cicd/issue-33/issue-33-passed-kevin.png` | **`VERIFICADA`** | Run `40897026572`; commit `ff19d85916e92f79fd899664fdf9f0ca52a01f26`. Los 4 jobs finalizaron correctamente. |

---

## 7. 🌿 ESTADO FINAL DE GIT

* **`develop` y `main`:** 100% limpias, intactas y sincronizadas con `origin`.
* **`chore/actualizar-guia-equipo`:** Resguardo seguro del manual de equipo.
* **`feature/issue-29-kate-fail-test`:** Conservada temporalmente para auditoría de la corrida `40819689060`.
* **`feature/issue-29-kate-devops`:** Publicada en `origin/feature/issue-29-kate-devops` con sus dos evidencias reales.
* **`feature/issue-33-kate-kevin`:** Publicada con la prueba temporal (`02698632c63b2a77812525525c9e61439ae55b88`) y la corrección (`ff19d85916e92f79fd899664fdf9f0ca52a01f26`); ejecuciones verificadas `40896488728` (fallo 127) y `40897026572` (éxito).
