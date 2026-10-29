import axios from 'axios';

export interface CravingInput {
  text: string;
  tags: string[];
}

export interface RecommendationRequest {
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

const getApiUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:4000/api';
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
};

const API_URL = getApiUrl().replace(/\/api\/?$/, '');

export const recommendationService = {
  getGlobalRecommendations: async (params: RecommendationRequest): Promise<RecommendationResponse> => {
    try {
      const response = await axios.post<RecommendationResponse>(
        `${API_URL}/api/public/recommendations`,
        params
      );
      return response.data;
    } catch (error) {
      console.warn('[recommendationService] Error en petición a backend, usando fallback local:', error);
      throw error;
    }
  }
};
