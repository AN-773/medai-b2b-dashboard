
import React, { useState } from 'react';
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
  Wand2
} from 'lucide-react';
import QuestionBankHealth from './views/QuestionBankHealth';
import StudentMasteryView from './views/StudentMasteryView';
import AIAgentCenter from './views/AIAgentCenter';
import ExamBlueprintView from './views/ExamBlueprintView';
import CurriculumHealthView from './views/CurriculumHealthView';
import BankExplorerView from './views/BankExplorerView';
import QuestionWorkbenchView from './views/QuestionWorkbenchView';
import CurriculumAuditMap from './components/CurriculumAuditMap';

export type View = 'DASHBOARD' | 'QB_HEALTH' | 'MASTERY' | 'CURRICULUM' | 'ASSESSMENT' | 'AGENTS' | 'BLUEPRINT' | 'BANK_EXPLORER' | 'WORKBENCH';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('DASHBOARD');
  const [isAuditMapOpen, setIsAuditMapOpen] = useState(false);

  const renderView = () => {
    switch (activeView) {
      case 'DASHBOARD':
        return <AIAgentCenter />;
      case 'QB_HEALTH':
        return <QuestionBankHealth />;
      case 'MASTERY':
        return <StudentMasteryView />;
      case 'CURRICULUM':
        return <CurriculumHealthView />;
      case 'BLUEPRINT':
        return <ExamBlueprintView />;
      case 'BANK_EXPLORER':
        return <BankExplorerView />;
      case 'WORKBENCH':
        return <QuestionWorkbenchView onNavigate={setActiveView} />;
      case 'AGENTS':
        return <AIAgentCenter />;
      case 'ASSESSMENT':
        return (
          <div className="flex flex-col items-center justify-center h-96 text-slate-400">
            <LineChart size={64} className="mb-4 opacity-20" />
            <p className="text-xl font-bold">Assessment Quality Analytics</p>
            <p className="text-sm mt-2">Integrating QID-specific psychometrics from USMLE Content Outline.</p>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-96 text-slate-400">
            <ClipboardList size={64} className="mb-4 opacity-20" />
            <p className="text-xl">Module Implementation in Progress</p>
            <p className="text-sm">This section is currently being architected by the MSAi Core Team.</p>
          </div>
        );
    }
  };

  const navItems = [
    { id: 'DASHBOARD', label: 'Mission Control', icon: LayoutDashboard },
    { id: 'WORKBENCH', label: 'Item Workbench', icon: Wand2, highlight: true },
    { id: 'BANK_EXPLORER', label: 'Item Repository', icon: Database },
    { id: 'QB_HEALTH', label: 'QB Health', icon: Stethoscope },
    { id: 'MASTERY', label: 'Student Mastery', icon: Users },
    { id: 'CURRICULUM', label: 'Curriculum Health', icon: BookOpen },
    { id: 'ASSESSMENT', label: 'Assessment Quality', icon: LineChart },
    { id: 'AGENTS', label: 'AI Agent Fleet', icon: Cpu },
    { id: 'BLUEPRINT', label: 'Blueprint Builder', icon: ClipboardList }
  ];

  return (
    <div className="flex h-screen bg-[#F3F6F3] text-slate-900 overflow-hidden font-['Inter']">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0F1110] border-r border-slate-800 hidden lg:flex flex-col shrink-0">
        <div className="p-8 flex-grow overflow-y-auto aside-custom-scrollbar">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-[#1BD183] rounded-2xl flex items-center justify-center text-slate-900 font-black text-2xl shadow-xl shadow-black/30">
              M
            </div>
            <div>
              <h1 className="font-black text-white tracking-tight text-xl">MSAi®</h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Intelligence Suite</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as View)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-sm font-bold transition-all relative ${
                  activeView === item.id 
                  ? 'bg-[#1BD183] text-[#0F1110] shadow-lg shadow-black/30' 
                  : 'text-[#848E8A] hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <item.icon size={20} className={activeView === item.id ? 'text-[#0F1110]' : 'text-[#848E8A]'} />
                {item.label}
                {item.id === 'WORKBENCH' && (
                  <span className="absolute right-4 w-2 h-2 bg-yellow-400 rounded-full animate-ping"></span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-8 space-y-4 border-t border-slate-800">
           <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-3xl">
              <div className="h-2 w-2 rounded-full bg-[#1BD183] animate-pulse"></div>
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Sena: Live</span>
           </div>
          <button className="w-full flex items-center gap-3 px-5 py-2 text-sm font-bold text-[#848E8A] hover:text-whitespace transition">
            <Settings size={18} /> System Config
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-lg w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Query QIDs, Objectives, or Syndromes..." 
                className="w-full pl-12 pr-6 py-3 bg-slate-100 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#1BD183] outline-none transition shadow-inner"
              />
            </div>
          </div>
          <div className="flex items-center gap-8">
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
          </div>
        </header>

        <div className="p-10 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            MSAi Ecosystem <ChevronRight size={12} className="text-slate-300" /> {activeView.replace('_', ' ')}
          </div>
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                {navItems.find(n => n.id === activeView)?.label || 'Mission Control'}
              </h2>
              <p className="text-slate-500 mt-2 text-lg font-medium italic">Authoring environment powered by USMLE Content Intelligence.</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsAuditMapOpen(true)}
                className="px-6 py-3 bg-[#191A19] rounded-[8px] text-sm text-white shadow-sm hover:bg-[##232524] transition active:translate-y-1"
              >
                Audit Map
              </button>
              <button className="px-6 py-3 primary-button rounded-[8px] text-sm font-black text-white transition active:translate-y-1">
                Trigger Auditor
              </button>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            {renderView()}
          </div>
        </div>
      </main>

      {/* Curriculum Audit Map Modal */}
      {isAuditMapOpen && (
        <CurriculumAuditMap 
          onClose={() => setIsAuditMapOpen(false)} 
          onNavigate={(view) => {
            setActiveView(view);
            setIsAuditMapOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default App;
