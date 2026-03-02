
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
  GeneratedObjective,
  QuestionStats,
  ChatMessage,
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
    organSystemId?: string,
    page = 1,
    limit = 200,
    id?: string,
  ): Promise<PaginatedApiResponse<Topic>> => {
    let url = `/topics?page=${page}&limit=${limit}`;
    if (organSystemId) url += `&_filters[organSystemId][eq]=${organSystemId}`;
    if (id) url += `&_filters[id][eq]=${id}`;
    return apiClient.get<PaginatedApiResponse<Topic>>('TESTS', url);
  },

  getSyndromes: async (
    topicId?: string,
    page = 1,
    limit = 200,
    id?: string,
  ): Promise<PaginatedApiResponse<Syndrome>> => {
    let url = `/syndromes?page=${page}&limit=${limit}`;
    if (topicId) url += `&_filters[topicId][eq]=${topicId}`;
    if (id) url += `&_filters[id][eq]=${id}`;
    return apiClient.get<PaginatedApiResponse<Syndrome>>('TESTS', url);
  },

  getLearningObjectives: async (
    page = 1,
    limit = 20,
    syndromeId?: string,
    q?: string,
    cognitiveSkillId?: string,
    examType?: string,
  ): Promise<PaginatedApiResponse<LearningObjective>> => {
    let url = `/learning-objectives?limit=${limit}&page=${page}`;
    if (syndromeId) {
      url += `&_filters[syndromeId][eq]=${syndromeId}`;
    }
    if (cognitiveSkillId) {
      url += `&_filters[cognitiveSkillId][eq]=${cognitiveSkillId}`;
    }
    if (q) {
      url += `&q=${q}`;
    }
    if (examType) {
      url += `&_filters[exam][eq]=${examType}`;
    }
    const res = await apiClient.get<PaginatedApiResponse<LearningObjective>>(
      'TESTS',
      url,
    );
    return res;
  },

  getLearningObjective: async (id: string): Promise<LearningObjective> => {
    return apiClient.get<LearningObjective>('TESTS', `/learning-objectives/${id}`);
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
    sortBy?: string,
    order?: 'asc' | 'desc',
    examType?: string,
  ): Promise<PaginatedApiResponse<Psychometric>> => {
    let url = `/psychometrics/stats?page=${page}&limit=${limit}`;
    if (sortBy) url += `&sort_by=${sortBy}`;
    if (order) url += `&order=${order}`;
    if (examType) url += `&examType=${examType}`;
    
    return apiClient.get<PaginatedApiResponse<Psychometric>>(
      'TESTS',
      url,
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
    examType?: string,
  ): Promise<LearningObjective> => {
    let payload = {
      learningObjective: { title: name },
      syndromeId,
      cognitiveSkillId,
      disciplines,
      examType,
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

  uploadFile: async (file: File): Promise<string> => {
    const token = localStorage.getItem('msai_educator_token');
    const formData = new FormData();
    formData.append('file', file);

    const baseUrl = (import.meta as any).env.VITE_TEST_API_URL || 'http://localhost:3000/tests';
    const response = await fetch(`${baseUrl}/files`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    // Assuming backend returns an array with file objects e.g., [{ id: 'some-id', ... }]
    return data[0]?.id || data.id;
  },

  importLearningObjectives: async (fileId: string, exam: string): Promise<any> => {
    return apiClient.post<any>('TESTS', '/learning-objectives/import', {
      fileId,
      exam
    });
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

  updateQuestionStatus: async (
    identifier: string,
    status: 'live' | 'draft' | 'pending',
  ): Promise<Question> => {
    return apiClient.post<Question>('TESTS', '/questions/status', {
      identifier,
      status,
    });
  },

  deleteOrganSystem: async (id: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', id.split("/local")[1]);
  },

  deleteTopic: async (id: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', id.split("/local")[1]);
  },

  deleteSyndrome: async (id: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', id.split("/local")[1]);
  },

  deleteLearningObjective: async (id: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', id.split("/local")[1]);
  },

  generateQuestion: async (
    learningObjective: string,
    difficulty: string,
    tags: string[],
    exam: string,
    additionalContext?: string,
    chatHistory?: ChatMessage[],
  ): Promise<GeneratedQuestion> => {
    return apiClient.post<GeneratedQuestion>('TESTS', '/question-gen', {
      learningObjective,
      difficulty,
      tags,
      exam,
      additionalContext,
      chatHistory,
    });
  },

  generateLearningObjective: async (
    organSystem: string,
    topic: string,
    syndrome: string,
    exam: string,
    bloomLevel: string,
    discipline: string,
    additionalContext?: string,
    chatHistory?: ChatMessage[],
  ): Promise<GeneratedObjective> => {
    const raw = await apiClient.post<any>('TESTS', '/lo-gen', {
      organSystem,
      topic,
      syndrome,
      exam,
      bloomLevel,
      discipline,
      additionalContext,
      chatHistory,
    });

    // Handle both formats:
    // 1. Structured response with title field (single objective)
    // 2. Raw content string: { content: "...json..." }
    if (raw.title) {
      return raw as GeneratedObjective;
    }

    if (raw.content && typeof raw.content === 'string') {
      try {
        const parsed = JSON.parse(raw.content);
        return parsed as GeneratedObjective;
      } catch (e) {
        console.error('Failed to parse LO generation response:', e);
        throw new Error('Failed to parse generated learning objective');
      }
    }

    throw new Error('Unexpected response format from LO generation');
  },
};
