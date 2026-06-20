import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { curriculumService } from '../services/curriculumService';
import { Curriculum } from '../types/TestsServiceTypes';
import { useAuth } from '../contexts/AuthContext';
import { identifierOf } from '../utils/resourceId';

type WriteAction = 'create' | 'update' | 'delete';

type ApiRequestError = Error & {
  status?: number;
};

/**
 * Maps a thrown API error to status-based messaging. Write endpoints in the
 * curriculum contract communicate failures via HTTP status only (body may be
 * null), so we primarily key off the HTTP status surfaced by the api client.
 */
const friendlyError = (err: unknown, action: WriteAction): string => {
  const message = err instanceof Error ? err.message : String(err);
  const status =
    (err as ApiRequestError | undefined)?.status ??
    Number(message.match(/API Error:\s*(\d{3})/)?.[1] || NaN);

  switch (status) {
    case 400:
      return action === 'delete'
        ? 'Invalid delete request.'
        : 'Invalid request. A title is required.';
    case 403:
      return 'You do not have permission to perform this action. Administrator role required.';
    case 404:
      return 'Curriculum not found. It may have been deleted.';
    case 409:
      return 'This curriculum still has linked resources and cannot be deleted.';
    default:
      // Fall back to the backend/transport message when there's no mappable status.
      return message || 'Something went wrong. Please try again.';
  }
};

export interface UseCurriculumWorkbenchReturn {
  // List
  curricula: Curriculum[];
  isLoadingList: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  refreshList: () => void;

  // Selection
  selectedIdentifier: string | null;
  selectedCurriculum: Curriculum | null;
  isLoadingDetail: boolean;
  selectCurriculum: (identifier: string | null) => void;

  // Mutations
  isMutating: boolean;
  actionError: string | null;
  clearActionError: () => void;
  createCurriculum: (title: string, visible: boolean) => Promise<Curriculum | null>;
  renameCurriculum: (id: string, title: string, visible: boolean) => Promise<void>;
  deleteCurriculum: (identifier: string) => Promise<void>;

  // Capabilities
  canManage: boolean;
}

export const useCurriculumWorkbench = (): UseCurriculumWorkbenchReturn => {
  const { currentUser, isSuperadmin } = useAuth();

  // Create / update / delete require an Administrator (or tenant admin/owner).
  const canManage =
    isSuperadmin ||
    currentUser?.role === 'Administrator' ||
    currentUser?.tenantRole === 'admin' ||
    currentUser?.tenantRole === 'owner';

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdentifier = searchParams.get('c');

  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const [selectedCurriculum, setSelectedCurriculum] = useState<Curriculum | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounce the search query for server-side filtering.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Load list (tenant-scoped) on mount, search change, or explicit refresh.
  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoadingList(true);
      try {
        const res = await curriculumService.getCurricula(
          1,
          undefined,
          false,
          debouncedSearch || undefined,
          canManage ? 'management' : undefined,
        );
        if (active) setCurricula(res.items ?? []);
      } catch (error) {
        if (active) {
          console.error('Failed to load curricula:', error);
          setCurricula([]);
        }
      } finally {
        if (active) setIsLoadingList(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [canManage, debouncedSearch, listRefreshKey]);

  // Load detail (with embedded members) whenever the selected curriculum changes.
  const detailRequestRef = useRef(0);
  useEffect(() => {
    if (!selectedIdentifier) {
      setSelectedCurriculum(null);
      return;
    }
    const requestId = ++detailRequestRef.current;
    let active = true;

    const loadDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const detail = await curriculumService.getCurriculum(
          selectedIdentifier,
          canManage ? 'management' : undefined,
        );
        if (active && requestId === detailRequestRef.current) {
          setSelectedCurriculum(detail);
        }
      } catch (error) {
        if (active) {
          console.error('Failed to load curriculum:', error);
          setSelectedCurriculum(null);
        }
      } finally {
        if (active && requestId === detailRequestRef.current) {
          setIsLoadingDetail(false);
        }
      }
    };

    loadDetail();

    return () => {
      active = false;
    };
  }, [canManage, selectedIdentifier, listRefreshKey]);

  const refreshList = useCallback(() => {
    setListRefreshKey((k) => k + 1);
  }, []);

  const clearActionError = useCallback(() => setActionError(null), []);

  const selectCurriculum = useCallback(
    (identifier: string | null) => {
      setActionError(null);
      setSearchParams(
        (params) => {
          if (identifier) {
            params.set('c', identifier);
          } else {
            params.delete('c');
          }
          // Reset hierarchy drill-down when switching curricula.
          params.delete('system');
          params.delete('topic');
          params.delete('subtopic');
          return params;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const createCurriculum = useCallback(
    async (title: string, visible: boolean): Promise<Curriculum | null> => {
      setIsMutating(true);
      setActionError(null);
      try {
        const created = await curriculumService.upsertCurriculum(title, undefined, visible);
        refreshList();
        const slug = created ? identifierOf(created) : '';
        if (slug) {
          selectCurriculum(slug);
        }
        return created;
      } catch (error) {
        setActionError(friendlyError(error, 'create'));
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [refreshList, selectCurriculum],
  );

  const renameCurriculum = useCallback(
    async (id: string, title: string, visible: boolean): Promise<void> => {
      setIsMutating(true);
      setActionError(null);
      try {
        await curriculumService.upsertCurriculum(title, id, visible);
        refreshList();
      } catch (error) {
        setActionError(friendlyError(error, 'update'));
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [refreshList],
  );

  const deleteCurriculum = useCallback(
    async (identifier: string): Promise<void> => {
      setIsMutating(true);
      setActionError(null);
      try {
        await curriculumService.deleteCurriculum(identifier);
        if (selectedIdentifier === identifier) {
          selectCurriculum(null);
        }
        refreshList();
      } catch (error) {
        setActionError(friendlyError(error, 'delete'));
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [refreshList, selectCurriculum, selectedIdentifier],
  );

  return {
    curricula,
    isLoadingList,
    searchQuery,
    setSearchQuery,
    refreshList,

    selectedIdentifier,
    selectedCurriculum,
    isLoadingDetail,
    selectCurriculum,

    isMutating,
    actionError,
    clearActionError,
    createCurriculum,
    renameCurriculum,
    deleteCurriculum,

    canManage,
  };
};
