# Diagnóstico por Capa (Fases 2 y 3)

## Backend Node.js (recomendaciones)
- **Rutas:** `backend/src/routes/publicRoutes.js` → `POST /api/public/recommendations` (global), `POST /api/public/menu/:restaurant_id/recommendations`; montadas en `/api/public/menu` y `/api/public` (`index.js`).
- **Controlador:** `backend/src/controllers/menuController.js`.
  - Resuelve restaurante (UUID o slug/nombre), valida existencia y `suscripcion_activa`.
  - Consulta platillos activos desde PostgreSQL (fuente de verdad) y arma `mlPayload` con candidatos.
  - Llama ML (`ML_SERVICE_URL`, timeout `ML_SERVICE_TIMEOUT` default 12000ms); si respuesta válida la reenvía.
  - **Fallback JS:** filtra alergias por substring en texto concatenado; asigna scores decrecientes; **no aplica dieta ni negaciones**; devuelve `meta.fallback=true` con razones genéricas.
- **Estado:** CUMPLE integración básica BE↔ML/DB; **NO CUMPLE** paridad de reglas obligatorias en fallback y validación estricta de entrada.

## ML Service (FastAPI / `ml-service/main.py`)
- **Contrato:** `RecommendationRequest/Response` (Pydantic) con `craving`, `diet`, `allergies`, `socialContext`, `limit`, `dishes`, `restaurant`.
- **NLP:** normalización, Levenshtein/fuzzy, TF-IDF + coseno, extracción de negaciones regex (+ spaCy opcional), mapas de proteínas/alérgenos/tipos; spaCy opcional (`es_core_news_sm`).
- **Filtrado:** exclusión por alérgenos (`is_allergen_present`), términos negados (`is_negated_term_present`), incompatibilidad de dieta (`is_diet_incompatible`).
- **Scoring/ranking:** pesos configurables, coincidencias exactas/fuzzy/categoría/ingredientes/descripción/tags, boost semántico; orden descendente y límite.
- **Respuesta:** incluye `meta` (conteos, filtros, `executionTimeMs`, `spacy_active`).
- **Riesgos:** `socialContext` no usado; dieta basada en heurística textual/tags (depende de calidad de datos); razones pueden sobreafirmar seguridad; posible bug de estructura en rama scoring (ver Q6).

## Frontend comensales (flujo Descubrir)
- **Rutas:** `/`, `/descubrir`, `/cuestionario`, `/menu/:restaurant_id`, `/escanear/:id?` (`src/App.tsx`).
- **Wizard:** `features/recommendations/CuestionarioWizard.tsx` captura texto+tags, dieta, alergias, contexto social (5 pasos), persiste en `localStorage` y navega a `/descubrir`.
- **Resultados:** `features/recommendations/DescubrirResultados.tsx` llama servicio global, maneja loading, muestra tarjetas/swipe/drawer; si error o vacío usa `FALLBACK_RECOMMENDATIONS` hardcodeados.
- **Servicios:** `features/recommendations/recommendationService.ts` (global) y `services/recommendation.ts` (por restaurante) — duplicidad de contratos/URLs.
- **UX hallazgos:** entrada principal es wizard estructurado (texto opcional) — **parcial** frente a objetivo "texto natural como entrada principal"; `socialContext` sin efecto backend; opciones dieta incluyen `keto` sin soporte verificable en datos/ML; fallback UI muestra platos ficticios en error/vacío.

## PostgreSQL / datos
- **Esquema:** `backend/src/db/init.sql` define `platillos` con `ingredientes_principales`, `complementos`, `etiquetas_dieteticas` (JSONB), `nivel_picante`, `porcion`, etc.; catálogos (`ingredientes_catalogo`, `sabores_catalogo`) y pivotes existen pero integración con recomendador **NO VERIFICADA**.
- **Calidad de datos:** etiquetas e ingredientes dependen de carga manual (JSONB); sin garantía de completitud para alergias/dietas/contaminación cruzada.
