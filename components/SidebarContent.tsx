import React from 'react';
import { 
  LogOut, 
  Settings,
  LayoutDashboard, 
  Stethoscope, 
  Users, 
  BookOpen, 
  LineChart,
  Cpu,
  ClipboardList, 
  Database,
  Wand2,
  GraduationCap
} from 'lucide-react';
import { View } from '../types';

interface SidebarContentProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({ activeView, onNavigate, onLogout }) => {
  
  const isActive = (view: View) => activeView === view;

  const getButtonClass = (view: View) => {
    return isActive(view)
      ? "w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all relative group bg-[#00AA55] text-white shadow-xl shadow-emerald-900/20"
      : "w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all relative group text-gray-400 hover:bg-white/10 hover:text-white";
  };

  const getIconClass = (view: View) => {
    return isActive(view)
      ? "text-white"
      : "text-gray-500 group-hover:text-[#00AA55]";
  };

  const getSubMenuButtonClass = (view: View) => {
    return isActive(view)
      ? "w-full flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative group text-white"
      : "w-full flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all relative group text-gray-500 hover:text-white";
  };

  const getSubMenuDotClass = (view: View) => {
    return isActive(view)
      ? "w-1.5 h-1.5 rounded-full bg-[#00AA55]"
      : "w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-gray-500";
  };

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

          <nav className="space-y-1">
            {/* Mission Control */}
            <button 
              onClick={() => onNavigate('DASHBOARD')}
              className={getButtonClass('DASHBOARD')}
            >
              <LayoutDashboard size={20} className={getIconClass('DASHBOARD')} />
              Mission Control
            </button>

            {/* Faculty Command Group */}
            <button 
              onClick={() => onNavigate('FACULTY')}
              className={getButtonClass('FACULTY')}
            >
              <GraduationCap size={20} className={getIconClass('FACULTY')} />
              Faculty Command
            </button>
            
            <div className="pl-6 space-y-1 mt-1 mb-2 relative">
              <div className="absolute left-10 top-2 bottom-2 w-px bg-white/10"></div>
              
              <button 
                onClick={() => onNavigate('CURRICULUM')}
                className={getSubMenuButtonClass('CURRICULUM')}
              >
                <div className={getSubMenuDotClass('CURRICULUM')}></div>
                Curriculum Workbench
              </button>
              
              <button 
                onClick={() => onNavigate('MASTERY')}
                className={getSubMenuButtonClass('MASTERY')}
              >
                <div className={getSubMenuDotClass('MASTERY')}></div>
                Student Mastery
              </button>
            </div>

            {/* Item Workbench */}
            <button 
              onClick={() => onNavigate('WORKBENCH')}
              className={getButtonClass('WORKBENCH')}
            >
              <Wand2 size={20} className={getIconClass('WORKBENCH')} />
              Item Workbench
            </button>

            {/* Item Repository Group */}
            <button 
              onClick={() => onNavigate('BANK_EXPLORER')}
              className={getButtonClass('BANK_EXPLORER')}
            >
              <Database size={20} className={getIconClass('BANK_EXPLORER')} />
              Item Repository
            </button>

            <div className="pl-6 space-y-1 mt-1 mb-2 relative">
              <div className="absolute left-10 top-2 bottom-2 w-px bg-white/10"></div>
              <button 
                onClick={() => onNavigate('QB_HEALTH')}
                className={getSubMenuButtonClass('QB_HEALTH')}
              >
                <div className={getSubMenuDotClass('QB_HEALTH')}></div>
                QB Health
              </button>
            </div>

            {/* Assessment Quality */}
            <button 
              onClick={() => onNavigate('ASSESSMENT')}
              className={getButtonClass('ASSESSMENT')}
            >
              <LineChart size={20} className={getIconClass('ASSESSMENT')} />
              Assessment Quality
            </button>

            {/* Blueprint Builder */}
            <button 
              onClick={() => onNavigate('BLUEPRINT')}
              className={getButtonClass('BLUEPRINT')}
            >
              <ClipboardList size={20} className={getIconClass('BLUEPRINT')} />
              Blueprint Builder
            </button>

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
          <button className="w-full flex items-center gap-3 px-5 py-2 text-sm font-bold text-[#848E8A] hover:text-white transition">
            <Settings size={18} /> System Config
          </button>
        </div>
    </div>
  );
};

export default SidebarContent;
