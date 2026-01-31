
import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  ExternalLink,
  BookMarked,
  Tag,
  FileText,
  MonitorPlay,
  ClipboardCheck,
  Image as ImageIcon,
  ChevronRight,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import { ItemType, ApiQuestion } from '../types';
import { questionService } from '../services/questionService';

const BankExplorerView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  // Tabs are visual only for now as the API currently fetches all questions
  const [activeTab, setActiveTab] = useState<ItemType>(ItemType.MCQ);

  const [items, setItems] = useState<ApiQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  useEffect(() => {
    fetchQuestions();
  }, [page]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await questionService.getQuestions(page, limit);
      setItems(response.items);
      setTotal(response.total);
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

  const tabItems = [
    { id: ItemType.MCQ, label: 'MCQ Repository', icon: ClipboardCheck },
    { id: ItemType.SAQ, label: 'SAQ Bank', icon: FileText },
    { id: ItemType.LECTURE, label: 'Lecture Materials', icon: MonitorPlay },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
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
        <div className="flex gap-4 p-1.5 bg-white rounded-[2rem] w-fit ">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-gradient text-white'
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
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Academic Item Repository
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {total} Items Indexed against Knowledge Map
              </p>
            </div>
            {/* Pagination Info */}
            <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              Page {page} of {Math.ceil(total / limit)}
            </div>
          </div>

          <div className="overflow-x-auto relative min-h-[400px]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                <Loader2 size={32} className="animate-spin text-slate-400" />
              </div>
            ) : null}

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
                {items.map((item) => {
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition group"
                    >
                      <td className="py-7 px-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#1BD183]/20 text-[#1BD183] rounded-2xl flex items-center justify-center font-black text-[11px] shadow-sm">
                            {item.identifier}
                          </div>
                          <div>
                            <p
                              className="text-sm font-black text-slate-900 leading-snug line-clamp-2 max-w-[300px]"
                              title={item.title}
                            >
                              {item.title || 'Untitled Item'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-black text-black/50 uppercase tracking-tight">
                                {item.organSystem?.title || 'Unknown System'}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 bg-slate-200 text-slate-500 rounded-lg font-black uppercase tracking-tighter">
                                {item.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-7 px-8">
                        <div className="flex flex-col gap-1.5 max-w-xs">
                          <div className="flex flex-wrap items-center gap-1">
                            {/* Constructing path: System > Topic */}
                            <div className="flex flex-wrap items-center gap-1">
                              {item.organSystem?.title && (
                                <>
                                  <span className="text-[9px] font-bold text-black/50 uppercase">
                                    {item.organSystem.title}
                                  </span>
                                  <ChevronRight
                                    size={10}
                                    className="text-slate-900"
                                  />
                                </>
                              )}
                              {item.topic?.title && (
                                <span className="text-[9px] font-bold text-black/50 uppercase">
                                  {item.topic.title}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-2 text-[10px] font-black text-slate-800 uppercase">
                            <BookMarked size={12} className="text-[#1BD183]" />{' '}
                            {item.syndrome?.title || 'Unknown Syndrome'}
                          </span>
                          {/* Assuming cognitive skill or similar as the tag if USMLE content ID is missing/different in API */}
                          {item.cognitiveSkillId && (
                            <span className="inline-flex items-center gap-2 text-[9px] font-bold text-black/50">
                              <Tag size={10} />{' '}
                              {item.cognitiveSkillId.split('/').pop()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-7 px-8">
                        <div className="group/obj relative">
                          <p className="text-[12px] text-slate-500 line-clamp-2 max-w-sm font-medium italic leading-relaxed">
                            "
                            {item.learningObjective?.title ||
                              'No Learning Objective'}
                            "
                          </p>
                        </div>
                      </td>
                      <td className="py-7 px-8 text-center">
                        <div className="flex justify-center gap-2">
                          {item.multimediaId && (
                            <span title="Has Multimedia">
                              <ImageIcon
                                size={14}
                                className="text-emerald-500"
                              />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-7 px-8 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-[#1BD183] hover:border-[#1BD183] rounded-2xl transition shadow-sm">
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

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white">
            <button
              onClick={handlePrevPage}
              disabled={page === 1 || loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 disabled:opacity-50 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <div className="flex gap-2">
              {[...Array(Math.min(5, Math.ceil(total / limit))).keys()].map(
                (i) => {
                  const pageNum = i + 1; // Simplistic pagination, just showing first 5 or so. Real implementation would be windowed.
                  // Better to just show current page context if total pages is large.
                  return null;
                },
              )}
              <span className="text-xs font-bold text-slate-400">
                Page {page}
              </span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={page * limit >= total || loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 disabled:opacity-50 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankExplorerView;
