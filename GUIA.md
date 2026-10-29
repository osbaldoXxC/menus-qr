# GUÍA PRÁCTICA DE LABORATORIO: CONSTRUCCIÓN Y DIAGNÓSTICO DE PIPELINES CI/CD

> **Repositorio de la práctica:** `https://github.com/osbaldoXxC/menus-qr`  
> **Rama de trabajo autorizada:** `feature/osbaldo`  
> **Proyecto:** Sistema de Menús Digitales Interactivos QR (`menus-qr`)  
> **Requisitos:** Node.js v20+ o v22+, npm v10+, Git v2.40+, editor con soporte YAML.

---

## 1. OBJETIVO Y REQUISITOS PREVIOS

### 1.1 Objetivo Didáctico
El propósito de este laboratorio es desarrollar habilidades prácticas de ingeniería y diagnóstico de pipelines de Integración Continua (CI), aprendiendo a identificar, aislar y corregir los cinco tipos de fallos más comunes que detienen un pipeline en entornos profesionales:
1. **Errores de sintaxis YAML vs. directivas no reconocidas en el esquema de GitHub Actions.**
2. **Errores de sintaxis o transpilación en código fuente (TypeScript/JavaScript).**
3. **Regresiones funcionales y aserciones fallidas en pruebas unitarias automatizadas.**
4. **Desincronización de dependencias y paquetes inexistentes en `npm ci`.**
5. **Comandos o binarios ausentes en el entorno de ejecución (`exit code 127`).**

### 1.2 Requisitos del Entorno
* **Node.js**: v20.x o v22.x instalado localmente (`node -v`).
* **npm**: v10.x instalado localmente (`npm -v`).
* **Git**: Instalado y configurado con tus credenciales (`git --version`).
* **Editor**: Visual Studio Code, Cursor o cualquier editor con soporte para YAML y TypeScript.

---

## 2. ARQUITECTURA Y ESTRUCTURA REAL DEL REPOSITORIO

El repositorio `menus-qr` cuenta con la siguiente estructura modular verificada:

```text
menus-qr/
├── .github/
│   └── workflows/              <-- Directorio donde diseñarás tu pipeline (ci.yml)
├── backend/
│   ├── src/
│   │   ├── config/             <-- Configuración de PostgreSQL y Redis
│   │   ├── controllers/        <-- Controladores de menús, platos, autenticación
│   │   ├── middleware/         <-- Middlewares de seguridad (JWT, RBAC)
│   │   ├── routes/             <-- Rutas REST de la API Express
│   │   ├── services/           <-- Servicios de negocio (slugService, cacheService)
│   │   └── index.js            <-- Servidor Express
│   ├── tests/
│   │   └── unit/
│   │       └── slugService.test.js <-- Suite de pruebas unitarias nativas
│   ├── .env.example            <-- Plantilla de variables de entorno (sin secretos)
│   ├── package.json            <-- Manifiesto con script "test": "node --test"
│   └── package-lock.json       <-- Árbol de dependencias bloqueado
├── frontend/
│   ├── src/
│   │   ├── components/         <-- Componentes React reutilizables
│   │   ├── pages/              <-- Vistas de la aplicación (Menú Público, Dashboard, etc.)
│   │   ├── services/           <-- Clientes API y Axios
│   │   ├── utils/
│   │   │   └── menuUtils.ts    <-- Utilidades de URL (contiene getPublicMenuUrl)
│   │   ├── App.tsx             <-- Enrutador principal de la app
│   │   └── main.tsx            <-- Punto de entrada React
│   ├── .env.example            <-- Plantilla de variables frontend
│   ├── package.json            <-- Manifiesto con script "build": "tsc && vite build"
│   ├── tsconfig.json           <-- Reglas del compilador TypeScript
│   └── vite.config.ts          <-- Configuración del empaquetador Vite
├── db/
│   └── contract/               <-- Esquema contractual de base de datos
├── .gitignore                  <-- Exclusiones de node_modules, dist, .env
├── README.md                   <-- Documentación institucional del equipo (protegido)
├── proyecto.md                 <-- Definición de alcance académico (protegido)
└── GUIA.md                     <-- Este manual de laboratorio
```

---

## 3. PREPARACIÓN DE LA RAMA DE TRABAJO

Para no alterar la rama principal (`main`), toda la práctica debe realizarse en ramas de trabajo o en la rama autorizada:

```bash
# 1. Posicionarse en la raíz del proyecto
cd C:\Users\Baldo\OneDrive\Escritorio\git\menus-qr

# 2. Verificar el estado de git
git status

# 3. Asegurar que estás en la rama feature/osbaldo
git checkout feature/osbaldo
```

---

## 4. CREACIÓN DEL WORKFLOW DE CI BASE DESDE CERO

En el repositorio destino no existe ningún archivo de CI previo. Debes crearlo en la ruta `.github/workflows/ci.yml`.

### Archivo: `.github/workflows/ci.yml` (Versión Canónica y Funcional)
```yaml
name: CI Menús QR

on:
  push:
    branches: [ feature/osbaldo, main ]
  pull_request:
    branches: [ feature/osbaldo, main ]

jobs:
  backend-test:
    name: Pruebas Unitarias Backend
    runs-on: ubuntu-latest
    steps:
      - name: Descargar código fuente
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Instalar dependencias limpias de Backend
        working-directory: backend
        run: npm ci

      - name: Ejecutar pruebas unitarias de Backend
        working-directory: backend
        env:
          NODE_ENV: test
        run: npm test

  frontend-build:
    name: Compilación Frontend
    runs-on: ubuntu-latest
    steps:
      - name: Descargar código fuente
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Instalar dependencias limpias de Frontend
        working-directory: frontend
        run: npm ci

      - name: Compilar aplicación React + TypeScript
        working-directory: frontend
        run: npm run build
```

---

## 5. EJECUCIÓN LOCAL DE LAS VALIDACIONES

Antes de subir cambios a GitHub, siempre debes comprobar las validaciones en tu máquina local.

### En Windows PowerShell:
```powershell
# Validar Pruebas Unitarias en Backend
cd backend
$env:NODE_ENV="test"
npm test
cd ..

# Validar Compilación en Frontend
cd frontend
npm run build
cd ..
```

### En Linux / macOS / Bash:
```bash
# Validar Pruebas Unitarias en Backend
cd backend
NODE_ENV=test npm test
cd ..

# Validar Compilación en Frontend
cd frontend
npm run build
cd ..
```

---

## 6. RESOLUCIÓN PASO A PASO DE LOS CINCO ESCENARIOS

---

### ESCENARIO 1: ERROR DE SINTAXIS YAML / ESQUEMA DE GITHUB ACTIONS
* **Issue de referencia:** [Issue #29: ci: inducir y diagnosticar error de sintaxis YAML / claves invalidas en pipeline](https://github.com/osbaldoXxC/menus-qr/issues/29)

#### A. Cómo inducir el error de forma controlada
Edita `.github/workflows/ci.yml` e introduce una directiva que viola el esquema de GitHub Actions (usar `steps_action:` en lugar de `steps:` e indentación irregular):
```yaml
jobs:
  backend-test:
    name: Pruebas Unitarias Backend
    runs-on: ubuntu-latest
      steps_action:
        - uses: actions/checkout@v4
```

#### B. Comportamiento y Mensaje Esperado en GitHub Actions
*(Resultado esperado en la interfaz web de GitHub Actions)*
GitHub detecta que la estructura no cumple el esquema de workflows antes de iniciar los runners:
```text
Invalid workflow file: .github/workflows/ci.yml#L16
mapping values are not allowed in this context / unexpected key 'steps_action'
```

#### C. Diagnóstico
1. **Error de sintaxis pura YAML:** Ocurre cuando hay tabulaciones o dos puntos sin espacio posterior (`clave:valor` en lugar de `clave: valor`).
2. **Error de esquema de GitHub Actions:** Ocurre cuando el YAML es válido sintácticamente pero contiene claves que no forman parte de la especificación oficial (como `steps_action` o `runs-on: ubntu-invalid`).

#### D. Corrección
Restaura la clave canónica `steps:` y la indentación de 2 espacios:
```yaml
  backend-test:
    name: Pruebas Unitarias Backend
    runs-on: ubuntu-latest
    steps:
      - name: Descargar código fuente
        uses: actions/checkout@v4
```

#### E. Verificación
Al hacer commit y push, el workflow es aceptado por el motor de GitHub y los jobs pasan a estado `Queued` $\to$ `In Progress`.

---

### ESCENARIO 2: ERROR DE SINTAXIS O COMPILACIÓN EN CÓDIGO FUENTE
* **Issue de referencia:** [Issue #30: build: inducir y resolver error de transpilacion/sintaxis en la etapa de construccion](https://github.com/osbaldoXxC/menus-qr/issues/30)

#### A. Cómo inducir el error de forma controlada
Abre [`frontend/src/utils/menuUtils.ts`](file:///C:/Users/Baldo/OneDrive/Escritorio/git/menus-qr/frontend/src/utils/menuUtils.ts) e introduce un token inválido de TypeScript en la línea 8:
```typescript
export function getPublicMenuUrl(identifier?: string, serverUrl?: string): string {
  if (serverUrl) return serverUrl;
  const tokenInvalido = ; // <-- Error de sintaxis TypeScript forzado
  if (!identifier) return '';
```

#### B. Mensaje de Error Realmente Observado
*(Comprobado en consola con exit code 2)*
```text
> frontend@0.0.0 build
> tsc && vite build

src/utils/menuUtils.ts:8:25 - error TS1109: Expression expected.
8   const tokenInvalido = ;
                          ~
npm ERR! code ELIFECYCLE
npm ERR! Exit status 2
```

#### C. Diagnóstico
El step `npm run build` invoca a `tsc` (TypeScript Compiler). Al detectar una expresión incompleta, el compilador aborta el proceso con código de salida `2`, impidiendo que Vite empaquete código roto.

#### D. Corrección
Elimina la línea con error en `frontend/src/utils/menuUtils.ts`:
```typescript
export function getPublicMenuUrl(identifier?: string, serverUrl?: string): string {
  if (serverUrl) return serverUrl;
  if (!identifier) return '';
```

#### E. Verificación
Ejecuta la compilación localmente:
```powershell
cd frontend
npm run build
```
Resultado comprobado:
```text
✓ 1725 modules transformed.
✓ built in 16.93s
```

---

### ESCENARIO 3: FALLO CONTROLADO DE ASERCIÓN EN PRUEBAS UNITARIAS
* **Issue de referencia:** [Issue #31: test: inducir y resolver regresion por fallo de asercion en pruebas unitarias](https://github.com/osbaldoXxC/menus-qr/issues/31)

#### A. Cómo inducir el error de forma controlada
Abre [`backend/tests/unit/slugService.test.js`](file:///C:/Users/Baldo/OneDrive/Escritorio/git/menus-qr/backend/tests/unit/slugService.test.js) y modifica la expectativa en la primera prueba:
```javascript
  await t.test('debe convertir un nombre de restaurante a minúsculas y reemplazar espacios por guiones', () => {
    const resultado = generarSlug('Taquería Los Hermanos');
    assert.equal(resultado, 'taqueria-las-glorias-error-intencional'); // <-- Esperado falso
  });
```

#### B. Mensaje de Error Realmente Observado
*(Comprobado en consola con exit code 1)*
```text
TAP version 13
# Subtest: Servicio de Slugs - Generación URL amigable
    # Subtest: debe convertir un nombre de restaurante a minúsculas y reemplazar espacios por guiones
    not ok 1 - debe convertir un nombre de restaurante a minúsculas y reemplazar espacios por guiones
      ---
      duration_ms: 1.58
      failureType: 'testCodeFailure'
      error: 'Values have different values: "taqueria-los-hermanos" !== "taqueria-las-glorias-error-intencional"'
      operator: 'strictEqual'
      ...
# tests 5
# pass 4
# fail 1
npm ERR! Exit status 1
```

#### C. Diagnóstico
La suite de pruebas detecta que `generarSlug` produjo `taqueria-los-hermanos`, pero la aserción exigía `taqueria-las-glorias-error-intencional`. El test runner nativo de Node.js emite un `AssertionError` y finaliza con código de salida `1`, deteniendo el pipeline de CI.

#### D. Corrección
Restaura la aserción legítima en `backend/tests/unit/slugService.test.js`:
```javascript
  await t.test('debe convertir un nombre de restaurante a minúsculas y reemplazar espacios por guiones', () => {
    const resultado = generarSlug('Taquería Los Hermanos');
    assert.equal(resultado, 'taqueria-los-hermanos');
  });
```

#### E. Verificación
Ejecuta las pruebas localmente:
```powershell
cd backend
$env:NODE_ENV="test"
npm test
```
Resultado comprobado:
```text
ok 1 - Servicio de Slugs - Generación URL amigable
# tests 5
# pass 5
# fail 0
```

---

### ESCENARIO 4: DEPENDENCIA INEXISTENTE O DESINCRONIZACIÓN EN `npm ci`
* **Issue de referencia:** [Issue #32: deps: inducir y corregir fallo de resolucion de paquetes en npm ci](https://github.com/osbaldoXxC/menus-qr/issues/32)

#### A. Cómo inducir el error de forma controlada
1. Abre `backend/package.json` y añade en `"dependencies"` un paquete inexistente:
```json
    "paquete-inexistente-campus-qr": "99.9.9",
```
2. Ejecuta `npm install` localmente para forzar al gestor a buscar el paquete en npm registry:
```powershell
cd backend
npm install
```

#### B. Mensaje de Error Realmente Observado
*(Comprobado en consola con exit code 1)*
```text
npm ERR! code E404
npm ERR! 404 Not Found - GET https://registry.npmjs.org/paquete-inexistente-campus-qr - Not found
npm ERR! 404 'paquete-inexistente-campus-qr@99.9.9' is not in this registry.
npm ERR! A complete log of this run can be found in: ...
```

*Nota sobre `npm ci` en el runner:* Si un desarrollador edita manualmente `package.json` sin actualizar `package-lock.json`, el runner fallará con:
```text
npm ERR! cipm can only install packages when your package.json and package-lock.json are in sync.
```

#### C. Diagnóstico
1. `npm install` falla con error `E404` cuando el paquete no existe en el registro central.
2. `npm ci` falla con desincronización cuando las dependencias declaradas en `package.json` no coinciden exactamente con el árbol resuelto en `package-lock.json`.

#### D. Corrección
1. Elimina la clave `"paquete-inexistente-campus-qr"` de `backend/package.json`.
2. Sincroniza limpiamente `package-lock.json`:
```powershell
cd backend
npm install
```

#### E. Verificación
Ejecuta la instalación estricta de CI localmente:
```powershell
cd backend
npm ci
```
Resultado comprobado:
```text
added 266 packages, and audited 267 packages in 26s
found 0 vulnerabilities
```

---

### ESCENARIO 5: COMANDO O HERRAMIENTA AUSENTE EN EL RUNNER (`exit code 127`)
* **Issue de referencia:** [Issue #33: runner: inducir y solucionar comando inexistente o falta de herramienta en runner](https://github.com/osbaldoXxC/menus-qr/issues/33)

#### A. Cómo inducir el error de forma controlada
Edita `.github/workflows/ci.yml` e invoca un binario que no existe en el sistema ni en el `$PATH`:
```yaml
      - name: Ejecutar comando no instalado en el runner
        working-directory: backend
        run: |
          herramienta-inventada-qr --reporte
          npm test
```

#### B. Mensaje de Error Esperado en el Runner Linux
*(Resultado esperado en runner Linux)*
```text
/home/runner/work/_temp/xxx.sh: line 1: herramienta-inventada-qr: command not found
Error: Process completed with exit code 127.
```

*(Comprobado localmente en Windows PowerShell)*
```text
herramienta-inventada-qr : El término 'herramienta-inventada-qr' no se reconoce como nombre de un cmdlet, función o programa ejecutable.
```

#### C. Diagnóstico
El código de salida `127` en sistemas tipo UNIX indica `command not found`. El shell del runner (`bash`) no encontró el binario en ninguna de las rutas de la variable de entorno `$PATH`.

#### D. Corrección
1. Si la herramienta es necesaria para el pipeline, debe instalarse en un step previo mediante `sudo apt-get install -y <herramienta>` o usando una GitHub Action oficial.
2. Si la herramienta fue invocada por error o es prescindible, se elimina la línea dejando únicamente el comando legítimo:
```yaml
      - name: Ejecutar pruebas unitarias de Backend
        working-directory: backend
        env:
          NODE_ENV: test
        run: npm test
```

#### E. Verificación
El job del runner ejecuta el comando de pruebas directamente y finaliza con código `0` en verde.

---

## 7. MATRIZ DE RESUMEN DE CÓDIGOS DE ERROR DE CI/CD

| Código de Salida | Significado Técnico | Escenario del Laboratorio | Diagnóstico / Solución |
| :---: | :--- | :--- | :--- |
| **0** | Éxito total (`Success`) | Verificación final | Todas las tareas concluyeron limpiamente. |
| **1** | Error general / Aserción fallida | Escenario 3 (Tests) / Escenario 4 (npm) | Revisar `Expected !== Received` o error `E404`. |
| **2** | Error sintáctico de CLI / compilación | Escenario 2 (TypeScript `tsc`) | Corregir sintaxis o tipos en código fuente. |
| **127** | Comando no encontrado (`Command not found`) | Escenario 5 (Runner) | Instalar herramienta o remover comando ausente en `$PATH`. |
| **137** | Exceso de Memoria (`OOM Killed`) | Procesos pesados | Optimizar proceso o ampliar recursos del contenedor. |

---

## 8. EVIDENCIAS QUE DEBE ENTREGAR EL ESTUDIANTE

Para acreditar satisfactoriamente el laboratorio, el alumno debe recopilar y adjuntar en el informe académico:
1. **Captura del Pipeline en Rojo:** Captura de pantalla de GitHub Actions mostrando el fallo inducido para cada uno de los 5 escenarios, destacando el log de error en consola.
2. **Commit de Corrección:** Enlace o identificador SHA del commit que solucionó la causa raíz.
3. **Captura del Pipeline en Verde:** Captura de pantalla de GitHub Actions mostrando la ejecución exitosa de los dos jobs (`backend-test` y `frontend-build`).
4. **Archivo de Workflow Final:** Copia de `.github/workflows/ci.yml` en la rama de entrega.
