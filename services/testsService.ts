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
  MoveDisciplineLearningObjectivesResponse,
  Difficulty,
  Competency,
  Subject,
  GeneratedQuestion,
  GeneratedObjective,
  QuestionStats,
  ChatMessage,
  OpenISearchResponse,
  File,
  DashboardStatsResponse,
  BackendApiItem,
  ItemListResponse,
  ItemUpsertRequest,
  ApiItemType,
  ApiItemStatus,
} from '../types/TestsServiceTypes';
import {
  Prompt,
  PromptCatalogResponse,
  PromptPayload,
  PromptUpsertResult,
  AppVersionSettingsResponse,
} from '../types';
import { apiClient } from './apiClient';

const extractResourceIdentifier = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const withoutQuery = trimmed.split(/[?#]/, 1)[0];
  const segments = withoutQuery.split('/').filter(Boolean);

  return segments.length > 0 ? segments[segments.length - 1] : withoutQuery;
};

export const testsService = {
  getOrganSystems: async (
    page = 1,
    limit = 200,
    subjectIds?: string[],
    curriculumId?: string,
  ): Promise<PaginatedApiResponse<OrganSystem>> => {
    let url = `/organ-systems?page=${page}&limit=${limit}`;
    if (subjectIds?.length) url += `&subjectIds=${subjectIds.join(',')}`;
    // curriculumId filter is the absolute curriculum URI (the `id` from a curriculum read)
    if (curriculumId) url += `&curriculumId=${encodeURIComponent(curriculumId)}`;
    return apiClient.get<PaginatedApiResponse<OrganSystem>>('TESTS', url);
  },

  getTopics: async (
    organSystemId?: string,
    page = 1,
    limit = 200,
    id?: string,
    subjectIds?: string[],
  ): Promise<PaginatedApiResponse<Topic>> => {
    let url = `/topics?page=${page}&limit=${limit}`;
    if (organSystemId) url += `&_filters[organSystemId][eq]=${organSystemId}`;
    if (id) url += `&_filters[id][eq]=${id}`;
    if (subjectIds?.length) url += `&subjectIds=${subjectIds.join(',')}`;
    return apiClient.get<PaginatedApiResponse<Topic>>('TESTS', url);
  },

  getSyndromes: async (
    topicId?: string,
    page = 1,
    limit = 200,
    id?: string,
    subjectIds?: string[],
  ): Promise<PaginatedApiResponse<Syndrome>> => {
    let url = `/syndromes?page=${page}&limit=${limit}`;
    if (topicId) url += `&_filters[topicId][eq]=${topicId}`;
    if (id) url += `&_filters[id][eq]=${id}`;
    if (subjectIds?.length) url += `&subjectIds=${subjectIds.join(',')}`;
    return apiClient.get<PaginatedApiResponse<Syndrome>>('TESTS', url);
  },

  getLearningObjectives: async (
    page = 1,
    limit = 20,
    syndromeId?: string,
    q?: string,
    cognitiveSkillId?: string,
    examType?: string,
    subjectIds?: string[],
    curriculumId?: string,
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
    if (subjectIds?.length) {
      url += `&subjectIds=${subjectIds.join(',')}`;
    }
    // curriculumId filter is the absolute curriculum URI (the `id` from a curriculum read)
    if (curriculumId) {
      url += `&curriculumId=${encodeURIComponent(curriculumId)}`;
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
    identifier?: string,
    organSystems?: string,
    topics?: string,
    cognitiveSkills?: string,
    disciplines?: string,
    subjects?: string,
    tags?: string,
    competencies?: string,
  ): Promise<PaginatedApiResponse<Psychometric>> => {
    let url = `/psychometrics/stats?page=${page}&limit=${limit}`;
    if (sortBy) url += `&sort_by=${sortBy}`;
    if (order) url += `&order=${order}`;
    if (examType) url += `&examType=${examType}`;
    if (identifier) url += `&identifier=${identifier}`;
    if (organSystems) url += `&organSystems=${organSystems}`;
    if (topics) url += `&topics=${topics}`;
    if (cognitiveSkills) url += `&cognitiveSkills=${cognitiveSkills}`;
    if (disciplines) url += `&disciplines=${disciplines}`;
    if (subjects) url += `&subjects=${subjects}`;
    if (tags) url += `&tags=${tags}`;
    if (competencies) url += `&competencies=${competencies}`;
    
    return apiClient.get<PaginatedApiResponse<Psychometric>>(
      'TESTS',
      url,
    );
  },

  getDashboardStats: async (
    examType?: string,
    identifier?: string,
    organSystems?: string,
    topics?: string,
    cognitiveSkills?: string,
    disciplines?: string,
    subjects?: string,
    tags?: string,
    competencies?: string,
  ): Promise<DashboardStatsResponse> => {
    let url = `/psychometrics/dashboard-stats?limit=1`; // limit=1 is just a placeholder, no pagination 
    // actually, let's build args properly.
    url = `/psychometrics/dashboard-stats?`;
    const params = new URLSearchParams();
    if (examType) params.append('examType', examType);
    if (identifier) params.append('identifier', identifier);
    if (organSystems) params.append('organSystems', organSystems);
    if (topics) params.append('topics', topics);
    if (cognitiveSkills) params.append('cognitiveSkills', cognitiveSkills);
    if (disciplines) params.append('disciplines', disciplines);
    if (subjects) params.append('subjects', subjects);
    if (tags) params.append('tags', tags);
    if (competencies) params.append('competencies', competencies);
    
    return apiClient.get<DashboardStatsResponse>(
      'TESTS',
      url + params.toString(),
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

  getItems: async (
    page = 1,
    limit = 200,
    type?: string,
    status?: string,
    examType?: string,
    learningObjectiveId?: string,
    organSystemId?: string,
    topicId?: string,
    disciplines?: string,
    subjects?: string,
    tags?: string,
    q?: string,
    syndromeId?: string,
    cognitiveSkillId?: string,
    identifier?: string,
  ): Promise<ItemListResponse> => {
    let url = `/items?page=${page}&limit=${limit}`;
    if (type) url += `&type=${type}`;
    if (status) url += `&status=${status}`;
    if (examType && examType !== 'all') url += `&examType=${examType}`;
    if (learningObjectiveId) url += `&learningObjectiveId=${learningObjectiveId}`;
    if (organSystemId) url += `&organSystemId=${organSystemId}`;
    if (topicId) url += `&topicId=${topicId}`;
    if (disciplines) url += `&disciplines=${disciplines}`;
    if (subjects) url += `&subjects=${subjects}`;
    if (tags) url += `&tags=${tags}`;
    if (q) url += `&q=${q}`;
    if (syndromeId) url += `&syndromeId=${syndromeId}`;
    if (cognitiveSkillId) url += `&cognitiveSkillId=${cognitiveSkillId}`;
    if (identifier) url += `&identifier=${identifier}`;

    return apiClient.get<ItemListResponse>('TESTS', url);
  },

  getItem: async (identifier: string): Promise<BackendApiItem> => {
    return apiClient.get<BackendApiItem>('TESTS', `/items/${identifier}`);
  },

  upsertItem: async (request: ItemUpsertRequest): Promise<BackendApiItem> => {
    return apiClient.post<BackendApiItem>('TESTS', `/items`, request);
  },

  deleteItem: async (identifier: string): Promise<void> => {
    const cleanId = identifier.replace('/items/', '');
    return apiClient.delete<void>('TESTS', `/items/${cleanId}`);
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

  getDiscipline: async (identifier: string): Promise<Discipline> => {
    return apiClient.get<Discipline>('TESTS', `/disciplines/${identifier}`);
  },

  upsertDiscipline: async (
    title: string,
    id?: string,
  ): Promise<Discipline> => {
    return apiClient.post<Discipline>('TESTS', '/disciplines', {
      discipline: {
        title,
        ...(id ? { id } : {}),
      },
    });
  },

  deleteDiscipline: async (identifier: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', `/disciplines/${identifier}`);
  },

  moveDisciplineLearningObjectives: async (
    from: string,
    to: string,
  ): Promise<MoveDisciplineLearningObjectivesResponse> => {
    return apiClient.post<MoveDisciplineLearningObjectivesResponse>(
      'TESTS',
      '/disciplines/move-learning-objectives',
      { from, to },
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
    curriculumId?: string,
  ): Promise<OrganSystem> => {
    const payload = {
      organSystem: {
        title: name,
        ...(id ? { id } : {}),
        // curriculumId is a field ON the OrganSystem entity — the backend reads it
        // from organSystem.curriculumId. A top-level curriculumId is silently
        // dropped (OrganSystemUpsertRequest only deserializes `organSystem`).
        // Optional today; required when CURRICULUM_REQUIRE_ORGAN_SYSTEM=true server-side.
        ...(curriculumId ? { curriculumId } : {}),
      },
    };

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
    subjectId?: string,
    curriculumId?: string,
  ): Promise<LearningObjective> => {
    let payload = {
      learningObjective: {
        title: name,
        // curriculumId is a field ON the LearningObjective entity — the backend
        // reads it from learningObjective.curriculumId. A top-level curriculumId
        // is silently dropped. Always optional; omitted stays null server-side.
        ...(curriculumId ? { curriculumId } : {}),
      },
      syndromeId,
      cognitiveSkillId,
      disciplines,
      examType,
      ...(subjectId ? { subjectId } : {}),
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

  uploadFile: async (file: globalThis.File): Promise<File> => {
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
    return data[0] || data;
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
          ...(c.multimedia && (c.multimedia.url || c.multimedia.fileId)
            ? {
                multimedia: {
                  fileId: c.multimedia.fileId || null,
                  multimedia: {
                    ...(c.multimedia.id ? { id: c.multimedia.id } : {}),
                    url: c.multimedia.url || '',
                    type: c.multimedia.type || 'image',
                  },
                },
              }
            : {}),
          ...(c.explanationMultimedia && (c.explanationMultimedia.url || c.explanationMultimedia.fileId)
            ? {
                explanationMultimedia: {
                  fileId: c.explanationMultimedia.fileId || null,
                  multimedia: {
                    ...(c.explanationMultimedia.id ? { id: c.explanationMultimedia.id } : {}),
                    url: c.explanationMultimedia.url || '',
                    type: c.explanationMultimedia.type || 'image',
                  },
                },
              }
            : {}),
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
      multimedia: question.multimedia && (question.multimedia.url || question.multimedia.fileId)
        ? {
            fileId: question.multimedia.fileId || null,
            multimedia: {
              ...(question.multimedia.id ? { id: question.multimedia.id } : {}),
              url: question.multimedia.url || '',
              type: question.multimedia.type || 'image',
            },
          }
        : undefined,
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

  getPrompts: async (
    exam?: string,
    type?: string,
    page = 1,
    limit = 0,
  ): Promise<PaginatedApiResponse<Prompt>> => {
    let url = `/prompts?page=${page}&limit=${limit}`;
    if (exam) url += `&exam=${encodeURIComponent(exam)}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    
    return apiClient.get<PaginatedApiResponse<Prompt>>('TESTS', url);
  },

  getPromptCatalog: async (): Promise<PromptCatalogResponse> => {
    return apiClient.get<PromptCatalogResponse>('TESTS', '/superadmin/prompts/catalog');
  },

  getAppVersionSettings: async (): Promise<AppVersionSettingsResponse> => {
    return apiClient.get<AppVersionSettingsResponse>('TESTS', '/app-version');
  },

  updateAppVersionSettings: async (
    settings: AppVersionSettingsResponse,
  ): Promise<AppVersionSettingsResponse> => {
    return apiClient.put<AppVersionSettingsResponse>('TESTS', '/superadmin/app-version', settings);
  },

  getPrompt: async (id: string): Promise<Prompt> => {
    return apiClient.get<Prompt>('TESTS', `/prompts/${extractResourceIdentifier(id)}`);
  },

  upsertPrompt: async (prompt: PromptPayload): Promise<PromptUpsertResult> => {
    return apiClient.post<PromptUpsertResult>('TESTS', '/prompts', { prompt });
  },

  deletePrompt: async (id: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', `/prompts/${extractResourceIdentifier(id)}`);
  },

  assignPromptContext: async (promptId: string, fileId: string): Promise<Prompt> => {
    return apiClient.post<Prompt>('TESTS', `/prompts/${extractResourceIdentifier(promptId)}/contexts`, { fileId });
  },

  removePromptContext: async (promptId: string, fileId: string): Promise<Prompt> => {
    return apiClient.delete<Prompt>(
      'TESTS',
      `/prompts/${extractResourceIdentifier(promptId)}/contexts/${extractResourceIdentifier(fileId)}`,
    );
  },

  searchOpenIImages: async (query: string, m: number = 1, n: number = 20): Promise<OpenISearchResponse> => {
    return apiClient.get<OpenISearchResponse>('TESTS', `/openi/search?query=${encodeURIComponent(query)}&m=${m}&n=${n}`);
  },

  downloadOpenIImage: async (url: string): Promise<File> => {
    return apiClient.post<File>('TESTS', '/openi/download', { url });
  },
};
