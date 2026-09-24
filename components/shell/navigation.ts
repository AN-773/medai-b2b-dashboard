import {
  BarChart3,
  BellRing,
  BookOpen,
  Building2,
  Contact,
  Database,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Library,
  Settings,
  Ticket,
  Users,
  UsersRound,
  Wand2,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { View } from '@/types';

export interface NavItem {
  view: View;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** Omitted for the ungrouped top item. */
  label?: string;
  items: NavItem[];
}

/** Grouped by the job an educator is doing, not by backend service. */
export const EDUCATOR_NAV: NavGroup[] = [
  { items: [{ view: 'FACULTY', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Teaching',
    items: [
      { view: 'COURSES', label: 'Courses', icon: BookOpen },
      { view: 'COHORTS', label: 'Cohorts', icon: UsersRound },
      { view: 'STUDENTS', label: 'Students', icon: Users },
      { view: 'MASTERY', label: 'Mastery', icon: BarChart3 },
    ],
  },
  {
    label: 'Content',
    items: [
      { view: 'WORKBENCH', label: 'Item workbench', icon: Wand2 },
      { view: 'BANK_EXPLORER', label: 'Item bank', icon: Database },
      { view: 'QB_HEALTH', label: 'Bank health', icon: HeartPulse },
    ],
  },
  {
    label: 'Curriculum',
    items: [
      { view: 'CURRICULA', label: 'Curricula', icon: Library },
      { view: 'DISCIPLINES', label: 'Disciplines', icon: FlaskConical },
    ],
  },
];

export const SUPERADMIN_NAV: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { view: 'TENANTS', label: 'Tenants', icon: Building2 },
      { view: 'PROMO_CODES', label: 'Promo codes', icon: Ticket },
      { view: 'TEAM_DIRECTORY', label: 'Team cards', icon: Contact },
      { view: 'NOTIFICATIONS', label: 'Notifications', icon: BellRing },
      { view: 'STUDY_PLAN_AUDIT', label: 'Study plan audit', icon: Workflow },
      { view: 'SETTINGS', label: 'Settings', icon: Settings },
    ],
  },
];

/** Page titles for every routed view, including ones not in the sidebar. */
export const VIEW_LABELS: Record<View, string> = {
  DASHBOARD: 'Dashboard',
  FACULTY: 'Dashboard',
  TENANTS: 'Tenants',
  PROMO_CODES: 'Promo codes',
  TEAM_DIRECTORY: 'Team cards',
  NOTIFICATIONS: 'Notifications',
  STUDY_PLAN_AUDIT: 'Study plan audit',
  SETTINGS: 'Settings',
  WORKBENCH: 'Item workbench',
  BANK_EXPLORER: 'Item bank',
  QB_HEALTH: 'Bank health',
  MASTERY: 'Mastery',
  CURRICULUM: 'Curriculum',
  CURRICULA: 'Curricula',
  DISCIPLINES: 'Disciplines',
  STUDENTS: 'Students',
  COHORTS: 'Cohorts',
  COHORT_STUDIO: 'Cohorts',
  COURSES: 'Courses',
  ASSESSMENT: 'Assessment quality',
  AGENTS: 'AI agents',
  BLUEPRINT: 'Blueprint builder',
};
