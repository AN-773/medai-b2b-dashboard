
import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Stethoscope,
  Users,
  BookOpen,
  LineChart,
  Cpu,
  ClipboardList,
  Bell,
  Settings,
  Search,
  ChevronRight,
  Database,
  Wand2,
  LogOut,
  GraduationCap
} from 'lucide-react';
import QuestionBankHealth from './views/QuestionBankHealth';
import FacultyDashboard from './views/FacultyDashboard';
import StudentMasteryView from './views/StudentMasteryView';
import AIAgentCenter from './views/AIAgentCenter';
import ExamBlueprintView from './views/ExamBlueprintView';
import CurriculumHealthView from './views/CurriculumHealthView';
import BankExplorerView from './views/BankExplorerView';
import QuestionWorkbenchView from './views/QuestionWorkbenchView';
import CurriculumAuditMap from './components/CurriculumAuditMap';
import SidebarContent from './components/SidebarContent';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';
import { View } from './types';

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [isAuditMapOpen, setIsAuditMapOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Map routes to View types for active state
  const getActiveView = (): View => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'DASHBOARD';
    if (path.startsWith('/workbench')) return 'WORKBENCH';
    if (path.startsWith('/bank-explorer')) return 'BANK_EXPLORER';
    if (path.startsWith('/qb-health')) return 'QB_HEALTH';
    if (path.startsWith('/mastery')) return 'MASTERY';
    if (path.startsWith('/curriculum')) return 'CURRICULUM';
    if (path.startsWith('/assessment')) return 'ASSESSMENT';
    if (path.startsWith('/agents')) return 'AGENTS';
    if (path.startsWith('/blueprint')) return 'BLUEPRINT';
    if (path.startsWith('/faculty')) return 'FACULTY';
    return 'DASHBOARD';
  };

  const activeView = getActiveView();

  // Map View types to route paths
  const getRoutePath = (view: View): string => {
    const routes: Record<View, string> = {
      DASHBOARD: '/dashboard',
      WORKBENCH: '/workbench',
      BANK_EXPLORER: '/bank-explorer',
      QB_HEALTH: '/qb-health',
      MASTERY: '/mastery',
      CURRICULUM: '/curriculum',
      ASSESSMENT: '/assessment',
      AGENTS: '/agents',
      BLUEPRINT: '/blueprint',
      FACULTY: '/faculty'
    };
    return routes[view];
  };

  const handleNavigate = (view: View) => {
    navigate(getRoutePath(view));
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
    { id: 'DASHBOARD', label: 'Mission Control', icon: LayoutDashboard },
    { id: 'FACULTY', label: 'Faculty Command', icon: GraduationCap },
    { id: 'WORKBENCH', label: 'Item Workbench', icon: Wand2, highlight: true },
    { id: 'BANK_EXPLORER', label: 'Item Repository', icon: Database },
    { id: 'QB_HEALTH', label: 'QB Health', icon: Stethoscope },
    { id: 'MASTERY', label: 'Student Mastery', icon: Users },
    { id: 'CURRICULUM', label: 'Curriculum Health', icon: BookOpen },
    { id: 'ASSESSMENT', label: 'Assessment Quality', icon: LineChart },
    // { id: 'AGENTS', label: 'AI Agent Fleet', icon: Cpu },
    { id: 'BLUEPRINT', label: 'Blueprint Builder', icon: ClipboardList }
  ];

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
          ></div>
          <div className="relative w-64 h-full bg-[#0F1110] shadow-2xl animate-in slide-in-from-left duration-300">
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
        <div className="p-4 xl:p-10 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            MSAi Ecosystem <ChevronRight size={12} className="text-slate-300" />{' '}
            {activeView.replace('_', ' ')}
          </div>
          <div className="flex flex-col xl:flex-row justify-between xl:items-end mb-10 gap-6">
            <div>
              <h2 className="text-3xl xl:text-4xl font-black text-slate-900 tracking-tight leading-none">
                {navItems.find((n) => n.id === activeView)?.label ||
                  'Mission Control'}
              </h2>
              <p className="text-slate-500 mt-2 text-base xl:text-lg font-medium italic">
                Authoring environment powered by USMLE Content Intelligence.
              </p>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<AIAgentCenter />} />
              <Route path="/faculty" element={<FacultyDashboard />} />
              <Route path="/workbench" element={<QuestionWorkbenchView />} />
              <Route path="/bank-explorer" element={<BankExplorerView />} />
              <Route path="/qb-health" element={<QuestionBankHealth />} />
              <Route path="/mastery" element={<StudentMasteryView />} />
              <Route
                path="/curriculum"
                element={
                  <CurriculumHealthView
                    onNavigate={(view) => handleNavigate(view)}
                  />
                }
              />
              <Route path="/assessment" element={<AssessmentPlaceholder />} />
              <Route path="/agents" element={<AIAgentCenter />} />
              <Route path="/blueprint" element={<ExamBlueprintView />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
