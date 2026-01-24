
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, ReferenceArea, ReferenceLine
} from 'recharts';
import { MOCK_ITEMS, MOCK_ITEM_PSYCHOMETRICS } from '../constants';
import DashboardCard from '../components/DashboardCard';
import { AlertTriangle, CheckCircle2, XCircle, Info, X, ExternalLink } from 'lucide-react';
import { ItemType } from '../types';

const QuestionBankHealth: React.FC = () => {
  const [isStandardsModalOpen, setIsStandardsModalOpen] = useState(false);

  // Map items to their psychometric data
  const mcqItems = useMemo(() => {
    return MOCK_ITEMS
      .filter(item => item.type === 'MCQ')
      .map(item => {
        const stats = MOCK_ITEM_PSYCHOMETRICS.find(p => p.itemId === item.id);
        return {
          ...item,
          pValue: stats?.difficultyIndex ?? item.pValue ?? 0,
          dIndex: stats?.discriminationIndex ?? item.dIndex ?? 0,
          sampleSize: stats?.sampleSize ?? 0,
          statsDistractors: stats?.distractorAnalysis ?? []
        };
      });
  }, []);

  const pValueDist = [
    { range: '<0.3', label: 'Too Hard', count: mcqItems.filter(i => i.pValue < 0.3).length, color: '#7F5CD3' },
    { range: '0.3-0.5', label: 'Acceptable', count: mcqItems.filter(i => i.pValue >= 0.3 && i.pValue < 0.5).length, color: '#7F5CD3' },
    { range: '0.5-0.6', label: 'Ideal', count: mcqItems.filter(i => i.pValue >= 0.5 && i.pValue <= 0.6).length, color: '#5D1AEC' },
    { range: '0.6-0.7', label: 'Acceptable', count: mcqItems.filter(i => i.pValue > 0.6 && i.pValue <= 0.7).length, color: '#7F5CD3' },
    { range: '>0.7', label: 'Too Easy', count: mcqItems.filter(i => i.pValue > 0.7).length, color: '#5D1AEC' }
  ];

  const scatterData = mcqItems.map(i => ({
    x: i.pValue,
    y: i.dIndex,
    id: i.id,
    z: 100
  }));

  const totalDistractors = mcqItems.reduce((acc, item) => acc + item.statsDistractors.length, 0);
  const functionalDistractors = mcqItems.reduce((acc, item) => 
    acc + item.statsDistractors.filter(d => !d.flaggedNonFunctional).length, 0);
  
  const efficiencyRate = totalDistractors > 0 ? ((functionalDistractors / totalDistractors) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6 relative">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Bank Strength Score</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1BD183]">72%</span>
            <span className="text-xs text-green-600 font-bold">+2.4%</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Active Samples</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">
              {mcqItems.reduce((acc, i) => acc + i.sampleSize, 0)}
            </span>
            <span className="text-xs text-slate-400">Attempts</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Functional Efficiency</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{efficiencyRate}%</span>
            <span className="text-xs text-slate-400">Distractors</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Revision Required</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#FF5353]">
               {mcqItems.filter(i => i.dIndex < 0.2 || i.statsDistractors.some(d => d.flaggedNonFunctional)).length}
            </span>
            <span className="text-xs text-[#FF5353]/80 font-bold">Items</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard title="Difficulty Analysis (P-value)" subtitle="Cognitive distribution across total student attempts">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pValueDist}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {pValueDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>

        <DashboardCard title="Discrimination Map (R_PB)" subtitle="Point-biserial correlation with total exam score">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="x" name="P" domain={[0, 1]} tick={{fontSize: 10}} label={{ value: 'Difficulty (P)', position: 'bottom', offset: 0, fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="D" domain={[-0.5, 1]} tick={{fontSize: 10}} label={{ value: 'Discrimination (D)', position: 'left', angle: -90, offset: 0, fontSize: 10 }} />
                <ZAxis type="number" dataKey="z" range={[100, 100]} />
                <ReferenceArea x1={0.3} x2={0.7} y1={0.3} y2={1} fill="#10b981" fillOpacity={0.05} />
                <ReferenceLine y={0.3} stroke="#10b981" strokeDasharray="5 5" />
                <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Items" data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.y < 0 ? '#ef4444' : entry.y < 0.3 ? '#fbbf24' : '#10b981'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
           <h3 className="font-black text-slate-900 uppercase tracking-tight">Per-Item Psychometric Audit</h3>
           <button onClick={() => setIsStandardsModalOpen(true)} className="text-[#1BD183] text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Info size={14} /> See Standards
           </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item ID</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Attempts</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">P-Value</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">D-Value</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">NFD Audit</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mcqItems.map(item => {
                const nfdCount = item.statsDistractors.filter(d => d.selectionRate < 0.05).length;
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-5 px-6 font-bold text-slate-900">{item.id}</td>
                    <td className="py-5 px-6 text-center text-xs font-bold text-slate-500">{item.sampleSize}</td>
                    <td className="py-5 px-6 text-center font-black text-slate-800">{item.pValue.toFixed(2)}</td>
                    <td className="py-5 px-6 text-center font-black text-[#5D1AEC]">{item.dIndex.toFixed(2)}</td>
                    <td className="py-5 px-6">
                       {nfdCount > 0 ? (
                         <div className="flex items-center gap-2 text-[10px] font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full w-fit">
                            <AlertTriangle size={12} /> {nfdCount} Non-functional options
                         </div>
                       ) : (
                         <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full w-fit">
                            <CheckCircle2 size={12} /> Optimized Distractors
                         </div>
                       )}
                    </td>
                    <td className="py-5 px-6 text-right">
                       <button className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl hover:bg-slate-800 transition">
                          Review
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuestionBankHealth;
