
import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Stethoscope,
  Users,
  BookOpen,
  LineChart,
  ClipboardList,
  Settings,
  ChevronRight,
  Database,
  Wand2,
  Menu,
  X,
  GraduationCap,
  Workflow,
  Library
} from 'lucide-react';
import QuestionBankHealth from './views/QuestionBankHealth';
import FacultyDashboard from './views/FacultyDashboard';
import MasteryLayout from './views/mastery/MasteryLayout';
import MasteryGlobalView from './views/mastery/MasteryGlobalView';
import MasteryCohortView from './views/mastery/MasteryCohortView';
import MasteryLearnerView from './views/mastery/MasteryLearnerView';
import AIAgentCenter from './views/AIAgentCenter';
import ExamBlueprintView from './views/ExamBlueprintView';
import CurriculumHealthView from './views/CurriculumHealthView';
import CurriculumWorkbenchView from './views/CurriculumWorkbenchView';
import BankExplorerView from './views/BankExplorerView';
import QuestionWorkbenchView from './views/QuestionWorkbenchView';
import CurriculumAuditMap from './components/CurriculumAuditMap';
import SidebarContent from './components/SidebarContent';
import SettingsView from './views/SettingsView';
import TenantManagementView from './views/TenantManagementView';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import { View } from './types';
import StudentRegistryView from './views/StudentRegistryView';
import CohortsView from './views/CohortsView';
import CoursesView from './views/CoursesView';
import DisciplinesView from './views/DisciplinesView';
import StudyPlanAuditView from './views/StudyPlanAuditView';

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isSuperadmin } = useAuth();
  const [isAuditMapOpen, setIsAuditMapOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    if (path.startsWith('/study-plan-audit')) return 'STUDY_PLAN_AUDIT';
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

  // Map View types to route paths
  const getRoutePath = (view: View): string => {
    const routes: Record<View, string> = {
      DASHBOARD: '/dashboard',
      TENANTS: '/tenants',
      STUDY_PLAN_AUDIT: '/study-plan-audit',
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
    <div className="flex flex-col items-center justify-center h-96 text-slate-400">
      <LineChart size={64} className="mb-4 opacity-20" />
      <p className="text-xl font-bold">Assessment Quality Analytics</p>
      <p className="text-sm mt-2">Integrating QID-specific psychometrics from USMLE Content Outline.</p>
    </div>
  );

  const navItems = [
    ...(isSuperadmin
      ? [
          { id: 'TENANTS', label: 'Tenant Management', icon: Building2 },
          { id: 'STUDY_PLAN_AUDIT', label: 'Study Plan Audit', icon: Workflow },
          { id: 'SETTINGS', label: 'Settings', icon: Settings },
        ]
      : [
          { id: 'DASHBOARD', label: 'Mission Control', icon: LayoutDashboard },
          { id: 'FACULTY', label: 'Faculty Command', icon: GraduationCap },
          { id: 'STUDENTS', label: 'Student Registry', icon: Users },
          { id: 'COHORTS', label: 'Cohorts', icon: Users },
          { id: 'COURSES', label: 'Courses', icon: BookOpen },
          { id: 'DISCIPLINES', label: 'Disciplines', icon: BookOpen },
          { id: 'WORKBENCH', label: 'Item Workbench', icon: Wand2, highlight: true },
          { id: 'BANK_EXPLORER', label: 'Item Repository', icon: Database },
          { id: 'QB_HEALTH', label: 'QB Health', icon: Stethoscope },
          { id: 'MASTERY', label: 'Student Mastery', icon: Users },
          { id: 'CURRICULUM', label: 'Curriculum Health', icon: BookOpen },
          { id: 'CURRICULA', label: 'Curriculum Workbench', icon: Library },
          { id: 'ASSESSMENT', label: 'Assessment Quality', icon: LineChart },
          { id: 'BLUEPRINT', label: 'Blueprint Builder', icon: ClipboardList },
        ]),
  ];
  const activeViewLabel =
    navItems.find((n) => n.id === activeView)?.label || 'Mission Control';

  return (
    <div className="flex h-screen bg-[#F3F6F3] text-slate-900 overflow-hidden font-['Inter']">
      {/* Desktop Sidebar */}
      <aside className="w-72 hidden xl:flex flex-col shrink-0 h-full">
        <SidebarContent
          activeView={activeView}
          onNavigate={handleNavigate}
          onLogout={() => logout()}
        />
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          ></div>
          <div
            id="mobile-sidebar"
            className="relative w-72 max-w-[85vw] h-full bg-[#0F1110] shadow-2xl animate-in slide-in-from-left duration-300"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-[#00AA55]"
              aria-label="Close navigation menu"
            >
              <X size={20} />
            </button>
            <SidebarContent
              activeView={activeView}
              onNavigate={handleNavigate}
              onLogout={() => logout()}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col relative w-full">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-[#F3F6F3]/95 px-4 py-3 backdrop-blur xl:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#00AA55]"
            aria-label="Open navigation menu"
            aria-controls="mobile-sidebar"
            aria-expanded={isMobileMenuOpen}
          >
            <Menu size={22} />
          </button>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              MSAi Ecosystem
            </div>
            <div className="truncate text-sm font-black text-slate-900">
              {activeViewLabel}
            </div>
          </div>
        </div>
        <div className="p-4 xl:p-10 max-w-[1600px] mx-auto w-full">
          <div className="hidden xl:flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            MSAi Ecosystem <ChevronRight size={12} className="text-slate-300" />{' '}
            {activeView.split('_').join(' ')}
          </div>
          <div className="flex flex-col xl:flex-row justify-between xl:items-end mb-10 gap-6">
            <div>
              <h2 className="text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-none">
                {activeViewLabel}
              </h2>
             
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <Routes>
              <Route path="/" element={<Navigate to={isSuperadmin ? "/tenants" : "/faculty"} replace />} />
              {/* <Route path="/dashboard" element={isSuperadmin ? <Navigate to="/tenants" replace /> : <AIAgentCenter />} /> */}
              <Route path="/tenants" element={isSuperadmin ? <TenantManagementView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/study-plan-audit" element={isSuperadmin ? <StudyPlanAuditView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/study-plan-audit/:studyPlanIdentifier" element={isSuperadmin ? <StudyPlanAuditView /> : <Navigate to="/dashboard" replace />} />
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
                path="/curriculum"
                element={
                  <CurriculumHealthView
                    onNavigate={(view, context) => handleNavigate(view, context)}
                  />
                }
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
      </main>

      {/* Curriculum Audit Map Modal */}
      {isAuditMapOpen && (
        <CurriculumAuditMap onClose={() => setIsAuditMapOpen(false)} />
      )}
    </div>
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
