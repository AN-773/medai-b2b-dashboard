import React from 'react';
import { Badge, cn } from '@/components/ui';

export interface WorkbenchTabSpec<T extends string> {
  id: T;
  label: string;
  /** Small trailing badge, e.g. "Preview". */
  badge?: string;
}

interface WorkbenchTabsProps<T extends string> {
  tabs: WorkbenchTabSpec<NoInfer<T>>[];
  active: T;
  onSelect: (tab: NoInfer<T>) => void;
  label: string;
  /** Prefix for tab / panel ids so panels can reference their tab. */
  idPrefix: string;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/** Underline tabs for switching between a page's sub-views. */
const WorkbenchTabs = <T extends string>({
  tabs,
  active,
  onSelect,
  label,
  idPrefix,
}: WorkbenchTabsProps<T>) => (
  <div
    role="tablist"
    aria-label={label}
    className="flex items-center gap-1 overflow-x-auto border-b border-stone-200 [scrollbar-width:none]"
  >
    {tabs.map((tab) => {
      const isActive = tab.id === active;
      return (
        <button
          key={tab.id}
          id={tabId(idPrefix, tab.id)}
          type="button"
          role="tab"
          aria-selected={isActive}
          aria-controls={panelId(idPrefix, tab.id)}
          tabIndex={isActive ? 0 : -1}
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            const index = tabs.findIndex((entry) => entry.id === tab.id);
            const next =
              tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
            onSelect(next.id);
            document.getElementById(tabId(idPrefix, next.id))?.focus();
          }}
          className={cn(
            'relative inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
            isActive ? 'text-stone-900' : 'text-stone-500 hover:text-stone-900',
          )}
        >
          {tab.label}
          {tab.badge && <Badge tone="neutral">{tab.badge}</Badge>}
          {isActive && (
            <span
              className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-stone-900"
              aria-hidden="true"
            />
          )}
        </button>
      );
    })}
  </div>
);

export default WorkbenchTabs;
