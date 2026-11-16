# Matriz de Contratos e Integración (Fase 4)

| Componente | Contrato esperado (según consumo/emisión) | Contrato real observado | Resultado | Evidencia |
|---|---|---|---|---|
| Frontend comensales → Backend global | `POST /api/public/recommendations` body `{craving:{text,tags}, diet, allergies, socialContext, limit}` | `recommendationService.ts` envía exactamente esos campos | **CUMPLE** (forma) | `frontend-comensales/src/features/recommendations/recommendationService.ts`, `DescubrirResultados.tsx` |
| Frontend → Backend por restaurante | `POST /api/public/menu/:id/recommendations` | Servicio alterno `services/recommendation.ts` lo implementa; UI principal usa global | **PARCIAL** (endpoint existe, uso divergente) | `frontend-comensales/src/services/recommendation.ts`, rutas/controlador |
| Backend → ML | `{restaurant_id, craving, diet, allergies, socialContext, limit, dishes, restaurant?}` | `menuController` envía esos campos; ML `RecommendationRequest` los acepta | **CUMPLE** | `backend/src/controllers/menuController.js` L~520-550,640-660; `ml-service/main.py` modelos |
| ML → Backend | `{recommendations:[{dish,restaurant,matchScore,matchPercentage,reasons,tags}], meta{...}}` | ML retorna ese shape; backend lo reenvía si array válido | **CUMPLE** | `ml-service/main.py` modelos/respuesta; controlador pass-through |
| Fallback backend → Frontend | Mismo shape, `meta.fallback=true` | Se cumple estructura básica; razones/tags genéricas, filtro simplificado | **PARCIAL** (compatibilidad, no paridad lógica) | `menuController.js` fallback en ambas funciones |
| Campo `dishes` (origen datos) | Debe provenir de PostgreSQL real | Backend consulta DB y pasa `candidateDishes` al ML | **CUMPLE** | `menuController.js` queries `platillos` |
| `restaurant_id` global | Valor sentinel aceptado | Frontend no envía; backend usa `'global'`; ML lo acepta | **CUMPLE** | `menuController.js` global, `ml-service/main.py` |
| `socialContext` | Influye en resultado | Se transmite FE→BE→ML pero **no se usa en scoring/filtrado ML ni backend** | **NO CUMPLE** (campo inerte/obsoleto funcionalmente) | `ml-service/main.py` sin uso de `socialContext` en lógica |
| Límite de resultados | Fuente única y consistente | FE envía `limit:8`; BE default 5/6 según endpoint; ML default 5 | **NO CUMPLE** (inconsistente) | FE/BE/ML archivos citados |
| Alergias | Aplicación estricta y consistente | ML: matching por mapa+word boundary; BE fallback: substring simple; FE no valida críticamente | **PARCIAL** (solo estricta en ML) | `is_allergen_present`, fallback JS |
| Dietas | Verificable con datos reales | ML infiere por tags/texto/ingredientes (heurístico); DB sin campo dietético estructurado fuerte | **PARCIAL** (riesgo de falsos positivos/negativos) | `ml-service/main.py`, `init.sql` (`etiquetas_dieteticas` JSONB) |
| `dishes` con campos extra | Backend envía `complementos`, `restaurante_*` | ML ignora extras (Pydantic tolera por uso de dict en entrada dishes) | **CUMPLE** | `menuController.js`, ML procesa dicts |
