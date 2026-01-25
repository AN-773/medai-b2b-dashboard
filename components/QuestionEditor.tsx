
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  ArrowLeft, 
  Save, 
  Eye, 
  Check, 
  Upload, 
  X,
  Target,
  BookOpen,
  Layout,
  Link as LinkIcon,
  Trash2,
  Plus,
  Activity,
  BarChart2,
  Users,
  Clock,
  GripVertical,
  AlertTriangle,
  FileText,
  ImageIcon,
  Wand2
} from 'lucide-react';
import { BloomsLevel, Question, QuestionOption, QuestionType, Reference } from '../types';


interface QuestionEditorProps {
  onBack: () => void;
  onSave: (question: Question) => void;
  initialQuestion?: Question | null;
}

const RenderMarkdown = ({ content }: { content: string }) => {
  if (!content) return null;
  const sections = content.split(/\n\n+/);
  return (
    <div className="space-y-4 text-sm text-indigo-900/80 leading-relaxed">
      {sections.map((section, idx) => {
        if (section.trim().startsWith('###')) {
          const headerText = section.replace(/^###\s*/, '').replace(/\*\*/g, '');
          return (
            <h4 key={idx} className="text-md font-bold text-indigo-900 mt-6 mb-2 border-b border-indigo-100 pb-1">
              {headerText}
            </h4>
          );
        }
        const parts = section.split(/(\*\*.*?\*\*)/);
        return (
          <p key={idx}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-semibold text-indigo-900">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

const QuestionEditor: React.FC<QuestionEditorProps> = ({ onBack, onSave, initialQuestion }) => {
  const [sidebarWidth, setSidebarWidth] = useState(500); 
  const [topic, setTopic] = useState('');
  const [bloomsLevel, setBloomsLevel] = useState<BloomsLevel>(BloomsLevel.Understand);
  const [genLearningObjectives, setGenLearningObjectives] = useState(''); 
  const [additionalContext, setAdditionalContext] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<QuestionOption[]>([
    { id: '1', text: '', isCorrect: false },
    { id: '2', text: '', isCorrect: false },
    { id: '3', text: '', isCorrect: false },
    { id: '4', text: '', isCorrect: false },
  ]);
  const [learningObjectives, setLearningObjectives] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [newRefTitle, setNewRefTitle] = useState('');
  const [newRefUrl, setNewRefUrl] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (initialQuestion) {
      setQuestionText(initialQuestion.text);
      setExplanation(initialQuestion.explanation);
      setOptions(initialQuestion.options);
      setLearningObjectives(initialQuestion.learningObjectives);
      setTags(initialQuestion.tags);
      setBloomsLevel(initialQuestion.bloomsLevel);
      if (initialQuestion.references) setReferences(initialQuestion.references);
      if (initialQuestion.tags.length > 0) setTopic(initialQuestion.tags[0]);
    }
  }, [initialQuestion]);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const onMouseMove = (mouseMoveEvent: MouseEvent) => {
      const newWidth = Math.max(300, Math.min(mouseMoveEvent.clientX, window.innerWidth * 0.6));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    setError(null);
    try {
      // const generated = await generateQuestionWithAI({
      //   topic,
      //   bloomsLevel,
      //   learningObjectives: genLearningObjectives,
      //   additionalContext,
      //   image: attachedImage || undefined
      // });
      const generated = null;
      if (generated) {
        setQuestionText(generated.text || '');
        setExplanation(generated.explanation || '');
        if (generated.options) setOptions(generated.options as QuestionOption[]);
        if (generated.learningObjectives) setLearningObjectives(generated.learningObjectives);
        if (generated.references) setReferences(generated.references as Reference[]);
        if (generated.tags) setTags(generated.tags);
      }
    } catch (e) {
      setError("Failed to generate question. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!questionText) {
      setError("Please provide question text or a topic to generate an image.");
      return;
    }
    setIsGeneratingImage(true);
    try {
      const prompt = topic || questionText.slice(0, 100);
      // const imageUrl = await generateClinicalImage(prompt);
      const imageUrl = null;
      if (imageUrl) setAttachedImage(imageUrl);
    } catch (e) {
      setError("Failed to generate clinical image.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSave = (targetStatus: 'Draft' | 'Published') => {
    if (!questionText || options.length < 2 || !options.some(o => o.isCorrect)) {
      setError("Please ensure question text exists and there is at least one correct option.");
      return;
    }
    const newQuestion: Question = {
      id: initialQuestion ? initialQuestion.id : `q-${Date.now()}`,
      text: questionText,
      bloomsLevel,
      type: QuestionType.SingleBestAnswer,
      options,
      explanation,
      learningObjectives,
      references,
      tags,
      createdAt: initialQuestion ? initialQuestion.createdAt : new Date().toISOString(),
      status: targetStatus,
      analysis: initialQuestion?.analysis 
    };
    onSave(newQuestion);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <h2 className="font-semibold text-slate-900">{initialQuestion ? 'Edit Question' : 'Create Question'}</h2>
            <p className="text-xs text-slate-500">{initialQuestion ? `Editing ID: ${initialQuestion.id}` : 'AI-Powered Workbench'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-[#F3F6F3] p-1 rounded-[40px] flex gap-1 mr-4">
            <button onClick={() => setViewMode('edit')} className={`px-3 py-1.5 rounded-[40px] text-xs font-medium transition-all flex items-center gap-2 ${viewMode === 'edit' ? 'bg-primary-gradient text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Layout size={16} /> Edit
            </button>
            <button onClick={() => setViewMode('preview')} className={`px-3 py-1.5 rounded-[40px] text-xs font-medium transition-all flex items-center gap-2 ${viewMode === 'preview' ? 'bg-primary-gradient text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Eye size={16} /> Preview
            </button>
          </div>
          <button onClick={() => handleSave('Draft')} className="flex items-center gap-2 text-sm bg-[#191A19] border border-slate-200 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
            <FileText size={18} /> Save Draft
          </button>
          <button onClick={() => handleSave('Published')} className="flex items-center gap-2 text-sm bg-primary-gradient border border-slate-200 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
            <Save size={18} /> Publish
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden flex flex-row">
        <div className={`bg-white flex flex-col overflow-y-auto flex-shrink-0 ${viewMode === 'preview' ? 'hidden md:flex' : 'flex'}`} style={{ width: sidebarWidth }}>
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
              <Sparkles className="text-[#1BD183]" size={18} /> AI Generator
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Topic</label>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="e.g. Diabetic Ketoacidosis" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Bloom's Level</label>
                <select value={bloomsLevel} onChange={(e) => setBloomsLevel(e.target.value as BloomsLevel)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                  {Object.values(BloomsLevel).map(level => (<option key={level} value={level}>{level}</option>))}
                </select>
              </div>
              <button onClick={handleGenerate} disabled={isGenerating || !topic} className="w-full flex items-center justify-center gap-2 primary-button text-white py-2.5 rounded-lg font-medium transition-all shadow-sm">
                {isGenerating ? "Generating..." : "Generate Draft"}
              </button>
            </div>
          </div>
          
          <div className="p-5 border-b border-slate-100">
             <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <ImageIcon className="text-[#1BD183]" size={18} /> Clinical Visuals
             </h3>
             <div className="space-y-4">
                {attachedImage ? (
                  <div className="relative rounded-xl overflow-hidden group">
                     <img src={attachedImage} alt="Clinical Visual" className="w-full h-40 object-cover" />
                     <button onClick={() => setAttachedImage(null)} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                  </div>
                ) : (
                  <button 
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage}
                    className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 p-6 rounded-2xl text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-all group"
                  >
                    {isGeneratingImage ? <div className="animate-spin text-emerald-500"><Wand2 size={24}/></div> : <Wand2 size={24} />}
                    <span className="text-xs font-bold uppercase tracking-widest">{isGeneratingImage ? "Synthesizing..." : "Generate AI Visual"}</span>
                  </button>
                )}
             </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 relative">
           {viewMode === 'edit' ? (
             <div className="max-w-3xl mx-auto space-y-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Question Stem</label>
                  <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="w-full p-4 text-lg border border-slate-200 rounded-lg min-h-[150px]" placeholder="Clinical scenario..."/>
                  {attachedImage && <img src={attachedImage} className="mt-4 rounded-xl w-full h-64 object-cover border border-slate-100 shadow-sm" />}
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                   <label className="block text-sm font-semibold text-slate-900 mb-4">Answer Options</label>
                   <div className="space-y-3">
                     {options.map((option, idx) => (
                       <div key={option.id} className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${option.isCorrect ? 'border-emerald-500 bg-emerald-50/30' : 'border-transparent bg-slate-50'}`}>
                          <button onClick={() => setOptions(options.map(o => ({...o, isCorrect: o.id === option.id})))} className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${option.isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
                            {option.isCorrect && <Check size={14} />}
                          </button>
                          <input value={option.text} onChange={(e) => { const newOpts = [...options]; newOpts[idx].text = e.target.value; setOptions(newOpts); }} className="flex-1 bg-transparent text-slate-800 focus:outline-none" placeholder={`Option ${String.fromCharCode(65 + idx)}`}/>
                       </div>
                     ))}
                   </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Explanation</label>
                  <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} className="w-full p-4 text-sm border border-slate-200 rounded-lg min-h-[200px] bg-indigo-50/20" placeholder="Support Markdown..."/>
                </div>
             </div>
           ) : (
             <div className="max-w-2xl mx-auto">
               <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                 <div className="p-8">
                   {attachedImage && <img src={attachedImage} className="w-full h-80 object-cover mb-8 rounded-xl shadow-md" />}
                   <p className="text-lg text-slate-900 leading-relaxed mb-8 font-serif">{questionText || "Question text..."}</p>
                   <div className="space-y-3">
                     {options.map((opt, idx) => (
                       <div key={opt.id} className="p-4 rounded-xl border border-slate-200 flex gap-4">
                         <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-500">{String.fromCharCode(65 + idx)}</span>
                         <span className="text-slate-700">{opt.text}</span>
                       </div>
                     ))}
                   </div>
                 </div>
                 {explanation && (
                    <div className="bg-indigo-50 border-t border-indigo-100 p-8">
                      <h4 className="text-sm font-bold text-indigo-900 mb-2 uppercase tracking-widest">Psychometric Explanation</h4>
                      <RenderMarkdown content={explanation} />
                    </div>
                 )}
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
