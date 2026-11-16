# Inventario y Mapa de Arquitectura (Fase 1)

## Componentes identificados
| Capa | Componente | Ruta | Evidencia |
|---|---|---|---|
| Frontend comensales | App B2C React/TS/Vite | `menus-qr/frontend-comensales/` | `package.json`, `src/App.tsx`, `src/pages/Descubrir/*`, `src/features/recommendations/*` |
| Frontend restaurantes | App restaurante React/TS | `menus-qr/frontend-restaurantes/` | árbol dir, `src/features/recommendations/*`, `src/services/recommendation.ts` |
| Admin | Panel admin React/TS | `menus-qr/admin/` | árbol dir, `src/pages`, `src/services` |
| Frontend legacy | Otro frontend | `menus-qr/frontend/` | árbol dir (`src/pages`) |
| Backend Node.js | API Express | `menus-qr/backend/` | `src/index.js`, `routes/*`, `controllers/*`, `services/*` |
| ML Service | FastAPI recomendador | `menus-qr/ml-service/` | `main.py`, `Dockerfile`, `requirements.txt`, `tests/` |
| AI Engine | Servicio IA adicional | `menus-qr/ai-engine/` | directorio presente (contenido NO VERIFICADO en detalle) |
| Base de datos | PostgreSQL schema/scripts | `menus-qr/backend/src/db/init.sql`, `menus-qr/db/contract/*` | archivos presentes |
| Infra/CI | IaC y scripts | `menus-qr/infra/`, `menus-qr/cloudformation/`, `menus-qr/scripts/`, `menus-qr/evidencias/` | árbol dir |

## Flujo de datos real (recomendaciones) — Hecho comprobado
1. **UI comensal**: `CuestionarioWizard.tsx` guarda estado en `localStorage` (`mexxicanmx_cuestionario_state`) y navega a `/descubrir` (`handleFinish` ~L520+).
2. **Resultados**: `DescubrirResultados.tsx` lee estado y llama `recommendationService.getGlobalRecommendations(...)` (`POST ${API_URL}/api/public/recommendations`) con `{craving:{text,tags}, diet, allergies, socialContext, limit}`.
3. **Backend público**: `routes/publicRoutes.js` expone `POST /recommendations` (global) y `POST /:restaurant_id/recommendations`; montado en `index.js` como `/api/public/menu` y `/api/public`.
4. **Controlador**: `menuController.getPublicRecommendations`/`getGlobalRecommendations` consultan PostgreSQL (`platillos` activos + restaurante/suscripción), construyen payload con `dishes` y llaman a `POST ${ML_SERVICE_URL}/recommendations` (timeout 12s).
5. **ML Service**: `ml-service/main.py` FastAPI `/recommendations` filtra (alergias/negaciones/dieta), puntúa TF-IDF + heurísticas + fuzzy + spaCy opcional, genera razones y retorna `{recommendations, meta}`.
6. **Fallback backend**: si ML falla/no responde, backend aplica filtro simple por alergia (substring) y retorna top N con score decreciente y `meta.fallback=true`.
7. **Fallback frontend**: `DescubrirResultados.tsx` usa `FALLBACK_RECOMMENDATIONS` hardcodeados si request falla o vacío.

## Endpoints/puntos de entrada
- Backend: `GET /`, `GET /health`, `/api/auth`, `/api/menu`, `/api/categories`, `/api/restaurants`, `/api/admin`, `/api/public/menu`, `/api/public`, `/api/search`, `/api/support` (`backend/src/index.js`).
- Recomendaciones: `POST /api/public/recommendations`, `POST /api/public/menu/:restaurant_id/recommendations` (y alias por montaje).
- ML: `GET /health`, `POST /recommendations` (`ml-service/main.py`).
