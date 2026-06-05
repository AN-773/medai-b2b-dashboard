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

const encodeIdentifier = (identifier: string) =>
  encodeURIComponent(identifier.trim());

export const studyPlanAuditService = {
  listStudyPlans: async () =>
    apiClient.get<ListStudyPlanAuditsResponse>(
      'TESTS',
      `/superadmin/audit/study-plans`,
    ),

  getStudyPlanAudit: async (studyPlanIdentifier: string) =>
    apiClient.get<GetStudyPlanAuditResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/${encodeIdentifier(studyPlanIdentifier)}/audit`,
    ),

  getUploadAudit: async (uploadIdentifier: string) =>
    apiClient.get<GetUploadAuditResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/uploads/${encodeIdentifier(uploadIdentifier)}/audit`,
    ),

  getSessionAudit: async (sessionIdentifier: string) =>
    apiClient.get<GetSessionAuditResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/sessions/${encodeIdentifier(sessionIdentifier)}/audit`,
    ),

  recordSessionScore: async (
    sessionIdentifier: string,
    payload: RecordSessionScoreRequest,
  ) =>
    apiClient.post<RecordSessionScoreResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/sessions/${encodeIdentifier(sessionIdentifier)}/score`,
      payload,
    ),

  getItemLineage: async (itemIdentifier: string) =>
    apiClient.get<GetItemLineageResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/items/${encodeIdentifier(itemIdentifier)}/lineage`,
    ),

  getLearningObjectiveLineage: async (
    learningObjectiveIdentifier: string,
  ) =>
    apiClient.get<GetLearningObjectiveLineageResponse>(
      'TESTS',
      `/superadmin/audit/study-plans/learning-objectives/${encodeIdentifier(
        learningObjectiveIdentifier,
      )}/lineage`,
    ),
};
