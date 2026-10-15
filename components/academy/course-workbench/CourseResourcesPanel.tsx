import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, ScanText, Upload } from 'lucide-react';
import type { TeacherCourse } from '@/types/AcademyStudioTypes';
import { courseResourceService } from '@/services/courseResourceService';
import {
  AGENT_MAX_UPLOAD_BYTES,
  AGENT_MAX_UPLOAD_SIZE_LABEL,
  formatSuffixLabels,
  getCorpusUploadFormats,
  isAcceptedUpload,
  uploadAcceptAttribute,
} from '@/services/agentV2Service';
import type { AcceptedUploadFormat } from '@/services/agentV2Service';
import { readCourseResourceKnowledgeBase } from '@/types/CourseResourceTypes';
import type { CourseResource } from '@/types/CourseResourceTypes';
import { resourceIdentifier } from '@/utils/resourceId';
import { BlobUploadAbortedError } from '@/utils/blockBlobUpload';
import { useProgressiveCourseResources } from '@/hooks/useProgressiveCourseResources';
import { needsCourseSync, shouldPollResource } from '@/utils/documentProcessing';
import {
  Badge,
  Button,
  ConfirmDialog,
  IconButton,
  InlineAlert,
  SectionHeader,
  Spinner,
} from '@/components/ui';
import { VIDEO_EXTENSIONS, extensionOf, formatFileSize } from './resources/fileDisplay';
import { UploadQueue, type UploadItem } from './resources/UploadQueue';
import { DropOverlay, EmptyDropzone } from './resources/Dropzone';
import { ResourceRow } from './resources/ResourceRow';
import { StatusNote } from './resources/StatusNote';

interface CourseResourcesPanelProps {
  course: TeacherCourse;
}

type ApiRequestError = Error & {
  status?: number;
};

const PAGE_SIZE = 25;

/*
 * What a course resource may be is now what the tutor agent can read.
 *
 * The store behind this panel would take anything — the Tests service applies
 * no MIME allowlist and its own ceiling was gigabyte-scale, sized for a lecture
 * video pushed over a campus uplink. What it could not do is make any of it
 * *searchable*: a file becomes answerable by a learner's tutor only by being
 * ingested into a knowledge base, and that pipeline parses a specific set of
 * document formats and refuses anything over 150 MiB.
 *
 * The gap between those two was the defect. A teacher could upload a 2 GB
 * lecture recording, see it listed, and have every learner's tutor unable to
 * quote a word of it — a success on screen and a file the product cannot use.
 * So the picker is bounded by the pipeline rather than by the store, both ways:
 * {@link AGENT_MAX_UPLOAD_BYTES} for the size, and the agent's own published
 * format list for the type.
 *
 * **This is a narrowing, and video is what it removes.** Recordings already
 * uploaded are untouched and still listed, downloadable and attached to their
 * study plans; what changes is that a new one is refused here rather than
 * accepted into a dead end. Making them searchable is a transcription step
 * nobody has built, and until it exists this refusal is the honest answer.
 *
 * Checking here rather than leaving it to the backend means nobody waits out a
 * long upload to be told no at the end.
 */

const getStatus = (error: unknown) =>
  typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as ApiRequestError).status)
    : undefined;

const getUploadErrorMessage = (error: unknown) => {
  const status = getStatus(error);
  if (status === 404) {
    return "We couldn't find this course, so nothing was uploaded.";
  }
  if (status === 500) {
    return 'The upload failed on the server — try again in a moment.';
  }
  return error instanceof Error ? error.message : "Couldn't upload these files.";
};

const getDeleteErrorMessage = (error: unknown) => {
  const status = getStatus(error);
  if (status === 404) {
    return 'That file is no longer attached to this course.';
  }
  if (status === 500) {
    return 'The server failed to remove that file — try again in a moment.';
  }
  return error instanceof Error ? error.message : "Couldn't remove that file.";
};

const isVideoFile = (file: File) =>
  file.type.toLowerCase().startsWith('video/') ||
  VIDEO_EXTENSIONS.includes(extensionOf(file.name));

/**
 * Why this file cannot be a course resource, or `null` if it can.
 *
 * `accepted` is `null` when the agent could not be asked what it reads — no
 * deployment configured, or the call failed. The type check is then skipped
 * entirely rather than run against a guess: refusing a PDF because a format
 * list did not load would be a worse failure than accepting a file the upload
 * later answers `415` for. The size check still runs, because that number is
 * known without asking.
 */
const rejectionFor = (
  file: File,
  accepted: readonly AcceptedUploadFormat[] | null,
): string | null => {
  if (accepted !== null && !isAcceptedUpload(file, accepted)) {
    const kinds = formatSuffixLabels(accepted).join(', ');
    if (isVideoFile(file)) {
      return `Recordings can’t be added as course resources — a learner’s tutor can’t read one. Upload the slides or a transcript instead (${kinds}).`;
    }
    // A name with no dot has no extension to name back at the teacher, and
    // `extensionOf` would hand back the whole filename for one.
    const dot = file.name.lastIndexOf('.');
    const kind =
      dot > 0 ? `${file.name.slice(dot + 1).toUpperCase()} files aren’t` : 'That file isn’t';
    return `${kind} something a learner’s tutor can read. Accepted: ${kinds}.`;
  }

  if (file.size > AGENT_MAX_UPLOAD_BYTES) {
    return `This file is ${formatFileSize(file.size)} — the limit is ${AGENT_MAX_UPLOAD_SIZE_LABEL}. Split it into parts, or compress the images inside it.`;
  }

  return null;
};

const resourceKey = (resource: CourseResource) =>
  resource.id || resource.identifier || resource.fileId || resource.fileName;

const identifierFor = (resource: CourseResource) =>
  resource.identifier || resourceIdentifier(resource.id);

/*
 * The Sina status (contracts/course-resources-contract.md, Contracts T1–T3).
 *
 * The Tests service ingests each eligible resource once per course into the
 * knowledge base a learner's tutor searches, and reports where each file stands
 * on `CourseResource.knowledgeBase`. The key is absent when Tests has no agent
 * configured, and then none of this renders: no status column, no Process
 * files action.
 */

const getSyncErrorMessage = (error: unknown) => {
  const status = getStatus(error);
  if (status === 500) {
    return 'Couldn’t send files to the tutor right now — try again in a moment.';
  }
  return error instanceof Error ? error.message : 'Couldn’t send files to the tutor.';
};

const hasDraggedFiles = (event: React.DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes('Files');

const CourseResourcesPanel: React.FC<CourseResourcesPanelProps> = ({ course }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  /** Files behind failed/canceled queue rows, so Retry can send them again. */
  const retryFilesRef = useRef(new Map<string, File>());
  const uploadBatchRef = useRef(0);
  const courseIdentifier = useMemo(
    () => course.backendIdentifier || resourceIdentifier(course.id),
    [course.backendIdentifier, course.id],
  );
  const [page, setPage] = useState(1);
  const { resources, total, isLoading, loadError, connectionStale, refresh, expectUpdate } =
    useProgressiveCourseResources(courseIdentifier, page, PAGE_SIZE);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<CourseResource | null>(
    null,
  );
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  /**
   * What the tutor agent will ingest. `null` until it answers, and permanently
   * `null` where there is no agent — see `rejectionFor` on why that is not the
   * same as an empty list.
   */
  const [acceptedFormats, setAcceptedFormats] = useState<
    AcceptedUploadFormat[] | null
  >(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  /**
   * Set once the Tests service answers that it cannot sync (no agent, or no
   * route). Kept for the life of the panel rather than per course, because it
   * is a fact about the deployment.
   */
  const [syncUnsupported, setSyncUnsupported] = useState(false);
  const syncControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setIsSyncing(false);
    return () => {
      syncControllerRef.current?.abort();
      syncControllerRef.current = null;
    };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageSize = useMemo(
    () => resources.reduce((sum, resource) => sum + (resource.fileSize || 0), 0),
    [resources],
  );

  // The key's presence, not a recognised status, decides the status column:
  // absent means Tests has no agent, and then no Sina status renders at all.
  const showTutorColumn = useMemo(
    () => resources.some((resource) => resource.knowledgeBase != null),
    [resources],
  );
  const hasProcessing = resources.some(shouldPollResource);
  const needsSync = resources.some(needsCourseSync);
  const loadResources = useCallback(
    async (pageToLoad: number) => {
      if (pageToLoad !== page) setPage(pageToLoad);
      else await refresh();
    }, [page, refresh],
  );

  useEffect(() => () => {
    syncControllerRef.current?.abort();
    cancelRequestedRef.current = true;
    abortRef.current?.abort();
  }, []);

  // Asked once per mount rather than per course: the answer is a fact about the
  // deployment's parser, not about this course, and it does not change while a
  // teacher moves between courses in the workbench.
  useEffect(() => {
    const controller = new AbortController();
    void getCorpusUploadFormats({ signal: controller.signal }).then(setAcceptedFormats);
    return () => controller.abort();
  }, []);

  // A large upload can outlast the teacher's patience with the tab, and closing
  // it mid-transfer throws away everything sent so far.
  useEffect(() => {
    if (!isUploading) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isUploading]);

  const updateUploadItem = useCallback(
    (key: string, patch: Partial<UploadItem>) => {
      setUploadQueue((current) =>
        current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  /**
   * `replacingKey` is set by Retry: that row alone is swapped for the new
   * attempt and the other rows stay. A fresh pick or drop starts a new queue.
   */
  const uploadFiles = useCallback(
    async (files: File[], replacingKey?: string) => {
      if (files.length === 0 || isUploading) return;

      uploadBatchRef.current += 1;
      const batch = uploadBatchRef.current;
      if (!replacingKey) retryFilesRef.current.clear();

      const queue: UploadItem[] = files.map((file, index) => {
        // Type before size, because it is the more useful thing to be told:
        // a teacher whose 900 MB recording is refused for both reasons is not
        // helped by "compress it", and the extension is what they can act on.
        const rejection = rejectionFor(file, acceptedFormats);
        const key = `${batch}-${index}-${file.name}-${file.size}-${file.lastModified}`;
        if (!rejection) retryFilesRef.current.set(key, file);
        return {
          key,
          fileName: file.name,
          fileSize: file.size,
          isVideo: isVideoFile(file),
          status: rejection ? 'error' : 'pending',
          percent: 0,
          error: rejection ?? undefined,
          retryable: !rejection,
        };
      });

      cancelRequestedRef.current = false;
      setUploadQueue((current) =>
        replacingKey
          ? [...current.filter((item) => item.key !== replacingKey), ...queue]
          : queue,
      );
      setDeleteError(null);
      setStatusMessage(null);
      setIsUploading(true);

      let uploadedCount = 0;
      let lastUploadedName = '';
      // Whether the Tests service said the tutor will index what landed. Only
      // then does the success copy mention processing — and not for a file Tests
      // already reported it cannot send, which its row status explains instead.
      let tutorWillIndex = false;

      // One file at a time: each upload already parallelises its own blocks, and
      // a failure part-way leaves the files that already landed untouched.
      for (let index = 0; index < files.length; index += 1) {
        const item = queue[index];
        if (item.status === 'error') continue;

        if (cancelRequestedRef.current) {
          updateUploadItem(item.key, { status: 'canceled' });
          continue;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        updateUploadItem(item.key, { status: 'uploading', percent: 0 });

        try {
          const uploaded = await courseResourceService.uploadTeacherCourseResource(
            courseIdentifier,
            files[index],
            {
              signal: controller.signal,
              onProgress: (percent) => updateUploadItem(item.key, { percent }),
            },
          );
          uploadedCount += 1;
          lastUploadedName = uploaded[0]?.fileName || item.fileName;
          const uploadedTutorState = uploaded[0]
            ? readCourseResourceKnowledgeBase(uploaded[0])
            : null;
          if (uploadedTutorState && uploadedTutorState.status !== 'ineligible') {
            tutorWillIndex = true;
          }
          retryFilesRef.current.delete(item.key);
          updateUploadItem(item.key, { status: 'done', percent: 100 });
        } catch (error) {
          if (controller.signal.aborted || error instanceof BlobUploadAbortedError) {
            updateUploadItem(item.key, { status: 'canceled' });
          } else {
            updateUploadItem(item.key, {
              status: 'error',
              error: getUploadErrorMessage(error),
            });
          }
        } finally {
          abortRef.current = null;
        }
      }

      cancelRequestedRef.current = false;
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Finished rows would only repeat what the list below now shows, so keep
      // just the ones the teacher still has to deal with.
      setUploadQueue((current) =>
        current.filter(
          (item) => item.status === 'error' || item.status === 'canceled',
        ),
      );

      if (uploadedCount > 0) {
        const single = uploadedCount === 1;
        const available = single
          ? `“${lastUploadedName}” is available to learners.`
          : `${uploadedCount} files are available to learners.`;
        setStatusMessage(
          tutorWillIndex
            ? `${available} Processing will continue automatically.`
            : single
              ? `“${lastUploadedName}” is now available to learners.`
              : `${uploadedCount} files are now available to learners.`,
        );
        if (page === 1) {
          await loadResources(1);
        } else {
          setPage(1);
        }
      }
    },
    [
      acceptedFormats,
      courseIdentifier,
      isUploading,
      loadResources,
      page,
      updateUploadItem,
    ],
  );

  const cancelUploads = () => {
    cancelRequestedRef.current = true;
    abortRef.current?.abort();
  };

  const retryUpload = (key: string) => {
    const file = retryFilesRef.current.get(key);
    if (!file || isUploading) return;
    retryFilesRef.current.delete(key);
    void uploadFiles([file], key);
  };

  const dismissUpload = (key: string) => {
    retryFilesRef.current.delete(key);
    setUploadQueue((current) => current.filter((entry) => entry.key !== key));
  };

  const openFilePicker = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    void uploadFiles(files);
  };

  // Files can be dropped anywhere over the panel, not just on the empty state.
  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    if (isUploading || !hasDraggedFiles(event)) return;
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = isUploading ? 'none' : 'copy';
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (isUploading) return;
    const files = event.dataTransfer?.files
      ? Array.from(event.dataTransfer.files)
      : [];
    void uploadFiles(files);
  };

  const confirmDeleteResource = async () => {
    const resource = resourceToDelete;
    if (!resource) return;
    const identifier = identifierFor(resource);
    if (!identifier || deletingResourceId) return;

    setResourceToDelete(null);
    setDeletingResourceId(identifier);
    setDeleteError(null);
    setStatusMessage(null);

    try {
      await courseResourceService.deleteTeacherCourseResource(
        courseIdentifier,
        identifier,
      );

      const nextTotal = Math.max(0, total - 1);
      const nextPage = Math.min(page, Math.max(1, Math.ceil(nextTotal / PAGE_SIZE)));
      setStatusMessage(`“${resource.fileName}” removed.`);

      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await loadResources(nextPage);
      }
    } catch (error) {
      setDeleteError(getDeleteErrorMessage(error));
    } finally {
      setDeletingResourceId(null);
    }
  };

  const refreshResources = () => {
    void loadResources(page);
  };

  /**
   * Contract T2. Only queues work on the Tests side, so the reload afterwards
   * shows statuses moving rather than finished; polling picks up from there.
   */
  const syncToTutor = async () => {
    if (syncControllerRef.current) return;
    const controller = new AbortController();
    syncControllerRef.current = controller;
    setIsSyncing(true);
    setSyncError(null);
    setStatusMessage(null);
    try {
      const result =
        await courseResourceService.syncTeacherCourseResourcesToTutor(courseIdentifier, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result === 'unsupported') {
        setSyncUnsupported(true);
        return;
      }
      setStatusMessage(
        'Processing requested. Files will update automatically.',
      );
      resources.filter(needsCourseSync).forEach(expectUpdate);
      await loadResources(page);
    } catch (error) {
      if (controller.signal.aborted) return;
      setSyncError(getSyncErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) {
        syncControllerRef.current = null;
        setIsSyncing(false);
      }
    }
  };

  // A page of ready files cannot certify that the rest of the course is done.
  const showSyncButton = !syncUnsupported && (showTutorColumn || needsSync);

  const formatsHint = acceptedFormats
    ? `${formatSuffixLabels(acceptedFormats).join(', ')} · up to ${AGENT_MAX_UPLOAD_SIZE_LABEL} each`
    : `Up to ${AGENT_MAX_UPLOAD_SIZE_LABEL} per file`;

  const showList = !loadError && !isLoading && resources.length > 0;

  const headerMeta =
    !loadError && !isLoading && total > 0 ? (
      <>
        <Badge className="tabular-nums">
          {total} {total === 1 ? 'file' : 'files'}
        </Badge>
        {hasProcessing && (
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
            <Loader2 size={12} className="animate-spin text-sky-500" aria-hidden="true" />
            Processing files…
          </span>
        )}
      </>
    ) : undefined;

  return (
    <div
      className="relative"
      data-testid="course-resources-panel"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        // Omitted entirely when the agent could not be asked, rather than set
        // to a guessed list: an `accept` built from nothing would hide files
        // the parser reads. A drop is checked by `rejectionFor` either way —
        // this attribute only makes the browser's own picker agree with it.
        {...(acceptedFormats
          ? { accept: uploadAcceptAttribute(acceptedFormats) }
          : {})}
        onChange={handleFileChange}
      />

      <div className="space-y-5">
        <SectionHeader
          title="Resources"
          description="Files learners and Sina can draw on for this course — slides, notes, readings."
          meta={headerMeta}
          actions={
            <>
              <IconButton
                icon={RefreshCw}
                label="Refresh"
                onClick={refreshResources}
                disabled={isLoading}
              />
              {showSyncButton && (
                <Button
                  variant="secondary"
                  icon={ScanText}
                  onClick={() => void syncToTutor()}
                  loading={isSyncing}
                  disabled={isLoading}
                  title="Start or retry processing for course files"
                >
                  Process files
                </Button>
              )}
              <Button variant="primary" icon={Upload} onClick={openFilePicker} loading={isUploading}>
                {isUploading ? 'Uploading…' : 'Upload files'}
              </Button>
            </>
          }
        />

        {syncError && (
          <InlineAlert onDismiss={() => setSyncError(null)}>{syncError}</InlineAlert>
        )}
        {deleteError && (
          <InlineAlert onDismiss={() => setDeleteError(null)}>{deleteError}</InlineAlert>
        )}
        {statusMessage && (
          <StatusNote onDismiss={() => setStatusMessage(null)}>{statusMessage}</StatusNote>
        )}
        {connectionStale && (
          <InlineAlert tone="warning">Reconnecting to check progress…</InlineAlert>
        )}

        {uploadQueue.length > 0 && (
          <UploadQueue
            items={uploadQueue}
            isUploading={isUploading}
            onCancel={cancelUploads}
            onRetry={retryUpload}
            onDismiss={dismissUpload}
          />
        )}

        {loadError ? (
          <InlineAlert
            title="Couldn’t load files"
            action={
              <Button
                size="sm"
                variant="secondary"
                icon={RefreshCw}
                onClick={() => void loadResources(page)}
                className="-my-0.5"
              >
                Try again
              </Button>
            }
          >
            {loadError}
          </InlineAlert>
        ) : isLoading ? (
          <Spinner label="Loading files…" className="py-16" />
        ) : resources.length === 0 ? (
          <EmptyDropzone
            isDragging={isDragging}
            isUploading={isUploading}
            formatsHint={formatsHint}
            onBrowse={openFilePicker}
          />
        ) : null}

        {showList && (
          <div>
            <ul
              aria-label="Course files"
              className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card"
            >
              {resources.map((resource) => (
                <ResourceRow
                  key={resourceKey(resource)}
                  resource={resource}
                  showStatus={showTutorColumn}
                  isDeleting={deletingResourceId === identifierFor(resource)}
                  removeDisabled={Boolean(deletingResourceId)}
                  onRemove={setResourceToDelete}
                />
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <p className="min-w-0 text-[13px] text-stone-500">
                <span className="tabular-nums">
                  {totalPages > 1
                    ? `${formatFileSize(pageSize)} on this page · Page ${page} of ${totalPages}`
                    : `${formatFileSize(pageSize)} in total`}
                </span>
                <span className="text-stone-400"> · Drag files onto this list to add more</span>
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    icon={ChevronLeft}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1 || isLoading}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    iconRight={ChevronRight}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    disabled={page >= totalPages || isLoading}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isDragging && <DropOverlay formatsHint={formatsHint} />}

      <ConfirmDialog
        open={resourceToDelete !== null}
        title="Remove this file?"
        description={
          resourceToDelete
            ? `“${resourceToDelete.fileName}” will be removed from this course, and learners will no longer see it in linked study plans. This can’t be undone.${
                resourceToDelete.knowledgeBase != null
                  ? ' Sina will stop using it from learners’ next question.'
                  : ''
              }`
            : ''
        }
        confirmLabel="Remove file"
        onConfirm={() => void confirmDeleteResource()}
        onCancel={() => setResourceToDelete(null)}
      />
    </div>
  );
};

// Course changes remount all mutation state; old requests cannot target new rows.
const ScopedCourseResourcesPanel: React.FC<CourseResourcesPanelProps> = ({ course }) => (
  <CourseResourcesPanel key={course.backendIdentifier || course.id} course={course} />
);

export default ScopedCourseResourcesPanel;
