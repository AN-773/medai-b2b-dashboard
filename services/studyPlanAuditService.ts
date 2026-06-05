import { apiClient } from './apiClient';
import type {
  GetItemLineageResponse,
  GetLearningObjectiveLineageResponse,
  GetSessionAuditResponse,
  GetStudyPlanAuditResponse,
  GetUploadAuditResponse,
  ListStudyPlanAuditsResponse,
  RecordSessionScoreRequest,
  RecordSessionScoreResponse,
} from '@/types/StudyPlanAuditTypes';

const encodeResourceId = (id: string) => encodeURIComponent(id.trim());

export const studyPlanAuditService = {
  listStudyPlans: async () =>
    apiClient.get<ListStudyPlanAuditsResponse>(
      'TESTS',
      `/superadmin/audit/study-plans`,
    ),

  getStudyPlanAudit: async (studyPlanId: string) =>
    apiClient.get<GetStudyPlanAuditResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/${encodeResourceId(studyPlanId)}/audit`,
    ),

  getUploadAudit: async (uploadId: string) =>
    apiClient.get<GetUploadAuditResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/uploads/${encodeResourceId(uploadId)}/audit`,
    ),

  getSessionAudit: async (sessionId: string) =>
    apiClient.get<GetSessionAuditResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/sessions/${encodeResourceId(sessionId)}/audit`,
    ),

  recordSessionScore: async (
    sessionId: string,
    payload: RecordSessionScoreRequest,
  ) =>
    apiClient.post<RecordSessionScoreResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/sessions/${encodeResourceId(sessionId)}/score`,
      payload,
    ),

  getItemLineage: async (itemId: string) =>
    apiClient.get<GetItemLineageResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/items/${encodeResourceId(itemId)}/lineage`,
    ),

  getLearningObjectiveLineage: async (learningObjectiveId: string) =>
    apiClient.get<GetLearningObjectiveLineageResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/learning-objectives/${encodeResourceId(
        learningObjectiveId,
      )}/lineage`,
    ),
};
