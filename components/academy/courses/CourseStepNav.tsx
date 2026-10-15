import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/components/ui';

export type WorkbenchTab = 'overview' | 'objectives' | 'resources' | 'content' | 'sessions';

export interface StepTab {
  id: WorkbenchTab;
  label: string;
  /** Pipeline position (1–3) for the build steps; omitted for side tabs. */
  step?: number;
  /** Short trailing figure, e.g. "477" or "86%". */
  figure?: string;
  done?: boolean;
  attention?: boolean;
}

interface CourseStepNavProps {
  tabs: StepTab[];
  active: WorkbenchTab;
  onSelect: (tab: WorkbenchTab) => void;
}

/**
 * Course tabs that read as a pipeline: Overview | ① Objectives › ② Content ›
 * ③ Modules | Resources. Sticks to the top of the page while scrolling.
 */
const CourseStepNav: React.FC<CourseStepNavProps> = ({ tabs, active, onSelect }) => (
  <div className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
    <div
      role="tablist"
      aria-label="Course sections"
      className="mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto px-4 sm:px-8 [scrollbar-width:none]"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === active;
        const next = tabs[index + 1];
        const joinsNextStep = Boolean(tab.step && next?.step);
        const groupEnds = Boolean(tab.step ? !next?.step : next?.step);
        return (
          <React.Fragment key={tab.id}>
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.id)}
              className={cn(
                'relative inline-flex h-12 flex-shrink-0 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                isActive ? 'text-stone-900' : 'text-stone-500 hover:text-stone-900',
              )}
            >
              {tab.step && (
                <span
                  className={cn(
                    'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                    tab.done
                      ? 'bg-brand-500 text-white'
                      : isActive
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200',
                  )}
                  aria-label={tab.done ? 'Done' : `Step ${tab.step}`}
                >
                  {tab.done ? <Check size={12} strokeWidth={3} /> : tab.step}
                </span>
              )}
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
            {joinsNextStep && (
              <ChevronRight size={14} className="flex-shrink-0 text-stone-300" aria-hidden="true" />
            )}
            {groupEnds && index < tabs.length - 1 && (
              <span className="mx-2 h-4 w-px flex-shrink-0 bg-stone-200" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);

export default CourseStepNav;
