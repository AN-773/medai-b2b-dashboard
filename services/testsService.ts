
import {
  PaginatedApiResponse,
  OrganSystem,
  LearningObjective,
  Topic,
  CognitiveSkill,
  Syndrome,
  Psychometric,
  Question,
  Tag,
  Discipline,
  Difficulty,
  Competency,
  Subject,
  GeneratedQuestion,
  QuestionStats,
} from '../types/TestsServiceTypes';
import { apiClient } from './apiClient';

export const testsService = {
  getOrganSystems: async (
    page = 1,
    limit = 200,
  ): Promise<PaginatedApiResponse<OrganSystem>> => {
    return apiClient.get<PaginatedApiResponse<OrganSystem>>(
      'TESTS',
      `/organ-systems?page=${page}&limit=${limit}`,
    );
  },

  getTopics: async (
    organSystemId: string,
    page = 1,
    limit = 200,
  ): Promise<PaginatedApiResponse<Topic>> => {
    return apiClient.get<PaginatedApiResponse<Topic>>(
      'TESTS',
      `/topics?page=${page}&limit=${limit}&_filters[organSystemId][eq]=${organSystemId}`,
    );
  },

  getSyndromes: async (
    topicId: string,
    page = 1,
    limit = 200,
  ): Promise<PaginatedApiResponse<Syndrome>> => {
    return apiClient.get<PaginatedApiResponse<Syndrome>>(
      'TESTS',
      `/syndromes?page=${page}&limit=${limit}&_filters[topicId][eq]=${topicId}`,
    );
  },

  getLearningObjectives: async (
    page = 1,
    limit = 20,
    syndromeId?: string,
    q?: string,
  ): Promise<PaginatedApiResponse<LearningObjective>> => {
    let url = `/learning-objectives?limit=${limit}&page=${page}`;
    if (syndromeId) {
      url += `&_filters[syndromeId][eq]=${syndromeId}`;
    }
    if (q) {
      url += `&q=${q}`;
    }
    const res = await apiClient.get<PaginatedApiResponse<LearningObjective>>(
      'TESTS',
      url,
    );
    return res;
  },

  getCognitiveSkills: async (
    page = 1,
    limit = 200,
  ): Promise<PaginatedApiResponse<CognitiveSkill>> => {
    return apiClient.get<PaginatedApiResponse<CognitiveSkill>>(
      'TESTS',
      `/cognitive-skills?page=${page}&limit=${limit}`,
    );
  },

  getPyschometrics: async (
    page = 1,
    limit = 200,
  ): Promise<PaginatedApiResponse<Psychometric>> => {
    return apiClient.get<PaginatedApiResponse<Psychometric>>(
      'TESTS',
      `/psychometrics/stats?page=${page}&limit=${limit}`,
    );
  },

  getQuestion: async (id: string): Promise<Question> => {
    return apiClient.get<Question>('TESTS', `/questions/${id}`);
  },

  getQuestions: async (
    page = 1,
    limit = 200,
    learningObjectiveId?: string,
    organSystemId?: string,
    topicId?: string,
    syndromeId?: string,
    q?: string,
    status?: string,
  ): Promise<PaginatedApiResponse<Question>> => {
    let url = `/questions?limit=${limit}&page=${page}`;
    if (learningObjectiveId) {
      url += `&_filters[learningObjectiveId][eq]=${learningObjectiveId}`;
    }
    if (organSystemId) {
      url += `&_filters[organSystemId][eq]=${organSystemId}`;
    }
    if (topicId) {
      url += `&_filters[topicId][eq]=${topicId}`;
    }
    if (syndromeId) {
      url += `&_filters[syndromeId][eq]=${syndromeId}`;
    }
    if (q) {
      url += `&q=${q}`;
    }
    if (status) {
      url += `&_filters[status][eq]=${status}`;
    }
    const res = await apiClient.get<PaginatedApiResponse<Question>>(
      'TESTS',
      url,
    );
    return res;
  },
  
  getTags: async (
    page = 1,
    limit = 200,
  ): Promise<PaginatedApiResponse<Tag>> => {
    return apiClient.get<PaginatedApiResponse<Tag>>(
      'TESTS',
      `/tags?page=${page}&limit=${limit}`,
    );
  },

  getDisciplines: async (
    page = 1,
    limit = 200,
  ): Promise<PaginatedApiResponse<Discipline>> => {
    return apiClient.get<PaginatedApiResponse<Discipline>>(
      'TESTS',
      `/disciplines?page=${page}&limit=${limit}`,
    );
  },

  getDifficultyLevels: async (
    page = 1,
    limit = 200,
  ): Promise<PaginatedApiResponse<Difficulty>> => {
    return apiClient.get<PaginatedApiResponse<Difficulty>>(
      'TESTS',
      `/difficulties?page=${page}&limit=${limit}`,
    );
  },
  
  getCompetencies: async (
    page = 1,
    limit = 200,
  ): Promise<PaginatedApiResponse<Competency>> => {
    return apiClient.get<PaginatedApiResponse<Competency>>(
      'TESTS',
      `/competencies?page=${page}&limit=${limit}`,
    );
  },

  getSubjects: async (
    page = 1,
    limit = 200,
  ): Promise<PaginatedApiResponse<Subject>> => {
    return apiClient.get<PaginatedApiResponse<Subject>>(
      'TESTS',
      `/subjects?page=${page}&limit=${limit}`,
    );
  },

  getQuestionStats: async (
    examType: string,
    subjectIds: string[],
  ): Promise<QuestionStats> => {
    const ids = subjectIds.map(encodeURIComponent).join(',');
    return apiClient.get<QuestionStats>(
      'TESTS',
      `/questions/stats?examType=${encodeURIComponent(examType)}&subjectIds=${ids}`,
    );
  },

  upsertOrganSystem: async (
    name: string,
    id?: string,
  ): Promise<OrganSystem> => {
    let payload = { title: name };
    if (id) {
      payload['id'] = id;
    }
    return apiClient.post<OrganSystem>('TESTS', '/organ-systems', payload);
  },

  upsertTopic: async (
    name: string,
    organSystemId: string,
    id?: string,
  ): Promise<Topic> => {
    let payload = { topic: { title: name }, organSystemId };
    if (id) {
      payload.topic['id'] = id;
    }
    return apiClient.post<Topic>('TESTS', '/topics', payload);
  },

  upsertSyndrome: async (
    id: string,
    name: string,
    topicId: string,
  ): Promise<Syndrome> => {
    let payload = { syndrome: { title: name }, topicId };
    if (id) {
      payload.syndrome['id'] = id;
    }
    return apiClient.post<Syndrome>('TESTS', '/syndromes', payload);
  },

  upsertLearningObjective: async (
    name: string,
    syndromeId: string,
    cognitiveSkillId: string,
    disciplines: string[],
    id?: string,
  ): Promise<LearningObjective> => {
    let payload = {
      learningObjective: { title: name },
      syndromeId,
      cognitiveSkillId,
      disciplines,
    };
    if (id) {
      payload.learningObjective['id'] = id;
    }
    return apiClient.post<LearningObjective>(
      'TESTS',
      '/learning-objectives',
      payload,
    );
  },

  upsertQuestion: async (question: Question): Promise<Question> => {
    const payload = {
      question: {
        ...(question.id ? { id: question.id } : {}),
        title: question.title,
        identifier: question.identifier,
      },
      choices:
        question.choices?.map((c) => ({
          choice: {
            ...c,
            ...(question.id ? { questionId: question.id } : {}),
            ...(c.id ? { id: c.id } : {}),
          },
        })) || [],
      organSystemId: question.organSystemId,
      disciplines: question.disciplines?.map((d) => d.id) || [],
      competencies: question.competencies?.map((c) => c.id) || [],
      tags: question.tags?.map((t) => t.id) || [],
      cognitiveSkillId: question.cognitiveSkillId,
      syndromeId: question.syndromeId,
      topicId: question.topicId,
      learningObjectiveId: question.learningObjectiveId,
      difficultyId: question.difficultyId,
      exam: question.exam,
      subjects: question.subjects || [],
      metadata: question.metadata || {},
      multimedia: {
        fileId: question.multimedia?.fileId || null,
        multimedia: {
          url: question.multimedia?.url || '',
        },
      },
    };
    return apiClient.post<Question>('TESTS', '/questions', payload);
  },

  deleteOrganSystem: async (id: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', `/organ-systems/${id}`);
  },

  deleteTopic: async (id: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', `/topics/${id}`);
  },

  deleteSyndrome: async (id: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', `/syndromes/${id}`);
  },

  generateQuestion: async (
    learningObjective: string,
    difficulty: string,
    tags: string[],
    exam: string,
  ): Promise<GeneratedQuestion> => {
    return apiClient.post<GeneratedQuestion>('TESTS', '/question-gen', {
      learningObjective,
      difficulty,
      tags,
      exam,
    });
  },
};
