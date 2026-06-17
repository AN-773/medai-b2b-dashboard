import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { curriculumService } from '../services/curriculumService';
import {
  Curriculum,
  CurriculumVersion,
  CurriculumVersionDetailResponse,
} from '../types/TestsServiceTypes';
import { useAuth } from '../contexts/AuthContext';
import { identifierOf } from '../utils/resourceId';

type WriteAction = 'create' | 'update' | 'delete' | 'publish';

/**
 * Maps a thrown API error to status-based messaging. Write endpoints in the
 * curriculum contract communicate failures via HTTP status only (body may be
 * null), so the apiClient surfaces an `API Error: <status>` message we parse here.
 */
const friendlyError = (err: unknown, action: WriteAction): string => {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/API Error:\s*(\d{3})/);
  const status = match ? Number(match[1]) : undefined;

  switch (status) {
    case 400:
      return action === 'publish'
        ? 'Publish failed: the curriculum could not be identified.'
        : 'Invalid request. A title is required.';
    case 403:
      return action === 'publish'
        ? 'You are not allowed to publish this curriculum (it may belong to another tenant or require an Administrator role).'
        : 'You do not have permission to perform this action. Administrator role required.';
    case 404:
      return 'Curriculum not found. It may have been deleted.';
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

  // Versions
  versions: CurriculumVersion[];
  isLoadingVersions: boolean;
  selectedVersionNumber: number | null;
  selectedVersionDetail: CurriculumVersionDetailResponse | null;
  isLoadingVersionDetail: boolean;
  selectVersion: (version: number | null) => void;

  // Mutations
  isMutating: boolean;
  actionError: string | null;
  clearActionError: () => void;
  createCurriculum: (title: string) => Promise<Curriculum | null>;
  renameCurriculum: (id: string, title: string) => Promise<void>;
  deleteCurriculum: (identifier: string) => Promise<void>;
  publishCurriculum: (identifier: string, summary?: string) => Promise<void>;

  // Capabilities
  canManage: boolean;
}

export const useCurriculumWorkbench = (): UseCurriculumWorkbenchReturn => {
  const { currentUser, isSuperadmin } = useAuth();

  // Create / update / delete / publish require an Administrator (or tenant admin/owner).
  const canManage =
    isSuperadmin ||
    currentUser?.role === 'Administrator' ||
    currentUser?.tenantRole === 'admin' ||
    currentUser?.tenantRole === 'owner';

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdentifier = searchParams.get('c');
  const versionParam = searchParams.get('v');
  const selectedVersionNumber = versionParam ? Number(versionParam) : null;

  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const [selectedCurriculum, setSelectedCurriculum] = useState<Curriculum | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [versions, setVersions] = useState<CurriculumVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  const [selectedVersionDetail, setSelectedVersionDetail] =
    useState<CurriculumVersionDetailResponse | null>(null);
  const [isLoadingVersionDetail, setIsLoadingVersionDetail] = useState(false);

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
  }, [debouncedSearch, listRefreshKey]);

  // Load detail (with embedded members) whenever the selected curriculum changes.
  const detailRequestRef = useRef(0);
  useEffect(() => {
    if (!selectedIdentifier) {
      setSelectedCurriculum(null);
      setVersions([]);
      return;
    }
    const requestId = ++detailRequestRef.current;
    let active = true;

    const loadDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const detail = await curriculumService.getCurriculum(selectedIdentifier);
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

    const loadVersions = async () => {
      setIsLoadingVersions(true);
      try {
        const res = await curriculumService.getCurriculumVersions(selectedIdentifier);
        if (active && requestId === detailRequestRef.current) {
          setVersions(res.items ?? []);
        }
      } catch (error) {
        if (active) {
          console.error('Failed to load curriculum versions:', error);
          setVersions([]);
        }
      } finally {
        if (active && requestId === detailRequestRef.current) {
          setIsLoadingVersions(false);
        }
      }
    };

    loadDetail();
    loadVersions();

    return () => {
      active = false;
    };
  }, [selectedIdentifier, listRefreshKey]);

  // Load a frozen snapshot when a version is selected.
  useEffect(() => {
    if (!selectedIdentifier || !selectedVersionNumber) {
      setSelectedVersionDetail(null);
      return;
    }
    let active = true;
    const load = async () => {
      setIsLoadingVersionDetail(true);
      try {
        const detail = await curriculumService.getCurriculumVersion(
          selectedIdentifier,
          selectedVersionNumber,
        );
        if (active) setSelectedVersionDetail(detail);
      } catch (error) {
        if (active) {
          console.error('Failed to load curriculum version snapshot:', error);
          setSelectedVersionDetail(null);
        }
      } finally {
        if (active) setIsLoadingVersionDetail(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [selectedIdentifier, selectedVersionNumber]);

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
          // Reset version + hierarchy drill-down when switching curricula.
          params.delete('v');
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

  const selectVersion = useCallback(
    (version: number | null) => {
      setSearchParams(
        (params) => {
          if (version) {
            params.set('v', String(version));
          } else {
            params.delete('v');
          }
          return params;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const createCurriculum = useCallback(
    async (title: string): Promise<Curriculum | null> => {
      setIsMutating(true);
      setActionError(null);
      try {
        const created = await curriculumService.upsertCurriculum(title);
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
    async (id: string, title: string): Promise<void> => {
      setIsMutating(true);
      setActionError(null);
      try {
        await curriculumService.upsertCurriculum(title, id);
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

  const publishCurriculum = useCallback(
    async (identifier: string, summary?: string): Promise<void> => {
      setIsMutating(true);
      setActionError(null);
      try {
        await curriculumService.publishCurriculum(identifier, summary);
        // Status / currentVersion changed and a new published version exists.
        refreshList();
      } catch (error) {
        setActionError(friendlyError(error, 'publish'));
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [refreshList],
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

    versions,
    isLoadingVersions,
    selectedVersionNumber,
    selectedVersionDetail,
    isLoadingVersionDetail,
    selectVersion,

    isMutating,
    actionError,
    clearActionError,
    createCurriculum,
    renameCurriculum,
    deleteCurriculum,
    publishCurriculum,

    canManage,
  };
};
