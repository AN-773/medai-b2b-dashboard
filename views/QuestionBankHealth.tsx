
import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, ReferenceArea, ReferenceLine
} from 'recharts';
import { MOCK_ITEMS, MOCK_ITEM_PSYCHOMETRICS } from '../constants';
import DashboardCard from '../components/DashboardCard';
import { AlertTriangle, CheckCircle2, XCircle, Info, X, ExternalLink, Loader2 } from 'lucide-react';
import { ItemType } from '../types';
import { testsService } from '../services/testsService';
import { Psychometric } from '../types/TestsServiceTypes';
import CustomTooltip from '../components/Tooltip';

const QuestionBankHealth: React.FC = () => {
  const [isStandardsModalOpen, setIsStandardsModalOpen] = useState(false);
  const [psychometrics, setPsychometrics] = useState<Psychometric[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 10;
  const totalPages = Math.ceil(totalItems / limit);

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string>('p_value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const fetchPsychometrics = async () => {
      try {
        setLoading(true);
        const res = await testsService.getPyschometrics(page, limit, sortColumn, sortDirection);
        setPsychometrics(res.items || []);
        setTotalItems(res.total || 0);
      } catch (err) {
        console.error("Failed to fetch psychometrics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPsychometrics();
  }, [page, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc'); // Default to descending for new sorts
    }
    setPage(1); // Reset to first page on sort
  };

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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DashboardCard title="Difficulty Analysis (P-value)" subtitle="Cognitive distribution across total student attempts">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pValueDist}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <RechartsTooltip cursor={{fill: 'transparent'}} />
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
                <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
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

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-visible">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
           <h3 className="font-black text-slate-900 uppercase tracking-tight">Per-Item Psychometric Audit</h3>
           <button onClick={() => setIsStandardsModalOpen(true)} className="text-[#1BD183] text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Info size={14} /> See Standards
           </button>
        </div>
        <div className="overflow-x-auto" style={{overflow:"visible"}}>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                <th 
                  className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:text-slate-600 transition"
                  onClick={() => handleSort('total_answer_count')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Attempts
                    {sortColumn === 'total_answer_count' && (
                      <span className="text-slate-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:text-slate-600 transition"
                  onClick={() => handleSort('p_value')}
                >
                  <div className="flex items-center justify-center gap-1">
                    P-Value
                    {sortColumn === 'p_value' && (
                      <span className="text-slate-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:text-slate-600 transition"
                  onClick={() => handleSort('r_b')}
                >
                  <div className="flex items-center justify-center gap-1">
                    D-Value
                    {sortColumn === 'r_b' && (
                      <span className="text-slate-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition"
                  onClick={() => handleSort('must_revise')}
                >
                  <div className="flex items-center gap-1">
                    NFD Audit
                    {sortColumn === 'must_revise' && (
                      <span className="text-slate-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-500 text-sm font-bold">
                      <Loader2 className="animate-spin text-slate-400" size={24} />
                      Loading psychometric data...
                    </div>
                  </td>
                </tr>
              ) : psychometrics.map(item => {
                const questionIdMatch = item.question_id?.match(/\/questions\/([^/]+)$/);
                const displayId = questionIdMatch ? questionIdMatch[1] : item.question_id || 'Unknown';
                
                const nfdString = item.stats?.Flawed_Distractor_Choice || "";
                const nfdCount = nfdString ? nfdString.split(',').filter(Boolean).length : 0;
                
                return (
                  <tr key={item.question_id} className="hover:bg-slate-50 transition">
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1 max-w-[280px]">
                        <CustomTooltip content={item.title || 'Untitled Question'} position="top">
                          <span 
                            className="font-bold text-slate-900 text-sm truncate max-w-[280px] block" 
                          >
                            {item.title || 'Untitled Question'}
                          </span>
                        </CustomTooltip>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {displayId}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-6 text-center text-xs font-bold text-slate-500">{item.stats?.Total_Answer_Count || 0}</td>
                    <td className="py-5 px-6 text-center font-black text-slate-800">{item.stats?.P_value?.toFixed(2) || '0.00'}</td>
                    <td className="py-5 px-6 text-center font-black text-[#5D1AEC]">{item.stats?.R_B?.toFixed(2) || '0.00'}</td>
                    <td className="py-5 px-6">
                       {item.stats?.must_revise || nfdCount > 0 ? (
                         <div className="flex items-center gap-2 text-[10px] font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full w-fit">
                            <AlertTriangle size={12} /> {item.stats?.must_revise ? 'Revision Required' : `${nfdCount} Non-functional options`}
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
        
        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-xs font-bold text-slate-500">
            Showing {psychometrics.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalItems)} of {totalItems} items
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-slate-600 px-2">
              Page {page} of {totalPages || 1}
            </span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionBankHealth;
