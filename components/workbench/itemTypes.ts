import { ClipboardCheck, FileText, Layers, MonitorPlay, type LucideIcon } from 'lucide-react';
import { ItemType } from '@/types';
import type { ApiItemType } from '@/types/TestsServiceTypes';

export interface ItemTypeSpec {
  type: ItemType;
  /** Short name used in labels and buttons: "MCQ", "Flashcard". */
  label: string;
  plural: string;
  /** Label in the "New item" menu. */
  menuLabel: string;
  /** One line explaining the format. */
  description: string;
  /** What the list shows for each item: the stem, prompt, front or title. */
  textLabel: string;
  icon: LucideIcon;
  /** `?questionId=` value that opens a blank editor for this type. */
  newParam: string;
}

/** Authoring formats, in the order they appear in switchers and menus. */
export const ITEM_TYPES: ItemTypeSpec[] = [
  {
    type: ItemType.MCQ,
    label: 'MCQ',
    plural: 'MCQs',
    menuLabel: 'MCQ',
    description: 'Single-best-answer questions',
    textLabel: 'Stem',
    icon: ClipboardCheck,
    newParam: 'new',
  },
  {
    type: ItemType.SAQ,
    label: 'SAQ',
    plural: 'SAQs',
    menuLabel: 'Short answer (SAQ)',
    description: 'Short-answer prompts with a model answer',
    textLabel: 'Prompt',
    icon: FileText,
    newParam: 'new_saq',
  },
  {
    type: ItemType.FLASHCARD,
    label: 'Flashcard',
    plural: 'Flashcards',
    menuLabel: 'Flashcard',
    description: 'Active-recall cards for spaced repetition',
    textLabel: 'Front',
    icon: Layers,
    newParam: 'new_flashcard',
  },
  {
    type: ItemType.LECTURE,
    label: 'Lecture',
    plural: 'Lectures',
    menuLabel: 'Lecture',
    description: 'Instructional lectures',
    textLabel: 'Title',
    icon: MonitorPlay,
    newParam: 'new_lecture',
  },
];

export const ITEM_TYPE_SPEC = Object.fromEntries(
  ITEM_TYPES.map((spec) => [spec.type, spec]),
) as Record<ItemType, ItemTypeSpec>;

/** Human label for a backend item type ("mcq" → "MCQ"). */
export const apiTypeLabel = (type: ApiItemType | string | undefined) => {
  const spec = ITEM_TYPES.find((entry) => entry.type.toLowerCase() === type?.toLowerCase());
  return spec?.label ?? 'Item';
};
