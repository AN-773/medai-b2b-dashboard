
import React from 'react';
import { 
  Activity, 
  BrainCircuit, 
  Sparkles, 
  Target, 
  MonitorPlay,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  HelpCircle
} from 'lucide-react';

import { 
  MOCK_LECTURE_METRICS, 
  MOCK_ITEMS, 
  MOCK_AI_INSIGHT_LOGS 
} from '../constants';

interface LectureDetailPageProps {
  lectureId: string;
  onBack: () => void;
}

const LectureDetailPage: React.FC<LectureDetailPageProps> = ({ lectureId, onBack }) => {
  const metrics = MOCK_LECTURE_METRICS.find(m => m.lectureId === lectureId) || MOCK_LECTURE_METRICS[0];
  const linkedItems = MOCK_ITEMS.filter(i => i.linkedLectureIds?.includes(lectureId));
  const aiInsights = MOCK_AI_INSIGHT_LOGS.filter(i => i.entityId === lectureId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <MonitorPlay size={28} className="text-indigo-600" />
            Lecture Analytics
          </h2>
          <p className="text-slate-500 font-medium text-sm">Reviewing engagement and assessment data for {lectureId}</p>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <MetricCard label="Avg Watch Time" value={`${(metrics.avgWatchTimePercent * 100).toFixed(0)}%`} icon={Clock} color="text-indigo-600" bg="bg-indigo-50" />
        <MetricCard label="Rewatch Rate" value={`${(metrics.rewatchRatePercent * 100).toFixed(0)}%`} icon={Activity} color="text-emerald-600" bg="bg-emerald-50" />
        <MetricCard label="Learning Gain" value={`${((metrics.postAssessmentAvg - metrics.preAssessmentAvg) * 100).toFixed(0)}%`} icon={TrendingUp} color="text-amber-600" bg="bg-amber-50" />
        <MetricCard label="MCQ Performance" value={`${(metrics.downstreamMCQPerformance * 100).toFixed(0)}%`} icon={BrainCircuit} color="text-purple-600" bg="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Linked Items */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-black text-slate-900 uppercase tracking-tight">Linked Assessment Items</h3>
            <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-full">{linkedItems.length} Total</span>
          </div>
          <div className="divide-y divide-slate-50">
            {linkedItems.map(item => (
              <div key={item.id} className="p-6 hover:bg-slate-50 transition group flex justify-between items-center">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{item.id}</p>
                   <p className="font-bold text-slate-800 line-clamp-1">{item.stem}</p>
                </div>
                <ChevronRight size={18} className="text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </div>
            ))}
            {linkedItems.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <HelpCircle size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest">No assessment items linked yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl space-y-6 flex flex-col">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Sparkles size={20} />
            </div>
            <h3 className="font-black uppercase tracking-tight">AI Insights</h3>
          </div>

          <div className="space-y-4 flex-grow">
            {aiInsights.map(ins => (
              <div key={ins.id} className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                <p className="font-bold text-sm leading-relaxed">"{ins.message}"</p>
                <div className="flex flex-wrap gap-2">
                  {ins.suggestedActions.map((action, i) => (
                    <span key={i} className="text-[9px] font-black bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-lg uppercase tracking-tight">
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {aiInsights.length === 0 && (
               <p className="text-xs text-slate-500 italic font-medium">Monitoring student interaction patterns...</p>
            )}
          </div>

          <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition shadow-lg shadow-indigo-900/40">
            Trigger Item Generator
          </button>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, icon: Icon, color, bg }: any) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-5 transition-all hover:scale-[1.02] hover:shadow-lg">
    <div className={`p-4 rounded-2xl ${color} ${bg}`}>
      <Icon size={28} />
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900">{value}</p>
    </div>
  </div>
);

export default LectureDetailPage;
