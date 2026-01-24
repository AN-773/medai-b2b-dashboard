
import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell
} from 'recharts';
import { MOCK_ITEMS, MOCK_EXAM_BLUEPRINTS, MOCK_RELIABILITY_TARGETS, MOCK_ORGAN_SYSTEMS } from '../constants';
import { OrganSystem, ExamBlueprint, ReliabilityTarget } from '../types';
import DashboardCard from '../components/DashboardCard';
import { 
  Zap, 
  AlertCircle, 
  ShieldCheck, 
  Database,
  LayoutTemplate,
  ChevronDown,
  Target,
  Search,
  CheckCircle2,
  Settings2
} from 'lucide-react';

const ExamBlueprintView: React.FC = () => {
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>(MOCK_EXAM_BLUEPRINTS[0].id);
  const [itemCount, setItemCount] = useState(MOCK_EXAM_BLUEPRINTS[0].totalItems);

  const selectedBlueprint = useMemo(() => 
    MOCK_EXAM_BLUEPRINTS.find(b => b.id === selectedBlueprintId) || MOCK_EXAM_BLUEPRINTS[0]
  , [selectedBlueprintId]);

  const reliabilityTarget = useMemo(() => 
    MOCK_RELIABILITY_TARGETS.find(t => t.context.toLowerCase().includes(selectedBlueprint.name.toLowerCase().split(' ')[0])) 
    || MOCK_RELIABILITY_TARGETS[0]
  , [selectedBlueprint]);

  // Transform Difficulty Distribution for AreaChart
  const difficultyData = useMemo(() => {
    // Generate a curve based on proportions
    const labels = ['Easy', 'Moderate', 'Hard'];
    const points = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    
    return points.map(p => {
      let weight = 0;
      selectedBlueprint.difficultyDistribution.forEach(dist => {
        if (dist.label === 'Easy' && p >= 0.7) weight += dist.proportion * Math.exp(-Math.pow(p - 0.8, 2) / 0.02);
        if (dist.label === 'Moderate' && p >= 0.4 && p <= 0.7) weight += dist.proportion * Math.exp(-Math.pow(p - 0.55, 2) / 0.01);
        if (dist.label === 'Hard' && p <= 0.4) weight += dist.proportion * Math.exp(-Math.pow(p - 0.25, 2) / 0.02);
      });
      return { pValue: p, weight: Math.round(weight * 100) };
    });
  }, [selectedBlueprint]);

  const getSystemName = (id: string) => MOCK_ORGAN_SYSTEMS.find(s => s.id === id)?.name || id;

  const bloomColors = {
    'Recall': '#94a3b8',
    'Understand': '#818cf8',
    'Apply': '#6366f1',
    'Analyze': '#4f46e5'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20 animate-in fade-in duration-700">
      {/* Sidebar Configuration */}
      <div className="lg:col-span-4 space-y-6">
        <DashboardCard title="Blueprint Templates" subtitle="Select institutional standard models">
           <div className="space-y-2 mt-2">
             {MOCK_EXAM_BLUEPRINTS.map(bp => (
               <button
                 key={bp.id}
                 onClick={() => {
                   setSelectedBlueprintId(bp.id);
                   setItemCount(bp.totalItems);
                 }}
                 className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                   selectedBlueprintId === bp.id 
                   ? 'bg-[#1BD183] text-black' 
                   : 'bg-white border-slate-100 text-slate-600 hover:border-[#1BD183]'
                 }`}
               >
                 <div>
                    <p className="text-xs font-black uppercase tracking-tight">{bp.name}</p>
                    <p className={`text-[10px] mt-1 font-medium ${selectedBlueprintId === bp.id ? 'text-black' : 'text-slate-400'}`}>
                      {bp.totalItems} Items • {bp.organSystemWeights.length} Systems
                    </p>
                 </div>
                 <CheckCircle2 size={18} className={selectedBlueprintId === bp.id ? 'opacity-100' : 'opacity-0'} />
               </button>
             ))}
           </div>
        </DashboardCard>

        <DashboardCard title="Exam Parameters" subtitle="Refine instance-specific settings">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Question Count</label>
                <span className="text-sm font-black text-[#1BD183]">{itemCount} Qs</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="100" 
                step="5" 
                value={itemCount}
                onChange={(e) => setItemCount(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1BD183]"
              />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Organ System Balancing</label>
              <div className="space-y-4">
                {selectedBlueprint.organSystemWeights.map(sys => (
                  <div key={sys.organSystemId} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                       <span className="text-slate-600 truncate max-w-[180px]">{getSystemName(sys.organSystemId)}</span>
                       <span className="text-[#1BD183]">{sys.weightPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-[#1BD183] transition-all duration-1000" style={{ width: `${sys.weightPercent}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button className="w-full py-4 bg-primary-gradient hover:bg-primary-gradient-hover text-white rounded-[1.5rem] text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition shadow-xl shadow-slate-200 active:translate-y-1">
              <Zap size={16} className="text-yellow-400" /> Assemble Form
            </button>
          </div>
        </DashboardCard>

        <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem]">
          <div className="flex items-start gap-4">
            <ShieldCheck className="text-emerald-600 shrink-0 mt-1" size={24} />
            <div>
              <p className="text-xs font-black text-emerald-900 uppercase tracking-tight">Reliability Goal</p>
              <p className="text-[10px] text-emerald-700 mt-1 leading-relaxed font-medium">
                Targeting Cronbach's Alpha <strong>≥{reliabilityTarget.targetCronbachAlpha}</strong> for {reliabilityTarget.context.toLowerCase()}.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Preview Analytics */}
      <div className="lg:col-span-8 space-y-8">
        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
              <Settings2 size={300} />
           </div>
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 pb-8 mb-8">
              <div>
                <span className="text-[10px] font-black text-[#1BD183] uppercase tracking-[0.2em] mb-2 block">Blueprint DNA Matrix</span>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedBlueprint.name}</h2>
                <p className="text-sm text-slate-500 font-medium mt-1 italic">"{selectedBlueprint.description}"</p>
              </div>
              <div className="flex gap-4">
                 <div className="bg-[#1BD183]/10 px-6 py-4 rounded-3xl text-center border border-[#1BD183]/20">
                    <p className="text-[9px] font-black text-[#1BD183] uppercase mb-1">Items</p>
                    <p className="text-3xl font-black text-[#1BD183]">{itemCount}</p>
                 </div>
                 <div className="bg-slate-900 px-6 py-4 rounded-3xl text-center">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">KR-20</p>
                    <p className="text-3xl font-black text-white">{reliabilityTarget.targetKR20}</p>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <Target size={14} className="text-[#1BD183]" /> Psychometric Difficulty Curve
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={difficultyData}>
                      <defs>
                        <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="pValue" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 9, fontWeight: 700}} 
                        label={{ value: 'Difficulty (P)', position: 'bottom', offset: 0, fontSize: 9, fontWeight: 900 }}
                      />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} 
                      />
                      <Area type="monotone" dataKey="weight" stroke="#1BA6D1" strokeWidth={4} fill="url(#curveGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <LayoutTemplate size={14} className="text-[#1BD183]" /> Bloom's Taxonomy Weights
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedBlueprint.bloomDistribution} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="bloomLevel" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 9, fontWeight: 700}} 
                      />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} 
                      />
                      <Bar dataKey="proportion" radius={[12, 12, 0, 0]} barSize={40}>
                        {selectedBlueprint.bloomDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={(bloomColors as any)[entry.bloomLevel] || '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <DashboardCard title="Bank Availability Check">
              <div className="space-y-4">
                 <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Eligible Published Items</span>
                    <span className="text-xl font-black text-slate-900">412</span>
                 </div>
                 <div className="p-4 border border-emerald-100 bg-emerald-50 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-emerald-500 text-white rounded-lg">
                       <CheckCircle2 size={16} />
                    </div>
                    <p className="text-[10px] font-bold text-emerald-800">
                      Sufficient variance detected across all target p-value clusters.
                    </p>
                 </div>
              </div>
           </DashboardCard>

           <DashboardCard title="Automated Logic Mapping">
              <div className="space-y-2">
                 {[
                   'Linear sequential delivery',
                   'Block timing: 60 minutes',
                   'System-based stratification enabled',
                   'NFD Item suppression active'
                 ].map((logic, i) => (
                   <div key={i} className="flex items-center gap-3 text-[10px] font-bold text-slate-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                      {logic}
                   </div>
                 ))}
              </div>
           </DashboardCard>
        </div>
      </div>
    </div>
  );
};

export default ExamBlueprintView;
