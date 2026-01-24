
import React, { useState, useMemo } from 'react';
import { 
  FlaskConical, Sparkles, Wand2, Save, Trash2, Zap, Brain, 
  MessageSquare, RefreshCw, X, Search, ChevronRight, FileText,
  Target, Activity, Sliders, Layout, Stethoscope, Microscope,
  Dna, ArrowRight, CheckCircle
} from 'lucide-react';
import { BackendItem, BloomsLevel } from '../types';
import { remasterQuestion } from '../services/geminiService';
import { MOCK_ITEMS } from '../constants';

interface AILabViewProps {
  onSaveNew: (item: BackendItem) => void;
}

const AILabView: React.FC<AILabViewProps> = ({ onSaveNew }) => {
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any>({
    newStem: 'a 45-year-old male presents with chest pain and shortness of breath. His ECG shows ST-elevation in leads II, III, and aVF. What is the most likely diagnosis?',
    newOptions: [
      { text: 'Anterior MI', isCorrect: false },
      { text: 'Inferior MI', isCorrect: true },
      { text: 'Lateral MI', isCorrect: false },
    ],
    explanation: 'The ECG findings of ST-elevation in leads II, III, and aVF indicate an inferior myocardial infarction (MI), which is typically caused by occlusion of the right coronary artery. Anterior MI would show changes in leads V1-V4, while lateral MI would affect leads I, aVL, V5, and V6.'

  });
  const [selectedItem, setSelectedItem] = useState<BackendItem | null>({
    id: 'LAB-BASE-001',
    type: 'MCQ',
    stem: 'A 45-year-old male presents with chest pain and shortness of breath. His ECG shows ST-elevation in leads II, III, and aVF. What is the most likely diagnosis?',
    options: [
      { id: 'opt1', text: 'Anterior MI', isCorrect: false, label: 'A' },
      { id: 'opt2', text: 'Inferior MI', isCorrect: true, label: 'B' },
      { id: 'opt3', text: 'Lateral MI', isCorrect: false, label: 'C' },
    ],
    taxonomy: { bloomLevel: 'Apply' }
    
  });
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Precision Sliders
  const [complexity, setComplexity] = useState(50);
  const [bloomTarget, setBloomTarget] = useState('Apply');
  const [clinicalDensity, setClinicalDensity] = useState(70);

  const filteredItems = useMemo(() => {
    return MOCK_ITEMS.filter(item => 
      item.stem.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleRemaster = async () => {
    setIsProcessing(true);
    
    const contextItem = selectedItem || { 
      stem: "General USMLE medical context regarding pathophysiology and diagnosis.", 
      options: [], 
      taxonomy: { bloomLevel: 'Recall' } 
    };

    const directives = `
      INSTRUCTION: ${prompt || 'Remaster the item for clinical vignette density and USMLE Step 1 rigor.'}
      PARAMETERS:
      - Cognitive Level: ${bloomTarget}
      - Complexity Index: ${complexity}/100
      - Patient Specifics: Increase diversity and realistic clinical labs.
    `;

    try {
      const result = await remasterQuestion(contextItem as BackendItem, directives);
      if (result) {
        setGeneratedResult(result);
      }
    } catch (e) {
      console.error("Remastering Error", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = () => {
    if (!generatedResult) return;
    const newItem: BackendItem = {
      id: `LAB-${Date.now()}`,
      type: 'MCQ',
      stem: generatedResult.newStem,
      options: generatedResult.newOptions.map((o: any, i: number) => ({
        id: `lab-opt-${Date.now()}-${i}`,
        text: o.text,
        isCorrect: o.isCorrect,
        label: String.fromCharCode(65+i)
      })),
      explanation: generatedResult.explanation,
      status: 'Published',
      version: 1,
      authorId: 'SENA-LAB',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeToAuthorMinutes: 1,
      itemType: 'single-best-answer',
      taxonomy: {
        organSystemId: selectedItem?.taxonomy.organSystemId || 'USMLE-GEN',
        disciplineId: selectedItem?.taxonomy.disciplineId || 'DISC-PHYS',
        bloomLevel: bloomTarget,
        syndromeTopicId: 'TOPIC-GEN',
        usmleContentId: 'USMLE-GEN'
      },
      linkedMediaIds: [],
      linkedLectureIds: [],
      learningObjective: `Synthesized in Sena Lab using ${bloomTarget} trajectory.`
    };
    onSaveNew(newItem);
  };

  const presets = [
    { label: "Vignette Synthesis", prompt: "Convert this item into a complex USMLE Step 1 clinical vignette with vital signs and labs." },
    { label: "Pharmacology Focus", prompt: "Refocus assessment on the side-effect profile or MOA of the first-line medication." },
    { label: "Increase Cognitive Load", prompt: "Add second-order or third-order reasoning requirements to the lead-in." },
    { label: "Diagnostic Shift", prompt: "Change the lead-in to focus on the 'Next Best Step' rather than diagnosis." }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500 h-[800px]">
      {/* Configuration Sidebar */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl space-y-8 relative overflow-hidden flex flex-col h-full border border-white/5">
          <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none scale-150 rotate-12">
            <FlaskConical size={400} />
          </div>

          <div className="relative z-10 flex items-center gap-5">
            <div className="p-4 bg-[#1BD183] rounded-[1.5rem] shadow-2xl shadow-indigo-900/50">
              <Brain size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight">Sena Lab</h2>
              <p className="text-[#1BD183] text-[10px] font-black uppercase tracking-[0.2em] mt-1">Generative R&D Sandbox</p>
            </div>
          </div>

          {/* Asset Selection */}
          <div className="relative z-10 space-y-3">
             <label className="text-[10px] font-black text-[#1BD183] uppercase tracking-widest px-1">Synthesis Base</label>
             {selectedItem ? (
                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl flex justify-between items-center group">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-10 h-10 bg-[#1BD183]/20 text-[#1BD183] rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                      {selectedItem.id.split('-').pop()}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-bold truncate leading-none mb-1">{selectedItem.stem}</p>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{selectedItem.taxonomy.bloomLevel}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="p-2 text-slate-500 hover:text-white transition opacity-0 group-hover:opacity-100">
                    <X size={16} />
                  </button>
                </div>
             ) : (
                <button 
                  onClick={() => setIsItemPickerOpen(true)}
                  className="w-full p-6 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:border-[#1BD183] hover:text-white transition-all group"
                >
                  <Search size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">Select Repository Base</span>
                </button>
             )}
          </div>

          {/* Parameter Sliders */}
          <div className="relative z-10 space-y-6 pt-2">
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Complexity Index</label>
                   <span className="text-[10px] font-black text-[#1BD183]">{complexity}%</span>
                </div>
                <input type="range" value={complexity} onChange={e => setComplexity(Number(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-[#1BD183]" />
             </div>

             <div className="space-y-4">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Cognitive Trajectory</label>
                <div className="grid grid-cols-4 gap-2">
                   {['Recall', 'Understand', 'Apply', 'Analyze'].map(level => (
                      <button 
                        key={level}
                        onClick={() => setBloomTarget(level)}
                        className={`py-2.5 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all border ${
                          bloomTarget === level ? 'bg-[#1BD183] border-[#1BD183] text-black shadow-lg' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                        }`}
                      >
                        {level}
                      </button>
                   ))}
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Clinical Density</label>
                   <span className="text-[10px] font-black text-[#1BD183]">{clinicalDensity}%</span>
                </div>
                <input type="range" value={clinicalDensity} onChange={e => setClinicalDensity(Number(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-emerald-500" />
             </div>
          </div>

          {/* Directives */}
          <div className="relative z-10 flex-1 flex flex-col gap-4">
             <div className="flex-1 bg-white/5 border border-white/5 rounded-[2rem] p-6 space-y-4 flex flex-col shadow-inner">
                <label className="text-[10px] font-black text-[#1BD183] uppercase tracking-widest">Synthesis Directives</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Provide precise instructions for content remastering..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-slate-200 text-sm font-medium leading-relaxed placeholder:text-slate-600 resize-none custom-scrollbar"
                />
             </div>

             <div className="grid grid-cols-2 gap-2">
                {presets.map((p, i) => (
                   <button 
                     key={i}
                     onClick={() => setPrompt(p.prompt)}
                     className="p-3 bg-white/5 border border-white/10 rounded-xl text-[8px] font-black uppercase text-left text-slate-400 hover:text-white hover:bg-white/10 hover:border-indigo-500/30 transition-all flex items-center gap-2"
                   >
                     <Zap size={10} className="text-[#1BD183]" /> {p.label}
                   </button>
                ))}
             </div>

             <button 
                onClick={handleRemaster}
                disabled={isProcessing}
                className="w-full py-6 bg-primary-gradient disabled:opacity-50 text-white rounded-[1.5rem] font-black uppercase tracking-widest transition shadow-2xl shadow-indigo-900/40 flex items-center justify-center gap-4 active:scale-95"
              >
                {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
                {isProcessing ? 'SYNTHESIZING ASSET...' : 'Execute Remaster'}
              </button>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="lg:col-span-7 flex flex-col h-full">
        {generatedResult ? (
          <div className="flex-1 bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right-10 duration-700">
             <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#1BD183] rounded-2xl text-white shadow-lg shadow-[#1BD183]/30">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Remastered Synthesis</h3>
                    <div className="flex gap-2 mt-1">
                       <span className="text-[9px] font-black px-2 py-0.5 bg-[#1BA6D1]/20 text-[#1BA6D1] rounded-md uppercase">{bloomTarget} Level</span>
                       <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-md uppercase">Vignette: {complexity}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setGeneratedResult(null)} className="p-3 text-slate-400 hover:text-rose-500 transition-colors">
                      <Trash2 size={24} />
                   </button>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
                <div className="space-y-4">
                   <div className="flex items-center gap-3">
                      <Stethoscope className="text-[#1BD183]/90" size={18} />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synthesized Clinical Stem</p>
                   </div>
                   <div className="p-10 bg-slate-50 border border-slate-100 rounded-[3rem] relative">
                      <p className="text-xl font-bold text-slate-900 leading-relaxed font-serif relative z-10 italic">
                        "{generatedResult.newStem}"
                      </p>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="flex items-center gap-3">
                      <Layout className="text-[#1BD183]/90" size={18} />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Homogeneous Distractors</p>
                   </div>
                   <div className="grid grid-cols-1 gap-4">
                     {generatedResult.newOptions.map((opt: any, i: number) => (
                       <div key={i} className={`p-6 rounded-[1.5rem] border transition-all flex justify-between items-center ${
                         opt.isCorrect 
                         ? 'border-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-100/50' 
                         : 'border-slate-100 bg-white hover:border-indigo-100 shadow-sm'
                       }`}>
                          <div className="flex items-center gap-6">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                              opt.isCorrect ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-50 text-slate-400'
                            }`}>
                              {String.fromCharCode(65+i)}
                            </div>
                            <p className="text-sm font-bold text-slate-800 leading-snug">{opt.text}</p>
                          </div>
                          {opt.isCorrect && <CheckCircle size={18} className="text-emerald-500" />}
                       </div>
                     ))}
                   </div>
                </div>

                <div className="p-10 bg-[#ebf4ff] rounded-[2.5rem] flex gap-6 items-start">
                   <div className="p-4 bg-white rounded-2xl text-[#1BD183] shadow-sm border border-indigo-100 shrink-0">
                      <Activity size={28} />
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] font-black text-[#1BD183] uppercase tracking-widest">Pedagogical Rationale</p>
                      <p className="text-sm font-medium text-indigo-900/80 leading-relaxed">{generatedResult.explanation}</p>
                   </div>
                </div>
             </div>

             <div className="p-10 bg-white border-t border-slate-100 flex justify-end gap-5">
                <button 
                  onClick={() => setGeneratedResult(null)} 
                  className="px-10 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-200 transition"
                >
                  Discard Synthesis
                </button>
                <button 
                  onClick={handleCommit}
                  className="px-12 py-4 text-white bg-primary-gradient rounded-2xl font-black uppercase tracking-widest text-[11px] transition shadow-2xl shadow-slate-300 flex items-center gap-3 active:scale-95"
                >
                  <Save size={20} /> Commit to Bank
                </button>
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-[3.5rem] border-4 border-dashed border-slate-200 p-20 text-center space-y-6 group">
             <div className="w-28 h-28 bg-white rounded-[2rem] flex items-center justify-center shadow-sm text-slate-200 group-hover:scale-110 transition-transform duration-700">
                <FlaskConical size={80} strokeWidth={1} />
             </div>
             <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-400 uppercase tracking-tight">AI Lab Standby</h3>
                <p className="text-sm text-slate-400 font-medium max-w-sm mx-auto leading-relaxed italic">
                  Initiate a high-yield synthesis by selecting a source item or organ system. Sena will remaster content based on your precision directives.
                </p>
             </div>
             <button 
               onClick={() => setIsItemPickerOpen(true)}
               className="mt-4 px-10 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition shadow-sm flex items-center gap-3 hover:gap-5 transition-all"
             >
               <Search size={18} /> Browse Knowledge Graph
             </button>
          </div>
        )}
      </div>

      {/* Item Picker Modal */}
      {isItemPickerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                  <Target size={24} className="text-indigo-600" />
                  Select Synthesis Base
                </h3>
                <button onClick={() => setIsItemPickerOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 transition"><X size={24} /></button>
             </div>
             <div className="p-8 border-b border-slate-100 bg-white">
                <div className="relative">
                   <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input 
                     type="text" 
                     placeholder="Search QIDs, topics, or syndromes..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full pl-14 pr-6 py-5 bg-slate-100 rounded-[1.5rem] border-none outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-bold shadow-inner"
                   />
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-50 custom-scrollbar">
                {filteredItems.map(item => (
                  <button 
                    key={item.id}
                    onClick={() => { setSelectedItem(item); setIsItemPickerOpen(false); }}
                    className="w-full p-8 text-left hover:bg-indigo-50 transition-colors flex justify-between items-center group rounded-[2rem]"
                  >
                    <div className="flex items-center gap-6">
                       <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-[11px] shadow-sm group-hover:scale-110 transition-transform">
                          {item.id.split('-').pop()}
                       </div>
                       <div>
                          <p className="text-base font-bold text-slate-900 line-clamp-1">{item.stem}</p>
                          <div className="flex items-center gap-3 mt-2">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.taxonomy.organSystemId}</span>
                             <div className="w-1 h-1 rounded-full bg-slate-200" />
                             <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{item.taxonomy.bloomLevel}</span>
                          </div>
                       </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all" />
                  </button>
                ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AILabView;
