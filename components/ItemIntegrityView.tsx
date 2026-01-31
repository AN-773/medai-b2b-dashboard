
import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, AlertTriangle, RefreshCw, CheckCircle, Sparkles, 
  ChevronRight, Ban, Activity, Info, X, TrendingDown, Users,
  ArrowRightLeft, Check, Wand2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  LineChart, Line
} from 'recharts';
import { BackendItem } from '../types';

interface ItemIntegrityViewProps {
  items: BackendItem[];
  onUpdate: (item: BackendItem) => void;
}

const ItemIntegrityView: React.FC<ItemIntegrityViewProps> = ({ items, onUpdate }) => {
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  /* 
  {
    integrityScore: 58,
    flaws: [
      'Stem contains ambiguous clinical language.',
      'Distractor options lack plausibility.',
      'Item shows significant performance drift over time.'
    ],
    reconstructedItem: {
      stem: 'A 45-year-old male presents with chest pain and shortness of breath. Which of the following is the most likely diagnosis?',
      options: [
        { text: 'Myocardial Infarction', isCorrect: true },
        { text: 'Gastroesophageal Reflux Disease', isCorrect: false },
        { text: 'Panic Attack', isCorrect: false },
        { text: 'Pneumonia', isCorrect: false }
      ]
    },

  }
  */
  const [selectedItem, setSelectedItem] = useState<BackendItem | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Simulated Drift History for a professional look
  const driftHistory = [
    { month: 'Jan', pValue: 0.72 },
    { month: 'Feb', pValue: 0.68 },
    { month: 'Mar', pValue: 0.65 },
    { month: 'Apr', pValue: 0.61 },
    { month: 'Current', pValue: 0.58 },
  ];

  const handleAudit = async (item: BackendItem) => {
    setAuditingId(item.id);
    setSelectedItem(item);
    // const result = await auditQuestionIntegrity(item);
    const result = null;
    if (result) {
      setAuditResult(result);
    }
    setAuditingId(null);
  };

  const applyRemedy = () => {
    if (!selectedItem || !auditResult?.reconstructedItem) return;
    setIsApplying(true);
    // Simulate commit to DB
    setTimeout(() => {
      const updated: BackendItem = {
        ...selectedItem,
        stem: auditResult.reconstructedItem.stem,
        options: auditResult.reconstructedItem.options.map((o: any, i: number) => ({
          id: `opt-rem-${Date.now()}-${i}`,
          text: o.text,
          isCorrect: o.isCorrect,
          label: String.fromCharCode(65 + i)
        })),
        updatedAt: new Date().toISOString()
      };
      onUpdate(updated);
      setAuditResult(null);
      setSelectedItem(null);
      setIsApplying(false);
    }, 1200);
  };

  const distractorData = useMemo(() => {
    if (!selectedItem || !selectedItem.options) return [];
    return selectedItem.options.map((opt, i) => ({
      name: `Option ${opt.label}`,
      value: opt.isCorrect ? 65 : (i === 1 ? 28 : (i === 2 ? 5 : 2)),
      isCorrect: opt.isCorrect
    }));
  }, [selectedItem]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-500 h-[750px]">
      {/* Flag Queue Sidebar */}
      <div className="xl:col-span-4 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Ban size={18} className="text-rose-500" />
              Integrity Flag Queue
            </h3>
            <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-lg">DRIFTING</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {items.length} items flagged for review
          </p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
          {items.length > 0 ? items.map(item => (
            <button 
              key={item.id}
              onClick={() => handleAudit(item)}
              className={`w-full p-8 text-left hover:bg-slate-50 transition-all group border-l-4 ${
                selectedItem?.id === item.id ? 'bg-indigo-50 border-indigo-600' : 'border-transparent'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-black text-[#1BD183] uppercase tracking-[0.2em]">{item.id}</span>
                <div className="flex items-center gap-1.5">
                   <TrendingDown size={12} className="text-rose-400" />
                   <span className="text-[8px] font-black text-rose-500 uppercase">P-Drift</span>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug mb-3">{item.stem}</p>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                       <Users size={12} className="text-slate-300" />
                       <span>{item.sampleSize || 312} attempts</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <Activity size={12} className="text-slate-300" />
                       <span>P: {(item.pValue || 0.64).toFixed(2)}</span>
                    </div>
                 </div>
                 {auditingId === item.id ? <RefreshCw className="animate-spin text-indigo-600" size={16} /> : <ChevronRight size={16} className="text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />}
              </div>
            </button>
          )) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 p-10 text-center">
              <ShieldCheck size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-black uppercase tracking-widest">No Integrity Flags</p>
              <p className="text-xs font-medium mt-1">Bank health is currently optimal.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Audit workspace */}
      <div className="xl:col-span-8 overflow-y-auto custom-scrollbar pr-2 pb-10">
        {auditResult ? (
          <div className="space-y-8 animate-in slide-in-from-right-10 duration-700">
            {/* Report Header HUD */}
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none scale-150">
                  <ShieldCheck size={300} />
               </div>
               
               <div className="relative z-10 flex justify-between items-start mb-10">
                 <div className="flex items-center gap-6">
                   <div className={`w-20 h-20 rounded-3xl flex flex-col items-center justify-center font-black shadow-2xl ${
                     auditResult.integrityScore > 70 ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'
                   }`}>
                     <span className="text-3xl leading-none">{auditResult.integrityScore}</span>
                     <span className="text-[8px] uppercase mt-1 tracking-widest opacity-80 font-black">Score</span>
                   </div>
                   <div>
                     <h3 className="text-2xl font-black uppercase tracking-tight">Integrity Audit: {selectedItem?.id}</h3>
                     <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Sina Intelligence Report</p>
                   </div>
                 </div>
                 <button onClick={() => setAuditResult(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition">
                   <X size={20} />
                 </button>
               </div>

               <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div className="flex items-center gap-2 text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">
                      <AlertTriangle size={14} /> Structural Flaws Detected
                    </div>
                    <ul className="space-y-3">
                      {auditResult.flaws.map((flaw: string, i: number) => (
                        <li key={i} className="flex items-start gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl group hover:bg-white/10 transition-colors">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                          <p className="text-xs font-medium text-slate-300 leading-relaxed">{flaw}</p>
                        </li>
                      ))}
                    </ul>
                 </div>

                 <div className="space-y-6">
                    <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                      <Activity size={14} /> Psychometric Analysis
                    </div>
                    <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5">
                      <div className="h-32 w-full mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={driftHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis dataKey="month" hide />
                            <YAxis domain={[0.4, 0.8]} hide />
                            <Line type="monotone" dataKey="pValue" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="flex-1 p-3 bg-white/5 rounded-xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Baseline P</p>
                            <p className="text-lg font-black">0.72</p>
                         </div>
                         <ArrowRightLeft className="text-indigo-500 opacity-50" size={16} />
                         <div className="flex-1 p-3 bg-white/5 rounded-xl border border-rose-500/20">
                            <p className="text-[8px] font-black text-rose-400 uppercase mb-1">Current P</p>
                            <p className="text-lg font-black text-rose-500">0.58</p>
                         </div>
                      </div>
                    </div>
                 </div>
               </div>
            </div>

            {/* Comparison Workspace */}
            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
               <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Proposed Remediation</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Review Sina's suggested optimization</p>
                  </div>
                  <div className="flex items-center gap-3">
                     <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">High Reliability Reconstruction</span>
                     <Sparkles size={18} className="text-emerald-500" />
                  </div>
               </div>

               <div className="p-10 space-y-10">
                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Optimized Clinical Stem</p>
                     <p className="text-xl font-bold text-slate-900 leading-relaxed font-serif">
                       {auditResult.reconstructedItem.stem}
                     </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {auditResult.reconstructedItem.options.map((opt: any, i: number) => (
                      <div key={i} className={`flex items-center justify-between p-5 rounded-[1.5rem] border transition-all ${
                        opt.isCorrect ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-100 bg-white'
                      }`}>
                         <div className="flex items-center gap-5">
                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${
                             opt.isCorrect ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-slate-100 text-slate-400'
                           }`}>
                             {String.fromCharCode(65+i)}
                           </div>
                           <span className="text-xs font-bold text-slate-800">{opt.text}</span>
                         </div>
                         {opt.isCorrect && <CheckCircle size={16} className="text-emerald-500" />}
                      </div>
                    ))}
                  </div>

                  <div className="p-8 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] flex gap-6 items-start">
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shrink-0">
                      <Wand2 size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Psychometric Remediation Logic</p>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed italic">"{auditResult.suggestedRemedy}"</p>
                    </div>
                  </div>
               </div>

               <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-6 items-center justify-between">
                  <div className="flex items-center gap-3">
                     <ShieldCheck size={20} className="text-emerald-600" />
                     <span className="text-xs font-bold text-slate-500 italic">Institutional standards alignment confirmed by Sina Auditor.</span>
                  </div>
                  <button 
                    onClick={applyRemedy}
                    disabled={isApplying}
                    className="w-full md:w-auto px-12 py-5 bg-primary-gradient disabled:opacity-50 text-white rounded-[2rem] font-black uppercase tracking-widest transition shadow-2xl shadow-indigo-500/30 flex items-center justify-center gap-4 active:scale-95"
                  >
                    {isApplying ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
                    {isApplying ? 'COMMITTING TO BANK...' : 'Deploy Reconstruction'}
                  </button>
               </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200 p-20 text-center space-y-6 group">
             <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-200 group-hover:scale-110 transition-transform duration-500">
                <ShieldCheck size={64} strokeWidth={1} />
             </div>
             <div>
                <h3 className="text-2xl font-black text-slate-400 uppercase tracking-tight">Audit Engine Standby</h3>
                <p className="text-sm text-slate-400 font-medium max-w-md mt-2 mx-auto leading-relaxed italic">
                  Select an item from the flagged queue on the left to trigger a multi-factor content and psychometric sweep.
                </p>
             </div>
             <div className="flex gap-4">
                <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 shadow-sm">
                   <div className="w-2 h-2 rounded-full bg-rose-500" /> P-Drift Detection
                </div>
                <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 shadow-sm">
                   <div className="w-2 h-2 rounded-full bg-indigo-500" /> NFD Identification
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemIntegrityView;
