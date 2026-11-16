# Bloque 4 — Frontend (Comensales)

## Ajuste de buscador y bouncy

El componente de carga conserva taco, aguacate, chile, sombra y anuncio accesible de estado; ya no muestra barra de progreso. El movimiento recupera los valores históricos: taco 38 px, aguacate 22 px, chile 24 px, ciclo de 0.85 s y sombra sincronizada. Por instrucción explícita del usuario del 2026-11-15, el rebote comienza automáticamente en cada búsqueda, incluso con movimiento reducido del sistema, sin botón de activación ni preferencia guardada. Esta excepción se limita a la pantalla de carga; no modifica Windows ni los ajustes de movimiento de otras pantallas. El aura local se redujo de opacidad 0.11–0.18 a 0.044–0.072 y de 480 a 320 px. El buscador conserva tarjeta, entrada única, tema claro/oscuro y resultados interactivos; se ajustaron espaciados, foco, textarea y contraste del botón. Sin cambios en el flujo de petición ni en el mínimo existente de 1500 ms.

Verificación sin navegador: 8 pruebas de flujo (incluido reloj simulado), 14 de componentes SSR, 7 de contrato y build con TypeScript satisfactorios. Las pruebas de componentes comprueban el rebote sin activación previa incluso simulando movimiento reducido. Docker sirve `localhost:3000` desde la carpeta montada del frontend; ambos módulos HTTP respondieron 200 con el cambio automático y sin controles de activación. El usuario confirmó que la animación funcionaba al activarla, antes de solicitar quitar el botón. La activación automática final no se inspeccionó visualmente. El contraste calculado del texto del botón frente a 202 muestras del degradado normal es como mínimo 5.14:1; esto no sustituye la comprobación visual de todos los estados. **PENDIENTE DE VERIFICACIÓN VISUAL — CÓDIGO IMPLEMENTADO**: animación real, responsive, temas, foco e interacción en navegador. No se ejecutaron Playwright, Cypress ni Selenium.

## Refinamiento de entrada y animación (2026-11-15)

Se conserva la tarjeta, el emoji, una entrada y el flujo de resultados interactivos. La entrada incorpora etiqueta visible, mayor contraste, foco y luces suaves derivadas de la portada; la pantalla bouncy conserva alimentos y movimiento, con aura y sombra de menor intensidad. El frontend inicia la petición inmediatamente y mantiene loading hasta que pase el mínimo de 1500 ms y llegue la respuesta; errores, edición y desmontaje pueden interrumpir la espera. Las pruebas con reloj simulado cubren respuestas rápidas y lentas. No se ha comparado visualmente el resultado: el navegador no pudo conectar al servidor local de vista previa.

## Decisión aprobada: búsqueda con un solo mensaje (2026-11-15)

La experiencia principal de recomendaciones usa un único mensaje obligatorio y el botón «Buscar platillos». Las rutas existentes `/cuestionario` y `/descubrir` presentan `NaturalSearch`; el menú público abre el mismo componente en un diálogo con ámbito del restaurante. No hay captura fragmentada, pasos, chips ni campos separados en esta experiencia. Los componentes históricos quedan en el repositorio, sin ser los puntos de entrada, para preservar trabajo previo.

El request conserva DEC-012: `craving.text`, etiquetas vacías, restricciones vacías y defaults canónicos. Backend y ML proponen interpretación; backend corrobora y evalúa elegibilidad. Se mantiene el mensaje editable y se descartan resultados pendientes si cambia. Se muestran carga, error, ausencia de resultados, información, razones y disclaimer. El precio solo se presenta si `safety.priceVerified` confirma evidencia MXN vigente en el backend; no se muestran scores como confianza.

Ejemplos reales con PostgreSQL y ML V2 en entorno efímero: «Quiero algo dulce como pan, pero solo tengo 100 pesos» y «Quiero algo picoso sin puerco, y tengo 100 pesos», ambos endpoints con precio/receta sintéticos confirmados. Se comprobó que se conservan presupuesto y exclusión. No hay garantía de entender toda formulación: entradas no corroboradas siguen fail-closed; la dieta textual omitida por ML produce cero resultados en lugar de ignorarla.

Validación visual, responsive, teclado y lectores de pantalla en navegador: **NO VERIFICADO**. Los contrastes calculados de los colores principales del nuevo componente exceden 4.5:1 para las combinaciones comprobadas, sin declarar conformidad WCAG global. No se ejecutó Playwright/Cypress/Selenium.

> Actualización 2026-11-15: R4 autorizado por objetivo maestro y en implementación. La descripción histórica de esta página no refleja por sí sola el corte actual. Véase la matriz siguiente y BITACORA. No se declara R4 completo ni validación integral.

## Restauración de carga en el recomendador de comensales (2026-11-15)

La búsqueda de texto único utiliza estados explícitos idle, loading, success, no_verified_results y error. Solo una respuesta del backend con `no_verified_results` y lista vacía produce el mensaje de ausencia; errores y respuestas inconsistentes son errores. No se consulta automáticamente al montar. Las respuestas de búsquedas anteriores o de componentes desmontados se descartan, y al cerrar el diálogo se desmonta su búsqueda. La lógica de elegibilidad y el contrato no cambiaron.

Se reutilizó `BouncyLoadingScreen.tsx`, la pantalla original de alimentos y barra visual indeterminada, mientras la solicitud está pendiente. Se respeta la preferencia de movimiento reducido y se omite en esta ruta la etiqueta de activación de spaCy, pues el frontend no puede verificarla. La búsqueda anterior de texto único no montaba ese componente; en el flujo anterior de resultados existía una salida temprana durante la carga. La captura aportada del estado vacío no permite determinar por sí sola qué solicitud o respuesta la originó.

Comprobaciones: flujo unitario 6/6, componentes SSR 12/12, contrato 7/7 y build de comensales (TypeScript y Vite) satisfactorio. En el entorno aislado existente, ocho peticiones HTTP reales a ambos endpoints recibieron 200: las tres frases de ejemplo devolvieron resultados y «Quiero pollo sin cebolla» devolvió `no_verified_results` en ambos ámbitos. Se usaron registros sintéticos y no se ejecutaron migraciones. SSR y revisión del código responsive no demuestran interacción, apariencia ni accesibilidad en navegador; esas comprobaciones siguen pendientes. No se ejecutaron Playwright, Cypress ni Selenium.

## Recuperación de resultados interactivos

`NaturalSearch` había sustituido la pantalla `DescubrirResultados` por una cuadrícula genérica. Se conecta de nuevo el componente original con la respuesta V2 ya recibida, evitando su carga automática histórica y conservando el texto al refinar. Se reutilizan sus tres columnas, tarjeta principal, arrastre, teclado, descarte, apertura de menú y lista de restaurantes. El corazón original abre el menú; no implementa favoritos persistentes. Los elementos secundarios se seleccionan por identidad restaurante/platillo y se eliminan únicamente identidades repetidas. No se usan imágenes de reserva externas ni precios sin evidencia MXN. Carga, vacío y error conservan los estados existentes.

La búsqueda sintética real `camaron` (requestId `r4-camaron-check`, endpoint global, HTTP 200) devolvió cinco resultados, incluidos registros distintos con pollo; `mlUsed=true`, `fallback=false`, ocho candidatos evaluados. Los cinco scores internos eran 0.55: el ranker asigna una base incluso sin coincidencia y ordena candidatos elegibles, sin umbral de relevancia; el backend los hidrata y el adaptador mantiene nombres e IDs. Esto demuestra una limitación de relevancia en el entorno aislado, no la causa específica de la captura del usuario. No hay evidencia de la respuesta original ni del contenido exacto enviado a ML para aquella sesión. No se alteró ML, elegibilidad ni se ocultaron resultados mediante filtros arbitrarios.

Pruebas del corte: componentes SSR 13/13, flujo 6/6, contrato 7/7 y build de comensales. La interacción real de swipe, flechas, drawer y refinamiento, la apariencia, el foco y los breakpoints no se han validado en navegador; no se declara restauración integral completa. No se ejecutaron Playwright, Cypress ni Selenium.

## Seguimiento del objetivo maestro R4

| ID | Objetivo / dependencias | Estado | Archivos y evidencia | Pendiente |
|---|---|---|---|---|
| R4-T01 | Contrastar consumidores con DEC-012 | CUMPLE (inspección focalizada) | Cuestionarios, servicios, resultados, wizard de menú, editor y `admin/src/App.tsx` | Mantener contraste al integrar |
| R4-T02 | Solicitud y resultados canónicos; R3-T05 | PARCIAL | Adaptadores `src/services/recommendationContract.ts`, servicios, cuestionarios y resultados en ambos portales; 7 pruebas de contrato y 6 renderizadas | Pruebas de interacción y API real; texto complejo sujeto a corroboración conservadora |
| R4-T03 | Confirmación del propietario; R3-T02/03 | PARCIAL | `src/components/CatalogEvidencePanel.tsx` en ambos portales | Confirmaciones y permisos con PostgreSQL/HTTP real; estados con navegador |
| R4-T04 | Mantener composición desde editor existente | PARCIAL | `pages/NuevoPlatillo/NuevoPlatillo.tsx` en ambos portales | Editor especializado de compuestos y prueba de persistencia; se conservan objetos detallados |
| R4-T05 | Responsividad, foco, temas, accesibilidad | PARCIAL | HTML semántico, labels, estados, diálogo nativo, focus-visible; 6 tests SSR | Contraste, teclado, lectores de pantalla y viewport reales NO VERIFICADOS |
| R4-T06 | Pruebas frontend | PARCIAL | Contrato 7/7, SSR 6/6, TypeScript ambos portales, build restaurantes y build comensales en memoria con dependencias existentes de restaurantes | Build normal de comensales requiere reparar dependencias; interacción, E2E y API real pendientes |
| R4-T07 | Documentación | PARCIAL | Esta matriz y BITACORA | Resultados de infraestructura real |

La aplicación `admin` inspeccionada no consume el recomendador ni confirma catálogo; no se le añadió delegación. Los contratos se copian dentro de cada contexto Docker existente y se comparan mediante test para impedir divergencias. No se modificó configuración de despliegue. En la UI no se presenta el score como probabilidad, se muestran motivos/safety devueltos por backend y no se fabrican platillos para errores o vacío.

Las comprobaciones SSR usan React y dependencias ya instaladas del portal de restaurantes; no representan navegación, eventos, contraste ni accesibilidad validada en un navegador. No se ejecutaron Playwright, Cypress ni Selenium.

**Objetivo:** simplificar la experiencia del comensal y representar correctamente estados de seguridad y verificabilidad, alineado al contrato V2 y sin lógica autoritativa de seguridad.  
**Estado del bloque:** PENDIENTE (documentado; implementación no autorizada).

## Dependencias
- B1: contrato BE→FE estable V2 canónico (`recommendations`, `safety`, `meta`, `status`, errores uniformes), estados y mensajes seguros.
- B2/B3: impacto indirecto en calidad de resultados y verificabilidad.
- Decisiones: DEC-001 (copy/UX de `desconocido`). **DEC-003 (APROBADA, 2026-11-13):** arquitectura V2 sin compatibilidad funcional obligatoria con rutas/API legacy; los 3 frontends se adaptan a contratos V2 en R4 (no en R1/R2/R3) y R5 valida integralmente.

## Estado real (comprobado, pre-adaptación R4)
- Rutas y flujo: `frontend-comensales/src/App.tsx`, `pages/Descubrir/Descubrir.tsx`, `features/recommendations/CuestionarioWizard.tsx`, `DescubrirResultados.tsx`.
- Servicios: `features/recommendations/recommendationService.ts` (global) y `services/recommendation.ts` (por restaurante) consumen rutas/shape legacy actuales — **a sustituir por contratos V2 en R4** (DEC-003).
- UI captura texto+tags, dieta, alergias, `socialContext` (5 pasos) y usa fallback con datos hardcodeados en resultados; `socialContext`/`keto` sin respaldo verificable. Adaptación de 3 interfaces (comensales, restaurantes, administrador) diferida a R4.

## Tareas
1. `01-cuestionario.md` — auditoría y simplificación (antojo, alergias, dieta verificable, presupuesto) y retiro de campos inertes.
2. `02-estados-y-resultados.md` — representación de `compatible_segun_datos`/`desconocido`/no verificable, recomendaciones, seguridad y ausencia de resultados.

## Principios
- No afirmar seguridad/compatibilidad garantizada; mostrar disclaimers.
- No inventar resultados ni usar datos ficticios como recomendaciones reales.
- Frontend no filtra como autoridad de seguridad; refleja contrato BE.

## Aplazamiento de pruebas funcionales frontend (decisión usuario, 2026-11-13)
- **Estado:** APLAZADA HASTA R4/R5 — PENDIENTE DE VALIDACIÓN INTEGRAL.
- **Contexto:** revisión manual en http://localhost:3000 (comensales), http://localhost:3001 (admin), http://localhost:3002 (restaurantes) evidenció fallos por falta de adaptación a modificaciones de backend/contrato.
- **Alcance R4:** adaptar las 3 interfaces a contratos definitivos backend/ML (sin adelantar implementación en R1/R2). Documentar cambios requeridos a partir de contratos inspeccionados.
- **Alcance R5:** validación integral funcional de las 3 interfaces con backend y ML integrados. No modificar frontends en R1/R2/R3 salvo autorización explícita.
