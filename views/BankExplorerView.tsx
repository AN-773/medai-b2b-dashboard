import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  Trash2, 
  ExternalLink,
  Database,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { questionService } from '../services/questionService';
import { testsService } from '../services/testsService';
import SearchableSelect from '../components/SearchableSelect';
import { OrganSystem, Topic, Syndrome, Question } from '@/types/TestsServiceTypes';

interface BankExplorerViewProps {
  onEditItem?: (itemId: string) => void;
}

type FilterType = 'ALL' | 'GOLD' | 'REMEDIATION' | 'EMERGING';

const BankExplorerView: React.FC<BankExplorerViewProps> = ({ onEditItem }) => {
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Filter data from testsService
  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subTopics, setSubTopics] = useState<Syndrome[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const [selectedSystemId, setSelectedSystemId] = useState<string>('ALL');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('ALL');
  const [selectedSubTopic, setSelectedSubTopic] = useState<string>('ALL');
  
  // Search states
  const [searchQuery, setSearchQuery] = useState(''); // Actual query sent to API
  const [localSearchQuery, setLocalSearchQuery] = useState(''); // Input value
  
  const [filterType, setFilterType] = useState<FilterType>('ALL');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearchQuery);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  useEffect(() => {
    fetchQuestions();
  }, [page, searchQuery, selectedSystemId, selectedTopicId, selectedSubTopic, filterType]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      
      const response = await questionService.getQuestions(page, limit, searchQuery, selectedSystemId, selectedTopicId, selectedSubTopic);
      
      let fetchedItems = response.items;
      
      // Client-side filtering for metrics cards
      if (filterType === 'GOLD') {
         fetchedItems = fetchedItems.filter(i => i.status === 'published');
      } else if (filterType === 'REMEDIATION') {
         fetchedItems = fetchedItems.filter(i => i.status === 'draft');
      } else if (filterType === 'EMERGING') {
         fetchedItems = fetchedItems.filter(i => i.status !== 'published' && i.status !== 'draft');
      }

      setItems(fetchedItems);
      setTotal(response.total); // Note: Total might be inaccurate if we filter locally
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    if (page * limit < total) {
      setPage((p) => p + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  };

  const totalPages = Math.ceil(total / limit);

  // Fetch organ systems on mount
  useEffect(() => {
    const fetchOrganSystems = async () => {
      try {
        setFiltersLoading(true);
        const response = await testsService.getOrganSystems();
        const systems = (response.items || []).map((sys: any) => ({
          id: sys.id,
          name: sys.title || sys.name
        }));
        setOrganSystems(systems);
      } catch (error) {
        console.error('Failed to fetch organ systems:', error);
      } finally {
        setFiltersLoading(false);
      }
    };
    fetchOrganSystems();
  }, []);

  // Fetch topics when organ system changes
  useEffect(() => {
    const fetchTopics = async () => {
      if (selectedSystemId === 'ALL') {
        setTopics([]);
        setSubTopics([]);
        return;
      }
      try {
        const response = await testsService.getTopics(selectedSystemId);
        const topicItems = (response || []).map((t: any) => ({
          id: t.id,
          name: t.title || t.name,
          syndromes: (t.syndromes || []).map((s: any) => ({
            id: s.id,
            name: s.title || s.name
          }))
        }));
        setTopics(topicItems);
      } catch (error) {
        console.error('Failed to fetch topics:', error);
      }
    };
    fetchTopics();
  }, [selectedSystemId]);

  // Extract syndromes from selected topic
  useEffect(() => {
    if (selectedTopicId === 'ALL') {
      setSubTopics([]);
      return;
    }
    const selectedTopic = topics.find(t => t.id === selectedTopicId);
    if (selectedTopic && (selectedTopic as any).syndromes) {
      setSubTopics((selectedTopic as any).syndromes);
    } else {
      setSubTopics([]);
    }
  }, [selectedTopicId, topics]);

  // --- HELPER LOGIC ---
  const checkGold = (item: Question) => {
    // Gold: Published with good sample size (simulated logic)
    return item.status === 'published';
  };

  const checkRemediation = (item: Question) => {
    // Remediation: Draft items needing review
    return item.status === 'draft';
  };

  // --- METRICS CALCULATION ---
  const metrics = useMemo(() => {
    let gold = 0;
    let remediation = 0;
    let emerging = 0;

    // We need to calculate metrics based on potentially unfiltered items if we want global stats
    // But 'items' here is what's displayed. 
    // If we want global stats, we might need a separate fetch or rely on what's loaded.
    // For now, using 'items' is consistent with previous code.
    items.forEach(item => {
      if (checkGold(item)) {
        gold++;
      } else if (checkRemediation(item)) {
        remediation++;
      } else {
        emerging++;
      }
    });

    return { gold, remediation, emerging };
  }, [items]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this item?")) {
      // Delete logic would go here
      console.log('Delete item:', id);
    }
  };

  const handleCardClick = (type: FilterType) => {
    if (filterType === type) {
      setFilterType('ALL'); // Toggle off
    } else {
      setFilterType(type);
    }
  };

  const clearFilters = () => {
    setLocalSearchQuery('');
    setSearchQuery('');
    setSelectedSystemId('ALL');
    setSelectedTopicId('ALL');
    setSelectedSubTopic('ALL');
    setFilterType('ALL');
    setPage(1);
  };

  const hasActiveFilters = localSearchQuery !== '' || selectedSystemId !== 'ALL' || selectedTopicId !== 'ALL' || selectedSubTopic !== 'ALL' || filterType !== 'ALL';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* 1. Repository Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Summative Gold */}
        <div 
          onClick={() => handleCardClick('GOLD')}
          className={`relative overflow-hidden rounded-[2rem] p-8 flex flex-col justify-between h-48 cursor-pointer transition-all duration-300 group
            ${filterType === 'GOLD' 
              ? 'bg-[#1BD183]/10 border-[#1BD183] ring-4 ring-[#1BD183]/20 shadow-xl scale-[1.02]' 
              : 'bg-white border-slate-200 border shadow-sm hover:border-[#1BD183]/50 hover:shadow-md'
            }
          `}
        >
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <ShieldCheck size={120} className="text-[#1BD183]" />
           </div>
           <div className="relative z-10">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${filterType === 'GOLD' ? 'bg-[#1BD183]/20 text-[#1BD183]' : 'bg-slate-50 text-slate-400 group-hover:text-[#1BD183] group-hover:bg-[#1BD183]/10'}`}>
                 <ShieldCheck size={24} />
              </div>
              <h3 className={`text-sm font-black uppercase tracking-widest ${filterType === 'GOLD' ? 'text-[#1BD183]' : 'text-slate-900'}`}>Summative Gold</h3>
              <p className={`text-[10px] font-bold uppercase tracking-tight mt-1 ${filterType === 'GOLD' ? 'text-[#1BD183]/70' : 'text-slate-400'}`}>Published • Validated</p>
           </div>
           <p className={`text-4xl font-black relative z-10 ${filterType === 'GOLD' ? 'text-[#1BD183]' : 'text-slate-300 group-hover:text-[#1BD183]/50'}`}>{metrics.gold}</p>
        </div>

        {/* Remediation Hub */}
        <div 
          onClick={() => handleCardClick('REMEDIATION')}
          className={`relative overflow-hidden rounded-[2rem] p-8 flex flex-col justify-between h-48 cursor-pointer transition-all duration-300 group
            ${filterType === 'REMEDIATION' 
              ? 'bg-amber-50 border-amber-500 ring-4 ring-amber-500/20 shadow-xl scale-[1.02]' 
              : 'bg-white border-slate-200 border shadow-sm hover:border-amber-300 hover:shadow-md'
            }
          `}
        >
           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <ShieldAlert size={120} className="text-amber-600" />
           </div>
           <div className="relative z-10">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${filterType === 'REMEDIATION' ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400 group-hover:text-amber-600 group-hover:bg-amber-50'}`}>
                 <ShieldAlert size={24} />
              </div>
              <h3 className={`text-sm font-black uppercase tracking-widest ${filterType === 'REMEDIATION' ? 'text-amber-900' : 'text-slate-900'}`}>Remediation Hub</h3>
              <p className={`text-[10px] font-bold uppercase tracking-tight mt-1 ${filterType === 'REMEDIATION' ? 'text-amber-700' : 'text-slate-400'}`}>Draft • Needs Review</p>
           </div>
           <p className={`text-4xl font-black relative z-10 ${filterType === 'REMEDIATION' ? 'text-amber-600' : 'text-slate-300 group-hover:text-amber-600/50'}`}>{metrics.remediation}</p>
        </div>

        {/* Emerging Vault */}
        <div 
          onClick={() => handleCardClick('EMERGING')}
          className={`relative overflow-hidden rounded-[2rem] p-8 flex flex-col justify-between h-48 cursor-pointer transition-all duration-300 group
            ${filterType === 'EMERGING' 
              ? 'bg-indigo-50 border-indigo-500 ring-4 ring-indigo-500/20 shadow-xl scale-[1.02]' 
              : 'bg-white border-slate-200 border shadow-sm hover:border-indigo-300 hover:shadow-md'
            }
          `}
        >
           <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <Sparkles size={120} className="text-indigo-600" />
           </div>
           <div className="relative z-10">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${filterType === 'EMERGING' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50'}`}>
                 <Sparkles size={24} />
              </div>
              <h3 className={`text-sm font-black uppercase tracking-widest ${filterType === 'EMERGING' ? 'text-indigo-900' : 'text-slate-900'}`}>Emerging Vault</h3>
              <p className={`text-[10px] font-bold uppercase tracking-tight mt-1 ${filterType === 'EMERGING' ? 'text-indigo-700' : 'text-slate-400'}`}>Experimental • New</p>
           </div>
           <p className={`text-4xl font-black relative z-10 ${filterType === 'EMERGING' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-600/50'}`}>{metrics.emerging}</p>
        </div>
      </div>

      {/* 2. Main Explorer & Filters */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                    <Database size={24} className="text-[#1BD183]" />
                    Global Item Repository
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm text-slate-500 font-medium">
                      {items.length} items found.
                  </p>
                  {filterType !== 'ALL' && (
                    <button onClick={() => setFilterType('ALL')} className="flex items-center gap-1 text-[10px] font-black uppercase bg-slate-100 hover:bg-slate-200 text-slate-500 px-2 py-0.5 rounded-lg transition-colors">
                      <XCircle size={12} /> {filterType} Filter Active
                    </button>
                  )}
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
            
            <div className="relative group w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1BD183] transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="Search by ID, stem, or keyword..."
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#1BD183] outline-none transition"
                />
            </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 pt-6 border-t border-slate-50">
           {/* Organ System Selection */}
           <SearchableSelect
             label="Organ System"
             options={organSystems}
             value={selectedSystemId}
             onChange={(value) => { setSelectedSystemId(value); setSelectedTopicId('ALL'); setSelectedSubTopic('ALL'); }}
             allOption={{ id: 'ALL', name: 'All Systems' }}
           />

           {/* Topic Selection */}
           <SearchableSelect
             label="Topic"
             options={topics}
             value={selectedTopicId}
             onChange={(value) => { setSelectedTopicId(value); setSelectedSubTopic('ALL'); }}
             disabled={selectedSystemId === 'ALL'}
             allOption={{ id: 'ALL', name: 'All Topics' }}
           />

           {/* Subtopic Selection */}
           <SearchableSelect
             label="Subtopic"
             options={subTopics}
             value={selectedSubTopic}
             onChange={(value) => setSelectedSubTopic(value)}
             disabled={selectedTopicId === 'ALL'}
             allOption={{ id: 'ALL', name: 'All Subtopics' }}
           />
        </div>
      </div>

      {/* Item Grid */}
      <div className="space-y-4 relative">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-2xl min-h-[200px]">
            <Loader2 size={32} className="animate-spin text-[#1BD183]" />
          </div>
        )}
        
        {items.map(item => (
            <div 
                key={item.id}
                onClick={() => onEditItem?.(item.identifier || item.id)}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-[#1BD183]/30 hover:shadow-md transition-all cursor-pointer group"
            >
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <span className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-[#1BD183]/10 text-[#1BD183]">
                            MCQ
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{item.identifier || item.id}</span>
                        {checkGold(item) && (
                           <span className="flex items-center gap-1 text-[9px] font-black text-[#1BD183] bg-[#1BD183]/10 px-2 py-0.5 rounded-full border border-[#1BD183]/20">
                              <ShieldCheck size={10} /> Gold
                           </span>
                        )}
                        {checkRemediation(item) && (
                           <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                              <ShieldAlert size={10} /> Needs Review
                           </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={(e) => handleDelete(e, item.id)}
                            className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                        <ExternalLink size={16} className="text-[#1BD183]" />
                    </div>
                </div>
                <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-relaxed mb-4">
                    {item.title || 'Untitled Item'}
                </h3>
                <div className="flex items-center gap-4 border-t border-slate-50 pt-4">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1BD183]"></span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{item.organSystem?.title || 'Unknown System'}</span>
                    </div>
                    {item.cognitiveSkillId && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase px-2 py-0.5 bg-slate-100 rounded">
                            {item.cognitiveSkillId.split('/').pop()}
                        </span>
                    )}
                     <div className="flex-1 text-right">
                        <span className={`text-[10px] font-black uppercase ${item.status === 'published' ? 'text-[#1BD183]' : 'text-amber-500'}`}>
                            {item.status}
                        </span>
                    </div>
                </div>
            </div>
        ))}

        {items.length === 0 && (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
                <Filter size={40} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-400 font-bold text-sm">No items match your criteria</p>
                <button 
                    onClick={clearFilters}
                    className="mt-4 text-[#1BD183] text-xs font-black uppercase tracking-widest hover:underline"
                >
                    Clear Filters
                </button>
            </div>
        )}

        {/* Pagination Controls */}
        {items.length > 0 && (
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <button
              onClick={handlePrevPage}
              disabled={page === 1 || loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 disabled:opacity-50 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Page {page} of {totalPages}
              </span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 disabled:opacity-50 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankExplorerView;
