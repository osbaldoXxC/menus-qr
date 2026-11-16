# [R2/R5][QA] Auditar ML V2 con 30 frases reales, documentar causas y bloqueos

**Responsable propuesto:** `Felix_G`  
**Tipo:** Testing / auditoría funcional, de seguridad y rendimiento  
**Prioridad:** ALTA — elevar a CRÍTICA si una exclusión alimentaria se incumple  
**Documento técnico:** `docs/asignaciones/felix-g/TEC-01-AUDITORIA-ML.md`  
**Ámbito:** backend recomendador + ML V2 + integración HTTP en entorno seguro  
**Dependencias:** acceso a evidencia de las 30 solicitudes, servicios controlados, datos del catálogo identificables.

## Historia de usuario

**Como** responsable de calidad de MexxicanMX, **quiero** que se reproduzcan las 30 solicitudes reales en un entorno conocido y se analice cada fallo, **para** saber por qué el recomendador produce resultados incorrectos, recomendaciones inseguras o vacíos, sin confundir una respuesta HTTP 200 con funcionamiento correcto.

## Contexto comprobado por reportes previos (revalidar en la ejecución)

- Se observaron 30 respuestas HTTP 200; 20 devolvieron `no_verified_results`.
- Hubo recomendaciones ajenas al antojo (p.ej., camarones → otras pizzas) y un caso crítico: exclusión de leche → licuado con leche.
- Después se informó de actualizaciones de backend/ML V2, pero una corrección posterior de relevancia aún no estaba cargada en `localhost:3000` y el reinicio puede invocar `runMigrations()`.
- Las pruebas pasadas con catálogos distintos **no** demuestran mejoras atribuibles al código.
- El origen de las 30 frases y las respuestas anteriores está en `docs/evidencias/demo-local-30-consultas.json`. No inventar frases faltantes.

## Alcance permitido

1. Leer `AGENTS.md`, decisiones R2/R3/R5, BITACORA y `TEC-01-AUDITORIA-ML.md`.
2. Comprobar versión efectiva del backend/ML, fecha o digest de imagen y configuración de datos **sin reiniciar ni migrar servicios por defecto**.
3. Recuperar exactamente las 30 entradas del archivo de evidencia, preservando petición y restricciones originales.
4. Ejecutar 30 pruebas reproducibles contra **el mismo dataset**, en un entorno autorizado. Guardar respuestas con `requestId`, timestamp, huella de datos y revisión de código.
5. Para cada frase trazar las capas: entrada → normalización → `/interpret` → consolidación → recuperación → elegibilidad → `/rank` → fallback → respuesta final.
6. Etiquetar cada resultado: `PASS`, `FAIL-RELEVANCIA`, `FAIL-SEGURIDAD`, `NO-VERIFICABLE`, `BLOQUEADO`, `NO-REPRODUCIBLE` o `PENDIENTE`.
7. Identificar **primer punto observable** donde cambia o se pierde una intención, ingrediente, exclusión, presupuesto o preferencia.
8. Auditar rendimiento: latencia p50/p95 de la batería, latencia por etapa si hay telemetría, consultas ineficientes, duplicados y costo estimado solo si hay medición real. No agregar instrumentación invasiva.
9. Registrar hallazgos, evidencia y responsables en bitácora; comentar de inmediato bloqueos y hallazgos críticos en el issue.
10. Entregar recomendaciones técnicas priorizadas para autorización posterior; este issue **NO** autoriza refactorizar ML, migrar BD ni cambiar contratos.

## Fuera de alcance — NO tocar

- No cambiar reglas de ranking, `ML V1`, endpoints públicos, DEC-002/DEC-003/DEC-007/DEC-011/DEC-012 ni mecanismos fail-closed.
- No modificar el frontend, diseño, roles, autenticación, pagos ni cuotas.
- No insertar, eliminar o certificar datos de clientes/restaurantes reales.
- No reiniciar backend principal ni ejecutar migraciones implícitas sin autorización.
- No editar `main`, fusionar ramas, instalar dependencias o publicar cambios sin permiso.
- No arreglar en silencio defectos detectados: documentarlos y proponer corrección separada.

## Skills obligatorias (verificar existencia real)

`scope-guard`, `feature-audit`, `security-audit`, `code-quality`, `performance-optimization` y Skill de testing pertinente. Leer `SKILL.md`, reportar si alguna no está disponible; no descargar automáticamente dependencias.

## Evidencias por caso

Cada una de las 30 filas debe incorporar: frase literal; categoría; intención y restricciones esperadas; interpretación real; cantidad de candidatos antes/después de elegibilidad; origen de datos; resultado; razón de descarte o irrelevancia; endpoint; status HTTP + `status.code`; `requestId`; latencia; severidad; componente responsable; conclusión con fundamento; vínculo a respuesta anonimizada.

## Criterios de aceptación

- [ ] Existen **30/30** casos identificados a partir de la fuente original; si hay faltantes se documenta bloqueo, sin completar con frases inventadas.
- [ ] Se declara entorno exacto (workspace, contenedores/imágenes, servicios, catálogo, revisión de código, fecha y zona horaria).
- [ ] Se conserva un catálogo fijo para resultados comparativos; cualquier cambio invalida la comparación directa o se documenta expresamente.
- [ ] Se diferencia resultado seguro sin datos de fallo de interpretación, recuperación, elegibilidad, ranking, fallback, integración o UI.
- [ ] Se inspeccionan casos críticos de negación: «no lleve leche», «que no pique» y exclusiones alimentarias que figuren en la batería.
- [ ] Una recomendación que contradiga una exclusión explícita se marca **CRÍTICA**, se reporta de inmediato y no se etiqueta PASS.
- [ ] Ningún resultado se declara correcto solo por devolver HTTP 200 o cinco elementos.
- [ ] La bitácora tiene al menos un resumen por ejecución y un hallazgo individual por cada FAIL/BLOQUEADO; fecha/hora/autor verificables.
- [ ] Se aporta matriz completa y resumen de causa raíz o de imposibilidad de diagnosticar cada error; no especular sobre ML sin traza.
- [ ] Se recoge rendimiento medible sin sacrificar seguridad ni disponibilidad.
- [ ] No se modifican módulos funcionales fuera de este issue y se respeta el proceso Git.

## Entregables obligatorios

- `docs/evidencias/ml-v2-30-frases-felix-g.json`: resultados reproducibles y anonimizados (no se inventa su contenido).
- `docs/evidencias/ml-v2-30-frases-felix-g.md`: tabla de 30 casos, diagnósticos y priorización.
- Entrada real en `docs/implementation-v2/BITACORA.md` usando `BITACORA-PLANTILLA-FELIX_G.md`.
- Comentarios al issue para hallazgos críticos, bloqueos y entrega final.
- **Sin reparaciones funcionales silenciosas**: nuevas correcciones requieren issue/autorización separados.

## Política de bloqueos

Si hay falla de seguridad, ausencia de evidencia original, datos que cambian, servicios desactualizados, migraciones implícitas o acceso insuficiente: **detener la acción insegura, registrar en la bitácora en cuanto se detecta, comentar el issue con @mención al responsable y continuar solo con pasos de lectura que sean seguros**. Nunca esperar a terminar las 30 pruebas para avisar.

## Definición de terminado

Auditoría completa y reproducible, causas documentadas con evidencia y alcance intacto. **No implica que ML haya quedado corregido.**
