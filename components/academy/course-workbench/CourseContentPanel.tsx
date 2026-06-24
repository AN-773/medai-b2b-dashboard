import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  Pencil,
  GraduationCap,
  Layers,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Target,
  X,
  XCircle,
} from 'lucide-react';
import type { TeacherCourse } from '@/types/AcademyStudioTypes';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import type { SuggestionStatus } from '@/types/CourseStudioTypes';
import type {
  ItemSuggestion,
  ItemSuggestionDraft,
  ItemSuggestionType,
} from '@/types/CourseAITypes';
import { getJobProgress, type ItemFactory } from '@/hooks/useItemFactory';
import { courseAIService } from '@/services/courseAIService';
import ConfirmationModal from '@/components/ConfirmationModal';
import { resourceIdentifier } from '@/utils/resourceId';
import ObjectiveItemsList, {
  ItemModality,
  MODALITIES,
} from './ObjectiveItemsList';
import { bloomStyle, SectionLabel } from './shared';

interface CourseContentPanelProps {
  course: TeacherCourse;
  itemFactory: ItemFactory;
  /** Open the in-page editor to author a brand new item for an objective. */
  onCreateItem: (modality: ItemModality, objectiveId: string) => void;
  /** Open the in-page editor for an existing live item. */
  onOpenItem: (item: BackendApiItem) => void;
  /** Bumped by the host after a manual save so the live list refetches. */
  refreshSignal: number;
}

const ITEM_TYPE_META: Record<ItemSuggestionType, { label: string; short: string }> = {
  mcq: { label: 'Multiple choice', short: 'MCQ' },
  saq: { label: 'Short answer', short: 'SAQ' },
  flashcard: { label: 'Flashcard', short: 'Flashcard' },
  lecture: { label: 'Lecture', short: 'Lecture' },
};

const STATUS_FILTERS: { value: SuggestionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

const COURSE_STATUS_FILTERS: { value: SuggestionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

type ReviewMode = 'by-objective' | 'all';

const REVIEW_MODE_TABS: { value: ReviewMode; label: string }[] = [
  { value: 'by-objective', label: 'Learning Objectives' },
  { value: 'all', label: 'Suggested items' },
];

const DEFAULT_PLAN: Record<ItemSuggestionType, number> = {
  mcq: 0,
  saq: 0,
  flashcard: 0,
  lecture: 0,
};

const VISIBLE_ITEM_TYPES: ItemSuggestionType[] = ['mcq', 'saq', 'flashcard'];
const VISIBLE_MODALITIES = MODALITIES.filter(
  (modality) => modality.type !== 'lecture',
);

const createDefaultPlan = (): Record<ItemSuggestionType, number> => ({
  ...DEFAULT_PLAN,
});

const visiblePlanEntries = (plan: Record<ItemSuggestionType, number>) =>
  VISIBLE_ITEM_TYPES.filter((type) => plan[type] > 0).map((type) => ({
    type,
    count: plan[type],
  }));

const COURSE_REVIEW_PAGE_SIZE = 100;

const EMPTY_COURSE_SUGGESTION_COUNTS: Record<SuggestionStatus, number> = {
  pending: 0,
  accepted: 0,
  rejected: 0,
};

const STATUS_BADGE: Record<SuggestionStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-600 border-rose-200',
};

// --- AI draft rendering -----------------------------------------------------

const cloneItemSuggestionDraft = (draft: ItemSuggestionDraft): ItemSuggestionDraft =>
  JSON.parse(JSON.stringify(draft)) as ItemSuggestionDraft;

const DRAFT_INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/15';

const getDraftEditError = (
  type: ItemSuggestionType,
  draft: ItemSuggestionDraft,
) => {
  if (type === 'mcq') {
    if (!draft.mcq?.stem.trim()) return 'Stem is required.';
    if (!draft.mcq.choices.length) return 'Choices are required.';
    if (draft.mcq.choices.some((choice) => !choice.content.trim())) {
      return 'Every choice needs text.';
    }
    const correctCount = draft.mcq.choices.filter((choice) => choice.isCorrect)
      .length;
    if (correctCount !== 1) return 'Select exactly one correct option.';
  }
  if (type === 'saq') {
    if (!draft.saq?.question.trim()) return 'Question is required.';
    if (!draft.saq.answer.trim()) return 'Answer is required.';
  }
  if (type === 'flashcard') {
    if (!draft.flashcard?.front.trim()) return 'Front is required.';
    if (!draft.flashcard.back.trim()) return 'Back is required.';
  }
  if (type === 'lecture') {
    if (!draft.lecture?.title.trim()) return 'Title is required.';
    if (!draft.lecture.summary.trim()) return 'Summary is required.';
    if (!draft.lecture.content.trim()) return 'Content is required.';
  }
  return null;
};

const ItemDraftBody: React.FC<{ suggestion: ItemSuggestion }> = ({ suggestion }) => {
  const { draft, type } = suggestion;
  if (type === 'mcq' && draft.mcq) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">{draft.mcq.stem}</p>
        <ul className="space-y-1">
          {draft.mcq.choices.map((choice, index) => (
            <li
              key={index}
              className={`flex items-start gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                choice.isCorrect
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <span className="font-black">{String.fromCharCode(65 + index)}.</span>
              <span className="flex-1">
                {choice.content}
                {choice.isCorrect && (
                  <Check size={12} className="ml-1 inline text-emerald-600" />
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (type === 'saq' && draft.saq) {
    return (
      <div className="space-y-1.5 text-sm">
        <p className="font-semibold text-slate-800">{draft.saq.question}</p>
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-black uppercase tracking-[0.12em] text-slate-400">
            Model answer ·{' '}
          </span>
          {draft.saq.answer}
        </p>
      </div>
    );
  }
  if (type === 'flashcard' && draft.flashcard) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
          <p className="font-black uppercase tracking-[0.12em] text-slate-400">Front</p>
          <p className="mt-1 font-semibold text-slate-800">{draft.flashcard.front}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <p className="font-black uppercase tracking-[0.12em] text-slate-400">Back</p>
          <p className="mt-1 text-slate-600">{draft.flashcard.back}</p>
        </div>
      </div>
    );
  }
  if (type === 'lecture' && draft.lecture) {
    return (
      <div className="space-y-1.5 text-sm">
        <p className="font-semibold text-slate-800">{draft.lecture.title}</p>
        <p className="text-xs italic text-slate-500">{draft.lecture.summary}</p>
        <p className="line-clamp-3 text-xs text-slate-600">{draft.lecture.content}</p>
      </div>
    );
  }
  return null;
};

const ItemDraftEditor: React.FC<{
  suggestion: ItemSuggestion;
  draft: ItemSuggestionDraft;
  setDraft: React.Dispatch<React.SetStateAction<ItemSuggestionDraft>>;
}> = ({ suggestion, draft, setDraft }) => {
  if (suggestion.type === 'mcq' && draft.mcq) {
    const updateMCQ = (next: NonNullable<ItemSuggestionDraft['mcq']>) =>
      setDraft((current) => ({ ...current, mcq: next }));
    return (
      <div className="space-y-3">
        <textarea
          value={draft.mcq.stem}
          onChange={(event) =>
            updateMCQ({ ...draft.mcq!, stem: event.target.value })
          }
          rows={2}
          className={DRAFT_INPUT_CLASS}
        />
        <div className="space-y-2">
          {draft.mcq.choices.map((choice, index) => (
            <label
              key={index}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <input
                type="radio"
                checked={choice.isCorrect}
                onChange={() =>
                  updateMCQ({
                    ...draft.mcq!,
                    choices: draft.mcq!.choices.map((candidate, choiceIndex) => ({
                      ...candidate,
                      isCorrect: choiceIndex === index,
                    })),
                  })
                }
                className="h-3.5 w-3.5 flex-shrink-0 border-slate-300 text-[#1BD183] focus:ring-[#1BD183]"
              />
              <span className="w-4 text-xs font-black text-slate-400">
                {String.fromCharCode(65 + index)}.
              </span>
              <input
                value={choice.content}
                onChange={(event) =>
                  updateMCQ({
                    ...draft.mcq!,
                    choices: draft.mcq!.choices.map((candidate, choiceIndex) =>
                      choiceIndex === index
                        ? { ...candidate, content: event.target.value }
                        : candidate,
                    ),
                  })
                }
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none"
              />
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (suggestion.type === 'saq' && draft.saq) {
    return (
      <div className="space-y-2">
        <textarea
          value={draft.saq.question}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              saq: { ...current.saq!, question: event.target.value },
            }))
          }
          rows={2}
          className={DRAFT_INPUT_CLASS}
        />
        <textarea
          value={draft.saq.answer}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              saq: { ...current.saq!, answer: event.target.value },
            }))
          }
          rows={3}
          className={`${DRAFT_INPUT_CLASS} text-xs font-medium`}
        />
      </div>
    );
  }

  if (suggestion.type === 'flashcard' && draft.flashcard) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <textarea
          value={draft.flashcard.front}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              flashcard: { ...current.flashcard!, front: event.target.value },
            }))
          }
          rows={3}
          className={DRAFT_INPUT_CLASS}
        />
        <textarea
          value={draft.flashcard.back}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              flashcard: { ...current.flashcard!, back: event.target.value },
            }))
          }
          rows={3}
          className={`${DRAFT_INPUT_CLASS} text-xs font-medium`}
        />
      </div>
    );
  }

  if (suggestion.type === 'lecture' && draft.lecture) {
    return (
      <div className="space-y-2">
        <input
          value={draft.lecture.title}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              lecture: { ...current.lecture!, title: event.target.value },
            }))
          }
          className={DRAFT_INPUT_CLASS}
        />
        <textarea
          value={draft.lecture.summary}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              lecture: { ...current.lecture!, summary: event.target.value },
            }))
          }
          rows={2}
          className={`${DRAFT_INPUT_CLASS} text-xs font-medium italic`}
        />
        <textarea
          value={draft.lecture.content}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              lecture: { ...current.lecture!, content: event.target.value },
            }))
          }
          rows={5}
          className={`${DRAFT_INPUT_CLASS} text-xs font-medium`}
        />
      </div>
    );
  }

  return null;
};

const ItemReviewCard: React.FC<{
  suggestion: ItemSuggestion;
  isBusy: boolean;
  onSave: (draft: ItemSuggestionDraft) => Promise<boolean>;
  onAccept: () => void;
  onReject: () => void;
}> = ({ suggestion, isBusy, onSave, onAccept, onReject }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<ItemSuggestionDraft>(() =>
    cloneItemSuggestionDraft(suggestion.draft),
  );

  useEffect(() => {
    setIsEditing(false);
    setEditDraft(cloneItemSuggestionDraft(suggestion.draft));
  }, [suggestion.id, suggestion.draft, suggestion.updatedAt]);

  const editError = isEditing
    ? getDraftEditError(suggestion.type, editDraft)
    : null;

  const handleSave = async () => {
    if (editError) return;
    const ok = await onSave(editDraft);
    if (ok) setIsEditing(false);
  };

  return (
    <div className="py-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          {ITEM_TYPE_META[suggestion.type].short}
        </span>
        <div className="flex items-center gap-1.5">
          {suggestion.status === 'pending' && !isEditing && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-[#1BD183] hover:text-[#07895a] disabled:opacity-50"
            >
              <Pencil size={11} />
              Edit
            </button>
          )}
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${STATUS_BADGE[suggestion.status]}`}
          >
            {suggestion.status}
          </span>
        </div>
      </div>

      {isEditing ? (
        <ItemDraftEditor
          suggestion={suggestion}
          draft={editDraft}
          setDraft={setEditDraft}
        />
      ) : (
        <ItemDraftBody suggestion={suggestion} />
      )}

      {editError && (
        <p className="mt-2 text-xs font-semibold text-rose-600">{editError}</p>
      )}

      {suggestion.status === 'pending' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                disabled={isBusy || Boolean(editError)}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1BD183] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#06241a] transition hover:brightness-105 disabled:opacity-50"
              >
                {isBusy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                Save
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setEditDraft(cloneItemSuggestionDraft(suggestion.draft));
                  setIsEditing(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={12} />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isBusy}
                onClick={onAccept}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1BD183] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#06241a] transition hover:brightness-105 disabled:opacity-50"
              >
                {isBusy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                Accept
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={onReject}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
              >
                <XCircle size={12} />
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- Plan editor (shared by per-objective + batch generation) ---------------

const PlanEditor: React.FC<{
  plan: Record<ItemSuggestionType, number>;
  adjustPlan: (type: ItemSuggestionType, delta: number) => void;
}> = ({ plan, adjustPlan }) => (
  <div className="flex flex-wrap items-center gap-2">
    {VISIBLE_ITEM_TYPES.map((type) => (
      <div
        key={type}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1"
      >
        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
          {ITEM_TYPE_META[type].short}
        </span>
        <button
          type="button"
          onClick={() => adjustPlan(type, -1)}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
        >
          <Minus size={12} />
        </button>
        <span className="w-4 text-center text-xs font-black text-slate-700">
          {plan[type]}
        </span>
        <button
          type="button"
          onClick={() => adjustPlan(type, 1)}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
        >
          <Plus size={12} />
        </button>
      </div>
    ))}
  </div>
);

// --- Main panel -------------------------------------------------------------

const CourseContentPanel: React.FC<CourseContentPanelProps> = ({
  course,
  itemFactory,
  onCreateItem,
  onOpenItem,
  refreshSignal,
}) => {
  const [query, setQuery] = useState('');
  const [batchPlan, setBatchPlan] =
    useState<Record<ItemSuggestionType, number>>(createDefaultPlan);
  const [objectivePlan, setObjectivePlan] =
    useState<Record<ItemSuggestionType, number>>(createDefaultPlan);
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus>('pending');
  const [confirmAction, setConfirmAction] = useState<'accept' | 'reject' | null>(null);
  // Objectives ticked for a batch generation run, plus the batch-review confirm.
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [batchConfirm, setBatchConfirm] = useState<'accept' | 'reject' | null>(
    null,
  );
  // Bumped after an AI draft is accepted so the live items list refetches and
  // shows the freshly promoted item. Combined with the host's refreshSignal
  // (bumped after a manual save).
  const [acceptedTick, setAcceptedTick] = useState(0);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('by-objective');
  const [courseStatusFilter, setCourseStatusFilter] =
    useState<SuggestionStatus>('pending');
  const [courseSuggestions, setCourseSuggestions] = useState<ItemSuggestion[]>([]);
  const [courseSuggestionCounts, setCourseSuggestionCounts] = useState<
    Record<SuggestionStatus, number>
  >(EMPTY_COURSE_SUGGESTION_COUNTS);
  const [isLoadingCourseSuggestions, setIsLoadingCourseSuggestions] =
    useState(false);
  const [courseSuggestionError, setCourseSuggestionError] = useState<string | null>(
    null,
  );
  const [courseSuggestionsTick, setCourseSuggestionsTick] = useState(0);

  const objectives = course.learningObjectives;

  const filteredObjectives = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return objectives;
    return objectives.filter(
      (objective) =>
        objective.title.toLowerCase().includes(trimmed) ||
        (objective.organSystem || '').toLowerCase().includes(trimmed),
    );
  }, [objectives, query]);

  const objectiveTitleById = useMemo(() => {
    const titleById = new Map<string, string>();
    objectives.forEach((objective) => {
      titleById.set(objective.id, objective.title);
      titleById.set(resourceIdentifier(objective.id), objective.title);
    });
    return titleById;
  }, [objectives]);

  const courseGenerationStatus = itemFactory.job?.status;

  const selectedObjectiveId = itemFactory.selectedObjectiveId;
  const selectedObjective = useMemo(
    () =>
      objectives.find((objective) => objective.id === selectedObjectiveId) || null,
    [objectives, selectedObjectiveId],
  );

  // Batch selection is keyed by objective id, so clear it when the course
  // changes (the panel instance is reused across courses).
  useEffect(() => {
    setBatchSelectedIds([]);
    setBatchConfirm(null);
    setCourseSuggestions([]);
    setCourseSuggestionCounts(EMPTY_COURSE_SUGGESTION_COUNTS);
    setCourseSuggestionError(null);
    setCourseStatusFilter('pending');
    setReviewMode('by-objective');
  }, [course.id]);

  const refreshCourseSuggestions = useCallback(() => {
    setCourseSuggestionsTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchCourseSuggestions = async () => {
      setIsLoadingCourseSuggestions(true);
      setCourseSuggestionError(null);

      try {
        const countResults = await Promise.all(
          COURSE_STATUS_FILTERS.map((filter) =>
            courseAIService.listItemSuggestions(course.id, {
              status: filter.value,
              limit: 1,
              page: 1,
            }),
          ),
        );
        if (cancelled) return;

        setCourseSuggestionCounts(
          COURSE_STATUS_FILTERS.reduce(
            (counts, filter, index) => ({
              ...counts,
              [filter.value]:
                typeof countResults[index].total === 'number'
                  ? countResults[index].total
                  : countResults[index].items?.length ?? 0,
            }),
            { ...EMPTY_COURSE_SUGGESTION_COUNTS },
          ),
        );

        const firstPage = await courseAIService.listItemSuggestions(course.id, {
          status: courseStatusFilter,
          limit: COURSE_REVIEW_PAGE_SIZE,
          page: 1,
        });
        if (cancelled) return;

        let items = firstPage.items || [];
        const total =
          typeof firstPage.total === 'number' ? firstPage.total : items.length;
        const totalPages = Math.ceil(total / COURSE_REVIEW_PAGE_SIZE);

        for (let page = 2; page <= totalPages; page += 1) {
          const nextPage = await courseAIService.listItemSuggestions(course.id, {
            status: courseStatusFilter,
            limit: COURSE_REVIEW_PAGE_SIZE,
            page,
          });
          if (cancelled) return;
          items = items.concat(nextPage.items || []);
        }

        setCourseSuggestions(items);
      } catch (error) {
        console.error('Failed to fetch course item suggestions:', error);
        if (!cancelled) {
          setCourseSuggestionError('Failed to load AI drafts for this course.');
          setCourseSuggestions([]);
        }
      } finally {
        if (!cancelled) setIsLoadingCourseSuggestions(false);
      }
    };

    void fetchCourseSuggestions();

    return () => {
      cancelled = true;
    };
  }, [course.id, courseStatusFilter, courseSuggestionsTick, courseGenerationStatus]);

  const visibleSuggestions = useMemo(
    () => itemFactory.filterByStatus(statusFilter),
    [itemFactory, statusFilter],
  );

  const itemsActive = itemFactory.isGenerating || itemFactory.isPolling;
  const progress = getJobProgress(itemFactory.job);

  const batchPlanEntries = useMemo(
    () => visiblePlanEntries(batchPlan),
    [batchPlan],
  );
  const batchPlanTotal = batchPlanEntries.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  const objectivePlanEntries = useMemo(
    () => visiblePlanEntries(objectivePlan),
    [objectivePlan],
  );
  const objectivePlanTotal = objectivePlanEntries.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );

  const handleGenerateItems = () => {
    if (!selectedObjectiveId || objectivePlanTotal === 0) return;
    void itemFactory.generate({
      learningObjectiveIds: [selectedObjectiveId],
      plan: objectivePlanEntries,
    });
  };

  const adjustBatchPlan = (type: ItemSuggestionType, delta: number) =>
    setBatchPlan((current) => ({
      ...current,
      [type]: Math.max(0, Math.min(10, current[type] + delta)),
    }));

  const adjustObjectivePlan = (type: ItemSuggestionType, delta: number) =>
    setObjectivePlan((current) => ({
      ...current,
      [type]: Math.max(0, Math.min(10, current[type] + delta)),
    }));

  // --- Batch generation across many / all objectives ------------------------

  const toggleBatchSelection = (objectiveId: string) =>
    setBatchSelectedIds((current) =>
      current.includes(objectiveId)
        ? current.filter((id) => id !== objectiveId)
        : [...current, objectiveId],
    );

  const visibleObjectiveIds = useMemo(
    () => filteredObjectives.map((objective) => objective.id),
    [filteredObjectives],
  );
  const allVisibleSelected =
    visibleObjectiveIds.length > 0 &&
    visibleObjectiveIds.every((id) => batchSelectedIds.includes(id));

  const toggleSelectAllVisible = () =>
    setBatchSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleObjectiveIds.includes(id))
        : Array.from(new Set([...current, ...visibleObjectiveIds])),
    );

  const handleGenerateForAll = () => {
    if (batchPlanTotal === 0 || itemsActive) return;
    // Pass explicit ids (rather than relying on the backend's "omit = all")
    // so the demo mock — which can't enumerate course LOs — also works.
    void itemFactory.generate({
      learningObjectiveIds: objectives.map((objective) => objective.id),
      plan: batchPlanEntries,
    });
    setBatchSelectedIds([]);
  };

  const handleGenerateForSelected = () => {
    if (batchPlanTotal === 0 || itemsActive || batchSelectedIds.length === 0) return;
    void itemFactory.generate({
      learningObjectiveIds: batchSelectedIds,
      plan: batchPlanEntries,
    });
  };

  const handleAcceptSuggestion = async (suggestion: ItemSuggestion) => {
    const ok = await itemFactory.acceptSuggestion(suggestion);
    if (ok) {
      setAcceptedTick((tick) => tick + 1);
      refreshCourseSuggestions();
    }
  };

  const handleRejectSuggestion = async (suggestion: ItemSuggestion) => {
    const ok = await itemFactory.rejectSuggestion(suggestion);
    if (ok) refreshCourseSuggestions();
  };

  const handleSaveSuggestion = async (
    suggestion: ItemSuggestion,
    draft: ItemSuggestionDraft,
  ) => {
    const ok = await itemFactory.patchSuggestion(suggestion, draft);
    if (ok) refreshCourseSuggestions();
    return ok;
  };

  const objectiveTitleForSuggestion = (suggestion: ItemSuggestion) =>
    objectiveTitleById.get(suggestion.learningObjectiveId) ||
    objectiveTitleById.get(resourceIdentifier(suggestion.learningObjectiveId)) ||
    'Objective';

  const renderCourseSuggestions = () => {
    if (isLoadingCourseSuggestions) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <Loader2 size={20} className="mb-3 animate-spin text-[#1BD183]" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">
            Loading drafts…
          </p>
        </div>
      );
    }

    if (courseSuggestionError) {
      return (
        <div className="border-y border-rose-200 bg-rose-50/60 px-6 py-8 text-center">
          <AlertTriangle size={22} className="mx-auto mb-3 text-rose-500" />
          <p className="text-sm font-bold text-rose-700">
            {courseSuggestionError}
          </p>
          <button
            type="button"
            onClick={refreshCourseSuggestions}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-rose-600 transition hover:bg-rose-50"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      );
    }

    if (courseSuggestions.length === 0) {
      return (
        <div className="border-y border-slate-200 px-6 py-8 text-center">
          <Sparkles size={22} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">
            {courseStatusFilter === 'pending'
              ? 'No pending AI drafts'
              : `No ${courseStatusFilter} AI drafts`}
          </p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100 border-y border-slate-200">
        {courseSuggestions.map((suggestion) => (
          <div key={suggestion.id} className="px-1">
            <div className="flex flex-wrap items-center gap-2 px-1 pt-4">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                {objectiveTitleForSuggestion(suggestion)}
              </span>
            </div>
            <ItemReviewCard
              suggestion={suggestion}
              isBusy={itemFactory.busySuggestionId === suggestion.id}
              onSave={(draft) => handleSaveSuggestion(suggestion, draft)}
              onAccept={() => void handleAcceptSuggestion(suggestion)}
              onReject={() => void handleRejectSuggestion(suggestion)}
            />
          </div>
        ))}
      </div>
    );
  };

  const liveRefreshSignal = refreshSignal + acceptedTick;

  if (objectives.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-8 text-center">
        <BookOpen size={40} className="mb-4 text-slate-300" />
        <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
          No objectives to build against
        </p>
        <p className="mt-2 max-w-sm text-xs font-medium text-slate-500">
          Content is authored against learning objectives. Add at least one
          objective on the Objectives tab, then come back to produce flashcards,
          SAQs, and MCQs — manually or with AI.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>Content production</SectionLabel>
          <h3 className="text-lg font-black tracking-tight text-slate-900">
            Build content per objective
          </h3>
          <p className="mt-1 max-w-xl text-xs font-medium text-slate-500">
            Pick an objective, then author items by hand or let AI draft them —
            everything lands in the same list. Nothing is added until you save or
            accept it.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
          {objectives.length} objective{objectives.length === 1 ? '' : 's'}
        </span>
      </div>

      {itemFactory.error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-rose-500" />
          <p className="flex-1 text-xs font-semibold text-rose-700">
            {itemFactory.error}
          </p>
          <button
            onClick={itemFactory.clearError}
            className="rounded-lg p-0.5 text-rose-400 hover:bg-rose-100"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Batch AI generation */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-emerald-50/40 px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Batch AI generation
            </p>
            <p className="mt-0.5 max-w-md text-xs font-medium text-slate-500">
              Draft items across many objectives in one run — every objective, or
              just the ones you tick in the list — then review the whole batch
              together.
            </p>
          </div>
        </div>

        {itemsActive && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#1BA6D1]">
                <Loader2 size={12} className="animate-spin" />
                {progress && progress.percent > 0
                  ? `Drafting ${progress.done} of ${progress.total} objectives…`
                  : 'Starting generation…'}
              </span>
              {progress && progress.percent > 0 && (
                <span className="text-[10px] font-black tabular-nums text-slate-500">
                  {progress.percent}%
                </span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] transition-all duration-500 ${
                  progress && progress.percent > 0 ? '' : 'w-1/3 animate-pulse'
                }`}
                style={
                  progress && progress.percent > 0
                    ? { width: `${progress.percent}%` }
                    : undefined
                }
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <PlanEditor plan={batchPlan} adjustPlan={adjustBatchPlan} />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            per objective
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={batchPlanTotal === 0 || itemsActive}
            onClick={handleGenerateForAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {itemsActive ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            Generate for all {objectives.length} objectives
          </button>
          <button
            type="button"
            disabled={
              batchPlanTotal === 0 || itemsActive || batchSelectedIds.length === 0
            }
            onClick={handleGenerateForSelected}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={13} />
            Generate for {batchSelectedIds.length} selected
          </button>
          {batchSelectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setBatchSelectedIds([])}
              className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}

          {itemFactory.jobPendingCount > 0 && !itemsActive && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-700">
                {itemFactory.jobPendingCount} pending from last batch
              </span>
              <button
                type="button"
                disabled={itemFactory.isJobBatchBusy}
                onClick={() => setBatchConfirm('accept')}
                className="inline-flex items-center gap-1 rounded-lg bg-[#1BD183] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#06241a] transition hover:brightness-105 disabled:opacity-50"
              >
                {itemFactory.isJobBatchBusy ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <CheckCheck size={11} />
                )}
                Accept all
              </button>
              <button
                type="button"
                disabled={itemFactory.isJobBatchBusy}
                onClick={() => setBatchConfirm('reject')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
              >
                <XCircle size={11} />
                Reject all
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="inline-flex gap-1">
          {REVIEW_MODE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setReviewMode(tab.value)}
              className={`border-b-2 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition ${
                reviewMode === tab.value
                  ? 'border-[#1BD183] text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {tab.value === 'all' && courseSuggestionCounts.pending > 0 && (
                <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] leading-none text-amber-700">
                  {courseSuggestionCounts.pending}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Course-level AI draft review */}
      {reviewMode === 'all' && (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionLabel>Review queue</SectionLabel>
            <h4 className="text-base font-black tracking-tight text-slate-900">
              All AI drafts
            </h4>
          </div>
          <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">
            {courseSuggestionCounts.pending} pending
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {COURSE_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCourseStatusFilter(filter.value)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] transition ${
                  courseStatusFilter === filter.value
                    ? 'bg-white text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {filter.label}
                <span className="ml-1.5 text-[10px] text-slate-400">
                  {courseSuggestionCounts[filter.value]}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={refreshCourseSuggestions}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        <div className="mt-3">{renderCourseSuggestions()}</div>
      </div>
      )}

      {reviewMode === 'by-objective' && (
      <div className="grid min-w-0 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* Objectives rail */}
        <div className="min-w-0">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this course’s objectives…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/15"
            />
          </div>

          <div className="mt-3 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 hover:text-slate-800"
            >
              {allVisibleSelected ? 'Clear all' : 'Select all'}
            </button>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              {batchSelectedIds.length} selected for batch
            </span>
          </div>

          <div className="mt-2 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto border-y border-slate-200 custom-scrollbar">
            {filteredObjectives.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs font-semibold text-slate-500">
                No objectives match “{query.trim()}”.
              </div>
            ) : (
              filteredObjectives.map((objective) => {
                const group = itemFactory.buildGroup(objective.id);
                const isActive = selectedObjectiveId === objective.id;
                const isChecked = batchSelectedIds.includes(objective.id);
                return (
                  <div
                    key={objective.id}
                    className={`flex items-start gap-2 border-l-2 pl-2.5 pr-3 transition ${
                      isActive
                        ? 'border-[#1BD183] bg-emerald-50/50'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleBatchSelection(objective.id)}
                      aria-label={`Select “${objective.title}” for batch generation`}
                      className="mt-[15px] h-3.5 w-3.5 flex-shrink-0 rounded border-slate-300 text-[#1BD183] focus:ring-[#1BD183]"
                    />
                    <button
                      type="button"
                      onClick={() => itemFactory.selectObjective(objective.id)}
                      className="min-w-0 flex-1 py-3 text-left"
                    >
                      <div className="flex items-start gap-2">
                        <Target size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                        <p className="min-w-0 flex-1 text-sm font-bold text-slate-900">
                          {objective.title}
                        </p>
                        <ChevronRight size={14} className="mt-0.5 flex-shrink-0 text-slate-300" />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {objective.cognitiveSkill && (
                          <span
                            className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${bloomStyle(objective.cognitiveSkill)}`}
                          >
                            {objective.cognitiveSkill}
                          </span>
                        )}
                        {objective.itemTotals && objective.itemTotals.total > 0 && (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                            {objective.itemTotals.total} live
                          </span>
                        )}
                        {group.pendingCount > 0 && (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-700">
                            {group.pendingCount} ai
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected objective workspace */}
        <div className="min-w-0 border-t border-slate-200 pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          {!selectedObjective ? (
            <div className="border-y border-slate-200 px-6 py-16 text-center">
              <GraduationCap size={26} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">
                Select an objective to build its content
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Author items by hand or let AI draft them for the objective.
              </p>
            </div>
          ) : (
            <div className="min-w-0 space-y-6">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <p className="text-sm font-bold text-slate-900">
                  {selectedObjective.title}
                </p>

                {/* Author new */}
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Author new
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {VISIBLE_MODALITIES.map((modality) => {
                      const Icon = modality.icon;
                      return (
                        <button
                          key={modality.type}
                          type="button"
                          onClick={() => onCreateItem(modality.type, selectedObjective.id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600 transition ${modality.create}`}
                        >
                          <Plus size={12} />
                          <Icon size={13} />
                          {modality.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Generate with AI */}
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Generate with AI
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <PlanEditor plan={objectivePlan} adjustPlan={adjustObjectivePlan} />
                    <button
                      type="button"
                      disabled={objectivePlanTotal === 0 || itemsActive}
                      onClick={handleGenerateItems}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {itemsActive ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Sparkles size={13} />
                      )}
                      Generate {objectivePlanTotal} items
                    </button>
                  </div>
                </div>
              </div>

              {/* Live items */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Layers size={15} className="text-slate-400" />
                  <SectionLabel>Items</SectionLabel>
                </div>
                <div className="mt-3 min-w-0">
                  <ObjectiveItemsList
                    objectiveId={selectedObjective.id}
                    refreshSignal={liveRefreshSignal}
                    onOpenItem={onOpenItem}
                  />
                </div>
              </div>

              {/* AI drafts */}
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-[#1BD183]" />
                  <SectionLabel>AI drafts</SectionLabel>
                </div>

                {itemsActive ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Loader2 size={22} className="mb-3 animate-spin text-[#1BD183]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                      Drafting content…
                    </p>
                    {progress && progress.percent > 0 && (
                      <div className="mt-3 w-40">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-[#1BD183] transition-all duration-500"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                        <p className="mt-1 text-center text-[10px] font-bold tabular-nums text-slate-400">
                          {progress.percent}%
                        </p>
                      </div>
                    )}
                  </div>
                ) : itemFactory.isLoadingSuggestions ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Loader2 size={22} className="mb-3 animate-spin text-[#1BD183]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                      Loading…
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
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
                          </button>
                        ))}
                      </div>
                      {itemFactory.stats.pending > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={itemFactory.busyObjectiveId === selectedObjective.id}
                            onClick={() => setConfirmAction('accept')}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#1BD183] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#06241a] transition hover:brightness-105 disabled:opacity-50"
                          >
                            <CheckCheck size={11} />
                            Accept all
                          </button>
                          <button
                            type="button"
                            disabled={itemFactory.busyObjectiveId === selectedObjective.id}
                            onClick={() => setConfirmAction('reject')}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                          >
                            <XCircle size={11} />
                            Reject all
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      {visibleSuggestions.length === 0 ? (
                        <div className="border-y border-slate-200 px-6 py-10 text-center">
                          <p className="text-sm font-bold text-slate-600">
                            {statusFilter === 'pending'
                              ? 'No AI drafts yet'
                              : `No ${statusFilter} drafts`}
                          </p>
                          {statusFilter === 'pending' && (
                            <p className="mt-1 text-xs font-medium text-slate-500">
                              Set the counts above and hit Generate to draft
                              content for this objective.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 border-y border-slate-200">
                          {visibleSuggestions.map((suggestion) => (
                            <ItemReviewCard
                              key={suggestion.id}
                              suggestion={suggestion}
                              isBusy={itemFactory.busySuggestionId === suggestion.id}
                              onSave={(draft) => handleSaveSuggestion(suggestion, draft)}
                              onAccept={() => void handleAcceptSuggestion(suggestion)}
                              onReject={() => void handleRejectSuggestion(suggestion)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      <ConfirmationModal
        isOpen={confirmAction !== null}
        variant={confirmAction === 'reject' ? 'danger' : 'info'}
        title={
          confirmAction === 'reject'
            ? 'Reject all pending items'
            : 'Accept all pending items'
        }
        message={
          confirmAction === 'reject'
            ? `Reject all ${itemFactory.stats.pending} pending item${
                itemFactory.stats.pending === 1 ? '' : 's'
              } for this objective? This cannot be undone.`
            : `Add all ${itemFactory.stats.pending} pending item${
                itemFactory.stats.pending === 1 ? '' : 's'
              } to the course?`
        }
        confirmLabel={confirmAction === 'reject' ? 'Reject all' : 'Accept all'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction;
          const group = itemFactory.selectedGroup;
          setConfirmAction(null);
          if (!group) return;
          if (action === 'accept') {
            void itemFactory.acceptAllForObjective(group).then((result) => {
              if (result && result.accepted > 0) setAcceptedTick((tick) => tick + 1);
              if (result) refreshCourseSuggestions();
            });
          } else if (action === 'reject') {
            void itemFactory.rejectAllForObjective(group).then((result) => {
              if (result) refreshCourseSuggestions();
            });
          }
        }}
      />

      <ConfirmationModal
        isOpen={batchConfirm !== null}
        variant={batchConfirm === 'reject' ? 'danger' : 'info'}
        title={
          batchConfirm === 'reject' ? 'Reject entire batch' : 'Accept entire batch'
        }
        message={
          batchConfirm === 'reject'
            ? `Reject all ${itemFactory.jobPendingCount} pending item${
                itemFactory.jobPendingCount === 1 ? '' : 's'
              } from the last generation? This cannot be undone.`
            : `Add all ${itemFactory.jobPendingCount} pending item${
                itemFactory.jobPendingCount === 1 ? '' : 's'
              } from the last generation to the course?`
        }
        confirmLabel={batchConfirm === 'reject' ? 'Reject batch' : 'Accept batch'}
        onCancel={() => setBatchConfirm(null)}
        onConfirm={() => {
          const action = batchConfirm;
          setBatchConfirm(null);
          if (action === 'accept') {
            void itemFactory.acceptAllForJob().then((result) => {
              if (result && result.accepted > 0) setAcceptedTick((tick) => tick + 1);
              if (result) refreshCourseSuggestions();
            });
          } else if (action === 'reject') {
            void itemFactory.rejectAllForJob().then((result) => {
              if (result) refreshCourseSuggestions();
            });
          }
        }}
      />
    </div>
  );
};

export default CourseContentPanel;
