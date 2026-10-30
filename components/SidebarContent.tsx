import React, { useState } from 'react';
import { LogOut, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import { View } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { cn, IconButton } from '@/components/ui';
import { navGroupsFor } from '@/components/shell/navigation';

interface SidebarContentProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  /** When true, the sidebar renders as a compact icon-only rail. */
  isCollapsed?: boolean;
  /** When provided, a collapse/expand toggle is shown. Omit on mobile. */
  onToggleCollapse?: () => void;
}

/** The green mark, cropped from the horizontal logo (whose wordmark is white). */
const LogoMark: React.FC = () => (
  <span className="block h-7 w-[31px] flex-shrink-0 overflow-hidden" aria-hidden="true">
    <img
      src="/assets/Medical Student AI Horizontal Dark BG - Green.png"
      alt=""
      className="h-7 max-w-none"
    />
  </span>
);

const initialsOf = (email?: string) => {
  const name = (email || '').split('@')[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase() || '·';
};

const SidebarContent: React.FC<SidebarContentProps> = ({
  activeView,
  onNavigate,
  onLogout,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { isSuperadmin, canAsk, currentUser } = useAuth();
  const groups = navGroupsFor({ isSuperadmin, canAsk });

  // Tooltip for the collapsed rail, positioned `fixed` so the scrolling nav
  // never clips it.
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(
    null,
  );
  const showTooltip = (event: React.MouseEvent | React.FocusEvent, label: string) => {
    if (!isCollapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 10 });
  };
  const hideTooltip = () => setTooltip(null);
  const tooltipHandlers = (label: string) => ({
    onMouseEnter: (event: React.MouseEvent) => showTooltip(event, label),
    onMouseLeave: hideTooltip,
    onFocus: (event: React.FocusEvent) => showTooltip(event, label),
    onBlur: hideTooltip,
  });

  const renderItem = (view: View, label: string, Icon: LucideIcon) => {
    const active = activeView === view;
    return (
      <button
        key={view}
        type="button"
        onClick={() => onNavigate(view)}
        aria-current={active ? 'page' : undefined}
        aria-label={isCollapsed ? label : undefined}
        {...tooltipHandlers(label)}
        className={cn(
          'group flex w-full items-center rounded-lg text-[13.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
          isCollapsed ? 'h-9 justify-center' : 'h-8 gap-2.5 px-2.5',
          active
            ? 'bg-white text-stone-900 shadow-card ring-1 ring-stone-200/80'
            : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900',
        )}
      >
        <Icon
          size={isCollapsed ? 18 : 16}
          className={cn(
            'flex-shrink-0',
            active ? 'text-brand-600' : 'text-stone-400 group-hover:text-stone-600',
          )}
        />
        {!isCollapsed && <span className="truncate">{label}</span>}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col bg-canvas font-sans">
      <div
        className={cn(
          'flex h-14 flex-shrink-0 items-center',
          isCollapsed ? 'justify-center px-2' : 'justify-between gap-2 pl-4 pr-2',
        )}
      >
        {!isCollapsed && (
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoMark />
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-stone-900">
              Medical Student AI
            </span>
          </div>
        )}
        {onToggleCollapse && (
          <IconButton
            icon={isCollapsed ? PanelLeftOpen : PanelLeftClose}
            label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            size="sm"
            onClick={onToggleCollapse}
          />
        )}
      </div>

      <nav
        aria-label="Main"
        className={cn('flex-1 overflow-y-auto pb-4 custom-scrollbar', isCollapsed ? 'px-2' : 'px-3')}
      >
        {groups.map((group, index) => (
          <div key={group.label ?? index} className={index === 0 ? 'mt-1' : 'mt-5'}>
            {group.label &&
              (isCollapsed ? (
                <div className="mx-2 mb-2 border-t border-stone-200" />
              ) : (
                <p className="mb-1 px-2.5 text-xs font-medium text-stone-400">{group.label}</p>
              ))}
            <div className="space-y-0.5">
              {group.items.map((item) => renderItem(item.view, item.label, item.icon))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn('flex-shrink-0 border-t border-stone-200/80 py-3', isCollapsed ? 'px-2' : 'px-3')}>
        <div className={cn('flex items-center', isCollapsed ? 'flex-col gap-2' : 'gap-2.5 px-1')}>
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700"
            title={currentUser?.email}
          >
            {initialsOf(currentUser?.email)}
          </span>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-stone-900">
                {currentUser?.email || 'Signed in'}
              </p>
              <p className="truncate text-xs text-stone-500">
                {isSuperadmin ? 'Super admin' : 'Educator'}
              </p>
            </div>
          )}
          <IconButton
            icon={LogOut}
            label="Sign out"
            size="sm"
            onClick={onLogout}
            {...tooltipHandlers('Sign out')}
          />
        </div>
      </div>

      {isCollapsed && tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white shadow-pop"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
};

export default SidebarContent;
