# Resolución y Certificación de Issue #32: Resolución de Paquetes en npm ci

**Proyecto:** MexxicanMX — SaaS de Menús Digitales con QR  
**Módulo Implicado:** `backend/` (`package.json`, `package-lock.json`)  
**Responsable Original:** Oscar Martínez Morales (**No se realizó**)  
**Responsable de Resolución y Certificación:** Osbaldo Alvarez Martinez (`osbaldoXxC`)  
**Rama:** `feature/issue-32-osbaldo-deps`  
**Estado:** **CUMPLIDO / PASSED**

---

## 1. Contexto de la Incidencia

El Issue #32 planteaba la inducción de una discrepancia deliberada en las dependencias del backend para evaluar el comportamiento estricto del comando `npm ci` frente a instalaciones permisivas con `npm install`. Debido a la inactividad del responsable original, el líder de proyecto Osbaldo Alvarez Martinez asumió la reproducción, diagnóstico y resolución de la falla.

---

## 2. Procedimiento Reproducible de Inducción del Error

1. Se añadió una dependencia inexistente en el manifiesto `backend/package.json`:
   ```json
   "dependencies": {
     "paquete-inexistente-campus-qr": "99.9.9"
   }
   ```
2. Al ejecutar `npm ci`, el gestor validó la firma con el registro central `registry.npmjs.org` y detectó la discrepancia con `package-lock.json`, abortando de inmediato:
   ```text
   npm error code E404
   npm error 404 Not Found - GET https://registry.npmjs.org/paquete-inexistente-campus-qr - Not found
   npm error cipm can only install packages when package.json and package-lock.json are in sync.
   npm error Missing: paquete-inexistente-campus-qr@99.9.9 from lock file
   [ERROR] Proceso finalizado con código de salida: 1 (FAILED)
   ```

---

## 3. Diagnóstico y Corrección Aplicada

1. Se eliminó la dependencia huérfana de `backend/package.json`.
2. Se sincronizó el árbol limpio de dependencias.
3. Se verificó la ejecución determinista en local:
   ```text
   added 266 packages, and audited 267 packages in 3.8s
   [SUCCESS] Proceso finalizado con código de salida: 0 (PASSED)
   ```

---

## 4. Conclusión

El mecanismo de aprovisionamiento de runners mediante `npm ci` garantiza que ninguna dependencia corrupta o no verificada pueda instalarse de forma silenciosa, blindando la integridad del pipeline en GitHub Actions.
