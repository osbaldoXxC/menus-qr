# 📋 INFORME TÉCNICO DE QA: ISSUE #31 Y AUDITORÍA DE PIPELINE CI/CD
**Proyecto:** MexxicanMX — Menús QR  
**Repositorio Oficial:** `https://github.com/osbaldoXxC/menus-qr`  
**Rol:** Ingeniero de Aseguramiento de Calidad (QA) — Félix Iván García  
**Colaborador en Issue #31:** Abraham Moreno  
**Tech Lead / Supervisor:** Álvarez Martínez Osbaldo  
**Fecha de Ejecución:** 29 de Octubre de 2026  

---

## 1. RESUMEN EJECUTIVO

El presente informe certifica la ejecución, reproducción controlada, corrección y auditoría de calidad (QA) del **Issue #31** (*Regresión por fallo de aserción en pruebas unitarias de backend en `slugService.test.js`*), así como la revisión de conformidad del pipeline de Integración Continua (`.github/workflows/ci.yml`):

1. **Inducción y Bloqueo en CI (`Failed`):** Se verificó que al introducir una expectativa inválida en `backend/tests/unit/slugService.test.js`, el runner de GitHub Actions (`ubuntu-latest` con Node.js 22) detiene inmediatamente el job **`Backend - Pruebas Unitarias`** con `AssertionError [ERR_ASSERTION]` y código de salida **`1`**.
2. **Restauración y Certificación (`Passed`):** Tras aplicar el commit bajo **Conventional Commits** (`fix: restaurar asercion canonica de slugService en pruebas unitarias`), la suite de pruebas nativa (`node --test`) aprueba los 5 casos de prueba (`# tests 5 / # pass 5 / # fail 0`) y los 4 jobs del workflow finalizan en verde (`exit code 0`).

---

## 2. TRAZABILIDAD DE EJECUCIONES REALES EN GITHUB ACTIONS (ISSUE #31)

| Integrante | Rol | Fase | Rama | Commit SHA | Run de GitHub Actions | Estado |
| :--- | :---: | :--- | :--- | :---: | :--- | :---: |
| **Abraham Moreno** | Dev | Fallo inducido (`test:`) | `feature/issue-31-abraham` | [`2f54425`](https://github.com/osbaldoXxC/menus-qr/commit/2f5442575955b21fa0c5836974e27a6a044188f6) | [Run #40831319227](https://github.com/osbaldoXxC/menus-qr/actions/runs/40831319227) | 🔴 `Failure (Exit 1)` |
| **Abraham Moreno** | Dev | Corrección (`fix:`) | `feature/issue-31-abraham` | [`217d74d`](https://github.com/osbaldoXxC/menus-qr/commit/217d74d51a8055b3beaebe864f1d40bc62ec196b) | [Run #40832265115](https://github.com/osbaldoXxC/menus-qr/actions/runs/40832265115) | 🟢 `Success (Exit 0)` |
| **Félix Iván García** | QA | Reproducción QA (`test:`) | `feature/issue-31-felix` | [`0610239`](https://github.com/osbaldoXxC/menus-qr/commit/0610239) | [Run #40919578391](https://github.com/osbaldoXxC/menus-qr/actions/runs/40919578391) | 🔴 `Failure (Exit 1)` |
| **Félix Iván García** | QA | Certificación QA (`fix:`) | `feature/issue-31-felix` | [`8f3cb3d`](https://github.com/osbaldoXxC/menus-qr/commit/8f3cb3d) | [Run #40920384753](https://github.com/osbaldoXxC/menus-qr/actions/runs/40920384753) | 🟢 `Success (Exit 0)` |

---

## 3. FICHA DE TRABAJO OFICIAL — ISSUE #31 (SECCIÓN 7 DE GUIA.MD)

1. **¿Qué falló exactamente? (Job y archivo):**
   Falló el job **`Backend - Pruebas Unitarias` (`backend-test`)** al evaluar el archivo de pruebas unitarias [`backend/tests/unit/slugService.test.js`](../../backend/tests/unit/slugService.test.js).

2. **¿En qué etapa se detuvo?**
   Se detuvo en el step **`Ejecutar pruebas unitarias`** (`npm test` con `NODE_ENV=test`), inmediatamente después de instalar las dependencias limpias con `npm ci`.

3. **¿Qué código o mensaje de error arrojó la consola? (El síntoma):**
   El test runner nativo de Node.js arrojó un error de aserción estricta:
   ```text
   AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
   + actual - expected
   + 'taqueria-los-hermanos'
   - 'taqueria-las-glorias-error-intencional'
   failureType: 'testCodeFailure'
   operator: 'strictEqual'
   Error: Process completed with exit code 1.
   ```

4. **¿Qué hicieron para resolverlo? (El commit `fix:` aplicado):**
   Se restauró la aserción canónica `assert.equal(resultado, 'taqueria-los-hermanos')` en la primera subprueba de [`backend/tests/unit/slugService.test.js`](../../backend/tests/unit/slugService.test.js) mediante el commit `fix: restaurar asercion canonica de slugService en pruebas unitarias` ([`8f3cb3d`](https://github.com/osbaldoXxC/menus-qr/commit/8f3cb3d) / [`217d74d`](https://github.com/osbaldoXxC/menus-qr/commit/217d74d51a8055b3beaebe864f1d40bc62ec196b)), logrando que las 5 pruebas pasen (`# pass 5 / # fail 0`) y el pipeline finalice en verde con código `0`.

---

## 4. EVIDENCIAS GRÁFICAS VERIFICADAS

* 🔴 **Captura 1 (Failed):** [`evidence/cicd/issue-31/issue-31-failed.png`](../../evidence/cicd/issue-31/issue-31-failed.png) — Muestra el job `Backend - Pruebas Unitarias` detenido en rojo con `Error: Process completed with exit code 1`.
* 🟢 **Captura 2 (Passed):** [`evidence/cicd/issue-31/issue-31-passed.png`](../../evidence/cicd/issue-31/issue-31-passed.png) — Muestra los 4 jobs del pipeline (`Backend - Pruebas Unitarias` y la matriz de 3 `Frontends`) completados en verde tras el commit `fix:`.

---

## 5. DICTAMEN DE AUDITORÍA QA (TURNO 2 Y TURNO 4)

| Ticket / PR Auditado | Responsables | Captura Roja (`Failed`) | Captura Verde (`Passed`) | Ficha de Trabajo (4 Respuestas) | Pipeline en Verde | Dictamen QA |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Issue #29 (PR #35/#36)** | Katherine Gómez (DevOps) | ✅ Verificada | ✅ Verificada | ✅ Completa | ✅ `Success` | **APROBADO** |
| **Issue #31 (PR #37 + QA)** | Abraham Moreno y Félix García | ✅ Verificada | ✅ Verificada | ✅ Completa | ✅ `Success` | **APROBADO** |
| **Issue #33 (PR #38)** | Katherine Gómez y Kevin Rojas | ✅ Verificada | ✅ Verificada | ✅ Completa | ✅ `Success` | **APROBADO** |
