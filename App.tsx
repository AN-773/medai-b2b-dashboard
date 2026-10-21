
import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ChevronRight, Library, LineChart, X } from 'lucide-react';
import QuestionBankHealth from './views/QuestionBankHealth';
import FacultyDashboard from './views/FacultyDashboard';
import MasteryLayout from './views/mastery/MasteryLayout';
import MasteryGlobalView from './views/mastery/MasteryGlobalView';
import MasteryCohortView from './views/mastery/MasteryCohortView';
import MasteryLearnerView from './views/mastery/MasteryLearnerView';
import AIAgentCenter from './views/AIAgentCenter';
import ExamBlueprintView from './views/ExamBlueprintView';
import CurriculumWorkbenchView from './views/CurriculumWorkbenchView';
import BankExplorerView from './views/BankExplorerView';
import QuestionWorkbenchView from './views/QuestionWorkbenchView';
import CurriculumAuditMap from './components/CurriculumAuditMap';
import SidebarContent from './components/SidebarContent';
import { ShellContext, TopBar } from './components/shell/TopBar';
import { VIEW_GROUPS, VIEW_LABELS } from './components/shell/navigation';
import { Button, EmptyState } from './components/ui';
import SettingsView from './views/SettingsView';
import TenantManagementView from './views/TenantManagementView';
import PromoCodesView from './views/PromoCodesView';
import TeamDirectoryView from './views/TeamDirectoryView';
import NotificationsView from './views/NotificationsView';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import { View } from './types';
import StudentRegistryView from './views/StudentRegistryView';
import CohortsView from './views/CohortsView';
import CoursesView from './views/CoursesView';
import DisciplinesView from './views/DisciplinesView';
import StudyPlanAuditView from './views/StudyPlanAuditView';
import TutorSkillsView, { TutorSkillCreateView, TutorSkillView } from './views/TutorSkillsView';

interface LegacyCurriculumViewProps {
  homePath: string;
}

const LegacyCurriculumView: React.FC<LegacyCurriculumViewProps> = ({ homePath }) => {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={Library}
      title="Curriculum health has moved"
      description="This page is no longer used. Manage curricula, organ systems, topics and objectives in Curricula."
      action={
        <>
          <Button variant="primary" onClick={() => navigate('/curricula')}>
            Open curricula
          </Button>
          <Button variant="ghost" onClick={() => navigate(homePath)}>
            Back to dashboard
          </Button>
        </>
      }
    />
  );
};

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isSuperadmin } = useAuth();
  const [isAuditMapOpen, setIsAuditMapOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem('msai_sidebar_collapsed') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('msai_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  // Map routes to View types for active state
  const getActiveView = (): View => {
    const path = location.pathname;
    if (path.startsWith('/tenants')) return 'TENANTS';
    if (path.startsWith('/promo-codes')) return 'PROMO_CODES';
    if (path.startsWith('/team-directory')) return 'TEAM_DIRECTORY';
    if (path.startsWith('/notifications')) return 'NOTIFICATIONS';
    if (path.startsWith('/study-plan-audit')) return 'STUDY_PLAN_AUDIT';
    if (path.startsWith('/tutor-skills')) return 'TUTOR_SKILLS';
    // if (path === '/' || path === '/dashboard') return 'DASHBOARD';
    if (path.startsWith('/workbench')) return 'WORKBENCH';
    if (path.startsWith('/bank-explorer')) return 'BANK_EXPLORER';
    if (path.startsWith('/qb-health')) return 'QB_HEALTH';
    if (path.startsWith('/mastery')) return 'MASTERY';
    if (path.startsWith('/curricula')) return 'CURRICULA';
    if (path.startsWith('/curriculum')) return 'CURRICULUM';
    if (path.startsWith('/disciplines')) return 'DISCIPLINES';
    if (path.startsWith('/students')) return 'STUDENTS';
    if (path.startsWith('/cohorts')) return 'COHORTS';
    if (path.startsWith('/courses')) return 'COURSES';
    if (path.startsWith('/cohort-studio')) return 'COHORTS';
    if (path.startsWith('/assessment')) return 'ASSESSMENT';
    if (path.startsWith('/agents')) return 'AGENTS';
    if (path.startsWith('/blueprint')) return 'BLUEPRINT';
    if (path.startsWith('/faculty')) return 'FACULTY';
    if (path.startsWith('/settings')) return 'SETTINGS';
    // return 'DASHBOARD';
    return 'FACULTY';
  };

  const activeView = getActiveView();
  const isLegacyCurriculumRoute =
    location.pathname === '/curriculum' || location.pathname.startsWith('/curriculum/');

  // Map View types to route paths
  const getRoutePath = (view: View): string => {
    const routes: Record<View, string> = {
      DASHBOARD: '/dashboard',
      TENANTS: '/tenants',
      PROMO_CODES: '/promo-codes',
      TEAM_DIRECTORY: '/team-directory',
      NOTIFICATIONS: '/notifications',
      STUDY_PLAN_AUDIT: '/study-plan-audit',
      TUTOR_SKILLS: '/tutor-skills',
      WORKBENCH: '/workbench',
      BANK_EXPLORER: '/bank-explorer',
      QB_HEALTH: '/qb-health',
      MASTERY: '/mastery',
      CURRICULUM: '/curriculum',
      CURRICULA: '/curricula',
      DISCIPLINES: '/disciplines',
      STUDENTS: '/students',
      COHORTS: '/cohorts',
      COURSES: '/courses',
      COHORT_STUDIO: '/cohorts',
      ASSESSMENT: '/assessment',
      AGENTS: '/agents',
      BLUEPRINT: '/blueprint',
      FACULTY: '/faculty',
      SETTINGS: '/settings'
    };
    return routes[view];
  };

  const handleNavigate = (view: View, context?: Record<string, any>) => {
    let path = getRoutePath(view);
    
    if (view === 'WORKBENCH' && context) {
      const params = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
      path += `?${params.toString()}`;
    }

    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const AssessmentPlaceholder = () => (
    <EmptyState
      icon={LineChart}
      title="Assessment quality analytics"
      description="Integrating QID-specific psychometrics from the USMLE content outline."
    />
  );

  const activeViewLabel = isLegacyCurriculumRoute
    ? 'Legacy curriculum page'
    : VIEW_LABELS[activeView];
  // Pages that render their own top bar (breadcrumbs, context actions).
  const pageOwnsTopBar = activeView === 'COURSES';

  return (
    <ShellContext.Provider value={{ openMobileNav: () => setIsMobileMenuOpen(true) }}>
    <div className="flex h-screen overflow-hidden bg-canvas font-sans text-stone-900">
      {/* Desktop sidebar */}
      <aside
        className={`${
          isSidebarCollapsed ? 'w-[60px]' : 'w-60'
        } hidden h-full shrink-0 flex-col transition-[width] duration-200 xl:flex`}
      >
        <SidebarContent
          activeView={activeView}
          onNavigate={handleNavigate}
          onLogout={() => logout()}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      </aside>

      {/* Mobile drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex xl:hidden">
          <div
            className="absolute inset-0 bg-stone-900/30 animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-sidebar"
            className="relative h-full w-72 max-w-[85vw] shadow-overlay animate-drawer-in"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute right-2 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-900"
              aria-label="Close navigation menu"
            >
              <X size={18} />
            </button>
            <SidebarContent
              activeView={activeView}
              onNavigate={handleNavigate}
              onLogout={() => logout()}
            />
          </div>
        </div>
      )}

      {/* The page sheet */}
      <main className="flex min-w-0 flex-1 flex-col xl:py-2 xl:pr-2">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white xl:rounded-xl xl:border xl:border-stone-200/80 xl:shadow-card">
          {!pageOwnsTopBar && (
            <TopBar>
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
                {VIEW_GROUPS[activeView] && !isLegacyCurriculumRoute && (
                  <>
                    <span className="hidden text-stone-400 sm:inline">{VIEW_GROUPS[activeView]}</span>
                    <ChevronRight size={14} className="hidden flex-shrink-0 text-stone-300 sm:block" />
                  </>
                )}
                <span className="truncate font-medium text-stone-900" aria-current="page">
                  {activeViewLabel}
                </span>
              </nav>
            </TopBar>
          )}
          <div id="page-scroll" className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
            <div className={pageOwnsTopBar ? 'min-h-full' : 'mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8'}>
            <Routes>
              <Route path="/" element={<Navigate to={isSuperadmin ? "/tenants" : "/faculty"} replace />} />
              {/* <Route path="/dashboard" element={isSuperadmin ? <Navigate to="/tenants" replace /> : <AIAgentCenter />} /> */}
              <Route path="/tenants" element={isSuperadmin ? <TenantManagementView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/promo-codes" element={isSuperadmin ? <PromoCodesView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/team-directory" element={isSuperadmin ? <TeamDirectoryView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/notifications" element={isSuperadmin ? <NotificationsView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/study-plan-audit" element={isSuperadmin ? <StudyPlanAuditView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/study-plan-audit/:studyPlanIdentifier" element={isSuperadmin ? <StudyPlanAuditView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/tutor-skills" element={isSuperadmin ? <TutorSkillsView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/tutor-skills/new" element={isSuperadmin ? <TutorSkillCreateView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/tutor-skills/:name" element={isSuperadmin ? <TutorSkillView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/faculty" element={<FacultyDashboard />} />
              <Route path="/workbench" element={<QuestionWorkbenchView />} />
              <Route path="/bank-explorer" element={<BankExplorerView onEditItem={(itemId) => navigate(`/workbench?questionId=${itemId}`)} />} />
              <Route path="/qb-health" element={<QuestionBankHealth />} />
              <Route path="/mastery" element={<MasteryLayout />}>
                <Route index element={<MasteryGlobalView />} />
                <Route path="cohorts/:cohortId" element={<MasteryCohortView />} />
              </Route>
              <Route
                path="/mastery/cohorts/:cohortId/learners/:studentId"
                element={<MasteryLearnerView />}
              />
              <Route path="/students" element={<StudentRegistryView />} />
              <Route path="/cohorts" element={<CohortsView />} />
              <Route path="/courses" element={<CoursesView />} />
              <Route path="/disciplines" element={<DisciplinesView />} />
              <Route path="/cohort-studio" element={<Navigate to="/cohorts" replace />} />
              <Route
                path="/curriculum/*"
                element={<LegacyCurriculumView homePath={isSuperadmin ? '/tenants' : '/faculty'} />}
              />
              <Route path="/curricula" element={<CurriculumWorkbenchView />} />
              <Route path="/assessment" element={<AssessmentPlaceholder />} />
              <Route path="/agents" element={<AIAgentCenter />} />
              <Route path="/blueprint" element={<ExamBlueprintView />} />
              <Route path="/settings" element={isSuperadmin ? <SettingsView /> : <Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to={isSuperadmin ? "/tenants" : "/faculty"} replace />} />
            </Routes>
            </div>
          </div>
        </div>
      </main>

      {/* Curriculum Audit Map Modal */}
      {isAuditMapOpen && (
        <CurriculumAuditMap onClose={() => setIsAuditMapOpen(false)} />
      )}
    </div>
    </ShellContext.Provider>
  );
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default App;
