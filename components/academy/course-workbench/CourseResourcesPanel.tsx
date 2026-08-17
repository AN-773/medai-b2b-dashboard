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
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import type { TeacherCourse } from '@/types/AcademyStudioTypes';
import { courseResourceService } from '@/services/courseResourceService';
import type { CourseResource } from '@/types/CourseResourceTypes';
import { resourceIdentifier } from '@/utils/resourceId';
import { BlobUploadAbortedError } from '@/utils/blockBlobUpload';
import ConfirmationModal from '@/components/ConfirmationModal';
import { SectionLabel } from './shared';

interface CourseResourcesPanelProps {
  course: TeacherCourse;
}

type ApiRequestError = Error & {
  status?: number;
};

const PAGE_SIZE = 25;

/**
 * Videos go straight to blob storage, so the ceiling is what a teacher can
 * realistically push over a campus uplink rather than a backend limit. The
 * Tests service enforces the same cap (COURSE_RESOURCE_MAX_UPLOAD_BYTES);
 * checking here as well means nobody waits out an hour-long upload to be told
 * no at the end.
 */
const MAX_VIDEO_BYTES = 2 * 1024 ** 3;
const MAX_VIDEO_SIZE_LABEL = '2 GB';

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

const getListErrorMessage = (error: unknown) => {
  const status = getStatus(error);
  if (status === 404) return "We couldn't find this course.";
  if (status === 500) {
    return "Couldn't load files right now — try again in a moment.";
  }
  return error instanceof Error ? error.message : "Couldn't load files.";
};

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

const fileTypeLabel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'File';
  return trimmed.includes('/') ? trimmed.split('/')[1].toUpperCase() : trimmed;
};

const extensionOf = (fileName: string) =>
  (fileName.split('.').pop() || '').toLowerCase();

const isVideoFile = (file: File) =>
  file.type.toLowerCase().startsWith('video/') ||
  VIDEO_EXTENSIONS.includes(extensionOf(file.name));

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

const CourseResourcesPanel: React.FC<CourseResourcesPanelProps> = ({ course }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const courseIdentifier = useMemo(
    () => course.backendIdentifier || resourceIdentifier(course.id),
    [course.backendIdentifier, course.id],
  );
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<CourseResource | null>(
    null,
  );
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageSize = useMemo(
    () => resources.reduce((sum, resource) => sum + (resource.fileSize || 0), 0),
    [resources],
  );

  const loadResources = useCallback(
    async (pageToLoad: number) => {
      setIsLoading(true);
      try {
        const response = await courseResourceService.listTeacherCourseResources(
          courseIdentifier,
          { page: pageToLoad, limit: PAGE_SIZE },
        );
        setResources(response.resources ?? []);
        setTotal(response.total ?? 0);
        setPage(response.page ?? pageToLoad);
        setLoadError(null);
      } catch (error) {
        setResources([]);
        setTotal(0);
        setLoadError(getListErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [courseIdentifier],
  );

  useEffect(() => {
    setPage(1);
    setResources([]);
    setTotal(0);
    setLoadError(null);
    setDeleteError(null);
    setStatusMessage(null);
    setUploadQueue([]);
  }, [course.id]);

  useEffect(() => {
    void loadResources(page);
  }, [loadResources, page]);

  // A video upload can outlast the teacher's patience with the tab, and closing
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
        const isVideo = isVideoFile(file);
        const tooLarge = isVideo && file.size > MAX_VIDEO_BYTES;
        return {
          key: `${index}-${file.name}-${file.size}-${file.lastModified}`,
          fileName: file.name,
          fileSize: file.size,
          isVideo,
          status: tooLarge ? 'error' : 'pending',
          percent: 0,
          error: tooLarge
            ? `This video is ${formatFileSize(file.size)} — the limit is ${MAX_VIDEO_SIZE_LABEL}. Compress it or split it into shorter clips.`
            : undefined,
        };
      });

      cancelRequestedRef.current = false;
      setUploadQueue(queue);
      setDeleteError(null);
      setStatusMessage(null);
      setIsUploading(true);

      let uploadedCount = 0;
      let lastUploadedName = '';

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
        setStatusMessage(
          uploadedCount === 1
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
    [courseIdentifier, isUploading, loadResources, page, updateUploadItem],
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

  return (
    <div className="space-y-7">
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

        <button
          type="button"
          onClick={() => void loadResources(page)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : undefined} />
          Refresh
        </button>
      </div>

      {/* Upload drop zone */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
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
              PDFs, slides, handouts, and lecture videos (MP4, MOV, WebM — up to{' '}
              {MAX_VIDEO_SIZE_LABEL}). Uploads start right away — no publish
              step.
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
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            {statusMessage}
          </p>
        )}
        {deleteError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <p className="font-medium">{deleteError}</p>
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
                Add the readings, slides, handouts, and lecture videos learners
                should be able to open from this course.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[minmax(0,1.8fr)_120px_110px_190px_110px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  <p>File</p>
                  <p>Type</p>
                  <p>Size</p>
                  <p>Added</p>
                  <p className="text-right">Action</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {resources.map((resource) => {
                    const Icon = iconForResource(resource);
                    const identifier = identifierFor(resource);
                    const isDeleting = deletingResourceId === identifier;
                    return (
                      <div
                        key={resourceKey(resource)}
                        className="grid grid-cols-[minmax(0,1.8fr)_120px_110px_190px_110px] items-center gap-4 px-5 py-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <Icon size={16} />
                          </div>
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {resource.fileName}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-slate-600">
                          {fileTypeLabel(resource.fileType)}
                        </p>
                        <p className="text-sm font-medium text-slate-600">
                          {formatFileSize(resource.fileSize)}
                        </p>
                        <p className="text-sm font-medium text-slate-600">
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
            ? `Remove “${resourceToDelete.fileName}”? Learners will no longer see it in study plans linked to this course. This can’t be undone.`
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

export default CourseResourcesPanel;
