import React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/components/ui';

export type AttentionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AttentionItem {
  id: string;
  priority: AttentionPriority;
  icon: LucideIcon;
  title: string;
  /** One line of detail: the evidence behind the flag. */
  detail: string;
  /** Where the row goes, e.g. "Review learners". */
  actionLabel: string;
  onSelect: () => void;
}

const PRIORITY: Record<AttentionPriority, { tile: string; label: string; rank: number }> = {
  HIGH: { tile: 'bg-red-50 text-red-600 ring-red-100', label: 'High priority', rank: 0 },
  MEDIUM: { tile: 'bg-amber-50 text-amber-700 ring-amber-100', label: 'Needs attention', rank: 1 },
  LOW: { tile: 'bg-stone-100 text-stone-500 ring-stone-200/70', label: 'For your information', rank: 2 },
};

/** Highest priority first; ties keep their original order. */
export const sortByPriority = (items: AttentionItem[]) =>
  items
    .map((item, index) => ({ item, index }))
    .sort(
      (left, right) =>
        PRIORITY[left.item.priority].rank - PRIORITY[right.item.priority].rank ||
        left.index - right.index,
    )
    .map(({ item }) => item);

interface NeedsAttentionListProps {
  items: AttentionItem[];
  /** Rendered instead of the list when there is nothing to act on. */
  empty: React.ReactNode;
}

/** Divided rows; each row is one flag and opens the page where it gets fixed. */
export const NeedsAttentionList: React.FC<NeedsAttentionListProps> = ({ items, empty }) => {
  if (items.length === 0) return <>{empty}</>;

  return (
    <ul className="divide-y divide-stone-100">
      {items.map((item) => {
        const Icon = item.icon;
        const priority = PRIORITY[item.priority];
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.onSelect}
              className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
            >
              <span
                className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
                  priority.tile,
                )}
                title={priority.label}
              >
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="sr-only">{priority.label}: </span>
                <span className="block text-sm font-medium text-stone-900">{item.title}</span>
                <span className="mt-0.5 block text-[13px] leading-5 text-stone-500">
                  {item.detail}
                </span>
              </span>
              <span className="hidden flex-shrink-0 text-[13px] font-medium text-stone-600 transition-colors group-hover:text-stone-900 sm:inline">
                {item.actionLabel}
              </span>
              <ChevronRight
                size={16}
                className="flex-shrink-0 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-600"
                aria-hidden="true"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
};
