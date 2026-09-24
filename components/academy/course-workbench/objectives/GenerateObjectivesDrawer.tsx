import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  IconButton,
  InlineAlert,
  SegmentedControl,
  Spinner,
  StatusDot,
  cn,
  type BadgeTone,
} from '@/components/ui';
import type { SuggestionStatus } from '@/types/CourseStudioTypes';
import type { UploadGroup, useCourseFactory } from '@/hooks/useCourseFactory';
import SuggestionReviewCard from '../SuggestionReviewCard';
import { PaginationFooter, revealTop } from './ListHelpers';

type CourseFactory = ReturnType<typeof useCourseFactory>;

const STATUS_FILTERS: { value: SuggestionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

/** Suggested objectives per page — a single source can yield 200+ suggestions. */
const SUGGESTIONS_PER_PAGE = 20;

const SpinningLoader: React.FC<{ size?: number; className?: string }> = ({ size, className }) => (
  <Loader2 size={size} className={cn(className, 'animate-spin')} />
);

const UPLOAD_STATUS_META: Record<
  UploadGroup['status'],
  { label: string; tone: BadgeTone; icon?: React.FC<{ size?: number; className?: string }> }
> = {
  processing: { label: 'Processing', tone: 'neutral', icon: SpinningLoader },
  ready: { label: 'Ready', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  empty: { label: 'No suggestions', tone: 'neutral' },
};

const plural = (count: number, noun: string) =>
  `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;

interface GenerateObjectivesDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Objective AI factory (upload sources → review suggestions). */
  factory: CourseFactory;
}

/** Upload course material, then review the objectives AI proposes from it. */
const GenerateObjectivesDrawer: React.FC<GenerateObjectivesDrawerProps> = ({
  open,
  onClose,
  factory,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const reviewRef = useRef<HTMLElement | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus>('pending');
  const [suggestionPage, setSuggestionPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'accept' | 'reject';
    group: UploadGroup;
  } | null>(null);
  const [lastBatchType, setLastBatchType] = useState<'accept' | 'reject' | null>(null);

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

  // True while an accept-all / reject-all is running for the active source —
  // used to lock every per-suggestion action so nothing fires concurrently.
  const isBatchBusy = activeGroup ? busyUploadId === activeGroup.uploadId : false;

  const visibleSuggestions = useMemo(() => {
    const base = activeGroup ? activeGroup.suggestions : [];
    return base
      .filter((suggestion) => suggestion.status === statusFilter)
      .sort((left, right) => (left.createdAt || '').localeCompare(right.createdAt || ''));
  }, [activeGroup, statusFilter]);

  const totalSuggestionPages = Math.max(
    1,
    Math.ceil(visibleSuggestions.length / SUGGESTIONS_PER_PAGE),
  );

  const pagedSuggestions = useMemo(() => {
    const start = (suggestionPage - 1) * SUGGESTIONS_PER_PAGE;
    return visibleSuggestions.slice(start, start + SUGGESTIONS_PER_PAGE);
  }, [visibleSuggestions, suggestionPage]);

  // Reset to the first page whenever the source or status filter changes.
  useEffect(() => {
    setSuggestionPage(1);
  }, [selectedUploadId, statusFilter]);

  // Clamp the page when the list shrinks (e.g. accepting/rejecting suggestions).
  useEffect(() => {
    setSuggestionPage((current) => Math.min(current, totalSuggestionPages));
  }, [totalSuggestionPages]);

  const totalPending = useMemo(
    () => uploadGroups.reduce((sum, group) => sum + group.pendingCount, 0),
    [uploadGroups],
  );

  const statusOptions = STATUS_FILTERS.map((filter) => ({
    ...filter,
    count: !activeGroup
      ? undefined
      : filter.value === 'pending'
        ? activeGroup.pendingCount
        : activeGroup.suggestionsLoaded
          ? filter.value === 'accepted'
            ? activeGroup.acceptedCount
            : activeGroup.rejectedCount
          : undefined,
  }));

  const changeSuggestionPage = (page: number) => {
    setSuggestionPage(page);
    revealTop(reviewRef.current);
  };

  const renderReviewBody = () => {
    if (isLoadingSuggestions || activeGroup?.isLoadingSuggestions) {
      return <Spinner label="Loading suggestions…" className="py-12" />;
    }
    if (!activeGroup) {
      return (
        <EmptyState
          compact
          icon={FileText}
          title="Select a source to review its suggestions"
        />
      );
    }
    if (activeGroup.status === 'processing') {
      return (
        <Spinner
          label="This source is still processing. Suggestions appear here when it’s done."
          className="py-12"
        />
      );
    }
    if (activeGroup.status === 'failed') {
      return (
        <EmptyState compact icon={AlertTriangle} title="This source failed during processing" />
      );
    }
    if (activeGroup.status === 'ready' && !activeGroup.suggestionsLoaded) {
      return (
        <EmptyState
          compact
          icon={Sparkles}
          title="Suggestions are ready"
          action={
            <Button
              size="sm"
              icon={RefreshCw}
              onClick={() => void refreshSelectedUploadSuggestions()}
            >
              Load suggestions
            </Button>
          }
        />
      );
    }
    if (visibleSuggestions.length === 0) {
      return statusFilter === 'pending' ? (
        <EmptyState compact icon={Upload} title="No pending suggestions for this source" />
      ) : (
        <EmptyState compact title={`No ${statusFilter} suggestions for this source`} />
      );
    }
    return (
      <div className="overflow-hidden rounded-xl border border-stone-200">
        <div className="divide-y divide-stone-100">
          {pagedSuggestions.map((suggestion) => (
            <SuggestionReviewCard
              key={suggestion.id}
              suggestion={suggestion}
              isBusy={busySuggestionId === suggestion.id}
              locked={isBatchBusy}
              onSave={(payload) => patchSuggestion(suggestion, payload)}
              onAccept={() => acceptSuggestion(suggestion)}
              onReject={() => rejectSuggestion(suggestion)}
            />
          ))}
        </div>
        {totalSuggestionPages > 1 && (
          <PaginationFooter
            className="border-t border-stone-100 px-4"
            page={suggestionPage}
            pageSize={SUGGESTIONS_PER_PAGE}
            total={visibleSuggestions.length}
            onPageChange={changeSuggestionPage}
          />
        )}
      </div>
    );
  };

  const footerStatus =
    totalPending > 0
      ? `${plural(totalPending, 'suggestion')} waiting for review`
      : uploadGroups.length > 0
        ? 'Nothing waiting for review'
        : 'Upload a source to get started';

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        // While a confirmation is open, Escape should only close the confirmation.
        dismissible={confirmAction === null}
        width="max-w-3xl"
        title="Generate objectives from sources"
        description="Upload course material and AI proposes objectives with evidence. Nothing is added until you accept."
        footer={
          <>
            <p className="min-w-0 flex-1 truncate text-[13px] tabular-nums text-stone-500">
              {footerStatus}
            </p>
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        <div className="space-y-6 px-6 py-5">
          {/* Upload */}
          <div className="space-y-3">
            <button
              type="button"
              data-autofocus
              onClick={() => fileInputRef.current?.click()}
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
              className={cn(
                'flex w-full items-center gap-3.5 rounded-xl border border-dashed px-4 py-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                isDragging
                  ? 'border-brand-500 bg-brand-50/60'
                  : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50',
              )}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                {isUploading ? (
                  <Loader2 size={17} className="animate-spin text-brand-600" />
                ) : (
                  <UploadCloud size={17} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-stone-900">
                  {isUploading ? 'Uploading…' : 'Drop source files or click to upload'}
                </span>
                <span className="block text-[13px] text-stone-500">
                  PDF, Word, PowerPoint or text · one or more files
                </span>
              </span>
            </button>

            {isPolling && (
              <div
                role="status"
                className="flex items-center gap-2 text-[13px] text-amber-800"
              >
                <Loader2 size={14} className="animate-spin text-amber-600" />
                Extraction in progress. New suggestions will appear below.
              </div>
            )}

            {error && (
              <InlineAlert tone="error" onDismiss={clearError}>
                {error}
              </InlineAlert>
            )}
          </div>

          {/* Sources */}
          {(uploadGroups.length > 0 || isLoading) && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-stone-900">
                  Sources
                  {uploadGroups.length > 0 && (
                    <span className="ml-1.5 font-normal tabular-nums text-stone-400">
                      {uploadGroups.length}
                    </span>
                  )}
                </h3>
                <IconButton
                  icon={RefreshCw}
                  label="Refresh sources"
                  size="sm"
                  onClick={() => void refresh()}
                  disabled={isLoading}
                  className={isLoading ? '[&>svg]:animate-spin' : undefined}
                />
              </div>
              {uploadGroups.length === 0 ? (
                <Spinner label="Loading sources…" className="py-8" />
              ) : (
                <ul className="max-h-60 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200 custom-scrollbar">
                  {uploadGroups.map((group) => {
                    const meta = UPLOAD_STATUS_META[group.status];
                    const isActive = selectedUploadId === group.uploadId;
                    return (
                      <li key={group.uploadId}>
                        <button
                          type="button"
                          onClick={() => selectUpload(group.uploadId)}
                          aria-pressed={isActive}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
                            isActive ? 'bg-stone-100' : 'hover:bg-stone-50',
                          )}
                        >
                          <FileText
                            size={16}
                            aria-hidden="true"
                            className={cn(
                              'flex-shrink-0',
                              isActive ? 'text-stone-700' : 'text-stone-400',
                            )}
                          />
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-sm',
                              isActive ? 'font-medium text-stone-900' : 'text-stone-700',
                            )}
                          >
                            {group.fileName}
                          </span>
                          {group.pendingCount > 0 && (
                            <StatusDot tone="amber">
                              <span className="tabular-nums">
                                {group.pendingCount.toLocaleString()}
                              </span>{' '}
                              to review
                            </StatusDot>
                          )}
                          <Badge tone={meta.tone} icon={meta.icon}>
                            {meta.label}
                          </Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* Review */}
          {(uploadGroups.length > 0 || isLoading) && (
            <section ref={reviewRef} className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-stone-900">Review suggestions</h3>
                {activeGroup && (
                  <p className="truncate text-[13px] text-stone-500">
                    From {activeGroup.fileName}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl<SuggestionStatus>
                  label="Suggestion status"
                  options={statusOptions}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
                {activeGroup && activeGroup.pendingCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={XCircle}
                      loading={isBatchBusy && lastBatchType === 'reject'}
                      disabled={isBatchBusy}
                      onClick={() => setConfirmAction({ type: 'reject', group: activeGroup })}
                    >
                      Reject all
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={CheckCheck}
                      loading={isBatchBusy && lastBatchType !== 'reject'}
                      disabled={isBatchBusy}
                      onClick={() => setConfirmAction({ type: 'accept', group: activeGroup })}
                    >
                      Accept all
                    </Button>
                  </div>
                )}
              </div>
              {renderReviewBody()}
            </section>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </Drawer>

      <ConfirmDialog
        open={confirmAction !== null}
        tone={confirmAction?.type === 'reject' ? 'danger' : 'default'}
        title={
          confirmAction?.type === 'reject'
            ? 'Reject all suggestions?'
            : 'Accept all suggestions?'
        }
        description={
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
          setLastBatchType(type);
          if (type === 'accept') void acceptAllForUpload(group);
          else void rejectAllForUpload(group);
        }}
      />
    </>
  );
};

export default GenerateObjectivesDrawer;
