
import React, { useState, useEffect, useRef } from 'react';
import { MOCK_AGENT_STATUS, MOCK_AI_INSIGHT_LOGS } from '../constants';
import PsychometricianAgentSession from '../components/PsychometricianAgentSession';
import {
  Activity,
  Sparkles,
  Play,
  Pause,
  RefreshCw,
  Terminal,
  ShieldCheck,
  Radio,
  ChevronRight,
  Info,
  Mic,
  AlertTriangle,
} from 'lucide-react';

const AIAgentCenter: React.FC = () => {
  const [briefingText, setBriefingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const startBriefingAudit = async () => {
    setBriefingText('');
    setIsStreaming(true);
    // const stream = getDashboardSummaryStream({
    //   logs: MOCK_AI_INSIGHT_LOGS,
    //   status: MOCK_AGENT_STATUS
    // });

    // let fullText = "";
    // for await (const chunk of stream) {
    //   fullText += chunk;
    //   setBriefingText(fullText);
    // }
    setIsStreaming(false);
  };

  useEffect(() => {
    startBriefingAudit();
    return () => audioSourceRef.current?.stop();
  }, []);

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  };

  const handlePlayAudio = async () => {
    if (isPlaying) {
      audioSourceRef.current?.stop();
      setIsPlaying(false);
      return;
    }
    setIsAudioLoading(true);
    // const base64 = await generateBriefingAudio(briefingText);
    const base64 = null;
    if (base64) {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      const audioBuffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      audioSourceRef.current = source;
      source.start();
      setIsPlaying(true);
    }
    setIsAudioLoading(false);
  };

  const getSeverityStyles = (severity: string) => {
    switch(severity) {
      case 'critical': return 'bg-[#fdf3f4] text-[#DC3545] border-rose-100';
      case 'warning': return 'bg-[#fff8e6] text-[#CF9808] border-amber-100';
      default: return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col xl:flex-row gap-4 md:gap-8">
        <div className="flex-1 space-y-4 md:space-y-8">
          {/* Fleet Status HUD */}
          <div className="bg-slate-900 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden border border-white/5">
            <div className="absolute top-0 right-0 p-6 md:p-12 opacity-5 pointer-events-none">
              <Radio size={280} />
            </div>
            <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <span className="text-slate-400 font-bold tracking-widest text-[10px] uppercase">
                    Fleet Command HUD
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                  Active Agent Sina
                </h1>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
                <button
                  onClick={() => setIsLiveSessionOpen(true)}
                  className="primary-button flex-1 sm:flex-none justify-center"
                >
                  <Mic size={20} /> Speak with Agent
                </button>
                <button
                  onClick={startBriefingAudit}
                  className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10 group flex items-center justify-center"
                >
                  <RefreshCw
                    size={24}
                    className={
                      isStreaming
                        ? 'animate-spin'
                        : 'group-hover:rotate-180 transition-transform duration-500'
                    }
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-8 md:mt-10">
              {MOCK_AGENT_STATUS.map((agent) => (
                <div
                  key={agent.id}
                  className="p-5 md:p-6 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-sm group hover:bg-white/10 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={`w-3 h-3 rounded-full ${agent.status === 'online' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`}
                    ></div>
                    <span className="text-[10px] font-black uppercase text-slate-500">
                      {agent.status}
                    </span>
                  </div>
                  <p className="text-xs font-black text-white uppercase tracking-tight mb-1">
                    {agent.name}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>{agent.recentTasksProcessed} Tasks Sina</span>
                    <span>Heartbeat: 2s ago</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Neural Logs */}
          <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">
                  Neural Insight Feed
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Real-time anomaly detection logs
                </p>
              </div>
              <button className="w-full sm:w-auto px-4 py-2 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition bg-primary-gradient text-primary-foreground shadow-lg hover:opacity-90">
                Export Audit
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-4">
              {MOCK_AI_INSIGHT_LOGS.map((log) => (
                <div
                  key={log.id}
                  className={`p-4 md:p-6 border rounded-[1.5rem] transition-all hover:shadow-md ${getSeverityStyles(log.severity)}`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white/50 rounded-lg shrink-0">
                        {log.severity === 'critical' ? (
                          <AlertTriangle size={18} />
                        ) : (
                          <Info size={18} />
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-tight opacity-60">
                          {log.agentName}
                        </p>
                        <p className="text-sm font-black">{log.message}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold opacity-40 self-end sm:self-auto">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-black/5">
                    {log.suggestedActions.map((action, i) => (
                      <button
                        key={i}
                        className="px-3 py-1.5 bg-white/40 hover:bg-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 group transition-colors"
                      >
                        {action}{' '}
                        <ChevronRight
                          size={10}
                          className="group-hover:translate-x-1 transition-transform"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Intelligence Feed (Sidebar remains for briefing) */}
        <div className="w-full xl:w-96 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[500px] md:min-h-[600px] max-h-[800px]">
              <div className="p-5 md:p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#1BD183] rounded-xl">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-tight">
                      Executive Briefing
                    </h3>
                    <p className="text-[10px] text-[#A2A5A6] font-bold uppercase tracking-tighter">
                      AI Mission Summary
                    </p>
                  </div>
                </div>
                {isStreaming && (
                  <Activity
                    size={16}
                    className="text-emerald-400 animate-pulse"
                  />
                )}
              </div>

              <div className="flex-grow p-6 md:p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
                <div className="prose prose-sm prose-slate">
                  {briefingText ? (
                    <div className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap animate-in fade-in duration-1000">
                      {briefingText}
                      {isStreaming && (
                        <span className="inline-block w-2 h-4 bg-indigo-400 ml-1 animate-pulse"></span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-300">
                      <Terminal size={32} className="mb-2 opacity-20" />
                      <p className="text-xs font-black uppercase tracking-widest">
                        Handshaking with Fleet...
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 md:p-8 border-t border-slate-100 bg-white">
                <div className="flex items-center gap-4 mb-6">
                  <button
                    onClick={handlePlayAudio}
                    disabled={isStreaming || !briefingText}
                    className="h-16 w-16 rounded-full bg-[#1BD183] text-white flex items-center justify-center shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 bg-primary-gradient shrink-0"
                  >
                    {isAudioLoading ? (
                      <Activity className="animate-spin" size={24} />
                    ) : isPlaying ? (
                      <Pause size={24} fill="currentColor" />
                    ) : (
                      <Play size={24} fill="currentColor" />
                    )}
                  </button>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">
                      Vocalize Briefing
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      Neural Voice Engine
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Critical Next Steps
                  </p>
                  <button className="w-full text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#1BD183] transition group flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Audit Drifting Items
                    </span>
                    <ShieldCheck
                      size={16}
                      className="text-slate-300 group-hover:text-[#1BD183] transition"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLiveSessionOpen && (
        <PsychometricianAgentSession
          bankDataSummary={briefingText}
          onClose={() => setIsLiveSessionOpen(false)}
        />
      )}
    </div>
  );
};

export default AIAgentCenter;
