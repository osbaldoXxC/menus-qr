import axios from 'axios';

export interface CravingInput {
  text: string;
  tags: string[];
}

export interface RecommendationRequest {
  restaurant_id: string;
  craving?: CravingInput;
  diet?: string;
  allergies?: string[];
  socialContext?: string;
  limit?: number;
}

export interface RecommendedDish {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  url_imagen: string;
  nivel_picante?: number;
  porcion?: string;
  categoria_nombre?: string;
  etiquetas_dieteticas?: string[];
  ingredientes_principales?: string[];
}

export interface RecommendedRestaurant {
  id: string;
  name: string;
  slug: string;
  menuUrl: string;
}

export interface RecommendationItem {
  dish: RecommendedDish;
  restaurant: RecommendedRestaurant;
  matchScore: number;
  matchPercentage: number;
  reasons: string[];
  tags: string[];
}

export interface RecommendationResponse {
  recommendations: RecommendationItem[];
  meta: {
    restaurant_id: string;
    totalCandidates: number;
    recommendedCount: number;
    fallback?: boolean;
    executionTimeMs?: number;
  };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const recommendationService = {
  getRecommendations: async (
    restaurantId: string,
    params: {
      craving?: CravingInput;
      diet?: string;
      allergies?: string[];
      socialContext?: string;
      limit?: number;
    }
  ): Promise<RecommendationResponse> => {
    try {
      const response = await axios.post<RecommendationResponse>(
        `${API_URL}/api/public/menu/${restaurantId}/recommendations`,
        params
      );
      return response.data;
    } catch (error) {
      console.warn('Error fetching recommendations from backend:', error);
      throw error;
    }
  }
};
