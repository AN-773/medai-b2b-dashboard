import type { PaginatedApiResponse } from '@/types/TestsServiceTypes';
import type {
  AcceptItemSuggestionResponse,
  CourseAIService,
  CourseGenerationJob,
  CourseGenerationKind,
  GenerateItemSuggestionsRequest,
  ItemSuggestion,
  ItemSuggestionBatchResult,
  ItemSuggestionDraft,
  ItemSuggestionType,
  ListItemSuggestionsParams,
} from '@/types/CourseAITypes';
import { resourceIdentifier } from '@/utils/resourceId';

/**
 * DEMO ONLY — in-memory fake implementation of {@link CourseAIService}.
 *
 * It mimics the async backend: generation calls return a `processing` job, and
 * polling that job flips it to `completed` after a short delay, at which point
 * the item suggestions become readable. This lets the real polling hook
 * (`useItemFactory`) and the UI run end-to-end with no backend.
 *
 * To replace with the real backend, set `VITE_COURSE_AI_MOCK=false` (see
 * `services/courseAIService.ts`). Nothing else changes — this object and the live
 * client implement the same interface. This file can then be deleted.
 */

const GEN_DELAY_MS = 4000; // floor duration so single-objective jobs stay snappy
const PER_OBJECTIVE_MS = 2500; // simulated work per objective — drives the progress bar
const NETWORK_MS = 400; // simulated request latency

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const slug = () => Math.random().toString(36).slice(2, 12);
const fakeUrl = (kind: string, id: string) => `https://mock.tests.local/${kind}/${id}`;
const nowIso = () => new Date().toISOString();

// --- In-memory stores -------------------------------------------------------

interface ItemsJobState {
  job: CourseGenerationJob;
  startedAt: number;
  durationMs: number;
  total: number;
}

const itemsJobByCourse = new Map<string, ItemsJobState>();
const itemsByObjective = new Map<string, ItemSuggestion[]>();
const suggestionIndex = new Map<string, ItemSuggestion>();

const indexSuggestion = (suggestion: ItemSuggestion) => {
  suggestionIndex.set(suggestion.id, suggestion);
  suggestionIndex.set(suggestion.identifier, suggestion);
};

const findSuggestion = (key: string) => suggestionIndex.get(key) || null;

const makeJob = (
  courseId: string,
  kind: CourseGenerationKind,
  total: number,
): CourseGenerationJob => {
  const id = slug();
  return {
    id: fakeUrl('course-generation-jobs', id),
    identifier: id,
    courseId,
    kind,
    status: total > 0 ? 'processing' : 'completed',
    triggerSource: 'mock',
    queuedCount: total,
    processingCount: 0,
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
};

/**
 * Advance a job's per-state counts based on elapsed time, so polling sees
 * realistic incremental progress and the job flips to `completed` once its
 * simulated duration elapses.
 */
const settleJob = (state: ItemsJobState): CourseGenerationJob => {
  const { job, startedAt, durationMs, total } = state;
  if (job.status !== 'processing') return { ...job };

  const fraction =
    durationMs <= 0 ? 1 : Math.min(1, (Date.now() - startedAt) / durationMs);

  if (fraction >= 1) {
    job.status = 'completed';
    job.completedCount = total;
    job.processingCount = 0;
    job.queuedCount = 0;
  } else {
    const completed = Math.min(total, Math.floor(fraction * total));
    job.completedCount = completed;
    job.processingCount = Math.min(total - completed, 1);
    job.queuedCount = total - completed - job.processingCount;
  }
  job.updatedAt = nowIso();
  return { ...job };
};

// --- Fake content -----------------------------------------------------------

const MCQ_POOL: ItemSuggestionDraft['mcq'][] = [
  {
    stem: 'A 58-year-old man presents with crushing substernal chest pain radiating to the left arm for 40 minutes. ECG shows ST-segment elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?',
    choices: [
      { content: 'Right coronary artery', isCorrect: true, explanation: 'Inferior STEMI (II, III, aVF) most commonly reflects RCA occlusion.' },
      { content: 'Left anterior descending artery', isCorrect: false, explanation: 'LAD occlusion causes anterior changes (V1–V4).' },
      { content: 'Left circumflex artery', isCorrect: false, explanation: 'LCx typically produces lateral changes (I, aVL, V5–V6).' },
      { content: 'Left main coronary artery', isCorrect: false, explanation: 'Left main occlusion causes widespread, often anterior, involvement.' },
    ],
  },
  {
    stem: 'Which of the following best explains why non-selective beta-blockers are used with caution in patients with reactive airway disease?',
    choices: [
      { content: 'Blockade of β2 receptors can precipitate bronchoconstriction', isCorrect: true, explanation: 'β2 blockade opposes bronchodilation, risking bronchospasm.' },
      { content: 'They increase myocardial oxygen demand', isCorrect: false, explanation: 'Beta-blockers reduce myocardial oxygen demand.' },
      { content: 'They cause reflex tachycardia', isCorrect: false, explanation: 'They blunt, not cause, tachycardia.' },
      { content: 'They directly dilate pulmonary arteries', isCorrect: false, explanation: 'They do not meaningfully dilate pulmonary vasculature.' },
    ],
  },
  {
    stem: 'A patient on a loop diuretic develops muscle weakness and a flattened T wave with a U wave on ECG. Which electrolyte abnormality is most likely?',
    choices: [
      { content: 'Hypokalemia', isCorrect: true, explanation: 'Loop diuretics waste potassium; U waves are classic for hypokalemia.' },
      { content: 'Hyperkalemia', isCorrect: false, explanation: 'Hyperkalemia causes peaked T waves.' },
      { content: 'Hypernatremia', isCorrect: false, explanation: 'Does not produce U waves.' },
      { content: 'Hypocalcemia', isCorrect: false, explanation: 'Prolongs QT rather than causing U waves.' },
    ],
  },
  {
    stem: 'Which mechanism most directly accounts for the afterload reduction produced by ACE inhibitors?',
    choices: [
      { content: 'Decreased angiotensin II–mediated vasoconstriction', isCorrect: true, explanation: 'Less angiotensin II lowers systemic vascular resistance.' },
      { content: 'Direct β1 receptor blockade', isCorrect: false, explanation: 'ACE inhibitors do not block β1 receptors.' },
      { content: 'Increased aldosterone secretion', isCorrect: false, explanation: 'They decrease aldosterone.' },
      { content: 'Calcium channel blockade', isCorrect: false, explanation: 'A different drug class.' },
    ],
  },
];

const SAQ_POOL: ItemSuggestionDraft['saq'][] = [
  { question: 'List two compensatory mechanisms the body uses to maintain cardiac output in early heart failure.', answer: 'Increased sympathetic tone (raising heart rate and contractility) and activation of the renin–angiotensin–aldosterone system (increasing preload via fluid retention).' },
  { question: 'Explain why troponin is preferred over CK-MB for diagnosing myocardial infarction.', answer: 'Troponin is more cardiac-specific and more sensitive, rises early, and stays elevated for several days, improving both early and late detection.' },
  { question: 'Describe the expected acid–base disturbance in a patient with a prolonged asthma exacerbation progressing to fatigue.', answer: 'Early respiratory alkalosis from hyperventilation, which can progress to respiratory acidosis as the patient tires and CO2 retention develops — a sign of impending respiratory failure.' },
];

const FLASHCARD_POOL: ItemSuggestionDraft['flashcard'][] = [
  { front: 'First-line treatment for stable angina', back: 'Beta-blockers (plus sublingual nitroglycerin for acute episodes) and risk-factor modification.' },
  { front: 'Classic ECG finding of pericarditis', back: 'Diffuse ST-segment elevation with PR-segment depression.' },
  { front: 'Most common cause of right-sided heart failure', back: 'Left-sided heart failure.' },
  { front: 'Drug class that improves mortality in HFrEF', back: 'ACE inhibitors / ARBs, beta-blockers, MRAs, and SGLT2 inhibitors.' },
  { front: 'Murmur of aortic stenosis', back: 'Crescendo–decrescendo systolic ejection murmur radiating to the carotids.' },
  { front: 'Antidote for warfarin-related major bleeding', back: 'Vitamin K plus 4-factor prothrombin complex concentrate (or FFP).' },
];

const LECTURE_POOL: ItemSuggestionDraft['lecture'][] = [
  {
    title: 'An Integrated Clinical Approach',
    summary: 'A 10-minute synthesis tying mechanism, diagnosis, and management into a single reasoning framework.',
    content: 'This lecture walks through a structured approach: (1) recognise the presentation, (2) localise the pathophysiology, (3) order and interpret targeted investigations, and (4) select evidence-based management. Worked examples connect each step so learners can rehearse the full reasoning chain rather than isolated facts.',
  },
  {
    title: 'High-Yield Review Session',
    summary: 'A focused recap of the most frequently tested concepts with rapid self-check prompts.',
    content: 'A concise review consolidating the unit’s key objectives. Each segment pairs a core concept with a quick application prompt, reinforcing retrieval and highlighting common pitfalls and exam traps.',
  },
];

const draftFor = (type: ItemSuggestionType, index: number): ItemSuggestionDraft => {
  switch (type) {
    case 'mcq':
      return { mcq: structuredClone(MCQ_POOL[index % MCQ_POOL.length]) };
    case 'saq':
      return { saq: structuredClone(SAQ_POOL[index % SAQ_POOL.length]) };
    case 'flashcard':
      return { flashcard: structuredClone(FLASHCARD_POOL[index % FLASHCARD_POOL.length]) };
    case 'lecture':
      return { lecture: structuredClone(LECTURE_POOL[index % LECTURE_POOL.length]) };
  }
};

const buildItemSuggestions = (
  courseId: string,
  learningObjectiveId: string,
  jobId: string,
  plan: { type: ItemSuggestionType; count: number }[],
): ItemSuggestion[] => {
  const result: ItemSuggestion[] = [];
  plan.forEach((entry) => {
    for (let i = 0; i < entry.count; i += 1) {
      const id = slug();
      const suggestion: ItemSuggestion = {
        id: fakeUrl('item-suggestions', id),
        identifier: id,
        courseId,
        learningObjectiveId,
        jobId,
        type: entry.type,
        status: 'pending',
        draft: draftFor(entry.type, i),
        chunks: [
          {
            id: fakeUrl('document-chunks', slug()),
            heading: 'Source evidence',
            content: 'Drafted from the course objective and grounded source material (demo data).',
          },
        ],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      indexSuggestion(suggestion);
      result.push(suggestion);
    }
  });
  return result;
};

const DEFAULT_ITEM_PLAN: { type: ItemSuggestionType; count: number }[] = [
  { type: 'mcq', count: 3 },
  { type: 'saq', count: 1 },
  { type: 'flashcard', count: 3 },
];

const paginate = <T>(items: T[], page = 1, limit = 100): PaginatedApiResponse<T> => {
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), page, total: items.length };
};

/** Build + store the draft suggestions for a set of objectives and enqueue a job. */
const enqueueItemsJob = (
  courseKey: string,
  courseId: string,
  objectiveIds: string[],
  plan: { type: ItemSuggestionType; count: number }[],
): CourseGenerationJob => {
  const total = objectiveIds.length;
  const job = makeJob(courseId, 'items', total);
  objectiveIds.forEach((learningObjectiveId) => {
    const built = buildItemSuggestions(courseId, learningObjectiveId, job.id, plan);
    itemsByObjective.set(learningObjectiveId, built);
  });
  itemsJobByCourse.set(courseKey, {
    job,
    startedAt: Date.now(),
    durationMs: Math.max(GEN_DELAY_MS, total * PER_OBJECTIVE_MS),
    total,
  });
  return job;
};

const planOrDefault = (request: GenerateItemSuggestionsRequest) =>
  request.plan && request.plan.length > 0 ? request.plan : DEFAULT_ITEM_PLAN;

// --- Service implementation -------------------------------------------------

export const courseAIServiceMock: CourseAIService = {
  getLatestGenerationJob: async (
    courseIdentifier,
    _kind: CourseGenerationKind,
  ) => {
    await delay(NETWORK_MS);
    const itemsState = itemsJobByCourse.get(courseIdentifier);
    return itemsState ? settleJob(itemsState) : null;
  },

  generateItemSuggestions: async (
    courseIdentifier,
    request: GenerateItemSuggestionsRequest,
  ) => {
    await delay(NETWORK_MS);
    const courseId = fakeUrl('courses', courseIdentifier);
    // `learningObjectiveIds` is optional on the course route (omit = all LOs);
    // the mock can only build drafts for objectives it is given explicitly.
    const objectiveIds = request.learningObjectiveIds ?? [];
    const job = enqueueItemsJob(
      courseIdentifier,
      courseId,
      objectiveIds,
      planOrDefault(request),
    );
    return { ...job };
  },

  generateItemSuggestionsForObjective: async (
    learningObjectiveIdentifier,
    request: GenerateItemSuggestionsRequest,
  ) => {
    await delay(NETWORK_MS);
    const courseId =
      request.courseId ?? fakeUrl('courses', 'unknown-course');
    const objectiveId = fakeUrl(
      'learning-objectives',
      resourceIdentifier(learningObjectiveIdentifier),
    );
    const job = enqueueItemsJob(
      resourceIdentifier(courseId),
      courseId,
      [objectiveId],
      planOrDefault(request),
    );
    return { ...job };
  },

  listItemSuggestions: async (
    _courseIdentifier,
    params: ListItemSuggestionsParams = {},
  ) => {
    await delay(NETWORK_MS);
    let items = params.learningObjectiveId
      ? itemsByObjective.get(params.learningObjectiveId) || []
      : Array.from(itemsByObjective.values()).flat();
    if (params.jobId) items = items.filter((item) => item.jobId === params.jobId);
    if (params.status) items = items.filter((item) => item.status === params.status);
    if (params.type) items = items.filter((item) => item.type === params.type);
    return paginate(items.map((item) => structuredClone(item)), params.page, params.limit);
  },

  patchItemSuggestion: async (suggestionIdentifier, draft) => {
    await delay(NETWORK_MS);
    const found = findSuggestion(suggestionIdentifier);
    if (!found) throw Object.assign(new Error('Suggestion not found'), { status: 404 });
    found.draft = { ...found.draft, ...draft };
    found.updatedAt = nowIso();
    return structuredClone(found);
  },

  acceptItemSuggestion: async (
    suggestionIdentifier,
  ): Promise<AcceptItemSuggestionResponse> => {
    await delay(NETWORK_MS);
    const found = findSuggestion(suggestionIdentifier);
    if (!found) throw Object.assign(new Error('Suggestion not found'), { status: 404 });
    found.status = 'accepted';
    found.acceptedItemId = fakeUrl('items', slug());
    found.updatedAt = nowIso();
    return { itemId: found.acceptedItemId, suggestion: structuredClone(found) };
  },

  rejectItemSuggestion: async (suggestionIdentifier) => {
    await delay(NETWORK_MS);
    const found = findSuggestion(suggestionIdentifier);
    if (!found) throw Object.assign(new Error('Suggestion not found'), { status: 404 });
    found.status = 'rejected';
    found.updatedAt = nowIso();
    return structuredClone(found);
  },

  acceptAllForObjective: async (learningObjectiveIdentifier) => {
    await delay(NETWORK_MS);
    const items = itemsByObjective.get(learningObjectiveIdentifier) || [];
    const result: ItemSuggestionBatchResult = {
      accepted: 0,
      rejected: 0,
      failed: 0,
      acceptedItemIds: [],
    };
    items.forEach((item) => {
      if (item.status === 'pending') {
        item.status = 'accepted';
        item.acceptedItemId = fakeUrl('items', slug());
        item.updatedAt = nowIso();
        result.accepted += 1;
        result.acceptedItemIds?.push(item.acceptedItemId);
      }
    });
    return result;
  },

  rejectAllForObjective: async (learningObjectiveIdentifier) => {
    await delay(NETWORK_MS);
    const items = itemsByObjective.get(learningObjectiveIdentifier) || [];
    let rejected = 0;
    items.forEach((item) => {
      if (item.status === 'pending') {
        item.status = 'rejected';
        item.updatedAt = nowIso();
        rejected += 1;
      }
    });
    return { accepted: 0, rejected, failed: 0 };
  },

  acceptAllForJob: async (jobIdentifier) => {
    await delay(NETWORK_MS);
    const result: ItemSuggestionBatchResult = {
      accepted: 0,
      rejected: 0,
      failed: 0,
      acceptedItemIds: [],
    };
    Array.from(itemsByObjective.values())
      .flat()
      .filter((item) => item.jobId?.includes(jobIdentifier))
      .forEach((item) => {
        if (item.status === 'pending') {
          item.status = 'accepted';
          item.acceptedItemId = fakeUrl('items', slug());
          item.updatedAt = nowIso();
          result.accepted += 1;
          result.acceptedItemIds?.push(item.acceptedItemId);
        }
      });
    return result;
  },

  rejectAllForJob: async (jobIdentifier) => {
    await delay(NETWORK_MS);
    let rejected = 0;
    Array.from(itemsByObjective.values())
      .flat()
      .filter((item) => item.jobId?.includes(jobIdentifier))
      .forEach((item) => {
        if (item.status === 'pending') {
          item.status = 'rejected';
          item.updatedAt = nowIso();
          rejected += 1;
        }
      });
    return { accepted: 0, rejected, failed: 0 };
  },
};
