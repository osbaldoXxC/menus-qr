import axios from 'axios';
import { buildRecommendationRequest, decodeRecommendationResponse, recommendationUrl } from './recommendationContract';
import type { RecommendationRequest } from './recommendationContract';
export type { CravingInput, RecommendationRequest, RecommendationItem, RecommendationResponse } from './recommendationContract';
const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const recommendationService = {
  async getRecommendations(restaurantId: string, input: RecommendationRequest) {
    const response = await axios.post(recommendationUrl(base, restaurantId), buildRecommendationRequest(input));
    return decodeRecommendationResponse(response.data);
  }
};
