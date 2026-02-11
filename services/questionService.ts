import { PaginatedApiResponse, Question } from '@/types/TestsServiceTypes';
import { apiClient, ServiceType } from './apiClient';

class QuestionService {
  private service: ServiceType = 'TESTS';

  async getQuestions(page: number = 1, limit: number = 20, q?: string, organSystemId?: string, topicId?: string, syndromeId?: string): Promise<PaginatedApiResponse<Question>> {
    let endpoint = `/questions?page=${page}&limit=${limit}`;
    if (q) {
      endpoint += `&q=${q}`;
    }
    if (organSystemId) {
      endpoint += '&[organSystemId][eq]=' + organSystemId;
    }
    if (topicId) {
      endpoint += '&[topicId][eq]=' + topicId;
    }
    if (syndromeId) {
      endpoint += '&[syndromeId][eq]=' + syndromeId;
    }
    return await apiClient.get<PaginatedApiResponse<Question>>(this.service, endpoint, { authenticated: true });
  }
}

export const questionService = new QuestionService();
