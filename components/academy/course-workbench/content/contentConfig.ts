import type { ItemSuggestionType } from '@/types/CourseAITypes';
import type { SuggestionStatus } from '@/types/CourseStudioTypes';

/** How many AI drafts of each type to request per objective. */
export type ItemPlan = Record<ItemSuggestionType, number>;

export const ITEM_TYPE_META: Record<ItemSuggestionType, { label: string; short: string }> = {
  mcq: { label: 'Multiple choice', short: 'MCQ' },
  saq: { label: 'Short answer', short: 'SAQ' },
  flashcard: { label: 'Flashcard', short: 'Flashcard' },
  lecture: { label: 'Lecture', short: 'Lecture' },
};

/** Lectures are authored elsewhere; the content workspace drafts these types. */
export const VISIBLE_ITEM_TYPES: ItemSuggestionType[] = ['mcq', 'saq', 'flashcard'];

/** Upper bound per type per objective (matches the previous stepper clamp). */
export const PLAN_MAX_PER_TYPE = 10;

export const createDefaultPlan = (): ItemPlan => ({
  mcq: 0,
  saq: 0,
  flashcard: 0,
  lecture: 0,
});

export const visiblePlanEntries = (plan: ItemPlan) =>
  VISIBLE_ITEM_TYPES.filter((type) => plan[type] > 0).map((type) => ({
    type,
    count: plan[type],
  }));

export const clampPlanValue = (value: number) =>
  Math.max(0, Math.min(PLAN_MAX_PER_TYPE, value));

export const DRAFT_STATUS_OPTIONS: { value: SuggestionStatus; label: string }[] = [
  { value: 'pending', label: 'Needs review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;
