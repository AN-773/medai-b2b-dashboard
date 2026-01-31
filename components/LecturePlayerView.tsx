
import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  MonitorPlay, 
  Clock, 
  MessageSquare, 
  FileText, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack,
  Volume2,
  Maximize,
  Settings,
  ChevronRight,
  Sparkles,
  Edit3
} from 'lucide-react';
import { MOCK_LECTURES, USMLE_2024_OUTLINE } from '../constants';
import { LectureAsset } from '../types';

interface LecturePlayerViewProps {
  lectureId: string;
  onBack: () => void;
  onEdit: (lecture: LectureAsset) => void;
}

const LecturePlayerView: React.FC<LecturePlayerViewProps> = ({ lectureId, onBack, onEdit }) => {
  const lecture = useMemo(() => 
    MOCK_LECTURES.find(l => l.id === lectureId) || MOCK_LECTURES[0]
  , [lectureId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'MARKERS' | 'TRANSCRIPT'>('MARKERS');
  const [currentTime, setCurrentTime] = useState(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] xl:h-[calc(100vh-180px)] bg-slate-950 rounded-[2rem] xl:rounded-[3rem] overflow-hidden shadow-2xl border border-white/5 animate-in fade-in zoom-in-95 duration-500">
      {/* Immersive Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 xl:px-8 py-4 xl:py-6 bg-slate-900/50 backdrop-blur-md border-b border-white/5 gap-4">
        <div className="flex items-center gap-4 xl:gap-6">
          <button 
            onClick={onBack}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 transition-all border border-white/10"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-indigo-600/30 text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-full border border-indigo-500/30">
                Instructional Preview
              </span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{lecture.id}</span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight line-clamp-1">{lecture.title}</h2>
          </div>
        </div>
        <button 
          onClick={() => onEdit(lecture)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
        >
          <Edit3 size={14} /> Edit Resource
        </button>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        {/* Main Cinema View */}
        <div className="flex-1 flex flex-col relative bg-black min-h-[300px] xl:min-h-0">
          <div className="flex-1 flex items-center justify-center relative group">
            {/* Simulated Video Content */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-slate-900/20 pointer-events-none" />
            <MonitorPlay size={120} strokeWidth={1} className="text-white/10" />
            
            {/* Overlay Center Button */}
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white scale-100 hover:scale-110 transition-transform active:scale-90"
            >
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
            </button>

            {/* Engagement Hotspots (Simulated Visual Spikes) */}
            <div className="absolute bottom-24 left-0 right-0 px-10 hidden sm:block">
               <div className="h-1.5 w-full bg-white/10 rounded-full relative overflow-hidden group/seek">
                  <div className="absolute top-0 left-0 bottom-0 bg-indigo-500 transition-all duration-300" style={{ width: '35%' }} />
                  {lecture.engagementMarkers.map((m, idx) => (
                    <div 
                      key={idx} 
                      className="absolute top-0 w-1.5 h-full bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.6)] cursor-pointer hover:scale-y-150 transition-transform" 
                      style={{ left: `${(m.timestampSec / (lecture.estimatedDurationMinutes * 60)) * 100}%` }}
                      title={m.description}
                    />
                  ))}
               </div>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="bg-slate-900/80 backdrop-blur-xl border-t border-white/5 p-4 xl:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-4">
                <button className="text-white/60 hover:text-white transition"><SkipBack size={20} /></button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-12 h-12 bg-white text-slate-950 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                </button>
                <button className="text-white/60 hover:text-white transition"><SkipForward size={20} /></button>
              </div>
              <div className="text-[11px] font-mono font-bold text-white/40">
                <span className="text-white">{formatTime(currentTime)}</span> / {formatTime(lecture.estimatedDurationMinutes * 60)}
              </div>
            </div>

            <div className="flex items-center gap-6 w-full sm:w-auto justify-end">
               <div className="flex items-center gap-3 hidden sm:flex">
                  <Volume2 size={18} className="text-white/40" />
                  <div className="w-24 h-1 bg-white/10 rounded-full">
                    <div className="h-full bg-white/40 rounded-full w-2/3" />
                  </div>
               </div>
               <div className="h-4 w-px bg-white/10 hidden sm:block" />
               <button className="text-white/60 hover:text-white transition"><Settings size={18} /></button>
               <button className="text-white/60 hover:text-white transition"><Maximize size={18} /></button>
            </div>
          </div>
        </div>

        {/* Intelligence Sidebar */}
        <div className="w-full xl:w-96 bg-slate-900 border-l border-white/5 flex flex-col h-[400px] xl:h-auto">
          <div className="p-1 bg-white/5 m-4 rounded-2xl flex shrink-0">
            <button 
              onClick={() => setActiveTab('MARKERS')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'MARKERS' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Sparkles size={14} /> Markers
            </button>
            <button 
              onClick={() => setActiveTab('TRANSCRIPT')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'TRANSCRIPT' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <FileText size={14} /> Transcript
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
            {activeTab === 'MARKERS' ? (
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">High-Yield Checkpoints</p>
                {lecture.engagementMarkers.map((marker, i) => (
                  <button 
                    key={i}
                    onClick={() => setCurrentTime(marker.timestampSec)}
                    className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-indigo-500/30 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] font-mono text-indigo-400 font-black">{formatTime(marker.timestampSec)}</span>
                       <ChevronRight size={14} className="text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-xs font-bold text-slate-200 leading-snug">{marker.description}</p>
                    <p className="text-[9px] text-slate-500 font-black uppercase mt-3 tracking-widest">{marker.type}</p>
                  </button>
                ))}
                {lecture.engagementMarkers.length === 0 && (
                  <div className="text-center py-20 text-slate-600 italic text-sm">
                    No engagement markers defined.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-indigo-900/20 border border-indigo-500/20 rounded-2xl flex items-start gap-3">
                   <FileText className="text-indigo-400 mt-0.5" size={16} />
                   <p className="text-[10px] text-indigo-200 font-medium leading-relaxed italic">
                     AI-generated transcript derived from multimodal audio analysis.
                   </p>
                </div>
                <div className="space-y-4 font-serif text-sm text-slate-400 leading-relaxed px-2">
                   <p><strong className="text-indigo-400">0:00</strong> Welcome back everyone. Today we are diving into the molecular mechanisms of insulin resistance, specifically looking at how systemic inflammation impacts GLUT4 translocation...</p>
                   <p><strong className="text-indigo-400">2:45</strong> Notice the role of TNF-alpha here. This cytokine induces phosphorylation of IRS-1 at serine residues rather than tyrosine residues, which effectively inhibits its activity...</p>
                   <p><strong className="text-indigo-400">5:12</strong> Let's transition to the clinical correlate on page 14 of your USMLE outline regarding the presentation of metabolic syndrome...</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-white/5 border-t border-white/5 shrink-0">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                   <MessageSquare size={16} />
                </div>
                <p className="text-[10px] font-black text-white uppercase tracking-widest">Sina: Tutor Insights</p>
             </div>
             <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
               "Students frequently pause at <span className="text-indigo-400">4:12</span>. Consider adding a self-assessment MCQ here to reinforce the IRS-1 phosphorylation mechanism."
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LecturePlayerView;
