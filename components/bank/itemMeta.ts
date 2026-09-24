import { formatDistanceToNowStrict } from 'date-fns';
import { ClipboardCheck, FileText, Layers, MonitorPlay, type LucideIcon } from 'lucide-react';
import type { BadgeTone } from '@/components/ui';
import type { BackendApiItem } from '@/types/TestsServiceTypes';

/** Sentinel used by every single-value filter for "no filter". */
export const ALL = 'ALL';

export interface BankFilterState {
  type: string;
  status: string;
  examType: string;
  cognitiveSkillId: string;
  organSystemId: string;
  topicId: string;
  subTopicId: string;
  /** Subjects are filtered by title (that is what the items API expects). */
  subjectId: string;
  disciplines: string[];
  tags: string[];
}

export const EMPTY_FILTERS: BankFilterState = {
  type: ALL,
  status: ALL,
  examType: ALL,
  cognitiveSkillId: ALL,
  organSystemId: ALL,
  topicId: ALL,
  subTopicId: ALL,
  subjectId: ALL,
  disciplines: [],
  tags: [],
};

/** How many filters (not counting text search or QID) are narrowing the list. */
export const countActiveFilters = (filters: BankFilterState) =>
  [
    filters.type,
    filters.status,
    filters.examType,
    filters.cognitiveSkillId,
    filters.organSystemId,
    filters.topicId,
    filters.subTopicId,
    filters.subjectId,
  ].filter((value) => value !== ALL).length +
  (filters.disciplines.length > 0 ? 1 : 0) +
  (filters.tags.length > 0 ? 1 : 0);

export interface Option {
  id: string;
  name: string;
}

export const TYPE_META: Record<string, { label: string; long: string; icon: LucideIcon }> = {
  mcq: { label: 'MCQ', long: 'Multiple choice', icon: ClipboardCheck },
  saq: { label: 'SAQ', long: 'Short answer', icon: FileText },
  flashcard: { label: 'Flashcard', long: 'Flashcard', icon: Layers },
  lecture: { label: 'Lecture', long: 'Lecture', icon: MonitorPlay },
};

export const TYPE_OPTIONS: Option[] = [
  { id: 'mcq', name: 'MCQ' },
  { id: 'saq', name: 'SAQ' },
  { id: 'flashcard', name: 'Flashcard' },
  { id: 'lecture', name: 'Lecture' },
];

export const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  live: { label: 'Live', tone: 'green' },
  published: { label: 'Published', tone: 'green' },
  pending: { label: 'Pending', tone: 'amber' },
  draft: { label: 'Draft', tone: 'neutral' },
};

export const STATUS_OPTIONS: Option[] = [
  { id: 'live', name: 'Live' },
  { id: 'draft', name: 'Draft' },
  { id: 'pending', name: 'Pending' },
  { id: 'published', name: 'Published' },
];

/** Statuses an item can be moved to in bulk. */
export const BULK_STATUSES = ['live', 'draft', 'pending'] as const;
export type BulkStatus = (typeof BULK_STATUSES)[number];

export const EXAM_OPTIONS: Option[] = [
  { id: 'STEP 1', name: 'STEP 1' },
  { id: 'STEP 2', name: 'STEP 2' },
  { id: 'STEP 3', name: 'STEP 3' },
];

export const statusMeta = (status: string) =>
  STATUS_META[status] ?? {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft',
    tone: 'neutral' as BadgeTone,
  };

/** The text people recognise an item by: stem, question, card front or lecture title. */
export const itemStem = (item: BackendApiItem) =>
  (
    item.mcq?.stem ||
    item.saq?.question ||
    item.lecture?.title ||
    item.flashcard?.front ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled item';

export const itemId = (item: BackendApiItem) => item.identifier || item.id;

export const relativeTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : formatDistanceToNowStrict(date, { addSuffix: true });
};

export const fullDate = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString();
};

export const plural = (count: number, word: string) =>
  `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
