import {
  Curriculum,
  CurriculumListResponse,
  CurriculumVersionListResponse,
  CurriculumVersionDetailResponse,
  PublishCurriculumResponse,
} from '../types/TestsServiceTypes';
import { apiClient } from './apiClient';
import { resourceIdentifier } from '../utils/resourceId';

/**
 * Curriculum service — implements `contracts/curriculum-api-contract.md`.
 *
 * Path params named `identifier` are the curriculum **slug** (e.g. `cardiology`).
 * Curriculum `id` fields are absolute URLs ending in the slug; query filters
 * elsewhere use that absolute `id`, while these endpoints use the trailing slug
 * segment. Pass either a slug or a full URL id here — both normalize to the slug.
 */
const toSlug = resourceIdentifier;

export const curriculumService = {
  /** GET /curricula — tenant-scoped list. */
  getCurricula: async (
    page = 1,
    limit?: number,
    relations = false,
    q?: string,
  ): Promise<CurriculumListResponse> => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    if (relations) params.append('relations', 'true');
    if (q) params.append('q', q);
    return apiClient.get<CurriculumListResponse>(
      'TESTS',
      `/curricula?${params.toString()}`,
    );
  },

  /** GET /curricula/{identifier} — single curriculum with embedded members. */
  getCurriculum: async (identifier: string): Promise<Curriculum> => {
    return apiClient.get<Curriculum>('TESTS', `/curricula/${toSlug(identifier)}`);
  },

  /**
   * POST /curricula — create (no id) or update (with absolute id).
   * `identifier`, `status`, and `currentVersion` are server-managed.
   */
  upsertCurriculum: async (title: string, id?: string): Promise<Curriculum> => {
    return apiClient.post<Curriculum>('TESTS', '/curricula', {
      curriculum: {
        title,
        ...(id ? { id } : {}),
      },
    });
  },

  /** DELETE /curricula/{identifier}. */
  deleteCurriculum: async (identifier: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', `/curricula/${toSlug(identifier)}`);
  },

  /** POST /curricula/{identifier}/publish — Administrator only. */
  publishCurriculum: async (
    identifier: string,
    summary?: string,
  ): Promise<PublishCurriculumResponse> => {
    return apiClient.post<PublishCurriculumResponse>(
      'TESTS',
      `/curricula/${toSlug(identifier)}/publish`,
      summary ? { summary } : {},
    );
  },

  /** GET /curricula/{identifier}/versions — published versions, newest first. */
  getCurriculumVersions: async (
    identifier: string,
  ): Promise<CurriculumVersionListResponse> => {
    return apiClient.get<CurriculumVersionListResponse>(
      'TESTS',
      `/curricula/${toSlug(identifier)}/versions`,
    );
  },

  /** GET /curricula/{identifier}/versions/{version} — frozen snapshot. */
  getCurriculumVersion: async (
    identifier: string,
    version: number,
  ): Promise<CurriculumVersionDetailResponse> => {
    return apiClient.get<CurriculumVersionDetailResponse>(
      'TESTS',
      `/curricula/${toSlug(identifier)}/versions/${version}`,
    );
  },
};
