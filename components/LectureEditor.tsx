
import React, { useState } from 'react';
import { 
  Save, 
  FileText, 
  Target, 
  Plus, 
  Trash2, 
  MonitorPlay,
  ArrowLeft,
  X,
  Clock,
  MessageSquare
} from 'lucide-react';
import { MOCK_LEARNING_OBJECTIVES } from '../constants';

interface LectureEditorProps {
  onBack: () => void;
  onSave: () => void;
  initialData?: any;
}

const LectureEditor: React.FC<LectureEditorProps> = ({ onBack, onSave, initialData }) => {
  const [title, setTitle] = useState(initialData?.title || 'New Lecture Asset');
  const [description, setDescription] = useState(initialData?.description || '');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>(initialData?.linkedObjectiveIds || []);
  const [engagementMarkers, setEngagementMarkers] = useState(initialData?.engagementMarkers || [
    { timestamp: 210, note: 'Comparison table hotspot' },
    { timestamp: 1420, note: 'Biopsy walkthrough' }
  ]);

  const toggleObjective = (id: string) => {
    setSelectedObjectives(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    );
  };

  const addMarker = () => {
    setEngagementMarkers(prev => [...prev, { timestamp: 0, note: '' }]);
  };

  const updateMarker = (index: number, field: string, value: any) => {
    setEngagementMarkers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeMarker = (index: number) => {
    setEngagementMarkers(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Edit Lecture</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Resource ID: {initialData?.id || 'UNASSIGNED'}</p>
          </div>
        </div>
        <button onClick={onSave} className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
          <Save size={18} /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          {/* Main Info */}
          <div className="bg-white p-6 xl:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <FileText size={20} className="text-indigo-600" />
              Content Specification
            </h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full p-4 border rounded-2xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-4 border rounded-2xl bg-slate-50 border-slate-200 h-40 focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Engagement Markers */}
          <div className="bg-white p-6 xl:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <MonitorPlay size={20} className="text-amber-500" />
                Engagement Markers
              </h3>
              <button
                onClick={addMarker}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition"
              >
                <Plus size={14} /> Add Marker
              </button>
            </div>

            <div className="space-y-4">
              {engagementMarkers.map((m, i) => (
                <div key={i} className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl group transition-all hover:bg-white hover:shadow-md">
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                    <Clock size={12} className="text-slate-400" />
                    <input
                      type="number"
                      value={m.timestamp}
                      onChange={e => updateMarker(i, 'timestamp', Number(e.target.value))}
                      className="w-16 bg-transparent text-xs font-black text-indigo-600 focus:outline-none text-center"
                      placeholder="Sec"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                    <MessageSquare size={12} className="text-slate-400" />
                    <input
                      value={m.note}
                      onChange={e => updateMarker(i, 'note', e.target.value)}
                      className="flex-1 bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
                      placeholder="Annotation for this timestamp..."
                    />
                  </div>
                  <button
                    onClick={() => removeMarker(i)}
                    className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 self-end sm:self-auto"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {engagementMarkers.length === 0 && (
                <div className="text-center py-10 text-slate-300">
                  <p className="text-[10px] font-black uppercase tracking-widest">No markers defined for this asset.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <div className="bg-white p-6 xl:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Target size={16} className="text-indigo-600" />
              Learning Objectives
            </h4>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {MOCK_LEARNING_OBJECTIVES.map(obj => (
                <label key={obj.id} className={`flex items-start gap-3 p-4 border rounded-2xl cursor-pointer transition-all ${selectedObjectives.includes(obj.id) ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-transparent hover:border-slate-100'}`}>
                  <input type="checkbox" className="mt-1" checked={selectedObjectives.includes(obj.id)} onChange={() => toggleObjective(obj.id)} />
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">{obj.text}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 p-6 xl:p-8 rounded-[2rem] text-white space-y-6">
            <h4 className="text-xs font-black uppercase tracking-widest">Asset Files</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                <MonitorPlay className="text-indigo-400" size={24} />
                <div className="flex-1 truncate">
                  <p className="text-[10px] font-black uppercase">Video Content</p>
                  <p className="text-[10px] text-slate-500 truncate">{initialData?.videoUri || 'lecture_v1_final.mp4'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                <FileText className="text-emerald-400" size={24} />
                <div className="flex-1 truncate">
                  <p className="text-[10px] font-black uppercase">Transcript Source</p>
                  <p className="text-[10px] text-slate-500 truncate">{initialData?.transcriptUri || 'transcript_eng.vtt'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LectureEditor;
