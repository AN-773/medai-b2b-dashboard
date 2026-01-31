
import React from 'react';
import { 
  Plus, 
  MessageSquare, 
  AlertCircle,
  FileQuestion,
  CheckCircle2,
  FileEdit,
  AlertTriangle,
  ArrowRight,
  Trash2,
  MonitorPlay,
  FileText,
  ClipboardCheck
} from 'lucide-react';
import { Question, BloomsLevel, Issue, ItemType } from '../types';

interface QuestionDashboardProps {
  onCreateClick: () => void;
  onViewAllClick: () => void;
  onEditClick: (question: Question) => void;
  onDelete: (id: string) => void;
  onIssueClick: (issue: Issue) => void;
  questions: Question[];
  issues: Issue[];
  itemType: ItemType;
}

const QuestionDashboard: React.FC<QuestionDashboardProps> = ({ 
  onCreateClick, 
  onViewAllClick, 
  onEditClick, 
  onDelete,
  onIssueClick,
  questions,
  issues,
  itemType
}) => {
  
  // Dynamic Terminology Configuration
  const config = {
    [ItemType.MCQ]: {
      singular: 'Question',
      plural: 'Questions',
      header: 'Questions Dashboard',
      subtitle: 'Overview of MCQ bank health and activity.',
      mainIcon: ClipboardCheck,
      tableCol: 'Question Stem'
    },
    [ItemType.SAQ]: {
      singular: 'SAQ',
      plural: 'SAQs',
      header: 'SAQ Dashboard',
      subtitle: 'Tracking short-answer content performance.',
      mainIcon: FileText,
      tableCol: 'Prompt Text'
    },
    [ItemType.LECTURE]: {
      singular: 'Lecture',
      plural: 'Lectures',
      header: 'Lectures Dashboard',
      subtitle: 'Audit and engagement overview for instructional materials.',
      mainIcon: MonitorPlay,
      tableCol: 'Lecture Title'
    }
  }[itemType];

  const stats = [
    { 
      label: `Total ${config.plural}`, 
      value: questions.length, 
      icon: config.mainIcon, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50' 
    },
    { 
      label: 'Published', 
      value: questions.filter(q => q.status === 'Published').length, 
      icon: CheckCircle2, 
      color: 'text-green-600', 
      bg: 'bg-green-50' 
    },
    { 
      label: 'Drafts', 
      value: questions.filter(q => q.status === 'Draft').length, 
      icon: AlertCircle, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50' 
    },
    { 
      label: 'Open Issues', 
      value: issues.length, 
      icon: MessageSquare, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50' 
    },
  ];

  // Only show open issues in the dashboard alert list
  const activeIssues = issues.filter(i => i.status === 'Open').slice(0, 5);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete this ${config.singular.toLowerCase()}? This action cannot be undone.`)) {
      onDelete(id);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{config.header}</h2>
          <p className="text-slate-500 text-sm font-medium">{config.subtitle}</p>
        </div>
        <button 
          onClick={onCreateClick}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <Plus size={16} />
          Create {config.singular}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-indigo-200 transition-colors">
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="xl:col-span-2 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="font-black text-slate-900 uppercase tracking-tight">Recent {config.plural}</h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={onViewAllClick}
                className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition px-2"
              >
                View all {config.plural.toLowerCase()}
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">{config.tableCol}</th>
                  <th className="px-6 py-4">Bloom's Level</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Revised</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {questions.slice(0, 8).map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 max-w-xs truncate font-bold text-slate-900">{q.text}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tight 
                        ${q.bloomsLevel === BloomsLevel.Remember ? 'bg-green-100 text-green-700' : 
                          q.bloomsLevel === BloomsLevel.Understand ? 'bg-indigo-100 text-indigo-700' :
                          q.bloomsLevel === BloomsLevel.Apply ? 'bg-orange-100 text-orange-700' :
                          'bg-purple-100 text-purple-700'}`}>
                        {q.bloomsLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tight
                         ${q.status === 'Published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                         <span className={`w-1 h-1 rounded-full ${q.status === 'Published' ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onEditClick(q)}
                          className="p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors"
                          title={`Edit ${config.singular}`}
                        >
                          <FileEdit size={16} />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, q.id)}
                          className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"
                          title={`Delete ${config.singular}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {questions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                       <config.mainIcon size={40} className="mx-auto mb-3 text-slate-200" strokeWidth={1} />
                       <p className="text-sm font-black text-slate-300 uppercase tracking-widest">No {config.plural} Indexed</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts Side Panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm h-full">
            <h3 className="font-black text-slate-900 uppercase tracking-tight mb-6 flex justify-between items-center">
              <span>Agent Alerts</span>
              {activeIssues.length > 0 && (
                 <span className="text-[9px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-lg">{activeIssues.length} ACTIVE</span>
              )}
            </h3>
            <div className="space-y-4">
              {activeIssues.map((issue) => (
                <div 
                  key={issue.id}
                  onClick={() => onIssueClick(issue)}
                  className="flex gap-3 items-start p-4 rounded-2xl hover:bg-slate-50 cursor-pointer transition-colors group border border-slate-100 hover:border-indigo-100 shadow-sm"
                >
                  <div className={`mt-1 flex-shrink-0 ${issue.severity === 'High' ? 'text-rose-500' : 'text-amber-500'}`}>
                    <AlertTriangle size={18} fill={issue.severity === 'High' ? "currentColor" : "none"} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className={`text-xs font-black uppercase tracking-tight ${issue.severity === 'High' ? 'text-rose-900' : 'text-slate-800'}`}>
                        {issue.title}
                      </p>
                      <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity transform group-hover:translate-x-1" />
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 italic font-medium">"{issue.description}"</p>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{issue.type}</span>
                       <span className="text-[9px] text-slate-300">•</span>
                       <span className="text-[9px] text-slate-400 font-mono">{new Date(issue.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}

              {activeIssues.length === 0 && (
                <div className="text-center py-20 text-slate-400">
                  <CheckCircle2 size={48} strokeWidth={1} className="mx-auto mb-3 text-emerald-100" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Queue Status: Optimal</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionDashboard;
