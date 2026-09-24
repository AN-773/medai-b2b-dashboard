import React from 'react';
import { cn } from '@/components/ui';

export type CohortTab = 'overview' | 'learners' | 'courses';

export interface CohortTabItem {
  id: CohortTab;
  label: string;
  /** Short trailing figure, e.g. a count. */
  figure?: string;
  attention?: boolean;
}

interface CohortTabsProps {
  tabs: CohortTabItem[];
  active: CohortTab;
  onSelect: (tab: CohortTab) => void;
}

/** Underline tabs for the cohort workspace; sticks under the top bar while scrolling. */
const CohortTabs: React.FC<CohortTabsProps> = ({ tabs, active, onSelect }) => (
  <div className="sticky top-0 z-20 -mx-4 border-b border-stone-200 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:-mx-8 sm:px-8">
    <div
      role="tablist"
      aria-label="Cohort sections"
      className="-ml-2.5 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`cohort-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`cohort-panel-${tab.id}`}
            onClick={() => onSelect(tab.id)}
            className={cn(
              'relative inline-flex h-12 flex-shrink-0 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
              isActive ? 'text-stone-900' : 'text-stone-500 hover:text-stone-900',
            )}
          >
            {tab.label}
            {tab.figure && (
              <span className="text-xs font-normal tabular-nums text-stone-400">{tab.figure}</span>
            )}
            {tab.attention && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Needs attention" />
            )}
            {isActive && (
              <span className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-stone-900" />
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export default CohortTabs;
