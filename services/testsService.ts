import { PaginatedApiResponse, OrganSystem, LearningObjective, Topic, CognitiveSkill } from '../types/TestsServiceTypes';
import { apiClient } from './apiClient';

export const testsService = {
  getOrganSystems: async (page = 1, limit = 200): Promise<PaginatedApiResponse<OrganSystem>> => {
    return apiClient.get<PaginatedApiResponse<OrganSystem>>('TESTS', `/organ-systems?page=${page}&limit=${limit}`);
  },
  
  getTopics: async (organSystemId: string): Promise<Topic[]> => {
    // Extract the name from the ID (split by / and take the last value)
    const parts = organSystemId.split('/');
    const name = parts[parts.length - 1];

    // Call the new endpoint /organ-systems/{name}
    const response = await apiClient.get<OrganSystem>('TESTS', `/organ-systems/${name}`);

    // The endpoint returns the OrganSystem object with nested topics.
    // We wrap it in an ApiResponse-like structure to maintain compatibility with the hook's expectation of 'items'.
    return response.topics;
  },
  
  getLearningObjectives: async (page = 1, limit = 20, syndromeId?: string, q?: string): Promise<PaginatedApiResponse<LearningObjective>> => {
    let url = `/learning-objectives?limit=${limit}&page=${page}`
    if (syndromeId) {
      url += `&_filters[syndromeId][eq]=${syndromeId}`
    }
    if (q) {
      url += `&q=${q}`
    }
    const res = await apiClient.get<PaginatedApiResponse<LearningObjective>>('TESTS', url);
    return res;
  },

  getCognitiveSkills: async (page = 1, limit = 200): Promise<PaginatedApiResponse<CognitiveSkill>> => {
    return apiClient.get<PaginatedApiResponse<CognitiveSkill>>('TESTS', `/cognitive-skills?page=${page}&limit=${limit}`);
  },
};
