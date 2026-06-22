import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import type { SuggestionStatus } from '@/types/CourseStudioTypes';
import type { UploadGroup, useCourseFactory } from '@/hooks/useCourseFactory';
import ConfirmationModal from '@/components/ConfirmationModal';
import SuggestionReviewCard from './SuggestionReviewCard';
import { SectionLabel } from './shared';

type Factory = ReturnType<typeof useCourseFactory>;

interface CourseFactoryPanelProps {
  factory: Factory;
}

const STATUS_FILTERS: { value: SuggestionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

const UPLOAD_STATUS_META: Record<
  UploadGroup['status'],
  { label: string; className: string }
> = {
  processing: { label: 'Processing', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'Failed', className: 'bg-rose-50 text-rose-600 border-rose-200' },
  empty: { label: 'No suggestions', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const CourseFactoryPanel: React.FC<CourseFactoryPanelProps> = ({ factory }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus>('pending');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'accept' | 'reject';
    group: UploadGroup;
  } | null>(null);

  const {
    uploadGroups,
    isLoading,
    isUploading,
    isPolling,
    isLoadingSuggestions,
    error,
    busySuggestionId,
    busyUploadId,
    selectedUploadId,
    clearError,
    refresh,
    refreshSelectedUploadSuggestions,
    selectUpload,
    upload,
    patchSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    acceptAllForUpload,
    rejectAllForUpload,
  } = factory;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    void upload(Array.from(fileList));
  };

  const activeGroup = useMemo(
    () => uploadGroups.find((group) => group.uploadId === selectedUploadId) || null,
    [uploadGroups, selectedUploadId],
  );

  const visibleSuggestions = useMemo(() => {
    const base = activeGroup ? activeGroup.suggestions : [];
    return base
      .filter((suggestion) => suggestion.status === statusFilter)
      .sort((left, right) => (left.createdAt || '').localeCompare(right.createdAt || ''));
  }, [activeGroup, statusFilter]);

  const filterCounts = useMemo(() => {
    const base = activeGroup ? activeGroup.suggestions : [];
    return base.reduce(
      (counts, suggestion) => {
        counts[suggestion.status] = (counts[suggestion.status] || 0) + 1;
        return counts;
      },
      { pending: 0, accepted: 0, rejected: 0 } as Record<SuggestionStatus, number>,
    );
  }, [activeGroup]);

  return (
    <div className="space-y-8">
      {/* Header + upload */}
      <section>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-2.5">
            <div>
              <SectionLabel>Objective factory</SectionLabel>
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                Upload sources → review AI objectives
              </h3>
              <p className="mt-1 max-w-xl text-xs font-medium text-slate-500">
                Upload course material and the extractor proposes learning
                objectives with source evidence. Accept to promote them into the
                course; nothing is added until you approve it.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Dropzone */}
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFiles(event.dataTransfer.files);
          }}
          className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${
            isDragging
              ? 'border-[#1BD183] bg-emerald-50/60'
              : 'border-slate-300 bg-slate-50 hover:border-[#1BD183] hover:bg-emerald-50/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
            className="hidden"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[#1BD183]">
            {isUploading ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <UploadCloud size={22} />
            )}
          </div>
          <p className="mt-3 text-sm font-black text-slate-800">
            {isUploading ? 'Uploading…' : 'Drop source files or click to upload'}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            PDF, Word, PowerPoint, or text · one or more files
          </p>
        </label>

        {isPolling && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
            <Loader2 size={14} className="animate-spin" />
            Extraction in progress.
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-rose-500" />
            <p className="flex-1 text-xs font-semibold text-rose-700">{error}</p>
            <button onClick={clearError} className="rounded-lg p-0.5 text-rose-400 hover:bg-rose-100">
              <X size={14} />
            </button>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        {/* Uploads rail */}
        <section>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-slate-400" />
              <SectionLabel>Uploads</SectionLabel>
            </div>
            {uploadGroups.length > 0 && (
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {uploadGroups.length} total
              </span>
            )}
          </div>

          <div className="mt-4 divide-y divide-slate-100 border-y border-slate-200">
            {uploadGroups.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs font-semibold text-slate-500">
                No uploads yet.
              </div>
            ) : (
              uploadGroups.map((group) => {
                const meta = UPLOAD_STATUS_META[group.status];
                const isActive = selectedUploadId === group.uploadId;
                const isUploadBusy = busyUploadId === group.uploadId;
                return (
                  <div
                    key={group.uploadId}
                    className={`border-l-2 px-4 py-3 transition ${
                      isActive ? 'border-[#1BD183] bg-emerald-50/50' : 'border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectUpload(group.uploadId)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-start gap-2">
                        <FileText size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />
                        <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                          {group.fileName}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${meta.className}`}
                        >
                          {group.status === 'processing' && (
                            <Loader2 size={9} className="animate-spin" />
                          )}
                          {meta.label}
                        </span>
                        {group.status === 'processing' &&
                          group.progress?.totalChunks ? (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-700">
                            {group.progress.processedChunks ?? 0}/
                            {group.progress.totalChunks} chunks
                          </span>
                        ) : null}
                        {group.pendingCount > 0 && (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-700">
                            {group.pendingCount} pending
                          </span>
                        )}
                        {group.acceptedCount > 0 && (
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-700">
                            {group.acceptedCount} done
                          </span>
                        )}
                      </div>
                    </button>

                    {group.pendingCount > 0 && (
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isUploadBusy}
                          onClick={() => setConfirmAction({ type: 'accept', group })}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#1BD183] px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#06241a] transition hover:brightness-105 disabled:opacity-50"
                        >
                          {isUploadBusy ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <CheckCheck size={11} />
                          )}
                          Accept all
                        </button>
                        <button
                          type="button"
                          disabled={isUploadBusy}
                          onClick={() => setConfirmAction({ type: 'reject', group })}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                        >
                          <XCircle size={11} />
                          Reject all
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Review list */}
        <section className="border-t border-slate-200 pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] transition ${
                    statusFilter === filter.value
                      ? 'bg-white text-slate-900'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {filter.label}
                  <span className="ml-1.5 text-slate-400">{filterCounts[filter.value]}</span>
                </button>
              ))}
            </div>
            {activeGroup && (
              <span className="truncate text-xs font-bold text-slate-500">
                {activeGroup.fileName}
              </span>
            )}
          </div>

          <div className="mt-4">
            {isLoading && uploadGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 size={22} className="mb-3 animate-spin text-[#1BD183]" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Loading uploads…
                </p>
              </div>
            ) : isLoadingSuggestions || activeGroup?.isLoadingSuggestions ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 size={22} className="mb-3 animate-spin text-[#1BD183]" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Loading suggestions…
                </p>
              </div>
            ) : !activeGroup ? (
              <div className="border-y border-slate-200 px-6 py-16 text-center">
                <FileText size={26} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold text-slate-600">
                  Select an upload to review suggestions
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Suggestions are fetched only after a completed upload is selected.
                </p>
              </div>
            ) : activeGroup.status === 'processing' ? (
              <div className="border-y border-amber-200 bg-amber-50/60 px-6 py-16 text-center">
                <Loader2 size={26} className="mx-auto mb-3 animate-spin text-amber-600" />
                <p className="text-sm font-bold text-amber-800">
                  This upload is still processing
                </p>
                <p className="mt-1 text-xs font-medium text-amber-700">
                  Suggestions will load after extraction completes.
                </p>
              </div>
            ) : activeGroup.status === 'failed' ? (
              <div className="border-y border-rose-200 bg-rose-50/60 px-6 py-16 text-center">
                <AlertTriangle size={26} className="mx-auto mb-3 text-rose-500" />
                <p className="text-sm font-bold text-rose-700">
                  This upload failed during processing
                </p>
                <p className="mt-1 text-xs font-medium text-rose-600">
                  Upload the source file again or refresh if the backend retried it.
                </p>
              </div>
            ) : activeGroup.status === 'ready' && !activeGroup.suggestionsLoaded ? (
              <div className="border-y border-slate-200 px-6 py-16 text-center">
                <Sparkles size={26} className="mx-auto mb-3 text-[#1BD183]" />
                <p className="text-sm font-bold text-slate-700">
                  Suggestions are ready to load
                </p>
                <button
                  type="button"
                  onClick={() => void refreshSelectedUploadSuggestions()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1BD183] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#06241a] transition hover:brightness-105"
                >
                  <RefreshCw size={13} />
                  Load suggestions
                </button>
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <div className="border-y border-slate-200 px-6 py-16 text-center">
                {statusFilter === 'pending' ? (
                  <>
                    <Upload size={26} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-bold text-slate-600">
                      No pending suggestions for this upload
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Accept/reject decisions will stay available in the other filters.
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-500">
                    No {statusFilter} suggestions for this upload.
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border-y border-slate-200">
                {visibleSuggestions.map((suggestion) => (
                  <SuggestionReviewCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    isBusy={busySuggestionId === suggestion.id}
                    onSave={(payload) => patchSuggestion(suggestion, payload)}
                    onAccept={() => acceptSuggestion(suggestion)}
                    onReject={() => rejectSuggestion(suggestion)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmationModal
        isOpen={confirmAction !== null}
        variant={confirmAction?.type === 'reject' ? 'danger' : 'info'}
        title={
          confirmAction?.type === 'reject'
            ? 'Reject all suggestions'
            : 'Accept all suggestions'
        }
        message={
          confirmAction
            ? confirmAction.type === 'reject'
              ? `Reject all ${confirmAction.group.pendingCount} pending suggestion${
                  confirmAction.group.pendingCount === 1 ? '' : 's'
                } from “${confirmAction.group.fileName}”? Rejected suggestions are permanent and cannot be accepted later.`
              : `Promote all ${confirmAction.group.pendingCount} pending suggestion${
                  confirmAction.group.pendingCount === 1 ? '' : 's'
                } from “${confirmAction.group.fileName}” into course learning objectives?`
            : ''
        }
        confirmLabel={confirmAction?.type === 'reject' ? 'Reject all' : 'Accept all'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          const { type, group } = confirmAction;
          setConfirmAction(null);
          if (type === 'accept') void acceptAllForUpload(group);
          else void rejectAllForUpload(group);
        }}
      />
    </div>
  );
};

export default CourseFactoryPanel;
