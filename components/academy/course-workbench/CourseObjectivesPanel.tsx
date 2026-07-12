import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import { testsService } from '@/services/testsService';
import type { TeacherCourse, TeacherLearningObjective } from '@/types/AcademyStudioTypes';
import type {
  LearningObjective,
  OrganSystem,
  Syndrome,
  Topic,
} from '@/types/TestsServiceTypes';
import type { SuggestionStatus } from '@/types/CourseStudioTypes';
import type { UploadGroup, useCourseFactory } from '@/hooks/useCourseFactory';
import { bloomStyle, getCourseObjectiveCount, SectionLabel } from './shared';
import CreateCourseObjectiveModal from './CreateCourseObjectiveModal';
import SuggestionReviewCard from './SuggestionReviewCard';
import ConfirmationModal from '@/components/ConfirmationModal';

type CourseFactory = ReturnType<typeof useCourseFactory>;

type SearchLearningObjective = LearningObjective & {
  source?: string;
  organSystem?: { title?: string } | null;
};

const normalizeSearchLearningObjective = (
  objective: SearchLearningObjective,
): TeacherLearningObjective => ({
  id: objective.id,
  title: objective.title,
  organSystem:
    objective.organSystem?.title ||
    objective.syndrome?.topic?.organSystem?.title ||
    undefined,
  cognitiveSkill: objective.cognitiveSkill?.title || undefined,
  source: objective.source === 'ai' ? 'ai' : 'manual',
  createdAt: objective.createdAt || new Date().toISOString(),
});

const STATUS_FILTERS: { value: SuggestionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

/** Suggested objectives per page — a single source can yield 200+ suggestions. */
const SUGGESTIONS_PER_PAGE = 20;
const CATALOG_PAGE_SIZE = 25;
const ATTACHED_OBJECTIVES_PAGE_SIZE = 25;
const catalogSelectClass =
  'w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#1BD183] focus:bg-white focus:ring-2 focus:ring-[#1BD183]/15 disabled:cursor-not-allowed disabled:opacity-50';

const UPLOAD_STATUS_META: Record<
  UploadGroup['status'],
  { label: string; className: string }
> = {
  processing: { label: 'Processing', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { label: 'Failed', className: 'bg-rose-50 text-rose-600 border-rose-200' },
  empty: { label: 'No suggestions', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

interface CourseObjectivesPanelProps {
  course: TeacherCourse;
  attachedIds: Set<string>;
  /** Objective AI factory (upload sources → review suggestions). */
  factory: CourseFactory;
  isGenerateOpen: boolean;
  onGenerateOpenChange: (open: boolean) => void;
  onAttach: (objective: TeacherLearningObjective) => Promise<void>;
  onAddAll: (filters: {
    q?: string;
    organSystemId?: string;
    topicId?: string;
    syndromeId?: string;
  }) => Promise<{ matched: number; added: number; alreadyAttached: number }>;
  onCreate: (objective: TeacherLearningObjective) => Promise<void>;
  onRemove: (objective: TeacherLearningObjective) => Promise<void>;
  /** Jump to the Content tab with this objective preselected. */
  onBuildContent?: (objective: TeacherLearningObjective) => void;
}

const CourseObjectivesPanel: React.FC<CourseObjectivesPanelProps> = ({
  course,
  attachedIds,
  factory,
  isGenerateOpen,
  onGenerateOpenChange,
  onAttach,
  onAddAll,
  onCreate,
  onRemove,
  onBuildContent,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TeacherLearningObjective[]>([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [attachedPage, setAttachedPage] = useState(1);
  const [isSearching, setSearching] = useState(false);
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);
  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [syndromes, setSyndromes] = useState<Syndrome[]>([]);
  const [selectedOrganSystemId, setSelectedOrganSystemId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedSyndromeId, setSelectedSyndromeId] = useState('');
  const [isLoadingOrganSystems, setIsLoadingOrganSystems] = useState(false);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingSyndromes, setIsLoadingSyndromes] = useState(false);
  const objectiveCount = getCourseObjectiveCount(course);
  const trimmedQuery = query.trim();
  const hasHierarchyFilter = Boolean(
    selectedOrganSystemId || selectedTopicId || selectedSyndromeId,
  );
  const shouldApplyQuery =
    trimmedQuery.length >= 2 || (hasHierarchyFilter && trimmedQuery.length > 0);
  const hasActiveCatalogInputs = hasHierarchyFilter || trimmedQuery.length >= 2;
  const totalCatalogPages = Math.max(
    1,
    Math.ceil(resultsTotal / CATALOG_PAGE_SIZE),
  );
  const totalAttachedPages = Math.max(
    1,
    Math.ceil(course.learningObjectives.length / ATTACHED_OBJECTIVES_PAGE_SIZE),
  );
  const attachedPageStart = (attachedPage - 1) * ATTACHED_OBJECTIVES_PAGE_SIZE;
  const attachedPageObjectives = useMemo(
    () =>
      course.learningObjectives.slice(
        attachedPageStart,
        attachedPageStart + ATTACHED_OBJECTIVES_PAGE_SIZE,
      ),
    [attachedPageStart, course.learningObjectives],
  );
  const attachedRangeStart =
    course.learningObjectives.length === 0 ? 0 : attachedPageStart + 1;
  const attachedRangeEnd =
    course.learningObjectives.length === 0
      ? 0
      : Math.min(
          course.learningObjectives.length,
          attachedPageStart + ATTACHED_OBJECTIVES_PAGE_SIZE,
        );

  // --- AI factory (generate from sources) -----------------------------------
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus>('pending');
  const [suggestionPage, setSuggestionPage] = useState(1);
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

  useEffect(() => {
    setQuery('');
    setResults([]);
    setResultsTotal(0);
    setCatalogPage(1);
    setAttachedPage(1);
    setSelectedOrganSystemId('');
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setTopics([]);
    setSyndromes([]);
    setSearching(false);

    let cancelled = false;
    setIsLoadingOrganSystems(true);
    void testsService
      .getOrganSystems(1, 200, undefined, course.curriculumId || undefined)
      .then((response) => {
        if (cancelled) return;
        setOrganSystems(response.items || []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load catalog organ systems:', error);
        setOrganSystems([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingOrganSystems(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [course.id, course.curriculumId]);

  useEffect(() => {
    setCatalogPage(1);
  }, [query, selectedOrganSystemId, selectedTopicId, selectedSyndromeId, course.id]);

  useEffect(() => {
    setCatalogPage((current) => Math.min(current, totalCatalogPages));
  }, [totalCatalogPages]);

  useEffect(() => {
    setAttachedPage((current) => Math.min(current, totalAttachedPages));
  }, [totalAttachedPages]);

  useEffect(() => {
    if (!hasActiveCatalogInputs) {
      setResults([]);
      setResultsTotal(0);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void testsService
        .listLearningObjectiveCatalog({
          page: catalogPage,
          limit: CATALOG_PAGE_SIZE,
          q: shouldApplyQuery ? trimmedQuery : undefined,
          curriculumId: course.curriculumId || undefined,
          organSystemId: selectedOrganSystemId || undefined,
          topicId: selectedTopicId || undefined,
          syndromeId: selectedSyndromeId || undefined,
        })
        .then((response) => {
          if (cancelled) return;
          setResults(
            response.items.map((objective) =>
              normalizeSearchLearningObjective(objective as SearchLearningObjective),
            ),
          );
          setResultsTotal(response.total || 0);
        })
        .catch((searchError) => {
          if (cancelled) return;
          console.error('Failed to search learning objectives:', searchError);
          setResults([]);
          setResultsTotal(0);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, trimmedQuery.length > 0 ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    catalogPage,
    catalogRefreshKey,
    course.curriculumId,
    hasActiveCatalogInputs,
    selectedOrganSystemId,
    selectedSyndromeId,
    selectedTopicId,
    shouldApplyQuery,
    trimmedQuery,
  ]);

  const handleOrganSystemChange = async (organSystemId: string) => {
    setSelectedOrganSystemId(organSystemId);
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setTopics([]);
    setSyndromes([]);
    if (!organSystemId) return;
    setIsLoadingTopics(true);
    try {
      const response = await testsService.getTopics(organSystemId, 1, 200);
      setTopics(response.items || []);
    } catch (error) {
      console.error('Failed to load catalog topics:', error);
      setTopics([]);
    } finally {
      setIsLoadingTopics(false);
    }
  };

  const handleTopicChange = async (topicId: string) => {
    setSelectedTopicId(topicId);
    setSelectedSyndromeId('');
    setSyndromes([]);
    if (!topicId) return;
    setIsLoadingSyndromes(true);
    try {
      const response = await testsService.getSyndromes(topicId, 1, 200);
      setSyndromes(response.items || []);
    } catch (error) {
      console.error('Failed to load catalog syndromes:', error);
      setSyndromes([]);
    } finally {
      setIsLoadingSyndromes(false);
    }
  };

  const handleAddAll = async () => {
    if (!hasActiveCatalogInputs || isAddingAll) return;
    setIsAddingAll(true);
    try {
      await onAddAll({
        q: shouldApplyQuery ? trimmedQuery : undefined,
        organSystemId: selectedOrganSystemId || undefined,
        topicId: selectedTopicId || undefined,
        syndromeId: selectedSyndromeId || undefined,
      });
      setCatalogRefreshKey((current) => current + 1);
    } finally {
      setIsAddingAll(false);
    }
  };

  const runAction = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId(null);
    }
  };

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

  const totalPendingFromAI = useMemo(
    () => uploadGroups.reduce((sum, group) => sum + group.pendingCount, 0),
    [uploadGroups],
  );

  const renderReviewBody = () => {
    if (isLoadingSuggestions || activeGroup?.isLoadingSuggestions) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Loader2 size={22} className="mb-3 animate-spin text-[#1BD183]" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">
            Loading suggestions…
          </p>
        </div>
      );
    }
    if (!activeGroup) {
      return (
        <div className="border-y border-slate-200 px-6 py-12 text-center">
          <FileText size={24} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">
            Select a source to review its suggestions
          </p>
        </div>
      );
    }
    if (activeGroup.status === 'processing') {
      return (
        <div className="border-y border-amber-200 bg-amber-50/60 px-6 py-12 text-center">
          <Loader2 size={24} className="mx-auto mb-3 animate-spin text-amber-600" />
          <p className="text-sm font-bold text-amber-800">
            This source is still processing
          </p>
        </div>
      );
    }
    if (activeGroup.status === 'failed') {
      return (
        <div className="border-y border-rose-200 bg-rose-50/60 px-6 py-12 text-center">
          <AlertTriangle size={24} className="mx-auto mb-3 text-rose-500" />
          <p className="text-sm font-bold text-rose-700">
            This source failed during processing
          </p>
        </div>
      );
    }
    if (activeGroup.status === 'ready' && !activeGroup.suggestionsLoaded) {
      return (
        <div className="border-y border-slate-200 px-6 py-12 text-center">
          <Sparkles size={24} className="mx-auto mb-3 text-[#1BD183]" />
          <p className="text-sm font-bold text-slate-700">Suggestions are ready</p>
          <button
            type="button"
            onClick={() => void refreshSelectedUploadSuggestions()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1BD183] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#06241a] transition hover:brightness-105"
          >
            <RefreshCw size={13} />
            Load suggestions
          </button>
        </div>
      );
    }
    if (visibleSuggestions.length === 0) {
      return (
        <div className="border-y border-slate-200 px-6 py-12 text-center">
          {statusFilter === 'pending' ? (
            <>
              <Upload size={24} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">
                No pending suggestions for this source
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-slate-500">
              No {statusFilter} suggestions for this source.
            </p>
          )}
        </div>
      );
    }
    return (
      <>
        <div className="divide-y divide-slate-100 border-y border-slate-200">
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">
              {visibleSuggestions.length} suggestion
              {visibleSuggestions.length === 1 ? '' : 's'} · page {suggestionPage} of{' '}
              {totalSuggestionPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSuggestionPage((current) => Math.max(1, current - 1))}
                disabled={suggestionPage <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <button
                type="button"
                onClick={() =>
                  setSuggestionPage((current) => Math.min(totalSuggestionPages, current + 1))
                }
                disabled={suggestionPage >= totalSuggestionPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>This course</SectionLabel>
          <h3 className="text-lg font-black tracking-tight text-slate-900">
            {objectiveCount} objective{objectiveCount === 1 ? '' : 's'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300"
          >
            <Plus size={14} /> New objective
          </button>
          <button
            type="button"
            onClick={() => onGenerateOpenChange(!isGenerateOpen)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-lg transition active:scale-[0.98] ${
              isGenerateOpen
                ? 'bg-slate-900 shadow-slate-900/20'
                : 'bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] shadow-[#1BD183]/20 hover:shadow-xl hover:shadow-[#1BD183]/30'
            }`}
          >
            <Sparkles size={14} /> Generate from sources
            {totalPendingFromAI > 0 && (
              <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] leading-none">
                {totalPendingFromAI}
              </span>
            )}
            {isGenerateOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>
      </div>

      {/* AI factory section (collapsible) */}
      {isGenerateOpen && (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionLabel>Objective factory</SectionLabel>
              <p className="mt-1 max-w-xl text-xs font-medium text-slate-500">
                Upload course material and the extractor proposes learning
                objectives with source evidence. Accept to add them to the
                course; nothing is added until you approve it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isLoading}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
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
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-7 text-center transition ${
              isDragging
                ? 'border-[#1BD183] bg-emerald-50/60'
                : 'border-slate-300 bg-white hover:border-[#1BD183] hover:bg-emerald-50/40'
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
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-50 text-[#1BD183]">
              {isUploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <UploadCloud size={20} />
              )}
            </div>
            <p className="mt-2.5 text-sm font-black text-slate-800">
              {isUploading ? 'Uploading…' : 'Drop source files or click to upload'}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              PDF, Word, PowerPoint, or text · one or more files
            </p>
          </label>

          {isPolling && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-700">
              <Loader2 size={14} className="animate-spin" />
              Extraction in progress.
            </div>
          )}

          {/* Source chips */}
          {uploadGroups.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {uploadGroups.map((group) => {
                const meta = UPLOAD_STATUS_META[group.status];
                const isActive = selectedUploadId === group.uploadId;
                return (
                  <button
                    key={group.uploadId}
                    type="button"
                    onClick={() => selectUpload(group.uploadId)}
                    className={`inline-flex max-w-[240px] items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                      isActive
                        ? 'border-[#1BD183] bg-emerald-50/60'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <FileText size={14} className="flex-shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">
                      {group.fileName}
                    </span>
                    <span
                      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${meta.className}`}
                    >
                      {group.status === 'processing' && (
                        <Loader2 size={9} className="animate-spin" />
                      )}
                      {group.pendingCount > 0 ? `${group.pendingCount} pending` : meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-rose-500" />
              <p className="flex-1 text-xs font-semibold text-rose-700">{error}</p>
              <button onClick={clearError} className="rounded-lg p-0.5 text-rose-400 hover:bg-rose-100">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Review */}
          {(uploadGroups.length > 0 || isLoading) && (
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                  {STATUS_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setStatusFilter(filter.value)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] transition ${
                        statusFilter === filter.value
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                {activeGroup && activeGroup.pendingCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isBatchBusy}
                      onClick={() => setConfirmAction({ type: 'accept', group: activeGroup })}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#1BD183] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#06241a] transition hover:brightness-105 disabled:opacity-50"
                    >
                      {isBatchBusy ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <CheckCheck size={11} />
                      )}
                      Accept all
                    </button>
                    <button
                      type="button"
                      disabled={isBatchBusy}
                      onClick={() => setConfirmAction({ type: 'reject', group: activeGroup })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                    >
                      <XCircle size={11} />
                      Reject all
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-3">{renderReviewBody()}</div>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-2">
        {/* Search / attach */}
        <section>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Search size={16} />
              </div>
              <div>
                <SectionLabel>Catalog</SectionLabel>
                <h3 className="text-lg font-black tracking-tight text-slate-900">
                  Attach existing objectives
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {course.curriculumId
                    ? 'Scoped to this course curriculum.'
                    : 'Showing the tenant-wide learning objective catalog.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={
                !hasActiveCatalogInputs ||
                isAddingAll ||
                isSearching ||
                resultsTotal === 0
              }
              onClick={() => void handleAddAll()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-[#1BD183] hover:text-[#0f7a4d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAddingAll ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCheck size={13} />
              )}
              Add all
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="relative">
              <select
                value={selectedOrganSystemId}
                onChange={(event) => void handleOrganSystemChange(event.target.value)}
                disabled={isLoadingOrganSystems}
                className={catalogSelectClass}
              >
                <option value="">All organ systems</option>
                {organSystems.map((organSystem) => (
                  <option key={organSystem.id} value={organSystem.id}>
                    {organSystem.title}
                  </option>
                ))}
              </select>
              {isLoadingOrganSystems ? (
                <Loader2
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                />
              ) : (
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              )}
            </div>

            <div className="relative">
              <select
                value={selectedTopicId}
                onChange={(event) => void handleTopicChange(event.target.value)}
                disabled={!selectedOrganSystemId || isLoadingTopics}
                className={catalogSelectClass}
              >
                <option value="">All topics</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </select>
              {isLoadingTopics ? (
                <Loader2
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                />
              ) : (
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              )}
            </div>

            <div className="relative">
              <select
                value={selectedSyndromeId}
                onChange={(event) => setSelectedSyndromeId(event.target.value)}
                disabled={!selectedTopicId || isLoadingSyndromes}
                className={catalogSelectClass}
              >
                <option value="">All syndromes</option>
                {syndromes.map((syndrome) => (
                  <option key={syndrome.id} value={syndrome.id}>
                    {syndrome.title}
                  </option>
                ))}
              </select>
              {isLoadingSyndromes ? (
                <Loader2
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                />
              ) : (
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              )}
            </div>
          </div>

          <div className="relative mt-4">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the learning objective catalog…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/15 placeholder:text-slate-400"
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <span>
              {hasActiveCatalogInputs
                ? `${resultsTotal} matching objective${resultsTotal === 1 ? '' : 's'}`
                : 'Set a filter or type at least 2 characters to browse the catalog.'}
            </span>
            {hasHierarchyFilter || trimmedQuery.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSelectedOrganSystemId('');
                  setSelectedTopicId('');
                  setSelectedSyndromeId('');
                  setTopics([]);
                  setSyndromes([]);
                }}
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:text-slate-700"
              >
                <XCircle size={12} />
                Clear filters
              </button>
            ) : null}
          </div>

          <div className="mt-4 max-h-[420px] divide-y divide-slate-100 overflow-y-auto border-t border-slate-200 pr-1 custom-scrollbar">
            {isSearching && (
              <div className="flex items-center gap-2 px-1 py-3 text-sm font-semibold text-slate-500">
                <Loader2 size={15} className="animate-spin" /> Searching…
              </div>
            )}

            {!isSearching && hasActiveCatalogInputs && results.length === 0 && (
              <div className="px-1 py-10 text-center text-sm font-semibold text-slate-500">
                No objectives matched the current catalog filters.
              </div>
            )}

            {!isSearching && !hasActiveCatalogInputs && (
              <div className="px-1 py-10 text-center text-sm font-medium text-slate-500">
                Choose an organ system, topic, syndrome, or type at least 2
                characters to search the catalog.
              </div>
            )}

            {results.map((objective) => {
              const isAttached = attachedIds.has(objective.id);
              return (
                <div key={objective.id} className="px-1 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{objective.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {objective.organSystem && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {objective.organSystem}
                          </span>
                        )}
                        {objective.cognitiveSkill && (
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${bloomStyle(objective.cognitiveSkill)}`}
                          >
                            {objective.cognitiveSkill}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isAttached || busyId === objective.id}
                      onClick={() => void runAction(objective.id, () => onAttach(objective))}
                      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                        isAttached
                          ? 'cursor-not-allowed bg-emerald-50 text-emerald-600'
                          : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50'
                      }`}
                    >
                      {busyId === objective.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : isAttached ? (
                        <Check size={13} />
                      ) : (
                        <Plus size={13} />
                      )}
                      {isAttached ? 'Added' : 'Attach'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hasActiveCatalogInputs && totalCatalogPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-500">
                Page {catalogPage} of {totalCatalogPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={catalogPage <= 1 || isSearching}
                  onClick={() => setCatalogPage((current) => Math.max(1, current - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-[#1BD183] hover:text-[#0f7a4d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={12} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={catalogPage >= totalCatalogPages || isSearching}
                  onClick={() =>
                    setCatalogPage((current) =>
                      Math.min(totalCatalogPages, current + 1),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-[#1BD183] hover:text-[#0f7a4d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Attached list */}
        <section className="border-t border-slate-200 pt-8 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1BD183] text-[#06241a]">
              <BookOpen size={16} />
            </div>
            <div>
              <SectionLabel>This course</SectionLabel>
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                {objectiveCount} objective{objectiveCount === 1 ? '' : 's'}
              </h3>
            </div>
          </div>

          <div className="mt-5 max-h-[460px] divide-y divide-slate-100 overflow-y-auto border-t border-slate-200 pr-1 custom-scrollbar">
            {course.learningObjectives.length === 0 ? (
              <div className="px-1 py-14 text-center text-sm font-semibold text-slate-500">
                No objectives yet. Attach from the catalog, create a new one, or
                generate them from your source material above.
              </div>
            ) : (
              attachedPageObjectives.map((objective) => (
                <div key={objective.id} className="px-1 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{objective.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {objective.organSystem && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {objective.organSystem}
                          </span>
                        )}
                        {objective.cognitiveSkill && (
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${bloomStyle(objective.cognitiveSkill)}`}
                          >
                            {objective.cognitiveSkill}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {onBuildContent && (
                        <button
                          type="button"
                          onClick={() => onBuildContent(objective)}
                          title="Build content for this objective"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-[#1BD183] hover:text-[#0f7a4d]"
                        >
                          <Layers size={13} /> Content
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === objective.id}
                        onClick={() => void runAction(objective.id, () => onRemove(objective))}
                        title="Remove from course"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        {busyId === objective.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {course.learningObjectives.length > 0 && totalAttachedPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Showing {attachedRangeStart}-{attachedRangeEnd} of{' '}
                  {course.learningObjectives.length}
                </p>
                <p className="text-[11px] font-semibold text-slate-400">
                  Page {attachedPage} of {totalAttachedPages}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={attachedPage <= 1}
                  onClick={() => setAttachedPage((current) => Math.max(1, current - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-[#1BD183] hover:text-[#0f7a4d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={12} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={attachedPage >= totalAttachedPages}
                  onClick={() =>
                    setAttachedPage((current) =>
                      Math.min(totalAttachedPages, current + 1),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-[#1BD183] hover:text-[#0f7a4d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <CreateCourseObjectiveModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        course={course}
        onCreated={onCreate}
      />

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

export default CourseObjectivesPanel;
