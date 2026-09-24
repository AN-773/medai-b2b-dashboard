import React, { useRef } from 'react';
import { cn } from '@/components/ui';
import { formatNumber } from './shared';

export interface AuditTabDef<T extends string> {
  id: T;
  label: string;
  count?: number;
  /** Dot after the label: amber = worth checking, red = failures inside. */
  attention?: 'amber' | 'red' | null;
  attentionLabel?: string;
}

interface AuditTabsProps<T extends string> {
  tabs: AuditTabDef<NoInfer<T>>[];
  active: T;
  onSelect: (tab: NoInfer<T>) => void;
  label: string;
  idPrefix: string;
}

export const auditTabId = (idPrefix: string, tab: string) => `${idPrefix}-tab-${tab}`;
export const auditPanelId = (idPrefix: string) => `${idPrefix}-panel`;

/**
 * Underline tabs that stick to the top of the page sheet while scrolling —
 * the same treatment as the course workspace tabs. Arrow keys move between tabs.
 */
export const AuditTabs = <T extends string>({
  tabs,
  active,
  onSelect,
  label,
  idPrefix,
}: AuditTabsProps<T>) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === active);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    if (!next) return;
    onSelect(next.id);
    listRef.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(auditTabId(idPrefix, next.id))}`)
      ?.focus();
  };

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-stone-200 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:-mx-8 sm:px-8">
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              id={auditTabId(idPrefix, tab.id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={auditPanelId(idPrefix)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              className={cn(
                'relative inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                isActive ? 'text-stone-900' : 'text-stone-500 hover:text-stone-900',
              )}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className="text-xs font-normal tabular-nums text-stone-400">
                  {formatNumber(tab.count)}
                </span>
              )}
              {tab.attention && (
                <span
                  role="img"
                  aria-label={tab.attentionLabel ?? 'Needs attention'}
                  title={tab.attentionLabel}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    tab.attention === 'red' ? 'bg-red-500' : 'bg-amber-500',
                  )}
                />
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
};
