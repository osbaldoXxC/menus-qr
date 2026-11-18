import axios from 'axios';
import { buildRecommendationRequest, decodeRecommendationResponse, recommendationUrl } from './recommendationContract';
import type { RecommendationRequest } from './recommendationContract';
export type { CravingInput, RecommendationRequest, RecommendationItem, RecommendationResponse } from './recommendationContract';

const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const recommendationService = {
  async getRecommendations(restaurantId: string, input: RecommendationRequest & { requestKey?: string }) {
    const payload = buildRecommendationRequest(input);
    if (input.requestKey) {
      (payload.options as Record<string, unknown>).requestId = input.requestKey;
    }
    const response = await axios.post(recommendationUrl(base, restaurantId), payload, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'MexxicanMX-Client',
        ...(input.requestKey ? { 'X-Idempotency-Key': input.requestKey } : {})
      }
    });
    return decodeRecommendationResponse(response.data);
  }
};
