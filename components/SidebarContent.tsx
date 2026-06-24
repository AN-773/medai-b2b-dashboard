import React, { useState } from 'react';
import {
  LogOut,
  Settings,
  Building2,
  Stethoscope,
  Users,
  BookOpen,
  Database,
  Wand2,
  GraduationCap,
  Workflow,
  Library,
  Layers,
  FlaskConical,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { View } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SidebarContentProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  /** When true, the sidebar renders as a compact icon-only rail. */
  isCollapsed?: boolean;
  /** When provided, a collapse/expand toggle is shown. Omit on mobile. */
  onToggleCollapse?: () => void;
}

interface NavLeaf {
  view: View;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  item: NavLeaf;
  children?: NavLeaf[];
}

const SUPERADMIN_NAV: NavSection[] = [
  { item: { view: 'TENANTS', label: 'Tenant Management', icon: Building2 } },
  { item: { view: 'STUDY_PLAN_AUDIT', label: 'Study Plan Audit', icon: Workflow } },
  { item: { view: 'SETTINGS', label: 'System Settings', icon: Settings } },
];

const EDUCATOR_NAV: NavSection[] = [
  {
    item: { view: 'FACULTY', label: 'Faculty Command', icon: GraduationCap },
    children: [
      { view: 'STUDENTS', label: 'Student Registry', icon: Users },
      { view: 'COHORTS', label: 'Cohorts', icon: Layers },
      { view: 'COURSES', label: 'Courses', icon: BookOpen },
      { view: 'DISCIPLINES', label: 'Disciplines', icon: FlaskConical },
      { view: 'CURRICULA', label: 'Curriculum Workbench', icon: Library },
      { view: 'MASTERY', label: 'Student Mastery', icon: BarChart3 },
    ],
  },
  { item: { view: 'WORKBENCH', label: 'Item Workbench', icon: Wand2 } },
  {
    item: { view: 'BANK_EXPLORER', label: 'Item Repository', icon: Database },
    children: [{ view: 'QB_HEALTH', label: 'QB Health', icon: Stethoscope }],
  },
];

const SidebarContent: React.FC<SidebarContentProps> = ({
  activeView,
  onNavigate,
  onLogout,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { isSuperadmin } = useAuth();
  const sections = isSuperadmin ? SUPERADMIN_NAV : EDUCATOR_NAV;
  const isActive = (view: View) => activeView === view;

  // Tooltip for the collapsed rail. Positioned `fixed` so it isn't clipped by
  // the sidebar's vertical scroll container (which also clips horizontal overflow).
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);

  const showTooltip = (event: React.MouseEvent | React.FocusEvent, label: string) => {
    if (!isCollapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 12 });
  };
  const hideTooltip = () => setTooltip(null);

  const getButtonClass = (view: View) => {
    const base =
      'w-full flex items-center rounded-2xl text-xs font-black uppercase tracking-widest transition-all relative group ' +
      (isCollapsed ? 'justify-center px-0 py-3' : 'gap-4 px-6 py-4');
    return isActive(view)
      ? `${base} bg-[#00AA55] text-white shadow-xl shadow-emerald-900/20`
      : `${base} text-gray-400 hover:bg-white/10 hover:text-white`;
  };

  const getIconClass = (view: View) =>
    isActive(view) ? 'text-white' : 'text-gray-500 group-hover:text-[#00AA55]';

  const getSubMenuButtonClass = (view: View) => {
    const base =
      'w-full flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative group';
    return isActive(view)
      ? `${base} text-white`
      : `${base} text-gray-500 hover:text-white`;
  };

  const getSubMenuDotClass = (view: View) =>
    isActive(view)
      ? 'w-1.5 h-1.5 rounded-full bg-[#00AA55]'
      : 'w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-gray-500';

  // Compact rail: render every destination (parents + children) as an icon button.
  const renderCollapsedItem = (leaf: NavLeaf) => {
    const Icon = leaf.icon;
    return (
      <button
        key={leaf.view}
        onClick={() => onNavigate(leaf.view)}
        className={getButtonClass(leaf.view)}
        aria-label={leaf.label}
        onMouseEnter={(e) => showTooltip(e, leaf.label)}
        onMouseLeave={hideTooltip}
        onFocus={(e) => showTooltip(e, leaf.label)}
        onBlur={hideTooltip}
      >
        <Icon size={20} className={getIconClass(leaf.view)} />
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0F1110] border-r border-slate-800 text-slate-900 font-['Inter']">
      <div
        className={`flex-grow overflow-y-auto aside-custom-scrollbar ${
          isCollapsed ? 'px-3 py-6' : 'p-8'
        }`}
      >
        <div
          className={`flex items-center mb-10 ${
            isCollapsed ? 'justify-center' : 'justify-between gap-3'
          }`}
        >
          {!isCollapsed && (
            <img
              src="/assets/Medical Student AI Horizontal Dark BG - Green.png"
              alt="MSAi Logo"
              className="h-10 w-auto"
            />
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#00AA55]"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
          )}
        </div>

        <nav className="space-y-1">
          {sections.map((section) => {
            if (isCollapsed) {
              return (
                <React.Fragment key={section.item.view}>
                  {renderCollapsedItem(section.item)}
                  {section.children?.map(renderCollapsedItem)}
                </React.Fragment>
              );
            }

            const Icon = section.item.icon;
            return (
              <div key={section.item.view}>
                <button
                  onClick={() => onNavigate(section.item.view)}
                  className={getButtonClass(section.item.view)}
                >
                  <Icon size={20} className={getIconClass(section.item.view)} />
                  {section.item.label}
                </button>

                {section.children && (
                  <div className="pl-6 space-y-1 mt-1 mb-2 relative">
                    <div className="absolute left-10 top-2 bottom-2 w-px bg-white/10"></div>
                    {section.children.map((child) => (
                      <button
                        key={child.view}
                        onClick={() => onNavigate(child.view)}
                        className={getSubMenuButtonClass(child.view)}
                      >
                        <div className={getSubMenuDotClass(child.view)}></div>
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div
        className={`space-y-4 border-t border-slate-800 ${
          isCollapsed ? 'px-3 py-6' : 'p-8'
        }`}
      >
        {isCollapsed ? (
          <div className="flex justify-center" title="Sina: Live">
            <div className="h-2.5 w-2.5 rounded-full bg-[#1BD183] animate-pulse"></div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-3xl">
            <div className="h-2 w-2 rounded-full bg-[#1BD183] animate-pulse"></div>
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              Sina: Live
            </span>
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center text-sm font-bold text-[#848E8A] hover:text-red-400 transition ${
            isCollapsed ? 'justify-center px-0 py-2' : 'gap-3 px-5 py-2'
          }`}
          aria-label="Sign Out"
          onMouseEnter={(e) => showTooltip(e, 'Sign Out')}
          onMouseLeave={hideTooltip}
          onFocus={(e) => showTooltip(e, 'Sign Out')}
          onBlur={hideTooltip}
        >
          <LogOut size={18} />
          {!isCollapsed && 'Sign Out'}
        </button>
      </div>

      {isCollapsed && tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-xl ring-1 ring-white/10"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
};

export default SidebarContent;
