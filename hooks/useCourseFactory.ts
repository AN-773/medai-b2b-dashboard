import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { courseStudioService } from '@/services/courseStudioService';
import { resourceIdentifier } from '@/utils/resourceId';
import type {
  CourseUpload,
  CourseUploadProgress,
  CourseUploadStatus,
  LearningObjectiveSuggestion,
} from '@/types/CourseStudioTypes';

export type UploadGroupStatus = 'processing' | 'ready' | 'failed' | 'empty';

export interface UploadGroup {
  /** Full course upload id (used as the stable group key). */
  uploadId: string;
  /** Short identifier for batch action routes. */
  uploadIdentifier: string;
  fileName: string;
  status: UploadGroupStatus;
  /** Raw upload status from the backend, when an upload row is available. */
  uploadStatus?: CourseUploadStatus;
  progress?: CourseUploadProgress;
  suggestions: LearningObjectiveSuggestion[];
  suggestionsLoaded: boolean;
  isLoadingSuggestions: boolean;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  createdAt?: string;
}

interface CourseScopeToken {
  courseIdentifier: string | null;
  version: number;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // ~5 minutes of polling
const UPLOAD_PAGE_SIZE = 100;
const SUGGESTION_PAGE_SIZE = 100;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const isUploadProcessing = (upload: CourseUpload) =>
  upload.status === 'pending' || upload.status === 'processing';

const isUploadReady = (upload: CourseUpload) => upload.status === 'completed';

const uploadIdentifierOf = (upload: CourseUpload) =>
  upload.identifier || resourceIdentifier(upload.id);

const pickMostRecentUploadId = (items: CourseUpload[]) =>
  items
    .slice()
    .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))[0]
    ?.id || null;

const resolveSelectedUploadId = (
  currentUploadId: string | null,
  items: CourseUpload[],
) => {
  if (currentUploadId && items.some((upload) => upload.id === currentUploadId)) {
    return currentUploadId;
  }
  return pickMostRecentUploadId(items);
};

const countByStatus = (suggestions: LearningObjectiveSuggestion[]) => {
  let pending = 0;
  let accepted = 0;
  let rejected = 0;

  suggestions.forEach((suggestion) => {
    if (suggestion.status === 'pending') pending += 1;
    else if (suggestion.status === 'accepted') accepted += 1;
    else if (suggestion.status === 'rejected') rejected += 1;
  });

  return { pending, accepted, rejected, total: suggestions.length };
};

/**
 * Drives the course "objective factory": uploading source files, polling upload
 * processing state, loading suggestions only for the selected completed upload,
 * and review actions (edit / accept / reject, plus per-upload batch actions).
 *
 * `onObjectivesPromoted` is called after any acceptance so the host can refresh
 * the normal course learning-objectives list.
 */
export const useCourseFactory = (
  courseIdentifier: string | null,
  onObjectivesPromoted?: () => void,
) => {
  const [uploads, setUploads] = useState<CourseUpload[]>([]);
  const [suggestionsByUploadId, setSuggestionsByUploadId] = useState<
    Record<string, LearningObjectiveSuggestion[]>
  >({});
  const [loadedSuggestionUploadIds, setLoadedSuggestionUploadIds] = useState<
    string[]
  >([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busySuggestionId, setBusySuggestionId] = useState<string | null>(null);
  const [busyUploadId, setBusyUploadId] = useState<string | null>(null);
  const [suggestionsLoadingUploadId, setSuggestionsLoadingUploadId] = useState<
    string | null
  >(null);

  const pollAttemptsRef = useRef(0);
  const courseScopeRef = useRef<CourseScopeToken>({
    courseIdentifier,
    version: 0,
  });

  if (courseScopeRef.current.courseIdentifier !== courseIdentifier) {
    courseScopeRef.current = {
      courseIdentifier,
      version: courseScopeRef.current.version + 1,
    };
  }

  const courseScope = courseScopeRef.current;

  const isCourseScopeActive = useCallback((scope: CourseScopeToken) => {
    return (
      courseScopeRef.current.version === scope.version &&
      courseScopeRef.current.courseIdentifier === scope.courseIdentifier
    );
  }, []);

  const selectedUpload = useMemo(
    () => uploads.find((upload) => upload.id === selectedUploadId) || null,
    [uploads, selectedUploadId],
  );

  const suggestions = useMemo(
    () => (selectedUploadId ? suggestionsByUploadId[selectedUploadId] || [] : []),
    [selectedUploadId, suggestionsByUploadId],
  );

  const fetchUploads = useCallback(async () => {
    if (!courseIdentifier) return [];
    const scope = courseScope;
    const items = await courseStudioService.listUploads(courseIdentifier, {
      limit: UPLOAD_PAGE_SIZE,
      page: 1,
    });
    if (!isCourseScopeActive(scope)) return [];
    setUploads(items);
    setSelectedUploadId((current) => resolveSelectedUploadId(current, items));
    return items;
  }, [courseIdentifier, courseScope, isCourseScopeActive]);

  const fetchSuggestionsForUpload = useCallback(
    async (upload: CourseUpload) => {
      if (!courseIdentifier || !isUploadReady(upload)) return [];
      const scope = courseScope;
      if (!isCourseScopeActive(scope)) return [];

      setSuggestionsLoadingUploadId(upload.id);
      setError(null);

      try {
        const uploadIdentifier = uploadIdentifierOf(upload);
        const firstPage = await courseStudioService.listSuggestions(
          courseIdentifier,
          {
            uploadId: uploadIdentifier || upload.id,
            limit: SUGGESTION_PAGE_SIZE,
            page: 1,
          },
        );
        if (!isCourseScopeActive(scope)) return [];

        let items = firstPage.items || [];
        const total =
          typeof firstPage.total === 'number' ? firstPage.total : items.length;
        const totalPages = Math.ceil(total / SUGGESTION_PAGE_SIZE);

        for (let page = 2; page <= totalPages; page += 1) {
          const nextPage = await courseStudioService.listSuggestions(
            courseIdentifier,
            {
              uploadId: uploadIdentifier || upload.id,
              limit: SUGGESTION_PAGE_SIZE,
              page,
            },
          );
          if (!isCourseScopeActive(scope)) return [];
          items = items.concat(nextPage.items || []);
        }

        setSuggestionsByUploadId((current) => ({
          ...current,
          [upload.id]: items,
        }));
        setLoadedSuggestionUploadIds((current) =>
          current.includes(upload.id) ? current : [...current, upload.id],
        );
        return items;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(
            getErrorMessage(
              err,
              'Unable to load suggestions for the selected upload.',
            ),
          );
        }
        return null;
      } finally {
        if (isCourseScopeActive(scope)) {
          setSuggestionsLoadingUploadId((current) =>
            current === upload.id ? null : current,
          );
        }
      }
    },
    [courseIdentifier, courseScope, isCourseScopeActive],
  );

  const refresh = useCallback(async () => {
    if (!courseIdentifier) return;
    const scope = courseScope;
    setIsLoading(true);
    setError(null);

    try {
      const uploadItems = await fetchUploads();
      if (!isCourseScopeActive(scope)) return;
      if (uploadItems.some(isUploadProcessing)) {
        pollAttemptsRef.current = 0;
        setIsPolling(true);
      }

      const activeUpload = selectedUploadId
        ? uploadItems.find((upload) => upload.id === selectedUploadId) || null
        : null;
      if (activeUpload && isUploadReady(activeUpload)) {
        await fetchSuggestionsForUpload(activeUpload);
      } else if (selectedUploadId && !activeUpload) {
        setSelectedUploadId(null);
      }
    } catch (err) {
      if (isCourseScopeActive(scope)) {
        setError(getErrorMessage(err, 'Unable to load course uploads.'));
      }
    } finally {
      if (isCourseScopeActive(scope)) {
        setIsLoading(false);
      }
    }
  }, [
    courseIdentifier,
    courseScope,
    fetchSuggestionsForUpload,
    fetchUploads,
    isCourseScopeActive,
    selectedUploadId,
  ]);

  // Reset + load uploads whenever the selected course changes.
  useEffect(() => {
    setUploads([]);
    setSuggestionsByUploadId({});
    setLoadedSuggestionUploadIds([]);
    setSelectedUploadId(null);
    setError(null);
    setIsLoading(Boolean(courseIdentifier));
    setIsUploading(false);
    setIsPolling(false);
    setBusySuggestionId(null);
    setBusyUploadId(null);
    setSuggestionsLoadingUploadId(null);
    pollAttemptsRef.current = 0;

    if (!courseIdentifier) return;

    let isCancelled = false;
    const scope = courseScope;

    const loadInitialUploads = async () => {
      try {
        const uploadItems = await fetchUploads();
        if (isCancelled || !isCourseScopeActive(scope)) return;
        setError(null);
        if (uploadItems.some(isUploadProcessing)) {
          pollAttemptsRef.current = 0;
          setIsPolling(true);
        }
      } catch (err) {
        if (!isCancelled && isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to load course uploads.'));
        }
      } finally {
        if (!isCancelled && isCourseScopeActive(scope)) setIsLoading(false);
      }
    };

    void loadInitialUploads();

    return () => {
      isCancelled = true;
    };
  }, [courseIdentifier, courseScope, fetchUploads, isCourseScopeActive]);

  // Selecting a completed upload is the trigger for fetching its suggestions.
  useEffect(() => {
    if (!selectedUpload || !isUploadReady(selectedUpload)) return;
    if (loadedSuggestionUploadIds.includes(selectedUpload.id)) return;
    void fetchSuggestionsForUpload(selectedUpload);
  }, [fetchSuggestionsForUpload, loadedSuggestionUploadIds, selectedUpload]);

  // While any upload is still processing, poll uploads. If the selected upload
  // becomes completed during polling, load that upload's suggestions.
  useEffect(() => {
    if (!isPolling || !courseIdentifier) return;
    const scope = courseScope;

    const timer = window.setInterval(async () => {
      pollAttemptsRef.current += 1;

      try {
        const uploadItems = await fetchUploads();
        if (!isCourseScopeActive(scope)) return;
        const activeUpload = selectedUploadId
          ? uploadItems.find((upload) => upload.id === selectedUploadId) || null
          : null;

        if (
          activeUpload &&
          isUploadReady(activeUpload) &&
          !loadedSuggestionUploadIds.includes(activeUpload.id)
        ) {
          await fetchSuggestionsForUpload(activeUpload);
        }

        const stillProcessing = uploadItems.some(isUploadProcessing);
        if (!stillProcessing || pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setIsPolling(false);
          pollAttemptsRef.current = 0;
        }
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to poll course uploads.'));
          if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
            setIsPolling(false);
            pollAttemptsRef.current = 0;
          }
        }
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [
    courseIdentifier,
    courseScope,
    fetchSuggestionsForUpload,
    fetchUploads,
    isCourseScopeActive,
    isPolling,
    loadedSuggestionUploadIds,
    selectedUploadId,
  ]);

  const selectUpload = useCallback((uploadId: string | null) => {
    setSelectedUploadId(uploadId);
    setError(null);
  }, []);

  const upload = useCallback(
    async (files: File[]) => {
      if (!courseIdentifier || files.length === 0) return;
      const scope = courseScope;
      setIsUploading(true);
      setError(null);
      try {
        const created = await courseStudioService.uploadCourseFiles(
          courseIdentifier,
          files,
        );
        if (!isCourseScopeActive(scope)) return;
        setUploads((current) => {
          const createdIds = new Set(created.map((upload) => upload.id));
          return [
            ...created,
            ...current.filter((upload) => !createdIds.has(upload.id)),
          ];
        });
        setSuggestionsByUploadId((current) => {
          const next = { ...current };
          created.forEach((upload) => {
            delete next[upload.id];
          });
          return next;
        });
        setLoadedSuggestionUploadIds((current) => {
          const createdIds = new Set(created.map((upload) => upload.id));
          return current.filter((id) => !createdIds.has(id));
        });
        if (created[0]) setSelectedUploadId(created[0].id);
        pollAttemptsRef.current = 0;
        setIsPolling(true);
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to upload course files.'));
        }
      } finally {
        if (isCourseScopeActive(scope)) {
          setIsUploading(false);
        }
      }
    },
    [courseIdentifier, courseScope, isCourseScopeActive],
  );

  const uploadIdForSuggestion = useCallback(
    (suggestion: LearningObjectiveSuggestion) => {
      const suggestionUploadIdentifier = resourceIdentifier(
        suggestion.courseUploadId,
      );
      const matchingUpload = uploads.find(
        (upload) =>
          upload.id === suggestion.courseUploadId ||
          upload.identifier === suggestionUploadIdentifier ||
          resourceIdentifier(upload.id) === suggestionUploadIdentifier,
      );
      return matchingUpload?.id || suggestion.courseUploadId;
    },
    [uploads],
  );

  const updateSuggestionInCache = useCallback(
    (
      suggestion: LearningObjectiveSuggestion,
      update: (
        current: LearningObjectiveSuggestion,
      ) => LearningObjectiveSuggestion,
    ) => {
      const uploadId = uploadIdForSuggestion(suggestion);
      setSuggestionsByUploadId((current) => {
        const uploadSuggestions = current[uploadId] || [];
        if (uploadSuggestions.length === 0) return current;

        return {
          ...current,
          [uploadId]: uploadSuggestions.map((item) =>
            item.id === suggestion.id ? update(item) : item,
          ),
        };
      });
    },
    [uploadIdForSuggestion],
  );

  const patchSuggestion = useCallback(
    async (
      suggestion: LearningObjectiveSuggestion,
      payload: { title?: string; bloomLevel?: string },
    ) => {
      const scope = courseScope;
      setBusySuggestionId(suggestion.id);
      setError(null);
      try {
        const updated = await courseStudioService.patchSuggestion(
          suggestion.identifier || suggestion.id,
          payload,
        );
        if (!isCourseScopeActive(scope)) return false;
        updateSuggestionInCache(suggestion, (item) => ({ ...item, ...updated }));
        return true;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to update this suggestion.'));
        }
        return false;
      } finally {
        if (isCourseScopeActive(scope)) {
          setBusySuggestionId(null);
        }
      }
    },
    [courseScope, isCourseScopeActive, updateSuggestionInCache],
  );

  const acceptSuggestion = useCallback(
    async (suggestion: LearningObjectiveSuggestion) => {
      const scope = courseScope;
      setBusySuggestionId(suggestion.id);
      setError(null);
      try {
        const result = await courseStudioService.acceptSuggestion(
          suggestion.identifier || suggestion.id,
        );
        if (!isCourseScopeActive(scope)) return false;
        updateSuggestionInCache(suggestion, (item) => ({
          ...item,
          status: 'accepted',
          acceptedLearningObjectiveId: result.learningObjectiveId,
          ...(result.suggestion || {}),
        }));
        onObjectivesPromoted?.();
        return true;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to accept this suggestion.'));
          // 409 means the row is stale - refresh to resync.
          if ((err as { status?: number })?.status === 409) void refresh();
        }
        return false;
      } finally {
        if (isCourseScopeActive(scope)) {
          setBusySuggestionId(null);
        }
      }
    },
    [
      courseScope,
      isCourseScopeActive,
      onObjectivesPromoted,
      refresh,
      updateSuggestionInCache,
    ],
  );

  const rejectSuggestion = useCallback(
    async (suggestion: LearningObjectiveSuggestion) => {
      const scope = courseScope;
      setBusySuggestionId(suggestion.id);
      setError(null);
      try {
        const updated = await courseStudioService.rejectSuggestion(
          suggestion.identifier || suggestion.id,
        );
        if (!isCourseScopeActive(scope)) return false;
        updateSuggestionInCache(suggestion, (item) => ({
          ...item,
          status: 'rejected',
          ...updated,
        }));
        return true;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(getErrorMessage(err, 'Unable to reject this suggestion.'));
          if ((err as { status?: number })?.status === 409) void refresh();
        }
        return false;
      } finally {
        if (isCourseScopeActive(scope)) {
          setBusySuggestionId(null);
        }
      }
    },
    [courseScope, isCourseScopeActive, refresh, updateSuggestionInCache],
  );

  const acceptAllForUpload = useCallback(
    async (group: UploadGroup) => {
      const scope = courseScope;
      setBusyUploadId(group.uploadId);
      setError(null);
      try {
        const result = await courseStudioService.acceptAllForUpload(
          group.uploadIdentifier,
        );
        if (!isCourseScopeActive(scope)) return null;
        const uploadRow = uploads.find((upload) => upload.id === group.uploadId);
        if (uploadRow) await fetchSuggestionsForUpload(uploadRow);
        if (!isCourseScopeActive(scope)) return null;
        if (result.accepted > 0) onObjectivesPromoted?.();
        return result;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(
            getErrorMessage(
              err,
              'Unable to accept all suggestions for this upload.',
            ),
          );
        }
        return null;
      } finally {
        if (isCourseScopeActive(scope)) {
          setBusyUploadId(null);
        }
      }
    },
    [
      courseScope,
      fetchSuggestionsForUpload,
      isCourseScopeActive,
      onObjectivesPromoted,
      uploads,
    ],
  );

  const rejectAllForUpload = useCallback(
    async (group: UploadGroup) => {
      const scope = courseScope;
      setBusyUploadId(group.uploadId);
      setError(null);
      try {
        const result = await courseStudioService.rejectAllForUpload(
          group.uploadIdentifier,
        );
        if (!isCourseScopeActive(scope)) return null;
        const uploadRow = uploads.find((upload) => upload.id === group.uploadId);
        if (uploadRow) await fetchSuggestionsForUpload(uploadRow);
        if (!isCourseScopeActive(scope)) return null;
        return result;
      } catch (err) {
        if (isCourseScopeActive(scope)) {
          setError(
            getErrorMessage(
              err,
              'Unable to reject all suggestions for this upload.',
            ),
          );
        }
        return null;
      } finally {
        if (isCourseScopeActive(scope)) {
          setBusyUploadId(null);
        }
      }
    },
    [courseScope, fetchSuggestionsForUpload, isCourseScopeActive, uploads],
  );

  const refreshSelectedUploadSuggestions = useCallback(async () => {
    if (!selectedUpload || !isUploadReady(selectedUpload)) return null;
    return fetchSuggestionsForUpload(selectedUpload);
  }, [fetchSuggestionsForUpload, selectedUpload]);

  const uploadGroups = useMemo<UploadGroup[]>(() => {
    return uploads
      .map((upload) => {
        const groupSuggestions = suggestionsByUploadId[upload.id] || [];
        const suggestionCounts = countByStatus(groupSuggestions);
        const suggestionsLoaded = loadedSuggestionUploadIds.includes(upload.id);
        const isLoadingSuggestions = suggestionsLoadingUploadId === upload.id;
        const pendingCount = suggestionsLoaded
          ? suggestionCounts.pending
          : upload.pendingLearningObjectiveSuggestionsTotal ?? 0;

        let status: UploadGroupStatus;
        if (upload.status === 'failed') status = 'failed';
        else if (isUploadProcessing(upload)) status = 'processing';
        else if (suggestionsLoaded && groupSuggestions.length === 0) status = 'empty';
        else status = 'ready';

        const uploadIdentifier = uploadIdentifierOf(upload);

        return {
          uploadId: upload.id,
          uploadIdentifier,
          fileName: upload.fileName || `Upload ${uploadIdentifier}`,
          status,
          uploadStatus: upload.status,
          progress: upload.progress,
          suggestions: groupSuggestions,
          suggestionsLoaded,
          isLoadingSuggestions,
          pendingCount,
          acceptedCount: suggestionCounts.accepted,
          rejectedCount: suggestionCounts.rejected,
          createdAt: upload.createdAt,
        };
      })
      .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));
  }, [
    loadedSuggestionUploadIds,
    suggestionsByUploadId,
    suggestionsLoadingUploadId,
    uploads,
  ]);

  const stats = useMemo(() => countByStatus(suggestions), [suggestions]);

  return {
    suggestions,
    uploadGroups,
    selectedUploadId,
    selectedUpload,
    stats,
    isLoading,
    isUploading,
    isPolling,
    isLoadingSuggestions:
      Boolean(selectedUploadId) && suggestionsLoadingUploadId === selectedUploadId,
    error,
    busySuggestionId,
    busyUploadId,
    clearError: () => setError(null),
    refresh,
    refreshSelectedUploadSuggestions,
    selectUpload,
    upload,
    patchSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    acceptAllForUpload,
    rejectAllForUpload,
  };
};
