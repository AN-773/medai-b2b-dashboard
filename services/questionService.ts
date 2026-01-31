import { apiClient, ServiceType } from './apiClient';
import { ApiQuestion, ApiResponse } from '../types';

class QuestionService {
  private service: ServiceType = 'TESTS';

  async getQuestions(page: number = 1, limit: number = 20): Promise<ApiResponse<ApiQuestion>> {
    const endpoint = `/questions?page=${page}&limit=${limit}`;
    return await apiClient.get<ApiResponse<ApiQuestion>>(this.service, endpoint, { authenticated: true });
  }
}

export const questionService = new QuestionService();
