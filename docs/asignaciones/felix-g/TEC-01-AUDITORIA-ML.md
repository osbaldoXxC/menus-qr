# Guía técnica — Issue 01: auditoría de ML V2 con 30 frases

**Responsable:** `Felix_G` · **Estado inicial:** por ejecutar · **Ámbito:** lectura, pruebas seguras y documentación.

## A. Preflight y control de versiones

1. Leer `AGENTS.md`, `docs/implementation-v2/00-plan-maestro.md`, documentación R2/R3/R5, BITACORA y decisiones existentes.
2. Identificar ruta exacta a la batería original: `docs/evidencias/demo-local-30-consultas.json`. Extraer las **frases literales**; no recrear por resumen.
3. Ejecutar consultas no destructivas: estado Git, rama, diff, versión de servicios, configuración de endpoints, estado de base y migraciones **sin correrlas**.
4. Determinar si `localhost:3000` consume una imagen antigua; no asumir bind mounts y no forzar reinicios. Especial cuidado con inicialización que invoque `runMigrations()`.
5. Describir entorno de pruebas con hashes de imagen/código, identificador de dataset, momento y zona (`America/Mexico_City`). Asegurar un solo dataset para comparaciones antes/después.

## B. Modelo de evidencia obligatorio

Para cada caso conservar JSON (campos adaptables al contrato real; no inventar valores):

```json
{
  "caseId": 1,
  "phrase": "<frase literal del archivo existente>",
  "environment": "<identificador verificable>",
  "requestId": "<si disponible>",
  "httpStatus": null,
  "statusCode": "<status.code real>",
  "parsedIntent": {},
  "consolidatedRestrictions": {},
  "candidateCount": null,
  "eligibleCount": null,
  "finalDishIds": [],
  "elapsedMs": null,
  "expectedBehavior": "<criterio comprobable>",
  "observedBehavior": "<resultado real>",
  "evaluation": "PENDIENTE",
  "suspectedLayer": "NO-DETERMINADA",
  "rootCauseEvidence": "<referencias a trazas/código/datos, o NO COMPROBADA>"
}
```

No guardar tokens, datos de cuentas ni otros secretos. Sanitizar trazas. No utilizar IDs reales de usuarios en evidencias públicas.

## C. Tabla de clasificación

| Categoría | Señal observable | Regla |
| --- | --- | --- |
| `FAIL-SEGURIDAD` | Resultado contradice exclusión explícita, alergia o restricción protegida | CRÍTICO, reportar de inmediato |
| `FAIL-RELEVANCIA` | Se devuelve platillo ajeno al alimento/preferencia principal | Guardar comparativa de candidatos y ranking |
| `NO-VERIFICABLE` | Faltan pruebas de precio, moneda, receta o ausencia; abstención justificada | No tratar automáticamente como bug de ML |
| `FAIL-INTEGRACION` | Contenedor obsoleto, fallback incorrecto, respuesta errónea | Evidenciar versión y capa |
| `BLOQUEADO` | Falta acceso/datos/servicios seguros | Notificar de inmediato |
| `PASS` | Interpretación, seguridad y relevancia verificadas según datos disponibles | HTTP 200 no es suficiente |

Si no hay trazabilidad suficiente: `NO-REPRODUCIBLE` o `PENDIENTE`, jamás inventar causa raíz.

## D. Guía de diagnóstico por capa

1. **Texto/validación:** request canónico `craving/restrictions/options`, normalización y `locale`; verificar DEC-012.
2. **Interpretación ML:** negaciones, cantidades, unidades MXN, intensificadores y mexicanismos. Mantener la frase original.
3. **Consolidación:** prioridad de restricción explícita, contradicciones, omisiones y fail-closed.
4. **Candidatos:** SQL/Prisma efectivo, scope de restaurante, `activo`, duplicados, ingredientes/recetas disponibles.
5. **Elegibilidad:** evidencia MXN según DEC-002 solo si hay presupuesto; evidencia de ausencia para restricciones; no confundir ingrediente ausente con ausencia verificada.
6. **Ranking:** inspeccionar candidatos que llegan a `/rank`, resultados y atributos disponibles; ausencia de coincidencia no debe rellenarse con irrelevantes.
7. **Fallback/backend:** verificar que solo usa elegibles y no recupera descartados.
8. **Respuesta/UI:** `recommendations`, `meta`, `status`, `safety`; separar lo que sale del backend de cómo se renderiza.

## E. Rendimiento con evidencia

Registrar duración total por caso, distribución p50/p95 (si hay 30 muestras), latencias por capa cuando realmente exista medición, resultados de consultas N+1 si se pueden reproducir sin intrusión. Verificar caché/consultas parametrizadas/rate limits sin alterar producción. Las optimizaciones son propuestas, no implementación autorizada.

## F. Archivos a editar / archivos prohibidos

**Sí:** `docs/evidencias/ml-v2-30-frases-felix-g.*`, registros reales en BITACORA, scripts de pruebas aislados aprobados si son necesarios y no afectan producto.

**No:** controladores, servicios ML, esquema de BD, archivos `.env`, frontend, paneles, políticas de acceso, pipeline de deploy, seeds de clientes reales.

## G. Plantilla breve de cada hallazgo

```md
### [ML-30-Cxx] Título preciso
- Fecha/hora (`America/Mexico_City`):
- Autor GitHub:
- Severidad: CRÍTICA / ALTA / MEDIA / BAJA
- Frase literal:
- Comportamiento esperado:
- Comportamiento observado:
- requestId y endpoint:
- Revisión de código + dataset:
- Etapa donde se produce:
- Evidencia que lo demuestra:
- Riesgo:
- Acción recomendada (sin implementar):
- Bloqueo / @mención / estado:
```

## H. Entrega y aviso de bloqueos

- Dejar informe final con 30 casos, pero reportar riesgos críticos **en el momento** de detectarlos.
- La bitácora debe registrar la ejecución real y el autor real, no atribuir a `Felix_G` acciones de otros.
- Respetar permisos de Git: trabajar sin publicación hasta autorización.
