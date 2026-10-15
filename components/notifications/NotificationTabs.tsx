import React, { useRef } from 'react';
import { cn } from '@/components/ui';
import { NOTIFICATION_TABS, type NotificationTab } from './navigation';

interface NotificationTabsProps {
  active: NotificationTab;
  onSelect: (tab: NotificationTab) => void;
  /** Id of the panel the tabs control. */
  panelId: string;
  className?: string;
}

export const notificationTabId = (tab: NotificationTab) => `notifications-tab-${tab}`;

/**
 * Underline tabs for the Notifications sections. Sticks to the top of the page
 * sheet while scrolling; "Test send" sits apart because it is an action rather
 * than a registry. Arrow keys, Home and End move between tabs.
 */
const NotificationTabs: React.FC<NotificationTabsProps> = ({
  active,
  onSelect,
  panelId,
  className,
}) => {
  const buttonRefs = useRef<Partial<Record<NotificationTab, HTMLButtonElement | null>>>({});

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = NOTIFICATION_TABS.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % NOTIFICATION_TABS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + NOTIFICATION_TABS.length) % NOTIFICATION_TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    const tab = NOTIFICATION_TABS[target].id;
    buttonRefs.current[tab]?.focus();
    onSelect(tab);
  };

  return (
    <div
      className={cn(
        'sticky top-0 z-20 -mx-4 border-b border-stone-200 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:-mx-8 sm:px-8',
        className,
      )}
    >
      <div
        role="tablist"
        aria-label="Notification sections"
        className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]"
      >
        {NOTIFICATION_TABS.map((tab, index) => {
          const isActive = tab.id === active;
          return (
            <React.Fragment key={tab.id}>
              {tab.id === 'send' && (
                <span className="mx-2 h-4 w-px flex-shrink-0 bg-stone-200" aria-hidden="true" />
              )}
              <button
                ref={(element) => {
                  buttonRefs.current[tab.id] = element;
                }}
                id={notificationTabId(tab.id)}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onSelect(tab.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  'relative inline-flex h-12 flex-shrink-0 items-center rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                  isActive ? 'text-stone-900' : 'text-stone-500 hover:text-stone-900',
                )}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-stone-900" />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationTabs;
