import axios from 'axios';
import { buildRecommendationRequest, decodeRecommendationResponse, recommendationUrl } from '../../services/recommendationContract';
import type { RecommendationRequest } from '../../services/recommendationContract';
export type { CravingInput, RecommendationRequest, RecommendationItem, RecommendationResponse } from '../../services/recommendationContract';
const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const recommendationService = {
  async getGlobalRecommendations(input: RecommendationRequest) {
    const response = await axios.post(recommendationUrl(base), buildRecommendationRequest(input));
    return decodeRecommendationResponse(response.data);
  }
};
