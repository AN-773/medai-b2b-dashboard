
import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Clock, 
  Brain, 
  Users, 
  AlertCircle, 
  Zap,
  ArrowUpRight,
  HelpCircle,
  PlayCircle
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend, ComposedChart, Line
} from 'recharts';
import { MOCK_LECTURE_METRICS } from '../constants';
import DashboardCard from './DashboardCard';

const LectureAnalyticsView: React.FC<{ lectureId: string; title: string }> = ({ lectureId, title }) => {
  const metrics = useMemo(() => 
    MOCK_LECTURE_METRICS.find(m => m.lectureId === lectureId) || MOCK_LECTURE_METRICS[0]
  , [lectureId]);

  const engagementData = useMemo(() => [
    { time: 'Start', engagement: 95, load: metrics.intrinsicLoad * 5 },
    { time: 'Pause 1', engagement: metrics.avgWatchTimePercent * 100, load: metrics.intrinsicLoad * 8 },
    { time: 'Pause 2', engagement: 75, load: metrics.extraneousLoad * 15 },
    { time: 'End', engagement: 82, load: metrics.germaneLoad * 10 },
  ], [metrics]);

  const retentionData = useMemo(() => [
    { name: 'Pre', score: metrics.preAssessmentAvg * 100 },
    { name: 'Post', score: metrics.postAssessmentAvg * 100 },
    { name: 'Retention', score: metrics.retentionAssessmentAvg * 100 },
    { name: 'Linked MCQ', score: metrics.downstreamMCQPerformance * 100 },
  ], [metrics]);

  const cognitiveData = [
    { name: 'Intrinsic', value: metrics.intrinsicLoad, color: '#6366f1' },
    { name: 'Extraneous', value: metrics.extraneousLoad, color: '#f43f5e' },
    { name: 'Germane', value: metrics.germaneLoad, color: '#10b981' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Zap size={24} /></div>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase">
              {metrics.nbmeCorrelationScore > 0.6 ? 'High Correlation' : 'Moderate'}
            </span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NBME Correlation</p>
          <h4 className="text-3xl font-black text-slate-900 mt-1">{metrics.nbmeCorrelationScore}</h4>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={24} /></div>
            <div className="flex items-center text-emerald-600 font-bold text-xs">
              +{(metrics.postAssessmentAvg - metrics.preAssessmentAvg).toFixed(2)} gain
            </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Learning Gain Index</p>
          <h4 className="text-3xl font-black text-slate-900 mt-1">{(metrics.postAssessmentAvg * 100).toFixed(0)}%</h4>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Clock size={24} /></div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retention Score</p>
          <h4 className="text-3xl font-black text-slate-900 mt-1">{(metrics.retentionAssessmentAvg * 100).toFixed(0)}%</h4>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Users size={24} /></div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tutor Queries</p>
          <h4 className="text-3xl font-black text-slate-900 mt-1">{metrics.avgTutorQueriesPerStudent} / stud</h4>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <DashboardCard title="Engagement & Cognitive Load" subtitle="Attention vs Mental Effort Mapping">
            <div className="h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={engagementData}>
                  <defs>
                    <linearGradient id="colorEngage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Area type="monotone" name="Engagement %" dataKey="engagement" stroke="#6366f1" fill="url(#colorEngage)" strokeWidth={3} />
                  <Line type="monotone" name="Cognitive Load (Sim)" dataKey="load" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <DashboardCard title="Cognitive Architecture" subtitle="Intrinsic vs Extraneous vs Germane">
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cognitiveData} layout="vertical">
                  <XAxis type="number" hide domain={[0, 10]} />
                  <YAxis type="category" dataKey="name" tick={{fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {cognitiveData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {metrics.extraneousLoad > 5 && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-700">
                <AlertCircle size={14} className="mt-0.5" />
                <p className="text-[10px] font-bold">Extraneous Load high! Revise instructional clarity.</p>
              </div>
            )}
          </DashboardCard>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
           <DashboardCard title="Assessment Trajectory" subtitle="Pre-test through Retention (30 Days)">
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={retentionData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip />
                    <Area type="monotone" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={3} dot={{r: 6, fill: '#10b981'}} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </DashboardCard>
        </div>
        <div className="space-y-6">
           <DashboardCard title="Neural Link Summary">
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Avg Notes / Student</span>
                    <span className="font-black">{metrics.avgNotesPerStudent}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Pause Events</span>
                    <span className="font-black text-amber-600">{metrics.pauseClusterTimestamps.length} spikes</span>
                 </div>
                 <button className="w-full py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition flex items-center justify-center gap-2">
                    <HelpCircle size={14} /> Review Logic
                 </button>
              </div>
           </DashboardCard>
        </div>
      </div>
    </div>
  );
};

export default LectureAnalyticsView;
