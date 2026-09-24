import { formatDistanceToNowStrict } from 'date-fns';
import type { Discipline } from '@/types/TestsServiceTypes';

/** The last path segment of a discipline IRI — what the delete endpoint expects. */
export const getShortIdentifier = (identifier: string) =>
  identifier.split('/').filter(Boolean).pop() || identifier;

export const plural = (count: number, word: string) =>
  `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

export const formatLearningObjectiveCount = (count?: number) =>
  typeof count === 'number'
    ? plural(count, 'learning objective')
    : 'Learning objective count unavailable';

export const hasLinkedObjectives = (discipline: Discipline) =>
  typeof discipline.learningObjectivesTotal === 'number' &&
  discipline.learningObjectivesTotal > 0;

export const DELETE_BLOCKED_HINT =
  'Move or remove linked learning objectives before deleting this discipline.';

const toDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value?: string) =>
  toDate(value)?.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) ?? null;

export const formatRelative = (value?: string) => {
  const date = toDate(value);
  return date ? formatDistanceToNowStrict(date, { addSuffix: true }) : null;
};

/**
 * Option labels for discipline pickers. Titles are the label; the short ID is
 * appended only when two disciplines share a title, so the list stays readable.
 */
export const buildDisciplineOptionLabels = (disciplines: Discipline[]) => {
  const titleCounts = new Map<string, number>();
  disciplines.forEach((discipline) => {
    const key = discipline.title.trim().toLowerCase();
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  });

  return new Map(
    disciplines.map((discipline) => {
      const isDuplicate = (titleCounts.get(discipline.title.trim().toLowerCase()) ?? 0) > 1;
      const count =
        typeof discipline.learningObjectivesTotal === 'number'
          ? ` · ${plural(discipline.learningObjectivesTotal, 'objective')}`
          : '';
      const suffix = isDuplicate ? ` (${getShortIdentifier(discipline.id)})` : '';
      return [discipline.id, `${discipline.title}${suffix}${count}`] as const;
    }),
  );
};
