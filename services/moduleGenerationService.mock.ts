import type { CourseGenerationJob, ItemSuggestion, ItemSuggestionDraft } from '@/types/CourseAITypes';
import type { CourseUpload } from '@/types/CourseStudioTypes';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import type {
  AcceptModulePlanResponse,
  ModuleGenerationEvent,
  ModuleGenerationEventKind,
  ModuleGenerationJob,
  ModuleGenerationOptions,
  ModuleGenerationService,
  ModuleGenerationStage,
  ModulePlan,
  ModulePlanIssue,
} from '@/types/ModuleGenerationTypes';
import { ModuleGenerationRequestError } from './moduleGenerationErrors';
import {
  isJobOpen,
  isJobRunning,
  refId,
  sessionDependencyIds,
  validateModulePlan,
} from '@/components/academy/course-workbench/module-generation/planUtils';

/**
 * DEMO ONLY: in-memory fake of {@link ModuleGenerationService}.
 *
 * A job walks through `queued → processing (analyzing → drafting_items →
 * planning) → completed / awaiting_review` on a timer, with a growing event
 * feed, so the wizard, the banner and their polling run with no backend. State
 * lives in module memory: it survives closing the wizard and switching tabs,
 * not a page reload.
 *
 * The scenario for the next job is picked in the wizard's Options step (the
 * picker only renders in mock mode) through {@link moduleGenerationMockControls}.
 *
 * Enable with `VITE_MODULE_GENERATION_MOCK=true` (see
 * `services/moduleGenerationService.ts`).
 */

export type ModuleGenerationMockScenario =
  | 'success'
  | 'fail'
  | 'stale_ids_on_accept'
  | 'stale_version_on_save'
  | 'open_draft_conflict';

export const MODULE_GENERATION_MOCK_SCENARIOS: {
  value: ModuleGenerationMockScenario;
  label: string;
}[] = [
  { value: 'success', label: 'Success (≈20 s)' },
  { value: 'fail', label: 'Fails while planning' },
  { value: 'stale_ids_on_accept', label: 'Accept returns 409 staleIds once' },
  { value: 'stale_version_on_save', label: 'First save returns 409 stale_version' },
  { value: 'open_draft_conflict', label: 'Generate returns 409 (draft already open)' },
];

const NETWORK_MS = 300;
const QUEUED_MS = 2500;
const ANALYZING_END_MS = 9000;
const DRAFTING_END_MS = 15000;
const PLANNING_END_MS = 20000;
const FAIL_AT_MS = 17000;
const CANCEL_CHECKPOINT_MS = 2500;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const slug = () => Math.random().toString(36).slice(2, 12);
const fakeUrl = (kind: string, id: string) => `https://mock.tests.local/${kind}/${id}`;
const iso = (ms: number) => new Date(ms).toISOString();
const clone = <T,>(value: T): T => structuredClone(value);

// ---------------------------------------------------------------------------
// Fake course content
// ---------------------------------------------------------------------------

const uploadId = (n: number) => fakeUrl('course-uploads', `mock-upload-${n}`);
const loId = (n: number) => fakeUrl('learning-objectives', `mock-lo-${String(n).padStart(2, '0')}`);
const itemId = (n: number) => fakeUrl('items', `mock-item-${String(n).padStart(2, '0')}`);

const MOCK_UPLOADS: CourseUpload[] = [
  {
    id: uploadId(1),
    identifier: 'mock-upload-1',
    courseId: fakeUrl('courses', 'mock'),
    fileName: 'Cardio L1 – Cardiac Cycle.pdf',
    status: 'completed',
    brief:
      'Introduces the phases of the cardiac cycle, pressure–volume loops and the determinants of stroke volume.',
    briefTopics: ['Cardiac cycle', 'Pressure–volume loop', 'Preload', 'Afterload', 'Frank–Starling'],
    briefContentType: 'lecture',
    briefStatus: 'completed',
  },
  {
    id: uploadId(2),
    identifier: 'mock-upload-2',
    courseId: fakeUrl('courses', 'mock'),
    fileName: 'Cardio L2 – Heart Failure.pdf',
    status: 'completed',
    brief: 'Covers HFrEF versus HFpEF, neurohormonal compensation and guideline-directed therapy.',
    briefTopics: ['HFrEF', 'HFpEF', 'RAAS', 'Beta-blockers', 'SGLT2 inhibitors'],
    briefContentType: 'slides',
    briefStatus: 'completed',
  },
  {
    id: uploadId(3),
    identifier: 'mock-upload-3',
    courseId: fakeUrl('courses', 'mock'),
    fileName: 'ESC Guideline – Chronic Coronary Syndromes.pdf',
    status: 'completed',
    brief: null,
    briefTopics: null,
    briefContentType: null,
    briefStatus: null,
  },
  {
    id: uploadId(4),
    identifier: 'mock-upload-4',
    courseId: fakeUrl('courses', 'mock'),
    fileName: 'Renal Physiology L2.pdf',
    status: 'completed',
    brief: 'Tubular handling of sodium and potassium, and how diuretics act along the nephron.',
    briefTopics: ['Nephron', 'Diuretics', 'Potassium'],
    briefContentType: 'lecture',
    briefStatus: 'completed',
  },
];

const baseItem = (n: number, lo: number): Omit<BackendApiItem, 'type' | 'mcq' | 'saq' | 'lecture' | 'flashcard'> => ({
  id: itemId(n),
  identifier: `mock-item-${String(n).padStart(2, '0')}`,
  status: 'live',
  learningObjectiveId: loId(lo),
  createdAt: iso(Date.now() - 86_400_000 * 20),
  updatedAt: iso(Date.now() - 86_400_000 * 3),
  tags: [],
});

const mcq = (n: number, lo: number, stem: string, answers: [string, string, string, string]): BackendApiItem => ({
  ...baseItem(n, lo),
  type: 'mcq',
  mcq: {
    stem,
    choices: answers.map((content, index) => ({
      content,
      isCorrect: index === 0,
      explanation: '',
      createdAt: baseItem(n, lo).createdAt,
      updatedAt: baseItem(n, lo).updatedAt,
    })),
  },
  saq: null,
  lecture: null,
  flashcard: null,
});

const saq = (n: number, lo: number, question: string, answer: string): BackendApiItem => ({
  ...baseItem(n, lo),
  type: 'saq',
  mcq: null,
  saq: { question, answer },
  lecture: null,
  flashcard: null,
});

const flashcard = (n: number, lo: number, front: string, back: string): BackendApiItem => ({
  ...baseItem(n, lo),
  type: 'flashcard',
  mcq: null,
  saq: null,
  lecture: null,
  flashcard: { front, back },
});

const lecture = (n: number, lo: number, title: string, summary: string): BackendApiItem => ({
  ...baseItem(n, lo),
  type: 'lecture',
  mcq: null,
  saq: null,
  lecture: { title, summary, content: `${summary}\n\n(Demo lecture content.)` },
  flashcard: null,
});

const MOCK_ITEMS: BackendApiItem[] = [
  lecture(1, 1, 'The Cardiac Cycle, Phase by Phase', 'Walks through systole and diastole with the Wiggers diagram.'),
  mcq(2, 2, 'On a pressure–volume loop, which segment represents isovolumetric contraction?', [
    'The vertical segment on the right side of the loop',
    'The top segment of the loop',
    'The vertical segment on the left side of the loop',
    'The bottom segment of the loop',
  ]),
  mcq(3, 3, 'Which change increases stroke volume through the Frank–Starling mechanism?', [
    'Increased end-diastolic volume',
    'Increased aortic pressure',
    'Decreased venous return',
    'Increased heart rate alone',
  ]),
  lecture(4, 4, 'Cardiac Action Potentials', 'Pacemaker versus ventricular myocyte action potentials and their ion currents.'),
  mcq(5, 5, 'Which ECG finding is most typical of hypokalaemia?', [
    'Prominent U waves',
    'Peaked T waves',
    'Shortened QT interval',
    'Delta waves',
  ]),
  flashcard(6, 5, 'ECG sign of pericarditis', 'Diffuse ST elevation with PR depression.'),
  lecture(7, 6, 'Heart Failure: HFrEF versus HFpEF', 'Contrasts systolic and diastolic dysfunction and their compensation.'),
  saq(8, 6, 'Name two neurohormonal compensations in early heart failure.', 'Sympathetic activation and RAAS activation.'),
  mcq(9, 7, 'Which drug class reduces mortality in HFrEF?', [
    'SGLT2 inhibitors',
    'Non-dihydropyridine calcium channel blockers',
    'Class IC antiarrhythmics',
    'Thiazolidinediones',
  ]),
  flashcard(10, 7, 'Four pillars of HFrEF therapy', 'ACEi/ARB/ARNI, beta-blocker, MRA, SGLT2 inhibitor.'),
  mcq(11, 8, 'ST elevation in II, III and aVF most often reflects occlusion of which artery?', [
    'Right coronary artery',
    'Left anterior descending artery',
    'Left circumflex artery',
    'Left main coronary artery',
  ]),
  mcq(12, 8, 'Which biomarker is preferred for diagnosing myocardial infarction?', [
    'High-sensitivity troponin',
    'CK-MB',
    'Myoglobin',
    'LDH',
  ]),
  flashcard(13, 8, 'Antiplatelet loading in STEMI', 'Aspirin plus a P2Y12 inhibitor.'),
  saq(14, 9, 'Why are beta-blockers first line in stable angina?', 'They lower heart rate and contractility, reducing myocardial oxygen demand.'),
  lecture(15, 9, 'Stable Angina: Diagnosis and Treatment', 'From pre-test probability to anti-anginal therapy and revascularisation.'),
];

const MOCK_ITEM_BY_ID = new Map(MOCK_ITEMS.map((item) => [item.id, item]));

interface SuggestionSeed {
  key: string;
  lo: number;
  draft: ItemSuggestionDraft;
}

const SUGGESTION_SEEDS: SuggestionSeed[] = [
  {
    key: 's1',
    lo: 2,
    draft: {
      mcq: {
        stem: 'A pressure–volume loop shifts right with a wider loop after IV fluids. Which variable changed first?',
        choices: [
          { content: 'End-diastolic volume', isCorrect: true, explanation: 'Fluids raise preload, moving the loop right.' },
          { content: 'End-systolic pressure', isCorrect: false },
          { content: 'Contractility', isCorrect: false },
          { content: 'Aortic valve area', isCorrect: false },
        ],
      },
    },
  },
  {
    key: 's2',
    lo: 2,
    draft: {
      mcq: {
        stem: 'Which point on the pressure–volume loop marks aortic valve closure?',
        choices: [
          { content: 'Top-left corner', isCorrect: true },
          { content: 'Top-right corner', isCorrect: false },
          { content: 'Bottom-left corner', isCorrect: false },
          { content: 'Bottom-right corner', isCorrect: false },
        ],
      },
    },
  },
  { key: 's3', lo: 3, draft: { flashcard: { front: 'Frank–Starling law', back: 'Stroke volume rises with end-diastolic volume, up to a limit.' } } },
  { key: 's4', lo: 3, draft: { flashcard: { front: 'Preload', back: 'Ventricular wall stress at the end of diastole; approximated by end-diastolic volume.' } } },
  { key: 's5', lo: 3, draft: { flashcard: { front: 'Afterload', back: 'The load the ventricle ejects against; approximated by aortic pressure.' } } },
  {
    key: 's6',
    lo: 7,
    draft: {
      saq: {
        question: 'Explain why an MRA is added to ACE inhibitor therapy in HFrEF.',
        answer: 'It blocks aldosterone escape, reducing fibrosis, sodium retention and mortality.',
      },
    },
  },
];

const suggestionTypeOf = (draft: ItemSuggestionDraft) =>
  draft.mcq ? 'mcq' : draft.saq ? 'saq' : draft.flashcard ? 'flashcard' : 'lecture';

const suggestionIdFor = (jobIdentifier: string, key: string) =>
  fakeUrl('item-suggestions', `${jobIdentifier}-${key}`);

const buildSuggestions = (job: { id: string; identifier: string; courseId: string }, createdAt: string) =>
  SUGGESTION_SEEDS.map(
    (seed): ItemSuggestion => ({
      id: suggestionIdFor(job.identifier, seed.key),
      identifier: `${job.identifier}-${seed.key}`,
      courseId: job.courseId,
      learningObjectiveId: loId(seed.lo),
      jobId: job.id,
      type: suggestionTypeOf(seed.draft),
      status: 'pending',
      draft: clone(seed.draft),
      chunks: [
        {
          id: fakeUrl('document-chunks', slug()),
          sourceFile: MOCK_UPLOADS[0].fileName,
          heading: 'Pressure–volume relationships',
          content: 'Drafted from the course file and the learning objective (demo data).',
        },
      ],
      createdAt,
      updatedAt: createdAt,
    }),
  );

const buildPlan = (jobIdentifier: string): ModulePlan => {
  const s = (key: string) => ({ itemSuggestionId: suggestionIdFor(jobIdentifier, key) });
  const i = (n: number) => ({ itemId: itemId(n) });
  return {
    modules: [
      {
        title: 'Cardiac Physiology Foundations',
        order: 1,
        rationale: 'Builds the mechanical and electrical basis every later module relies on.',
        sessions: [
          {
            title: 'The Cardiac Cycle and Pressure–Volume Loops',
            order: 1,
            rationale: 'Starts with the cycle itself so loops and valve events have a shared vocabulary.',
            items: [i(1), i(2), s('s1'), s('s2')],
            learningObjectiveIds: [loId(1), loId(2)],
            sourceFileIds: [uploadId(1)],
          },
          {
            title: 'Preload, Afterload and the Frank–Starling Mechanism',
            order: 2,
            rationale: 'Only one existing item covered this objective, so three flashcards were drafted.',
            items: [i(3), s('s3'), s('s4'), s('s5')],
            learningObjectiveIds: [loId(3)],
            sourceFileIds: [uploadId(1)],
          },
          {
            title: 'Cardiac Electrophysiology and the ECG',
            order: 3,
            rationale: 'Electrical activity follows mechanics and prepares for ischaemia on the ECG.',
            items: [i(4), i(5), i(6)],
            learningObjectiveIds: [loId(4), loId(5)],
            sourceFileIds: [uploadId(1)],
          },
        ],
      },
      {
        title: 'Heart Failure: From Mechanism to Management',
        order: 2,
        rationale: 'Applies the physiology module to the most common chronic cardiac syndrome.',
        sessions: [
          {
            title: 'Pathophysiology of HFrEF and HFpEF',
            order: 1,
            rationale: 'Contrasts the two phenotypes before any drug is introduced.',
            items: [i(7), i(8)],
            learningObjectiveIds: [loId(6)],
            sourceFileIds: [uploadId(2)],
          },
          {
            title: 'Pharmacological Management of Heart Failure',
            order: 2,
            rationale: 'Groups the four pillars of therapy; an SAQ was drafted on MRA use.',
            items: [i(9), i(10), s('s6')],
            learningObjectiveIds: [loId(7)],
            sourceFileIds: [uploadId(2)],
          },
        ],
      },
      {
        title: 'Ischaemic Heart Disease',
        order: 3,
        rationale: 'Ends with acute and chronic coronary syndromes, which draw on both earlier modules.',
        sessions: [
          {
            title: 'Acute Coronary Syndromes',
            order: 1,
            rationale: 'ECG localisation and biomarkers first, then early management.',
            items: [i(11), i(12), i(13)],
            learningObjectiveIds: [loId(8)],
            sourceFileIds: [uploadId(3)],
          },
          {
            title: 'Stable Angina: Diagnosis and Treatment',
            order: 2,
            rationale: 'Draws on the guideline for the chronic side of the same disease.',
            items: [i(14), i(15)],
            learningObjectiveIds: [loId(9)],
            sourceFileIds: [uploadId(3)],
          },
        ],
      },
    ],
    warnings: [
      '“Renal Physiology L2.pdf” has only pending learning objectives, so it was not used. Accept its objectives to include it next time.',
      '“ESC Guideline – Chronic Coronary Syndromes.pdf” has no brief (uploaded before briefs existed); its outline was used instead.',
    ],
  };
};

// ---------------------------------------------------------------------------
// Event script
// ---------------------------------------------------------------------------

interface ScriptedEvent {
  at: number;
  agent: string;
  kind: ModuleGenerationEventKind;
  label: string;
  tokensIn?: number;
  tokensOut?: number;
}

const EVENT_SCRIPT: ScriptedEvent[] = [
  { at: 2700, agent: 'orchestrator', kind: 'tool_call', label: 'Reading the course overview', tokensIn: 6200, tokensOut: 310 },
  { at: 3300, agent: 'orchestrator', kind: 'tool_call', label: 'Listing 4 course files', tokensIn: 7100, tokensOut: 180 },
  { at: 3900, agent: 'orchestrator', kind: 'tool_call', label: 'Loading 18 accepted learning objectives', tokensIn: 9400, tokensOut: 220 },
  { at: 4500, agent: 'orchestrator', kind: 'subagent_start', label: 'Asking a file analyst to read “Cardio L1 – Cardiac Cycle.pdf”' },
  { at: 4700, agent: 'orchestrator', kind: 'subagent_start', label: 'Asking a file analyst to read “ESC Guideline – Chronic Coronary Syndromes.pdf”' },
  { at: 5300, agent: 'file_analyst#1', kind: 'tool_call', label: 'Reading Cardio L1 – Cardiac Cycle.pdf (section 1/6)', tokensIn: 3900, tokensOut: 420 },
  { at: 5700, agent: 'file_analyst#2', kind: 'tool_call', label: 'Reading ESC Guideline – Chronic Coronary Syndromes.pdf (section 1/9)', tokensIn: 4100, tokensOut: 380 },
  { at: 6400, agent: 'file_analyst#1', kind: 'tool_call', label: 'Searching file content for “Frank–Starling”', tokensIn: 2800, tokensOut: 150 },
  { at: 7000, agent: 'file_analyst#2', kind: 'tool_call', label: 'Reading ESC Guideline – Chronic Coronary Syndromes.pdf (section 4/9)', tokensIn: 4300, tokensOut: 360 },
  { at: 7800, agent: 'file_analyst#1', kind: 'subagent_done', label: 'File analyst finished Cardio L1 (4 suggested groupings)', tokensIn: 1200, tokensOut: 900 },
  { at: 8400, agent: 'file_analyst#2', kind: 'subagent_done', label: 'File analyst finished the ESC guideline (3 suggested groupings)', tokensIn: 1100, tokensOut: 840 },
  { at: 8800, agent: 'orchestrator', kind: 'warning', label: 'Renal Physiology L2.pdf has only pending learning objectives; skipping it' },
  { at: 9300, agent: 'orchestrator', kind: 'subagent_start', label: 'Asking an item author to cover 3 objectives without items' },
  { at: 10000, agent: 'item_author#1', kind: 'tool_call', label: 'Loading “Describe the Frank–Starling mechanism”', tokensIn: 1800, tokensOut: 120 },
  { at: 11000, agent: 'item_author#1', kind: 'tool_call', label: 'Drafting 3 flashcards for “Describe the Frank–Starling mechanism”', tokensIn: 5200, tokensOut: 1900 },
  { at: 12300, agent: 'item_author#1', kind: 'tool_call', label: 'Drafting 2 MCQs for “Interpret a pressure–volume loop”', tokensIn: 5600, tokensOut: 2300 },
  { at: 13600, agent: 'item_author#1', kind: 'tool_call', label: 'Drafting 1 SAQ for “Justify MRA use in HFrEF”', tokensIn: 4800, tokensOut: 1100 },
  { at: 14500, agent: 'item_author#1', kind: 'subagent_done', label: 'Item author drafted 6 items', tokensIn: 900, tokensOut: 600 },
  { at: 15300, agent: 'orchestrator', kind: 'compaction', label: 'Compacted working notes (61k → 9k tokens)', tokensIn: 61000, tokensOut: 2400 },
  { at: 15800, agent: 'orchestrator', kind: 'subagent_start', label: 'Asking a session designer to order “Cardiac Physiology Foundations”' },
  { at: 16400, agent: 'session_designer#1', kind: 'tool_call', label: 'Loading 14 items for 5 objectives', tokensIn: 3600, tokensOut: 200 },
  { at: 17600, agent: 'session_designer#1', kind: 'subagent_done', label: 'Designed 3 sessions for Cardiac Physiology Foundations', tokensIn: 2400, tokensOut: 1500 },
  { at: 18400, agent: 'orchestrator', kind: 'tool_call', label: 'Submitting the plan (3 modules, 7 sessions)', tokensIn: 12000, tokensOut: 3100 },
  { at: 19300, agent: 'orchestrator', kind: 'tool_call', label: 'Plan validated', tokensIn: 0, tokensOut: 0 },
];

const FAIL_EVENT: ScriptedEvent = {
  at: FAIL_AT_MS,
  agent: 'orchestrator',
  kind: 'error',
  label: 'submit_plan rejected 3 times: session “Acute Coronary Syndromes” has no items',
};

const stageAt = (elapsed: number): ModuleGenerationStage =>
  elapsed < ANALYZING_END_MS ? 'analyzing' : elapsed < DRAFTING_END_MS ? 'drafting_items' : 'planning';

// ---------------------------------------------------------------------------
// In-memory jobs
// ---------------------------------------------------------------------------

interface MockJob {
  id: string;
  identifier: string;
  courseKey: string;
  courseId: string;
  scenario: ModuleGenerationMockScenario;
  options: ModuleGenerationOptions;
  startedAt: number;
  cancelRequestedAt: number | null;
  end: { status: 'completed' | 'failed' | 'cancelled'; at: number } | null;
  reviewState: ModuleGenerationJob['reviewState'];
  errorMessage: string | null;
  plan: ModulePlan | null;
  version: number | null;
  planUpdatedAt: string | null;
  suggestions: ItemSuggestion[];
  /** Ids "deleted" since the draft was made (stale_ids scenario). */
  staleIds: Set<string>;
  staleIdsArmed: boolean;
  staleVersionArmed: boolean;
  updatedAt: number;
}

const jobsById = new Map<string, MockJob>();
const jobsByCourse = new Map<string, MockJob[]>();
let nextScenario: ModuleGenerationMockScenario = 'success';

const courseKeyOf = (courseIdentifier: string) => courseIdentifier.split('/').filter(Boolean).pop() || courseIdentifier;

const settle = (job: MockJob, now = Date.now()) => {
  if (job.end) return job;
  const candidates: { status: 'completed' | 'failed' | 'cancelled'; at: number }[] = [
    { status: 'completed', at: job.startedAt + PLANNING_END_MS },
  ];
  if (job.scenario === 'fail') candidates.push({ status: 'failed', at: job.startedAt + FAIL_AT_MS });
  if (job.cancelRequestedAt !== null) {
    candidates.push({ status: 'cancelled', at: job.cancelRequestedAt + CANCEL_CHECKPOINT_MS });
  }
  const first = candidates.sort((left, right) => left.at - right.at)[0];
  if (first.at > now) return job;

  job.end = first;
  job.updatedAt = first.at;
  if (first.status === 'completed') {
    job.plan = buildPlan(job.identifier);
    job.version = 1;
    job.planUpdatedAt = iso(first.at);
    job.reviewState = 'awaiting_review';
    job.suggestions = buildSuggestions(job, iso(first.at));
  } else if (first.status === 'failed') {
    job.errorMessage =
      'The planner could not produce a valid plan after 3 attempts: session “Acute Coronary Syndromes” has no items.';
  } else {
    job.errorMessage = null;
  }
  return job;
};

const visibleEvents = (job: MockJob, now = Date.now()): ModuleGenerationEvent[] => {
  const cutoff = (job.end ? job.end.at : now) - job.startedAt;
  const script = job.scenario === 'fail' ? [...EVENT_SCRIPT.filter((e) => e.at < FAIL_AT_MS), FAIL_EVENT] : EVENT_SCRIPT;
  const shown: ScriptedEvent[] = script.filter((event) => event.at <= cutoff);
  if (job.end?.status === 'cancelled') {
    shown.push({
      at: cutoff,
      agent: 'orchestrator',
      kind: 'warning',
      label: 'Cancelled at the next checkpoint; draft items were rejected',
    });
  }
  return shown.map((event, index) => ({
    seq: index + 1,
    agent: event.agent,
    kind: event.kind,
    label: event.label,
    detail: null,
    tokensIn: event.tokensIn,
    tokensOut: event.tokensOut,
    createdAt: iso(job.startedAt + event.at),
  }));
};

const toJob = (job: MockJob, now = Date.now()): CourseGenerationJob => {
  settle(job, now);
  const elapsed = now - job.startedAt;
  const status: CourseGenerationJob['status'] = job.end
    ? job.end.status
    : elapsed < QUEUED_MS
      ? 'queued'
      : 'processing';
  const events = visibleEvents(job, now);
  return {
    id: job.id,
    identifier: job.identifier,
    courseId: job.courseId,
    kind: 'modules',
    status,
    stage: status === 'processing' ? stageAt(elapsed) : null,
    reviewState: status === 'completed' ? job.reviewState : null,
    cancelRequestedAt: job.cancelRequestedAt !== null ? iso(job.cancelRequestedAt) : null,
    tokensIn: events.reduce((sum, event) => sum + (event.tokensIn ?? 0), 0),
    tokensOut: events.reduce((sum, event) => sum + (event.tokensOut ?? 0), 0),
    llmCalls: events.filter((event) => event.tokensIn || event.tokensOut).length,
    triggerSource: job.options.triggerSource,
    queuedCount: 0,
    processingCount: status === 'processing' ? 1 : 0,
    completedCount: status === 'completed' ? 1 : 0,
    failedCount: status === 'failed' ? 1 : 0,
    skippedCount: 0,
    errorMessage: job.errorMessage,
    createdAt: iso(job.startedAt),
    updatedAt: iso(Math.max(job.updatedAt, Math.min(now, job.end?.at ?? now))),
  };
};

const toDetail = (job: MockJob): ModuleGenerationJob => {
  const base = toJob(job);
  const events = visibleEvents(job);
  return {
    ...base,
    options: clone(job.options),
    plan: job.plan && base.status === 'completed' ? clone(job.plan) : null,
    version: job.plan && base.status === 'completed' ? job.version : null,
    planUpdatedAt: job.planUpdatedAt,
    lastEventSeq: events.length,
    itemSuggestions: job.plan ? clone(job.suggestions) : undefined,
  };
};

const createJob = (
  courseIdentifier: string,
  options: ModuleGenerationOptions,
  scenario: ModuleGenerationMockScenario,
  startedAt = Date.now(),
): MockJob => {
  const identifier = slug();
  const courseKey = courseKeyOf(courseIdentifier);
  const job: MockJob = {
    id: fakeUrl('course-generation-jobs', identifier),
    identifier,
    courseKey,
    courseId: fakeUrl('courses', courseKey),
    scenario,
    options: clone(options),
    startedAt,
    cancelRequestedAt: null,
    end: null,
    reviewState: null,
    errorMessage: null,
    plan: null,
    version: null,
    planUpdatedAt: null,
    suggestions: [],
    staleIds: new Set(),
    staleIdsArmed: scenario === 'stale_ids_on_accept',
    staleVersionArmed: scenario === 'stale_version_on_save',
    updatedAt: startedAt,
  };
  jobsById.set(identifier, job);
  jobsByCourse.set(courseKey, [job, ...(jobsByCourse.get(courseKey) ?? [])]);
  return job;
};

const findJob = (jobIdentifier: string) => {
  const job = jobsById.get(courseKeyOf(jobIdentifier));
  if (!job) throw Object.assign(new Error('Module generation job not found'), { status: 404 });
  return settle(job);
};

const openJobFor = (courseIdentifier: string) =>
  (jobsByCourse.get(courseKeyOf(courseIdentifier)) ?? []).find((job) => isJobOpen(toJob(job))) ?? null;

const fail = (status: number, body: unknown): never => {
  throw new ModuleGenerationRequestError(status, body);
};

/** Server-side checks: structure (400), then ids that no longer resolve (409). */
const checkPlanAgainstState = (job: MockJob, plan: ModulePlan) => {
  const issues = validateModulePlan(plan);
  if (issues.length > 0) fail(400, { error: 'The plan is invalid.', issues });

  const suggestionIds = new Set(
    job.suggestions.filter((suggestion) => suggestion.status === 'pending').map((s) => s.id),
  );
  const staleIssues: ModulePlanIssue[] = [];
  plan.modules.forEach((module, mi) =>
    module.sessions.forEach((session, si) => {
      session.items.forEach((ref, ii) => {
        const id = refId(ref);
        const path = `modules[${mi}].sessions[${si}].items[${ii}]`;
        if (ref.itemId && (!MOCK_ITEM_BY_ID.has(id) || job.staleIds.has(id))) {
          staleIssues.push({ code: 'unknown_item', path, id, message: 'This item was deleted.' });
        }
        if (ref.itemSuggestionId && (!suggestionIds.has(id) || job.staleIds.has(id))) {
          staleIssues.push({
            code: 'unknown_item_suggestion',
            path,
            id,
            message: 'This drafted item is no longer available.',
          });
        }
      });
      sessionDependencyIds(session)
        .filter((id) => job.staleIds.has(id) && !session.items.some((ref) => refId(ref) === id))
        .forEach((id) =>
          staleIssues.push({
            code: 'unknown_learning_objective',
            path: `modules[${mi}].sessions[${si}]`,
            id,
            message: 'This learning objective was deleted.',
          }),
        );
    }),
  );
  if (staleIssues.length > 0) {
    fail(409, {
      error: 'Some items in the draft no longer exist.',
      reason: 'stale_ids',
      version: job.version,
      staleIds: Array.from(new Set(staleIssues.map((issue) => issue.id!))),
      issues: staleIssues,
    });
  }
};

const requireAwaitingReview = (job: MockJob) => {
  const base = toJob(job);
  if (!(base.status === 'completed' && job.reviewState === 'awaiting_review')) {
    fail(409, {
      error: 'This draft is no longer awaiting review.',
      reason: 'not_awaiting_review',
      version: job.version,
    });
  }
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const moduleGenerationServiceMock: ModuleGenerationService = {
  getOpenJob: async (courseIdentifier) => {
    await delay(NETWORK_MS);
    const job = openJobFor(courseIdentifier);
    return job ? toJob(job) : null;
  },

  startGeneration: async (courseIdentifier, options) => {
    await delay(NETWORK_MS);
    const scenario = nextScenario;
    if (scenario === 'open_draft_conflict' && !openJobFor(courseIdentifier)) {
      // A draft that finished a while ago and is still awaiting review.
      createJob(courseIdentifier, { triggerSource: 'mock' }, 'success', Date.now() - PLANNING_END_MS - 60_000);
    }
    const open = openJobFor(courseIdentifier);
    if (open) {
      fail(409, { error: 'This course already has an open module generation job.', job: toJob(open) });
    }
    if (options.targetModuleCount != null && options.targetModuleCount < 1) {
      fail(400, { error: 'targetModuleCount must be at least 1.' });
    }
    const { min, max } = options.sessionsPerModule ?? {};
    if (min != null && max != null && min > max) {
      fail(400, { error: 'sessionsPerModule.min must not exceed max.' });
    }
    if (options.fileIds && options.fileIds.length === 0) {
      fail(400, { error: 'Select at least one file.' });
    }
    return toJob(createJob(courseIdentifier, options, scenario));
  },

  getJob: async (jobIdentifier) => {
    await delay(NETWORK_MS);
    return toDetail(findJob(jobIdentifier));
  },

  listEvents: async (jobIdentifier, params = {}) => {
    await delay(NETWORK_MS);
    const job = findJob(jobIdentifier);
    const all = visibleEvents(job);
    const afterSeq = params.afterSeq ?? 0;
    const limit = Math.min(params.limit ?? 100, 500);
    const items = all.filter((event) => event.seq > afterSeq).slice(0, limit);
    return { items, lastSeq: items.length > 0 ? items[items.length - 1].seq : afterSeq };
  },

  cancel: async (jobIdentifier) => {
    await delay(NETWORK_MS);
    const job = findJob(jobIdentifier);
    const current = toJob(job);
    if (!isJobRunning(current)) {
      fail(409, { error: 'The job already finished.' });
    }
    const now = Date.now();
    if (current.status === 'queued') {
      job.cancelRequestedAt = now;
      job.end = { status: 'cancelled', at: now };
    } else if (job.cancelRequestedAt === null) {
      job.cancelRequestedAt = now;
    }
    job.updatedAt = now;
    return toJob(job);
  },

  updatePlan: async (jobIdentifier, request) => {
    await delay(NETWORK_MS);
    const job = findJob(jobIdentifier);
    requireAwaitingReview(job);
    if (job.staleVersionArmed && job.plan) {
      // Simulate a save from another tab that landed first.
      job.staleVersionArmed = false;
      job.plan = clone(job.plan);
      job.plan.modules[0].title = `${job.plan.modules[0].title} (edited in another tab)`;
      job.version = (job.version ?? 1) + 1;
      job.planUpdatedAt = iso(Date.now());
    }
    if (request.version !== job.version) {
      fail(409, {
        error: 'The draft was saved elsewhere since you loaded it.',
        reason: 'stale_version',
        version: job.version,
      });
    }
    checkPlanAgainstState(job, request.plan);
    job.plan = clone(request.plan);
    job.version = (job.version ?? 1) + 1;
    job.planUpdatedAt = iso(Date.now());
    job.updatedAt = Date.now();
    return {
      jobId: job.id,
      plan: clone(job.plan),
      version: job.version,
      updatedBy: 'mock-teacher',
      updatedAt: job.planUpdatedAt,
    };
  },

  accept: async (jobIdentifier, request): Promise<AcceptModulePlanResponse> => {
    await delay(NETWORK_MS * 2);
    const job = findJob(jobIdentifier);
    requireAwaitingReview(job);
    if (request.version !== job.version) {
      fail(409, {
        error: 'The draft was saved elsewhere since you loaded it.',
        reason: 'stale_version',
        version: job.version,
      });
    }
    const plan = job.plan!;
    if (job.staleIdsArmed) {
      // Something was deleted between drafting and accepting: one existing
      // item and one drafted item.
      job.staleIdsArmed = false;
      job.staleIds = new Set([itemId(8), suggestionIdFor(job.identifier, 's6')]);
      job.suggestions = job.suggestions.map((suggestion) =>
        job.staleIds.has(suggestion.id) ? { ...suggestion, status: 'rejected' } : suggestion,
      );
    }
    checkPlanAgainstState(job, plan);

    const referenced = new Set(
      plan.modules.flatMap((module) => module.sessions.flatMap((session) => session.items.map(refId))),
    );
    const acceptedIds = new Map<string, string>();
    job.suggestions = job.suggestions.map((suggestion) => {
      if (suggestion.status !== 'pending') return suggestion;
      if (!referenced.has(suggestion.id)) return { ...suggestion, status: 'rejected' };
      const acceptedItemId = fakeUrl('items', slug());
      acceptedIds.set(suggestion.id, acceptedItemId);
      return { ...suggestion, status: 'accepted', acceptedItemId };
    });
    job.reviewState = 'accepted';
    job.updatedAt = Date.now();

    return {
      job: toJob(job),
      modules: plan.modules.map((module) => {
        const moduleIdentifier = slug();
        return {
          id: fakeUrl('course-modules', moduleIdentifier),
          identifier: moduleIdentifier,
          title: module.title,
          displayOrder: module.order,
          sessions: module.sessions.map((session) => {
            const sessionIdentifier = slug();
            return {
              id: fakeUrl('course-sessions', sessionIdentifier),
              identifier: sessionIdentifier,
              title: session.title,
              displayOrder: session.order,
              itemIds: session.items.map((ref) =>
                ref.itemSuggestionId ? acceptedIds.get(ref.itemSuggestionId)! : ref.itemId!,
              ),
            };
          }),
        };
      }),
      createdItemIds: Array.from(acceptedIds.values()),
    };
  },

  discard: async (jobIdentifier) => {
    await delay(NETWORK_MS);
    const job = findJob(jobIdentifier);
    const current = toJob(job);
    if (!(current.status === 'completed' && job.reviewState === 'awaiting_review')) {
      fail(409, { error: 'This draft is not awaiting review.' });
    }
    job.reviewState = 'discarded';
    job.suggestions = job.suggestions.map((suggestion) =>
      suggestion.status === 'pending' ? { ...suggestion, status: 'rejected' } : suggestion,
    );
    job.updatedAt = Date.now();
    return toJob(job);
  },
};

/** Mock course files and items so the wizard needs no backend at all. */
export const moduleGenerationMockData = {
  listCompletedUploads: async (): Promise<CourseUpload[]> => {
    await delay(NETWORK_MS);
    return clone(MOCK_UPLOADS);
  },
  getItems: async (ids: string[]): Promise<Record<string, BackendApiItem | null>> => {
    await delay(NETWORK_MS);
    return Object.fromEntries(ids.map((id) => [id, MOCK_ITEM_BY_ID.get(id) ? clone(MOCK_ITEM_BY_ID.get(id)!) : null]));
  },
};

/** Scenario picker for the next generated job (mock mode only). */
export const moduleGenerationMockControls = {
  scenarios: MODULE_GENERATION_MOCK_SCENARIOS,
  getScenario: () => nextScenario,
  setScenario: (scenario: ModuleGenerationMockScenario) => {
    nextScenario = scenario;
  },
};
