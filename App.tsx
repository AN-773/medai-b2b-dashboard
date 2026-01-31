
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
  LogOut
} from 'lucide-react';
import QuestionBankHealth from './views/QuestionBankHealth';
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
      BLUEPRINT: '/blueprint'
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
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 xl:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="xl:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <div className="space-y-1.5">
                <span className="block w-6 h-0.5 bg-current"></span>
                <span className="block w-6 h-0.5 bg-current"></span>
                <span className="block w-6 h-0.5 bg-current"></span>
              </div>
            </button>

            <div className="relative max-w-lg w-full hidden md:block">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Query QIDs, Objectives, or Syndromes..."
                className="w-full pl-12 pr-6 py-3 bg-slate-100 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#1BD183] outline-none transition shadow-inner"
              />
            </div>
          </div>
          {/* <div className="flex items-center gap-8">
            <button className="relative p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition">
              <Bell size={22} />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-4 pl-8 border-l border-slate-200">
              <div className="text-right">
                <p className="text-sm font-black text-slate-900 leading-none">Dr. Theodore</p>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Dean of Academic Affairs</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                <img src="https://picsum.photos/100/100?seed=dean" alt="Dean Avatar" className="w-full h-full object-cover" />
              </div>
            </div>
          </div> */}
        </header>

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
            <div className="flex gap-4 w-full xl:w-auto">
              <button
                onClick={() => setIsAuditMapOpen(true)}
                className="flex-1 xl:flex-none px-6 py-3 bg-[#191A19] rounded-[8px] text-sm text-white shadow-sm hover:bg-[##232524] transition active:translate-y-1"
              >
                Audit Map
              </button>
              <button className="flex-1 xl:flex-none px-6 py-3 primary-button rounded-[8px] text-sm font-black text-white transition active:translate-y-1">
                Trigger Auditor
              </button>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<AIAgentCenter />} />
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
