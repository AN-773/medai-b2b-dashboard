import { PaginatedApiResponse, Question } from '@/types/TestsServiceTypes';
import { apiClient, ServiceType } from './apiClient';

class QuestionService {
  private service: ServiceType = 'TESTS';

  async getQuestions(page: number = 1, limit: number = 20, q?: string,
    organSystemId?: string, topicId?: string, syndromeId?: string,
    identifier?: string, cognitiveSkillId?: string, disciplineId?: string,
    tagId?: string, examType?: string, subjectId?: string,
    status?: string, disciplines?: string, competencies?: string, tags?: string
  ): Promise<PaginatedApiResponse<Question>> {
    let endpoint = `/questions?page=${page}&limit=${limit}`;
    if (q) {
      endpoint += `&q=${encodeURIComponent(q)}`;
    }
    if (organSystemId) {
      endpoint += '&_filters[organSystemId][eq]=' + encodeURIComponent(organSystemId);
    }
    if (topicId) {
      endpoint += '&_filters[topicId][eq]=' + encodeURIComponent(topicId);
    }
    if (syndromeId) {
      endpoint += '&_filters[syndromeId][eq]=' + encodeURIComponent(syndromeId);
    }
    if (identifier) {
      endpoint += '&_filters[identifier][eq]=' + encodeURIComponent(identifier);
    }
    if (cognitiveSkillId) {
      endpoint += '&_filters[cognitiveSkillId][eq]=' + encodeURIComponent(cognitiveSkillId);
    }
    if (subjectId) {
      endpoint += '&_filters[subjects][like]=' + encodeURIComponent(subjectId);
    }
    if (examType) {
      endpoint += '&_filters[exam][eq]=' + encodeURIComponent(examType);
    }
    if (status) {
      endpoint += '&_filters[status][eq]=' + encodeURIComponent(status);
    }
    
    const finalDisciplines = disciplines || disciplineId;
    if (finalDisciplines) {
      endpoint += '&disciplines=' + encodeURIComponent(finalDisciplines);
    }

    const finalTags = tags || tagId;
    if (finalTags) {
      endpoint += '&tags=' + encodeURIComponent(finalTags);
    }
    
    if (competencies) {
      endpoint += '&competencies=' + encodeURIComponent(competencies);
    }
    
    return await apiClient.get<PaginatedApiResponse<Question>>(this.service, endpoint, { authenticated: true });
  }

  async deleteQuestion(id: string): Promise<void> {
    await apiClient.delete<void>(this.service, `/questions/${encodeURIComponent(id)}`, { authenticated: true });
  }

  async updateQuestionStatus(id: string, status: string): Promise<void> {
    await apiClient.put<void>(this.service, `/questions/${encodeURIComponent(id)}`, { status }, { authenticated: true });
  }
}

export const questionService = new QuestionService();
