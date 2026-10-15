import type { ItemSuggestion } from '@/types/CourseAITypes';
import type { SessionItemDetail } from '@/components/academy/course-workbench/SessionItemDetailModal';

export const suggestionTitle = (suggestion: ItemSuggestion) =>
  suggestion.draft.lecture?.title ||
  suggestion.draft.mcq?.stem ||
  suggestion.draft.saq?.question ||
  suggestion.draft.flashcard?.front ||
  'Drafted item';

/**
 * Shape an AI-drafted item like a real item so the existing
 * `SessionItemDetailModal` can preview it.
 */
export const suggestionToItemDetail = (suggestion: ItemSuggestion): SessionItemDetail => ({
  id: suggestion.id,
  identifier: suggestion.identifier,
  type: suggestion.type,
  status: 'draft',
  learningObjectiveId: suggestion.learningObjectiveId,
  createdAt: suggestion.createdAt ?? '',
  updatedAt: suggestion.updatedAt ?? '',
  mcq: suggestion.draft.mcq
    ? {
        stem: suggestion.draft.mcq.stem,
        choices: suggestion.draft.mcq.choices.map((choice) => ({
          content: choice.content,
          isCorrect: choice.isCorrect,
          explanation: choice.explanation ?? '',
          createdAt: '',
          updatedAt: '',
        })),
      }
    : null,
  saq: suggestion.draft.saq ?? null,
  lecture: suggestion.draft.lecture ?? null,
  flashcard: suggestion.draft.flashcard ?? null,
  tags: [],
});
