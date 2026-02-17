
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, X, ClipboardCheck, ExternalLink, MonitorPlay, Plus, Sparkles, Loader2 } from 'lucide-react';
import { LearningObjective } from '@/types';
import { testsService } from '@/services/testsService';
import { Question } from '@/types/TestsServiceTypes';


interface LinkedItemsPanelProps {
  objective: LearningObjective;
  onClose: () => void;
  onCreateNew?: (obj: LearningObjective) => void;
}

const LinkedItemsPanel: React.FC<LinkedItemsPanelProps> = ({ objective, onClose, onCreateNew }) => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await testsService.getQuestions(1, 200, objective.id);
        setQuestions(res.items || []);
      } catch (err) {
        console.error('Failed to fetch questions:', err);
        setError('Failed to load questions.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestions();
  }, [objective.id]);

  return (
    <>
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
        onClick={onClose}
      />
      <div className="absolute top-4 bottom-4 right-4 w-[500px] bg-white rounded-[2.5rem] shadow-2xl z-50 border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
         <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
           <div>
             <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight flex items-center gap-2">
               <Database size={18} className="text-[#1BD183]" />
               Linked Repository Items
             </h3>
             <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed line-clamp-2">
               "{objective.text}"
             </p>
           </div>
           <button 
             onClick={onClose}
             className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 transition"
           >
             <X size={18} />
           </button>
         </div>

         <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardCheck size={12} /> Linked Assessment Items (MCQ/SAQ)
                    </h4>
                    {onCreateNew && (
                        <button 
                            onClick={() => onCreateNew(objective)}
                            className="text-[9px] font-black text-[#1BD183] uppercase tracking-widest flex items-center gap-1 hover:underline"
                        >
                            <Sparkles size={10} /> Create New
                        </button>
                    )}
               </div>
               <div className="space-y-3">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-[#1BD183] mb-2" />
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading Questions...</p>
                    </div>
                  ) : error ? (
                    <p className="text-xs text-red-400 italic">{error}</p>
                  ) : questions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No linked questions found.</p>
                  ) : (
                    questions.map(question => (
                      <div key={question.id} onClick={() => navigate(`/workbench?questionId=${question.identifier}`)} className="p-4 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all group cursor-pointer bg-white">
                         <div className="flex justify-between items-start mb-2">
                            <span className="px-2 py-0.5 bg-indigo-50 text-[#1BD183] rounded-lg text-[9px] font-black uppercase tracking-widest">
                              {question.status || 'MCQ'}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">{question.identifier || question.id.slice(0, 8)}</span>
                         </div>
                         <p className="text-xs font-bold text-slate-800 line-clamp-2 mb-3">{question.title}</p>
                         <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[9px] font-black text-indigo-500 flex items-center gap-1">
                              Open Item <ExternalLink size={10} />
                            </span>
                         </div>
                      </div>
                    ))
                  )}
               </div>
            </div>
         </div>
         
         <div className="p-6 border-t border-slate-100 bg-slate-50">
            <button className="w-full py-3 bg-primary-gradient hover:bg-primary-gradient-hover   text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition flex items-center justify-center gap-2">
               <Plus size={14} /> Link Existing Asset
            </button>
         </div>
      </div>
    </>
  );
};

export default LinkedItemsPanel;

