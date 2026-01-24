
import React, { useState, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Cell
} from 'recharts';
import { 
  MOCK_ORGAN_SYSTEMS, 
  MOCK_LEARNING_OBJECTIVES,
  MOCK_OBJECTIVE_COVERAGE,
  MOCK_AI_INSIGHT_LOGS,
  USMLE_2024_OUTLINE
} from '../constants';
import { parseAndAuditObjectives, FileData } from '../services/geminiService';
import DashboardCard from '../components/DashboardCard';
import { 
  Target, 
  ChevronRight, 
  Filter, 
  Search, 
  ShieldAlert, 
  BookMarked,
  CheckCircle2,
  AlertCircle,
  Activity,
  FileText,
  Sparkles,
  Upload,
  Brain,
  X,
  RefreshCw,
  CheckCircle,
  ShieldCheck,
  FileType,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import { LearningObjective } from '../types';

const CurriculumHealthView: React.FC = () => {
  const [selectedSystemId, setSelectedSystemId] = useState<string>(MOCK_ORGAN_SYSTEMS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [auditMode, setAuditMode] = useState<'OBJECTIVES' | 'USMLE_STANDARD'>('USMLE_STANDARD');
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);

  // Ingestion State
  const [ingestText, setIngestText] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [parsedObjectives, setParsedObjectives] = useState<LearningObjective[]>([]);
  const [ingestMode, setIngestMode] = useState<'PASTE' | 'UPLOAD'>('UPLOAD');
  const [selectedFiles, setSelectedFiles] = useState<{name: string, type: string, base64: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSystem = useMemo(() => 
    MOCK_ORGAN_SYSTEMS.find(s => s.id === selectedSystemId) || MOCK_ORGAN_SYSTEMS[0]
  , [selectedSystemId]);

  const usmleCategory = useMemo(() => 
    USMLE_2024_OUTLINE.find(cat => cat.id === selectedSystemId) || USMLE_2024_OUTLINE[0]
  , [selectedSystemId]);

  const objectivesForSystem = useMemo(() => 
    MOCK_LEARNING_OBJECTIVES.filter(obj => obj.organSystemId === selectedSystemId)
  , [selectedSystemId]);

  const coverageData = useMemo(() => {
    return objectivesForSystem.map(obj => {
      const coverage = MOCK_OBJECTIVE_COVERAGE.find(c => c.objectiveId === obj.id);
      return {
        id: obj.id,
        text: obj.text,
        current: coverage?.mappedItemCount || 0,
        target: obj.targetItemCount,
        percent: ((coverage?.mappedItemCount || 0) / obj.targetItemCount) * 100,
        bloom: obj.bloomLevel
      };
    });
  }, [objectivesForSystem]);

  const relevantLogs = useMemo(() => 
    MOCK_AI_INSIGHT_LOGS.filter(log => objectivesForSystem.some(obj => obj.id === log.entityId) || log.message.includes(currentSystem.name))
  , [objectivesForSystem, currentSystem]);

  // Ingestion Logic
  const handleIngest = async () => {
    if (!ingestText.trim() && selectedFiles.length === 0) return;
    setIsIngesting(true);
    try {
      let filePayload: FileData | undefined;
      if (selectedFiles.length > 0) {
        filePayload = {
          data: selectedFiles[0].base64,
          mimeType: selectedFiles[0].type
        };
      }
      const results = await parseAndAuditObjectives(ingestText, filePayload);
      setParsedObjectives(results);
    } catch (e) {
      console.error("Ingest error", e);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processFiles(Array.from(files));
  };

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setSelectedFiles(prev => [...prev, {
          name: file.name,
          type: file.type || getMimeFromExtension(file.name),
          base64
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const getMimeFromExtension = (filename: string) => {
    if (filename.endsWith('.csv')) return 'text/csv';
    if (filename.endsWith('.txt')) return 'text/plain';
    if (filename.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Dynamic Header with USMLE 2024 Context */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
          <Target size={240} />
        </div>
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-indigo-600/30 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border border-indigo-400/30 text-indigo-100 flex items-center gap-2">
              <BookMarked size={12} /> USMLE® 2024 Alignment Audit
            </span>
            <button 
              onClick={() => setIsIngestModalOpen(true)}
              className="px-3 py-1 bg-emerald-600/30 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border border-emerald-400/30 text-emerald-100 flex items-center gap-2 hover:bg-emerald-600/50 transition-colors"
            >
              <Upload size={12} /> Ingest Objectives
            </button>
          </div>
          <h2 className="text-4xl font-black tracking-tight mb-2">{currentSystem.name}</h2>
          <p className="text-slate-400 font-medium max-w-xl text-sm leading-relaxed">
            Comparing institutional asset density against official USMLE benchmarks. {usmleCategory?.topics.length} core topics identified in the {usmleCategory?.name} outline.
          </p>
        </div>
        <div className="flex gap-4 relative z-10">
           <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-center min-w-[120px]">
              <p className="text-[9px] font-black text-[#1BA6D1] uppercase tracking-widest mb-1">Outline Page</p>
              <p className="text-4xl font-black">{usmleCategory?.page || '--'}</p>
           </div>
           <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-center min-w-[120px]">
              <p className="text-[9px] font-black text-[#1BD183] uppercase tracking-widest mb-1">Coverage</p>
              <div className="flex items-center justify-center gap-2">
                <Sparkles size={24} className="text-[#1BD183]" />
                <span className="text-sm font-black uppercase">84%</span>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-6">
           <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 px-2 border-b border-slate-100 pb-2">
                <Filter size={12} /> Outline Categories
              </p>
              <div className="space-y-1 max-h-[600px] overflow-y-auto px-1 custom-scrollbar">
                {MOCK_ORGAN_SYSTEMS.map(sys => (
                  <button 
                    key={sys.id}
                    onClick={() => setSelectedSystemId(sys.id)}
                    className={`w-full text-left px-5 py-4 rounded-2xl text-[10px] font-black transition-all flex items-center justify-between group ${
                      selectedSystemId === sys.id 
                      ? 'bg-[#1BD183] text-black shadow-xl' 
                      : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate uppercase tracking-tight">{sys.name}</span>
                    <ChevronRight size={14} className={selectedSystemId === sys.id ? 'opacity-100' : 'opacity-0'} />
                  </button>
                ))}
              </div>
           </div>

           <DashboardCard title="Audit Alerts">
              <div className="space-y-4">
                 {relevantLogs.map(log => (
                    <div key={log.id} className={`p-4 rounded-2xl border text-[10px] font-bold ${log.severity === 'critical' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                       <div className="flex items-center gap-2 mb-1 uppercase tracking-widest">
                          <ShieldAlert size={12} /> {log.severity} Alert
                       </div>
                       <p className="italic leading-relaxed">{log.message}</p>
                    </div>
                 ))}
                 {relevantLogs.length === 0 && (
                    <div className="text-center py-6 text-slate-400">
                       <p className="text-[10px] font-black uppercase tracking-widest">No active system alerts</p>
                    </div>
                 )}
              </div>
           </DashboardCard>
        </div>

        {/* Main Dashboard Area */}
        <div className="lg:col-span-9 space-y-8">
          <div className="flex gap-4 p-1.5 bg-slate-200/50 rounded-[2rem] w-fit shadow-inner mb-6">
            <button
              onClick={() => setAuditMode('USMLE_STANDARD')}
              className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                auditMode === 'USMLE_STANDARD' 
                ? 'bg-primary-gradient text-white' 
                : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <BookMarked size={14} /> USMLE Outline Map
            </button>
            <button
              onClick={() => setAuditMode('OBJECTIVES')}
              className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                auditMode === 'OBJECTIVES' 
                ? 'bg-primary-gradient text-white' 
                : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Target size={14} /> Learning Objectives
            </button>
          </div>

          {auditMode === 'USMLE_STANDARD' ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {usmleCategory?.topics.map(topic => (
                   <div key={topic.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 hover:border-[#1BD183]/60 transition-colors group flex flex-col">
                      <div className="flex justify-between items-start mb-6">
                         <div className="p-3 bg-[#1BD183]/10 text-[#1BD183] rounded-2xl group-hover:scale-110 transition-transform">
                            <Activity size={20} />
                         </div>
                         <div className="flex items-center gap-2 text-[10px] font-black text-[#1BA6D1] uppercase">
                            <CheckCircle2 size={14} /> Coverage Met
                         </div>
                      </div>
                      <h4 className="text-lg font-black text-slate-900 mb-2 leading-tight uppercase tracking-tight">{topic.name}</h4>
                      <div className="space-y-2 mb-6 flex-grow">
                         {topic.subTopics?.map((sub, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-500">
                               <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                               {sub}
                            </div>
                         ))}
                      </div>
                      <div className="pt-6 border-t border-slate-50 flex justify-between items-center mt-auto">
                         <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-indigo-600">32Q</div>
                            <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-emerald-600">4L</div>
                         </div>
                         <button className="text-[10px] font-black text-[#1BD183] uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
                            Audit Assets <ChevronRight size={14} />
                         </button>
                      </div>
                   </div>
                ))}
                {(!usmleCategory || usmleCategory.topics.length === 0) && (
                  <div className="md:col-span-2 p-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                    <AlertCircle size={48} className="mx-auto mb-4 text-slate-200" />
                    <p className="text-slate-400 font-black uppercase tracking-widest">No matching USMLE topics structured for this system.</p>
                  </div>
                )}
             </div>
          ) : (
            <div className="space-y-8">
              <DashboardCard title="Institutional Objective Analysis" subtitle="Item count vs institutional blueprint targets">
                 <div className="h-80 w-full mt-4">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={coverageData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="id" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                       <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                       <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} 
                       />
                       <Legend verticalAlign="top" align="right" />
                       <Bar name="Current Items" dataKey="current" fill="#1BA6D1" radius={[4, 4, 0, 0]} barSize={40} />
                       <Bar name="Target Items" dataKey="target" fill="#7F5CD3" radius={[4, 4, 0, 0]} barSize={40} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
              </DashboardCard>
            </div>
          )}

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden mt-8">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">USMLE Standard Explorer</h3>
                <p className="text-sm text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Cross-referencing institutional assets against the 2024 Blueprint</p>
              </div>
              <div className="relative w-full md:w-64">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search standard topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-2xl text-[10px] font-black border-none outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-inner"
                />
              </div>
            </div>

            <div className="p-8">
               <div className="grid grid-cols-1 gap-4">
                  {USMLE_2024_OUTLINE.filter(cat => cat.name.toLowerCase().includes(searchQuery.toLowerCase())).map(cat => (
                    <div key={cat.id} className="p-6 border border-slate-100 rounded-[2rem] hover:border-[#1BA6D1]/60 transition bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                       <div className="flex items-center gap-6 flex-1">
                          <div className="w-14 h-14 bg-[#1BD183]/90 rounded-2xl border border-[#1BD183] shadow-xl shadow-[#1BD183]/20 flex items-center justify-center text-white font-black text-lg">
                             {cat.page}
                          </div>
                          <div>
                             <h5 className="font-black text-slate-900 uppercase tracking-tight">{cat.name}</h5>
                             <div className="flex items-center gap-4 mt-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{cat.topics.length} Key Sub-categories</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span className="text-[10px] text-[#1BA6D1] font-black uppercase tracking-widest">Section {cat.id.split('-').pop()}</span>
                             </div>
                          </div>
                       </div>
                       <button 
                        onClick={() => setSelectedSystemId(cat.id)}
                        className="px-6 py-3 bg-black border border-slate-200 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black/80 transition shadow-sm active:translate-y-1"
                       >
                          Analyze Coverage
                       </button>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ingest Objectives Modal */}
      {isIngestModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100">
                    <Brain size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Curriculum Auditor Ingestion</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Cognitive Parsing Engine</p>
                  </div>
               </div>
               <button onClick={() => {setIsIngestModalOpen(false); setParsedObjectives([]); setIngestText(""); setSelectedFiles([]);}} className="p-2 text-slate-400 hover:text-slate-900 transition">
                 <X size={24} />
               </button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar">
               {parsedObjectives.length === 0 ? (
                 <div className="space-y-6">
                    <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-start gap-4">
                       <Info className="text-indigo-600 shrink-0 mt-1" size={20} />
                       <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                         Paste raw institutional objectives or <strong>upload PDF, CSV, or TXT files</strong>. 
                         The <strong>Curriculum Auditor Agent</strong> will analyze the text to extract learning objectives and align them with the 2024 USMLE Step 1 content outline.
                       </p>
                    </div>

                    <div className="flex gap-4 p-1 bg-slate-100 rounded-2xl w-fit">
                      <button 
                        onClick={() => setIngestMode('UPLOAD')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${ingestMode === 'UPLOAD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <Upload size={14} /> Upload Files
                      </button>
                      <button 
                        onClick={() => setIngestMode('PASTE')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${ingestMode === 'PASTE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <FileText size={14} /> Paste Text
                      </button>
                    </div>
                    
                    {ingestMode === 'PASTE' ? (
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Raw Curriculum Data</label>
                        <textarea 
                          value={ingestText}
                          onChange={(e) => setIngestText(e.target.value)}
                          placeholder="e.g. Course 102: Introduction to Renal Physiology. Students must understand glomerular filtration rate (GFR)..."
                          className="w-full h-80 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition"
                        />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files));
                          }}
                          className="w-full h-64 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center gap-4 group hover:border-emerald-500 hover:bg-emerald-50/30 transition-all cursor-pointer"
                        >
                           <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all">
                              <Upload size={32} />
                           </div>
                           <div className="text-center">
                              <p className="text-lg font-black text-slate-700 uppercase tracking-tight">Drop curriculum files here</p>
                              <p className="text-xs text-slate-400 font-medium mt-1">Supports PDF, CSV, and TXT formats</p>
                           </div>
                           <input 
                             type="file" 
                             ref={fileInputRef} 
                             className="hidden" 
                             multiple 
                             accept=".pdf,.csv,.txt"
                             onChange={handleFileChange}
                           />
                        </div>

                        {selectedFiles.length > 0 && (
                          <div className="space-y-3">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Selected Assets ({selectedFiles.length})</p>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedFiles.map((file, i) => (
                                  <div key={i} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between group">
                                     <div className="flex items-center gap-4 overflow-hidden">
                                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                           {file.type.includes('pdf') ? <FileType size={20} /> : file.type.includes('csv') ? <FileSpreadsheet size={20} /> : <FileText size={20} />}
                                        </div>
                                        <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                                     </div>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setSelectedFiles(prev => prev.filter((_, idx) => idx !== i));
                                       }}
                                       className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                     >
                                       <X size={16} />
                                     </button>
                                  </div>
                                ))}
                             </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-center pt-4">
                       <button 
                         onClick={handleIngest}
                         disabled={isIngesting || (ingestMode === 'PASTE' ? !ingestText.trim() : selectedFiles.length === 0)}
                         className="flex items-center gap-3 px-12 py-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/20 active:scale-95"
                       >
                         {isIngesting ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                         {isIngesting ? "Neural Extraction Active..." : "Commit Ingestion Audit"}
                       </button>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-8">
                    <div className="flex justify-between items-center">
                       <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                         <CheckCircle className="text-emerald-500" size={20} />
                         Auditor Results: {parsedObjectives.length} Objectives Extracted
                       </h3>
                       <button 
                         onClick={() => setParsedObjectives([])}
                         className="text-[10px] font-black text-indigo-600 uppercase tracking-widest"
                       >
                         Ingest Another Batch
                       </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {parsedObjectives.map((obj, i) => (
                         <div key={i} className="p-6 bg-white border border-slate-200 rounded-[2rem] hover:border-indigo-500 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                               <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest rounded-lg">
                                  {obj.id}
                               </span>
                               <span className="text-[9px] font-black text-slate-400 uppercase">
                                  {obj.bloomLevel}
                               </span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 leading-snug mb-4">{obj.text}</p>
                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                  {obj.organSystemId}
                               </span>
                               <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center" title="Target Items">
                                     <span className="text-[10px] font-black text-slate-900">{obj.targetItemCount}</span>
                                  </div>
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>

                    <div className="bg-slate-900 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6">
                       <div className="flex items-center gap-4 text-white">
                          <ShieldCheck className="text-emerald-400" size={24} />
                          <div>
                             <p className="text-sm font-black uppercase tracking-tight">Institutional Library Sync</p>
                             <p className="text-xs text-slate-400 font-medium">Add these objectives to the curriculum master bank.</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => {
                           // Simulated Save
                           setIsIngestModalOpen(false);
                           setParsedObjectives([]);
                           setIngestText("");
                           setSelectedFiles([]);
                         }}
                         className="px-10 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition active:scale-95 shadow-xl"
                       >
                         Commit to Bank
                       </button>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CurriculumHealthView;
