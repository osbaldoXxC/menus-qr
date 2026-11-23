// Presentation adapter shared by both existing portals; never decides eligibility.
export interface CravingInput { text: string; tags: string[] }
export interface RecommendationRequest {
  craving?: Partial<CravingInput>; diet?: string; allergies?: string[];
  excludedIngredients?: string[]; budgetMax?: number; limit?: number;
}
export interface Safety { overall: string; disclaimer: string; hasUnverifiableRestrictions?: boolean; priceVerified?: boolean }
export interface RecommendedDish {
  id: string; nombre: string; descripcion?: string; precio?: number; url_imagen?: string;
  nivel_picante?: number; porcion?: string; categoria_nombre?: string;
  etiquetas_dieteticas?: string[]; ingredientes_principales?: string[];
}
export interface RecommendedRestaurant { id: string; name: string; slug?: string; menuUrl?: string }
export interface RecommendationItem {
  dish: RecommendedDish; restaurant: RecommendedRestaurant; reasons: string[]; safety: Safety;
}
export interface RecommendationResponse {
  requestId: string; recommendations: RecommendationItem[]; safety: Safety;
  status: { code: string }; error: { code: string; message?: string } | null;
  meta: { fallback: boolean; mlUsed: boolean; returned: number; limitApplied: number };
}

type WireRecommendation = {
  dish: {
    id: string; name: string; description?: string; price?: number; imageUrl?: string;
    category?: string; ingredients?: string[]; dietaryTags?: string[];
    nivel_picante?: number; porcion?: string;
  };
  restaurant: RecommendedRestaurant;
  reasons: Array<{ text: string }>;
  safety: Safety;
};

type WireResponse = Omit<RecommendationResponse, 'recommendations'> & {
  recommendations: WireRecommendation[];
};

export function buildRecommendationRequest(input: RecommendationRequest) {
  const restrictions: Record<string, unknown> = {};
  const diets: Record<string, string> = { none: 'none', vegetarian: 'vegetarian', vegan: 'vegan',
    vegetariana: 'vegetarian', vegana: 'vegan' };
  if (input.diet && input.diet !== 'none') {
    if (!diets[input.diet]) throw Error('Dieta no admitida. Revisa tu selección.');
    restrictions.diet = diets[input.diet];
  }
  if (input.allergies?.length) restrictions.allergies = input.allergies;
  if (input.excludedIngredients?.length) restrictions.excludedIngredients = input.excludedIngredients;
  if (input.budgetMax !== undefined) {
    if (!Number.isFinite(input.budgetMax) || input.budgetMax <= 0 || input.budgetMax > 100000 ||
      !/^\d+(\.\d{1,2})?$/.test(String(input.budgetMax))) throw Error('Presupuesto inválido.');
    restrictions.budgetMax = input.budgetMax;
    restrictions.budgetCurrency = 'MXN';
  }
  return { craving: { text: input.craving?.text?.trim() || '', tags: input.craving?.tags || [] },
    restrictions, options: { limit: input.limit ?? 5, locale: 'es-MX' } };
}

export function recommendationUrl(base: string, restaurantId?: string) {
  return `${base.replace(/\/+$/, '').replace(/\/api$/, '')}/api/public/menu/${restaurantId ? encodeURIComponent(restaurantId) + '/' : ''}recommendations`;
}

export function decodeRecommendationResponse(value: unknown): RecommendationResponse {
  const data = value as WireResponse;
  if (!data || !Array.isArray(data.recommendations) || !data.status?.code ||
    !data.safety?.disclaimer || !data.meta || typeof data.requestId !== 'string') throw Error('Respuesta de recomendaciones inválida.');
  if (data.error) throw Error(data.error.message || 'No se pudieron obtener recomendaciones.');
  const recommendations = data.recommendations.map((item: WireRecommendation) => {
    if (!item.dish?.id || typeof item.dish.name !== 'string' || !item.restaurant?.id ||
      !Array.isArray(item.reasons) || !item.safety?.disclaimer) throw Error('Recomendación incompleta.');
    return { dish: { id: item.dish.id, nombre: item.dish.name, descripcion: item.dish.description,
      precio: item.dish.price, url_imagen: item.dish.imageUrl, categoria_nombre: item.dish.category,
      ingredientes_principales: item.dish.ingredients, etiquetas_dieteticas: item.dish.dietaryTags,
      nivel_picante: item.dish.nivel_picante, porcion: item.dish.porcion },
      restaurant: item.restaurant, reasons: item.reasons.map((r: { text: string }) => {
        if (typeof r.text !== 'string') throw Error('Razón inválida.');
        return r.text;
      }), safety: item.safety };
  });
  return { ...data, recommendations } as RecommendationResponse;
}
