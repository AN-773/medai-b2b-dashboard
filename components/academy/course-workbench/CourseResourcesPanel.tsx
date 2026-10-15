import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderOpen,
  Loader2,
  Presentation,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
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
import ConfirmationModal from '@/components/ConfirmationModal';
import { SectionLabel } from './shared';
import { useProgressiveCourseResources } from '@/hooks/useProgressiveCourseResources';
import { isTextReady, needsCourseSync, shouldPollResource } from '@/utils/documentProcessing';
import { ResourceProcessingStatus } from './ResourceProcessingStatus';

interface CourseResourcesPanelProps {
  course: TeacherCourse;
}

type ApiRequestError = Error & {
  status?: number;
};

const PAGE_SIZE = 25;

/**
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
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi'];

type UploadItemStatus = 'pending' | 'uploading' | 'done' | 'error' | 'canceled';

interface UploadItem {
  key: string;
  fileName: string;
  fileSize: number;
  isVideo: boolean;
  status: UploadItemStatus;
  percent: number;
  error?: string;
}

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

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const digits = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[exponent]}`;
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'text/markdown': 'MD',
};

const fileTypeLabel = (value: string, fileName: string) => {
  const trimmed = value.split(';')[0].trim();
  const knownLabel = FILE_TYPE_LABELS[trimmed.toLowerCase()];
  if (knownLabel) return knownLabel;
  const extension = /\.([a-z0-9]{1,10})$/i.exec(fileName)?.[1];
  if (extension) return extension.toUpperCase();
  if (!trimmed) return 'File';
  return trimmed.includes('/') ? trimmed.split('/')[1].toUpperCase() : trimmed;
};

const extensionOf = (fileName: string) =>
  (fileName.split('.').pop() || '').toLowerCase();

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

const iconForResource = (resource: CourseResource) => {
  const type = (resource.fileType || '').toLowerCase();
  const ext = extensionOf(resource.fileName);
  const has = (...needles: string[]) =>
    needles.some((needle) => type.includes(needle) || ext === needle);

  if (has('pdf')) return FileText;
  if (type.startsWith('image/') || has('png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'))
    return FileImage;
  if (type.startsWith('video/') || has(...VIDEO_EXTENSIONS))
    return FileVideo;
  if (type.startsWith('audio/') || has('mp3', 'wav', 'm4a', 'ogg'))
    return FileAudio;
  if (has('spreadsheet', 'excel', 'csv', 'xls', 'xlsx')) return FileSpreadsheet;
  if (has('presentation', 'powerpoint', 'ppt', 'pptx')) return Presentation;
  if (has('zip', 'rar', '7z', 'gzip', 'compressed')) return FileArchive;
  if (has('word', 'document', 'doc', 'docx', 'txt', 'rtf')) return FileText;
  return FileIcon;
};

const resourceKey = (resource: CourseResource) =>
  resource.id || resource.identifier || resource.fileId || resource.fileName;

const identifierFor = (resource: CourseResource) =>
  resource.identifier || resourceIdentifier(resource.id);

/*
 * The tutor column (contracts/course-resources-contract.md, Contracts T1–T3).
 *
 * The Tests service ingests each eligible resource once per course into the
 * knowledge base a learner's tutor searches, and reports where each file stands
 * on `CourseResource.knowledgeBase`. The key is absent when Tests has no agent
 * configured, and then none of this renders: the grid, the header and the copy
 * stay exactly as they were before the feature.
 */

/** Container-based columns account for the workbench/sidebar's available width. */
const RESOURCE_GRID_COLUMNS = 'course-resources-grid';
const RESOURCE_GRID_COLUMNS_WITH_TUTOR = 'course-resources-grid-with-tutor';

const getSyncErrorMessage = (error: unknown) => {
  const status = getStatus(error);
  if (status === 500) {
    return 'Couldn’t send files to the tutor right now — try again in a moment.';
  }
  return error instanceof Error ? error.message : 'Couldn’t send files to the tutor.';
};

const CourseResourcesPanel: React.FC<CourseResourcesPanelProps> = ({ course }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
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

  // The key's presence, not a recognised status, decides the column: absent
  // means Tests has no agent, and then the table is exactly what it was.
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

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || isUploading) return;

      const queue: UploadItem[] = files.map((file, index) => {
        // Type before size, because it is the more useful thing to be told:
        // a teacher whose 900 MB recording is refused for both reasons is not
        // helped by "compress it", and the extension is what they can act on.
        const rejection = rejectionFor(file, acceptedFormats);
        return {
          key: `${index}-${file.name}-${file.size}-${file.lastModified}`,
          fileName: file.name,
          fileSize: file.size,
          isVideo: isVideoFile(file),
          status: rejection ? 'error' : 'pending',
          percent: 0,
          error: rejection ?? undefined,
        };
      });

      cancelRequestedRef.current = false;
      setUploadQueue(queue);
      setDeleteError(null);
      setStatusMessage(null);
      setIsUploading(true);

      let uploadedCount = 0;
      let lastUploadedName = '';
      // Whether the Tests service said the tutor will index what landed. Only
      // then does the success copy mention the tutor — and not for a file Tests
      // already reported it cannot send, which its row chip explains instead.
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

      // Finished rows would only repeat what the table below now shows, so keep
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

  const openFilePicker = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    void uploadFiles(files);
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    if (isUploading) return;
    dragDepth.current += 1;
    setIsDragging(true);
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

  const refreshButton = (
    <button
      type="button"
      onClick={refreshResources}
      disabled={isLoading}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw size={14} className={isLoading ? 'animate-spin' : undefined} />
      Refresh
    </button>
  );

  return (
    <div className="course-resources-panel space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16324F] text-white">
            <FolderOpen size={16} />
          </div>
          <div>
            <SectionLabel>Course resources</SectionLabel>
            <h3 className="text-lg font-black tracking-tight text-slate-900">
              Files learners can open
            </h3>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              Anything you add here appears in every study plan linked to this
              course.
            </p>
          </div>
        </div>

        {/* The wrapper exists only with the sync action, so a deployment with no
            tutor keeps the header's markup exactly as it was. */}
        {showSyncButton ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void syncToTutor()}
              disabled={isSyncing || isLoading}
              title="Start or retry processing for course files"
              className="inline-flex items-center gap-2 rounded-lg border border-[#1BD183]/40 bg-[#1BD183]/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-800 transition hover:border-[#1BD183] hover:bg-[#1BD183]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSyncing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              Process files
            </button>
            {refreshButton}
          </div>
        ) : (
          refreshButton
        )}
      </div>

      {/* Upload drop zone */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          // Omitted entirely when the agent could not be asked, rather than set
          // to a guessed list: an `accept` built from nothing would hide files
          // the parser reads. A drop is checked by `rejectionFor` either way —
          // this attribute only makes the browser's own picker agree with it.
          {...(acceptedFormats
            ? { accept: uploadAcceptAttribute(acceptedFormats) }
            : {})}
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openFilePicker();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-disabled={isUploading}
          className={`flex flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed px-6 py-9 text-center transition ${
            isUploading
              ? 'cursor-progress border-slate-200 bg-slate-50'
              : isDragging
                ? 'cursor-copy border-[#1BD183] bg-[#1BD183]/10'
                : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-[#1BD183] hover:bg-[#1BD183]/5'
          }`}
        >
          <div className="pointer-events-none flex flex-col items-center">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                isDragging
                  ? 'bg-[#1BD183] text-[#06241a]'
                  : 'bg-white text-[#16324F] shadow-sm'
              }`}
            >
              {isUploading ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <UploadCloud size={22} />
              )}
            </div>
            <p className="mt-4 text-sm font-black text-slate-800">
              {isUploading
                ? 'Uploading…'
                : isDragging
                  ? 'Drop to upload'
                  : 'Drag files here, or click to browse'}
            </p>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
              {acceptedFormats
                ? `Readings, slides and handouts — ${formatSuffixLabels(acceptedFormats).join(', ')}, up to ${AGENT_MAX_UPLOAD_SIZE_LABEL} each.`
                : `Readings, slides and handouts, up to ${AGENT_MAX_UPLOAD_SIZE_LABEL} each.`}{' '}
              Uploads start right away — no publish step.
            </p>
          </div>
        </div>

        {/* Upload queue — one row per file, so a long video shows real progress */}
        {uploadQueue.length > 0 && (
          <div className="mt-3 space-y-2 rounded-[1.25rem] border border-slate-200 bg-white p-3">
            {uploadQueue.map((item) => {
              const Icon =
                item.status === 'done'
                  ? Check
                  : item.status === 'error'
                    ? AlertTriangle
                    : item.isVideo
                      ? FileVideo
                      : FileIcon;
              return (
                <div key={item.key} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                        item.status === 'done'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.status === 'error'
                            ? 'bg-rose-100 text-rose-600'
                            : 'bg-white text-slate-500'
                      }`}
                    >
                      <Icon size={15} />
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                      {item.fileName}
                    </p>
                    <p className="flex-shrink-0 text-xs font-black tabular-nums text-slate-500">
                      {item.status === 'uploading'
                        ? `${item.percent}%`
                        : item.status === 'pending'
                          ? 'Queued'
                          : item.status === 'canceled'
                            ? 'Canceled'
                            : formatFileSize(item.fileSize)}
                    </p>
                    {item.status === 'uploading' && (
                      <button
                        type="button"
                        onClick={cancelUploads}
                        title="Cancel upload"
                        className="flex-shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                      >
                        Cancel
                      </button>
                    )}
                    {!isUploading &&
                      (item.status === 'error' || item.status === 'canceled') && (
                        <button
                          type="button"
                          onClick={() =>
                            setUploadQueue((current) =>
                              current.filter((entry) => entry.key !== item.key),
                            )
                          }
                          title="Dismiss"
                          className="flex-shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                        >
                          <X size={14} />
                        </button>
                      )}
                  </div>

                  {item.status === 'uploading' && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] transition-[width] duration-200"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  )}
                  {item.error && (
                    <p className="mt-1.5 text-xs font-medium leading-5 text-rose-600">
                      {item.error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {statusMessage && (
          <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">
            {statusMessage}
          </p>
        )}
        {deleteError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <p className="font-medium">{deleteError}</p>
          </div>
        )}
        {syncError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <p className="font-medium">{syncError}</p>
          </div>
        )}
      </div>

      {/* Attached files */}
      <section>
        <div className="flex items-center gap-2">
          <SectionLabel>Attached files</SectionLabel>
          {total > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
              {total}
            </span>
          )}
          {hasProcessing && (
            <span className="text-xs font-medium text-slate-500">
              Processing files…
            </span>
          )}
        </div>

        <div role="status" aria-live="polite">
          {connectionStale && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Reconnecting to check progress…
          </p>}
        </div>

        <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
          {loadError ? (
            <div className="flex flex-col items-start gap-4 px-5 py-6">
              <div className="flex items-start gap-3 text-rose-700">
                <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                <p className="font-semibold">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadResources(page)}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-100"
              >
                <RefreshCw size={14} />
                Try again
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm font-semibold text-slate-500">
              <Loader2 size={16} className="mr-2 animate-spin" />
              Loading files…
            </div>
          ) : resources.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
              <FolderOpen size={30} className="text-slate-300" />
              <p className="mt-4 text-sm font-black text-slate-700">
                No files yet
              </p>
              <p className="mt-2 max-w-md text-xs font-medium leading-5 text-slate-500">
                Add the readings, slides and handouts learners should be able to
                open from this course.
              </p>
            </div>
          ) : (
            <div>
              <div>
                <div
                  className={`course-resources-header ${
                    showTutorColumn ? RESOURCE_GRID_COLUMNS_WITH_TUTOR : RESOURCE_GRID_COLUMNS
                  } gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400`}
                >
                  <p>File</p>
                  <p>Type</p>
                  <p>Size</p>
                  {showTutorColumn && <p>Status</p>}
                  <p>Added</p>
                  <p className="text-right">Action</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {resources.map((resource) => {
                    const Icon = iconForResource(resource);
                    const identifier = identifierFor(resource);
                    const isDeleting = deletingResourceId === identifier;
                    const textUnavailable = resource.knowledgeBase != null && !isTextReady(resource.knowledgeBase);
                    return (
                      <div
                        key={resourceKey(resource)}
                        className={`grid grid-cols-2 ${
                          showTutorColumn
                            ? RESOURCE_GRID_COLUMNS_WITH_TUTOR
                            : RESOURCE_GRID_COLUMNS
                        } items-center gap-4 px-5 py-4 ${textUnavailable ? 'bg-slate-50/70' : ''}`}
                      >
                        <div className="course-resources-wide flex min-w-0 items-center gap-3">
                          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 ${textUnavailable ? 'text-slate-300' : 'text-slate-500'}`}>
                            <Icon size={16} />
                          </div>
                          <p title={resource.fileName} className={`min-w-0 break-words text-sm font-semibold ${textUnavailable ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {resource.fileName}
                          </p>
                        </div>
                        <p title={resource.fileType} className="min-w-0 break-words text-sm font-medium text-slate-600">
                          <span className="course-resources-mobile-label mr-1 text-xs text-slate-500">Type:</span>
                          {fileTypeLabel(resource.fileType, resource.fileName)}
                        </p>
                        <p className="whitespace-nowrap text-sm font-medium text-slate-600">
                          <span className="course-resources-mobile-label mr-1 text-xs text-slate-500">Size:</span>
                          {formatFileSize(resource.fileSize)}
                        </p>
                        {showTutorColumn && (
                          <div className="course-resources-wide min-w-0">
                            <ResourceProcessingStatus resource={resource} />
                          </div>
                        )}
                        <p className="min-w-0 break-words text-sm font-medium text-slate-600">
                          <span className="course-resources-mobile-label mr-1 text-xs text-slate-500">Added:</span>
                          {formatTimestamp(resource.createdAt)}
                        </p>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setResourceToDelete(resource)}
                            disabled={Boolean(deletingResourceId)}
                            title="Remove file"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {!loadError && resources.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">
              {total} file{total === 1 ? '' : 's'} · {formatFileSize(pageSize)} on
              this page
              {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || isLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={page >= totalPages || isLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <ConfirmationModal
        isOpen={resourceToDelete !== null}
        variant="danger"
        title="Remove file"
        message={
          resourceToDelete
            ? `Remove “${resourceToDelete.fileName}”? Learners will no longer see it in study plans linked to this course. This can’t be undone.${
                resourceToDelete.knowledgeBase != null
                  ? ' Their tutor will stop using it from their next question.'
                  : ''
              }`
            : ''
        }
        confirmLabel="Remove file"
        cancelLabel="Keep file"
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
