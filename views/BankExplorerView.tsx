
import React, { useState, useMemo } from 'react';
import { MOCK_ITEMS, MOCK_ORGAN_SYSTEMS, MOCK_SYNDROME_TOPICS } from '../constants';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ExternalLink, 
  BookMarked, 
  Tag, 
  FileText, 
  MonitorPlay,
  ClipboardCheck,
  MoreHorizontal,
  Image as ImageIcon,
  ChevronRight
} from 'lucide-react';
import { ItemType } from '../types';

const BankExplorerView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<ItemType>(ItemType.MCQ);
  
  const filtered = useMemo(() => MOCK_ITEMS.filter(item => {
    const matchesTab = item.type === activeTab;
    const matchesSearch = 
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.itemTagline?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.taxonomy.syndromeTopicId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  }), [searchTerm, activeTab]);

  const tabItems = [
    { id: ItemType.MCQ, label: 'MCQ Repository', icon: ClipboardCheck },
    { id: ItemType.SAQ, label: 'SAQ Bank', icon: FileText },
    { id: ItemType.LECTURE, label: 'Lecture Materials', icon: MonitorPlay },
  ];

  const getOrganSystemName = (id: string) => {
    return MOCK_ORGAN_SYSTEMS.find(s => s.id === id)?.name || id;
  };

  const getSyndromeInfo = (id: string) => {
    const topic = MOCK_SYNDROME_TOPICS.find(t => t.id === id);
    return topic || { name: id, path: [id] };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder={`Search by QID, Topic, or Keywords...`}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition active:scale-95">
            <Filter size={14} /> Filter System
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex gap-4 p-1.5 bg-slate-100 rounded-[2rem] w-fit shadow-inner">
          {tabItems.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-xl' 
                : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
          <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Academic Item Repository</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {filtered.length} Items Indexed against Knowledge Map
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">
                  <th className="py-6 px-8">ID & CONTENT</th>
                  <th className="py-6 px-8">KNOWLEDGE PATH</th>
                  <th className="py-6 px-8">LEARNING OBJECTIVE</th>
                  <th className="py-6 px-8 text-center">ASSETS</th>
                  <th className="py-6 px-8 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(item => {
                  const syndrome = getSyndromeInfo(item.taxonomy.syndromeTopicId);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition group">
                      <td className="py-7 px-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-[11px] shadow-sm">
                            {item.id.replace('QID-', '')}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 leading-snug">{item.itemTagline || 'Untitled Item'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tight">
                                  {getOrganSystemName(item.taxonomy.organSystemId)}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 bg-slate-200 text-slate-500 rounded-lg font-black uppercase tracking-tighter">
                                v{item.version}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-7 px-8">
                        <div className="flex flex-col gap-1.5 max-w-xs">
                          <div className="flex flex-wrap items-center gap-1">
                            {syndrome.path.map((step, idx) => (
                              <React.Fragment key={idx}>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">{step}</span>
                                {idx < syndrome.path.length - 1 && <ChevronRight size={10} className="text-slate-200" />}
                              </React.Fragment>
                            ))}
                          </div>
                           <span className="inline-flex items-center gap-2 text-[10px] font-black text-slate-800 uppercase">
                              <BookMarked size={12} className="text-indigo-400" /> {syndrome.name}
                           </span>
                           <span className="inline-flex items-center gap-2 text-[9px] font-bold text-slate-300">
                              <Tag size={10} /> {item.taxonomy.usmleContentId}
                           </span>
                        </div>
                      </td>
                      <td className="py-7 px-8">
                        <p className="text-[12px] text-slate-500 line-clamp-2 max-w-sm font-medium italic leading-relaxed">
                          "{item.learningObjective}"
                        </p>
                      </td>
                      <td className="py-7 px-8 text-center">
                         <div className="flex justify-center gap-2">
                            {item.linkedMediaIds.length > 0 && <span title="Has Linked Media"><ImageIcon size={14} className="text-emerald-500" /></span>}
                            {item.linkedLectureIds.length > 0 && <span title="Linked to Lecture"><MonitorPlay size={14} className="text-blue-500" /></span>}
                         </div>
                      </td>
                      <td className="py-7 px-8 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 rounded-2xl transition shadow-sm">
                            <ExternalLink size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankExplorerView;
