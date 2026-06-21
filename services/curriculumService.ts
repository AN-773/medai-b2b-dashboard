import {
  Curriculum,
  CurriculumListResponse,
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
    scope?: 'management',
  ): Promise<CurriculumListResponse> => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    params.append('relations', 'false');
    if (q) params.append('q', q);
    if (scope) params.append('scope', scope);
    return apiClient.get<CurriculumListResponse>(
      'TESTS',
      `/curricula?${params.toString()}`,
    );
  },

  /** GET /curricula/{identifier} — single curriculum with embedded members. */
  getCurriculum: async (
    identifier: string,
    scope?: 'management',
  ): Promise<Curriculum> => {
    const params = new URLSearchParams();
    if (scope) params.append('scope', scope);
    params.append('relations', 'false'); // always include relations for detail view
    const query = params.toString();
    return apiClient.get<Curriculum>(
      'TESTS',
      `/curricula/${toSlug(identifier)}${query ? `?${query}` : ''}`,
    );
  },

  /**
   * POST /curricula — create (no id) or update (with resource-path id).
   * `identifier` is server-managed and generated from `title`.
   */
  upsertCurriculum: async (
    title: string,
    id?: string,
    visible?: boolean,
  ): Promise<Curriculum> => {
    return apiClient.post<Curriculum>('TESTS', '/curricula', {
      curriculum: {
        title,
        ...(id ? { id } : {}),
        ...(typeof visible === 'boolean' ? { visible } : {}),
      },
    });
  },

  /** DELETE /curricula/{identifier}. */
  deleteCurriculum: async (identifier: string): Promise<void> => {
    return apiClient.delete<void>('TESTS', `/curricula/${toSlug(identifier)}`);
  },
};
