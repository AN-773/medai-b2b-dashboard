import React from 'react';
import { Activity, Target } from 'lucide-react';

export interface MemberItem {
  key: string;
  title: string;
  identifier: string;
}

interface MemberColumnProps {
  label: string;
  icon: 'organ' | 'objective';
  items: MemberItem[];
  emptyHint: string;
}

const MemberColumn: React.FC<MemberColumnProps> = ({ label, icon, items, emptyHint }) => {
  const Icon = icon === 'organ' ? Activity : Target;
  const accent = icon === 'organ' ? 'text-[#1BA6D1]' : 'text-[#1BD183]';

  return (
    <div className="flex-1 min-w-0 bg-white rounded-[1.75rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <Icon size={16} className={accent} />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            {label}
          </span>
        </div>
        <span className="text-[11px] font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-full">
          {items.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 max-h-[44vh]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <Icon size={26} className="mb-3 opacity-30" />
            <p className="text-[10px] font-black uppercase tracking-widest">{emptyHint}</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 transition-colors group"
            >
              <span className="truncate text-sm font-bold text-slate-700 group-hover:text-slate-900">
                {item.title}
              </span>
              {item.identifier && (
                <span className="flex-shrink-0 text-[10px] font-mono font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                  {item.identifier}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface MemberColumnsProps {
  organSystems: MemberItem[];
  learningObjectives: MemberItem[];
}

const MemberColumns: React.FC<MemberColumnsProps> = ({ organSystems, learningObjectives }) => (
  <div className="flex flex-col lg:flex-row gap-5">
    <MemberColumn
      label="Organ Systems"
      icon="organ"
      items={organSystems}
      emptyHint="No organ systems linked"
    />
    <MemberColumn
      label="Learning Objectives"
      icon="objective"
      items={learningObjectives}
      emptyHint="No learning objectives linked"
    />
  </div>
);

export default MemberColumns;
