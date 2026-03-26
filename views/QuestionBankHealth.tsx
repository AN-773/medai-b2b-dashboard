
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, ReferenceArea, ReferenceLine
} from 'recharts';

import DashboardCard from '../components/DashboardCard';
import { AlertTriangle, CheckCircle2, XCircle, Info, X, ExternalLink, Loader2 } from 'lucide-react';
import { ItemType } from '../types';
import { testsService } from '../services/testsService';
import { Psychometric, DashboardStatsResponse } from '../types/TestsServiceTypes';
import CustomTooltip from '../components/Tooltip';
import SearchableSelect from '../components/SearchableSelect';
import MultiSearchableSelect from '../components/MultiSearchableSelect';
import { useGlobal } from '../contexts/GlobalContext';
import { OrganSystem, Topic, Discipline, Tag, Subject, Competency } from '../types/TestsServiceTypes';
import { Search, Filter, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

const QuestionBankHealth: React.FC = () => {
  const navigate = useNavigate();
  const [isStandardsModalOpen, setIsStandardsModalOpen] = useState(false);
  const [psychometrics, setPsychometrics] = useState<Psychometric[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 10;
  const totalPages = Math.ceil(totalItems / limit);

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string>('p_value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter State
  const { cognitiveSkills } = useGlobal();
  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const [selectedExamType, setSelectedExamType] = useState<string>('ALL');
  const [selectedIdentifier, setSelectedIdentifier] = useState<string>('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  
  const [selectedOrganSystems, setSelectedOrganSystems] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedCognitiveSkills, setSelectedCognitiveSkills] = useState<string[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectedIdentifier(localSearchQuery);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setFiltersLoading(true);
        const [sysRes, discRes, tagsRes, subjRes, compRes] = await Promise.all([
          testsService.getOrganSystems(),
          testsService.getDisciplines(1, 200),
          testsService.getTags(1, 200),
          testsService.getSubjects(1, 200),
          testsService.getCompetencies(1, 200)
        ]);
        
        setOrganSystems(sysRes.items || []);
        setDisciplines(discRes.items || []);
        setTags(tagsRes.items || []);
        setSubjects(subjRes.items || []);
        setCompetencies(compRes.items || []);
      } catch (error) {
        console.error('Failed to fetch initial filter data:', error);
      } finally {
        setFiltersLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch topics when organ systems change
  useEffect(() => {
    const fetchTopics = async () => {
      if (selectedOrganSystems.length === 0) {
        setTopics([]);
        return;
      }
      try {
        // Here we ideally fetch topics for all selected systems. 
        // For now, testing service might just support filtering by the primary system if one is selected, 
        // but given its signature it seems we can just fetch all topics and filter client-side or assume it handles it.
        // Assuming testsService handles it if we pass nothing or we just fetch top 200
        const response = await testsService.getTopics(selectedOrganSystems[0]); 
        setTopics(response.items || []);
      } catch (error) {
        console.error('Failed to fetch topics:', error);
      }
    };
    fetchTopics();
  }, [selectedOrganSystems]);

  useEffect(() => {
    const fetchPsychometrics = async () => {
      try {
        setLoading(true);
        const res = await testsService.getPyschometrics(
          page, 
          limit, 
          sortColumn, 
          sortDirection,
          selectedExamType === 'ALL' ? undefined : selectedExamType,
          selectedIdentifier || undefined,
          selectedOrganSystems.length > 0 ? selectedOrganSystems.join(',') : undefined,
          selectedTopics.length > 0 ? selectedTopics.join(',') : undefined,
          selectedCognitiveSkills.length > 0 ? selectedCognitiveSkills.join(',') : undefined,
          selectedDisciplines.length > 0 ? selectedDisciplines.join(',') : undefined,
          selectedSubjects.length > 0 ? selectedSubjects.join(',') : undefined,
          selectedTags.length > 0 ? selectedTags.join(',') : undefined,
          selectedCompetencies.length > 0 ? selectedCompetencies.join(',') : undefined
        );
        setPsychometrics(res.items || []);
        setTotalItems(res.total || 0);
      } catch (err) {
        console.error("Failed to fetch psychometrics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPsychometrics();
  }, [page, sortColumn, sortDirection, selectedExamType, selectedIdentifier, selectedOrganSystems, selectedTopics, selectedCognitiveSkills, selectedDisciplines, selectedSubjects, selectedTags, selectedCompetencies]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const res = await testsService.getDashboardStats(
          selectedExamType === 'ALL' ? undefined : selectedExamType,
          selectedIdentifier || undefined,
          selectedOrganSystems.length > 0 ? selectedOrganSystems.join(',') : undefined,
          selectedTopics.length > 0 ? selectedTopics.join(',') : undefined,
          selectedCognitiveSkills.length > 0 ? selectedCognitiveSkills.join(',') : undefined,
          selectedDisciplines.length > 0 ? selectedDisciplines.join(',') : undefined,
          selectedSubjects.length > 0 ? selectedSubjects.join(',') : undefined,
          selectedTags.length > 0 ? selectedTags.join(',') : undefined,
          selectedCompetencies.length > 0 ? selectedCompetencies.join(',') : undefined
        );
        setDashboardStats(res);
      } catch (err) {
        console.error("Failed to fetch dashboard stats", err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [selectedExamType, selectedIdentifier, selectedOrganSystems, selectedTopics, selectedCognitiveSkills, selectedDisciplines, selectedSubjects, selectedTags, selectedCompetencies]);

  const clearFilters = () => {
    setSelectedExamType('ALL');
    setLocalSearchQuery('');
    setSelectedIdentifier('');
    setSelectedOrganSystems([]);
    setSelectedTopics([]);
    setSelectedCognitiveSkills([]);
    setSelectedDisciplines([]);
    setSelectedSubjects([]);
    setSelectedTags([]);
    setSelectedCompetencies([]);
    setPage(1);
  };

  const hasActiveFilters = localSearchQuery !== '' || selectedExamType !== 'ALL' || selectedOrganSystems.length > 0 || selectedTopics.length > 0 || selectedCognitiveSkills.length > 0 || selectedDisciplines.length > 0 || selectedSubjects.length > 0 || selectedTags.length > 0 || selectedCompetencies.length > 0;

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc'); // Default to descending for new sorts
    }
    setPage(1); // Reset to first page on sort
  };

  const pValueDist = dashboardStats ? [
    { range: '<0.3', label: 'Too Hard', count: dashboardStats.difficulty_distribution.too_hard, color: '#7F5CD3' },
    { range: '0.3-0.5', label: 'Acceptable', count: dashboardStats.difficulty_distribution.acceptable_low, color: '#7F5CD3' },
    { range: '0.5-0.6', label: 'Ideal', count: dashboardStats.difficulty_distribution.ideal, color: '#5D1AEC' },
    { range: '0.6-0.7', label: 'Acceptable', count: dashboardStats.difficulty_distribution.acceptable_high, color: '#7F5CD3' },
    { range: '>0.7', label: 'Too Easy', count: dashboardStats.difficulty_distribution.too_easy, color: '#5D1AEC' }
  ] : [];

  const scatterData = (dashboardStats?.scatter_plot_data || []).map(i => ({
    x: i.p_value,
    y: i.r_b,
    id: i.question_id,
    z: 100
  }));

  return (
    <div className="space-y-6 relative">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          {statsLoading && <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-[#1BD183]" size={20} /></div>}
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Bank Strength Score</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#1BD183]">{dashboardStats?.metrics.bank_strength_score ?? 0}%</span>
            <span className={`text-xs font-bold ${(dashboardStats?.metrics.bank_strength_trend ?? 0) >= 0 ? 'text-green-600' : 'text-rose-500'}`}>
              {(dashboardStats?.metrics.bank_strength_trend ?? 0) > 0 ? '+' : ''}{dashboardStats?.metrics.bank_strength_trend ?? 0}%
            </span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          {statsLoading && <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-[#1BD183]" size={20} /></div>}
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Active Samples</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">
              {dashboardStats?.metrics.total_active_samples ?? 0}
            </span>
            <span className="text-xs text-slate-400">Attempts</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          {statsLoading && <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-[#1BD183]" size={20} /></div>}
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Functional Efficiency</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{dashboardStats?.metrics.functional_efficiency_rate ?? 0}%</span>
            <span className="text-xs text-slate-400">Distractors</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          {statsLoading && <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-[#1BD183]" size={20} /></div>}
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Revision Required</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#FF5353]">
               {dashboardStats?.metrics.items_requiring_revision ?? 0}
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
        {/* Filters Top Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                 Per-Item Psychometric Audit
              </h3>
              <div className="flex items-center gap-3 mt-1">
                 <p className="text-sm text-slate-500 font-medium">
                     {totalItems} items found.
                 </p>
                 {hasActiveFilters && (
                   <button 
                     onClick={clearFilters}
                     className="flex items-center gap-1 text-[10px] font-black uppercase bg-rose-50 text-rose-500 hover:bg-rose-100 px-2 py-0.5 rounded-lg transition-colors"
                   >
                     <Trash2 size={12} /> Clear Filters
                   </button>
                 )}
              </div>
           </div>
           <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative group w-full md:w-48">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1BD183] transition-colors" size={18} />
                  <input 
                      type="text" 
                      placeholder="Search ID..."
                      value={localSearchQuery}
                      onChange={(e) => setLocalSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#1BD183] outline-none transition"
                  />
              </div>
              <button 
                 onClick={() => setShowFilters(!showFilters)}
                 className="flex items-center gap-2 text-[#1BD183] px-4 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-[#1BD183]/10 whitespace-nowrap"
              >
                 <Filter size={16} />
                 {showFilters ? 'Hide Filters' : 'Filters'}
                 {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button onClick={() => setIsStandardsModalOpen(true)} className="text-[#1BD183] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap hidden sm:flex">
                 <Info size={14} /> See Standards
              </button>
           </div>
        </div>

        {/* Filters Grid */}
        {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 px-6 pt-6 pb-6 border-b border-slate-100 bg-slate-50/30 animate-in fade-in slide-in-from-top-4 duration-300">
           {/* Exam Selection */}
           <SearchableSelect
             label="Exam Type"
             options={[{ id: 'STEP 1', name: 'STEP 1' }, { id: 'STEP 2', name: 'STEP 2' }, { id: 'STEP 3', name: 'STEP 3' }]}
             value={selectedExamType}
             onChange={(value) => { setSelectedExamType(value); setPage(1); }}
             allOption={{ id: 'ALL', name: 'All Exams' }}
           />

           <MultiSearchableSelect
             label="Organ Systems"
             options={organSystems.map(x => ({ id: x.id, name: x.title || x.name || x.id }))}
             values={selectedOrganSystems}
             onChange={(v) => { setSelectedOrganSystems(v); setSelectedTopics([]); setPage(1); }}
             placeholder={filtersLoading ? "Loading..." : "Filter systems..."}
             disabled={filtersLoading}
           />

           <MultiSearchableSelect
             label="Topics"
             options={topics.map(x => ({ id: x.id, name: x.title || x.name || x.id  }))}
             values={selectedTopics}
             onChange={(v) => { setSelectedTopics(v); setPage(1); }}
             placeholder={selectedOrganSystems.length === 0 ? "Select System First" : "Filter topics..."}
             disabled={selectedOrganSystems.length === 0}
           />

           <MultiSearchableSelect
             label="Cognitive Skills"
             options={(cognitiveSkills || []).map(x => ({ id: x.id, name: x.title }))}
             values={selectedCognitiveSkills}
             onChange={(v) => { setSelectedCognitiveSkills(v); setPage(1); }}
             placeholder="Filter skills..."
           />

           <MultiSearchableSelect
             label="Disciplines"
             options={disciplines.map(x => ({ id: x.id, name: x.title }))}
             values={selectedDisciplines}
             onChange={(v) => { setSelectedDisciplines(v); setPage(1); }}
             placeholder={filtersLoading ? "Loading..." : "Filter disciplines..."}
             disabled={filtersLoading}
           />

           <MultiSearchableSelect
             label="Subjects"
             options={subjects.map(x => ({ id: x.id, name: x.title }))}
             values={selectedSubjects}
             onChange={(v) => { setSelectedSubjects(v); setPage(1); }}
             placeholder={filtersLoading ? "Loading..." : "Filter subjects..."}
             disabled={filtersLoading}
           />

           <MultiSearchableSelect
             label="Tags"
             options={tags.map(x => ({ id: x.id, name: x.title }))}
             values={selectedTags}
             onChange={(v) => { setSelectedTags(v); setPage(1); }}
             placeholder={filtersLoading ? "Loading..." : "Filter tags..."}
             disabled={filtersLoading}
           />

           <MultiSearchableSelect
             label="Competencies"
             options={competencies.map(x => ({ id: x.id, name: x.title }))}
             values={selectedCompetencies}
             onChange={(v) => { setSelectedCompetencies(v); setPage(1); }}
             placeholder={filtersLoading ? "Loading..." : "Filter competencies..."}
             disabled={filtersLoading}
           />
        </div>
        )}

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
                const editorQuestionId = questionIdMatch ? questionIdMatch[1] : (item.question_id || '').split('/').filter(Boolean).pop() || '';
                
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
                       <button
                          onClick={() => {
                            if (!editorQuestionId) return;
                            navigate(`/workbench?questionId=${encodeURIComponent(editorQuestionId)}`);
                          }}
                          disabled={!editorQuestionId || editorQuestionId === 'Unknown'}
                          className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
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
