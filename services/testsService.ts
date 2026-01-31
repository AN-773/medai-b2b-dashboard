import { apiClient } from './apiClient';
import { Question, ExamBlueprint, BackendItem } from '../types';

export const testsService = {
  getOrganSystems: async (page = 1, limit = 200): Promise<any> => {
    return apiClient.get<any>('TESTS', `/organ-systems?page=${page}&limit=${limit}`);
  },
  getTopics: async (organSystemId: string): Promise<any> => {
    // Extract the name from the ID (split by / and take the last value)
    const parts = organSystemId.split('/');
    const name = parts[parts.length - 1];

    // Call the new endpoint /organ-systems/{name}
    const response = await apiClient.get<any>('TESTS', `/organ-systems/${name}`);

    // The endpoint returns the OrganSystem object with nested topics.
    // We wrap it in an ApiResponse-like structure to maintain compatibility with the hook's expectation of 'items'.
    return {
      items: response.topics || [], // The topics are now nested in the response
      page: 1,
      total: response.topics?.length || 0
    };
  }
};
