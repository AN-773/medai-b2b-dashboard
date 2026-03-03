import React, { useState } from 'react';
import PromptManager from '../components/settings/PromptManager';
import { ShieldAlert, BookOpen } from 'lucide-react';

const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'prompts' | 'general'>('prompts');

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="flex bg-slate-50 border-b border-slate-200 px-6 py-4 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Configuration</h2>
          <p className="text-sm text-slate-500 mt-1">Manage global AI prompts and system settings.</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-slate-50 border-r border-slate-200 p-4 shrink-0 overflow-y-auto hidden md:block">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('prompts')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'prompts'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BookOpen size={18} />
              AI Prompts
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors opacity-50 cursor-not-allowed ${
                activeTab === 'general'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600'
              }`}
              disabled
            >
              <ShieldAlert size={18} />
              General (Coming Soon)
            </button>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 bg-white min-h-[600px]">
          {activeTab === 'prompts' && <PromptManager />}
        </main>
      </div>
    </div>
  );
};

export default SettingsView;
