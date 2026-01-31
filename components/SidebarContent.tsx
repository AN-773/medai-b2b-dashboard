import React from 'react';
import { 
  LogOut, 
  Settings,
  LayoutDashboard, 
  Stethoscope, 
  Users, 
  BookOpen, 
  LineChart, 
  ClipboardList, 
  Database,
  Wand2,
} from 'lucide-react';
import { View } from '../types';

interface SidebarContentProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ activeView, onNavigate, onLogout }) => {
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
    <div className="flex flex-col h-full bg-[#0F1110] border-r border-slate-800 text-slate-900 font-['Inter']">
        <div className="p-8 flex-grow overflow-y-auto aside-custom-scrollbar">
          <div className="flex items-center gap-3 mb-10">
            <img 
              src="/assets/Medical Student AI Horizontal Dark BG - Green.png" 
              alt="MSAi Logo" 
              className="h-10 w-auto"
            />
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as View)}
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
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Sina: Live</span>
           </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-5 py-2 text-sm font-bold text-[#848E8A] hover:text-red-400 transition"
          >
            <LogOut size={18} /> Sign Out
          </button>
          <button className="w-full flex items-center gap-3 px-5 py-2 text-sm font-bold text-[#848E8A] hover:text-whitespace transition">
            <Settings size={18} /> System Config
          </button>
        </div>
    </div>
  );
};

export default SidebarContent;
