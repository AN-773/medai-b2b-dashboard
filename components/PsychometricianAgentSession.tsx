
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { X, Mic, MicOff, Volume2, Activity } from 'lucide-react';

interface PsychometricianAgentSessionProps {
  onClose: () => void;
  bankDataSummary: string;
}

const PsychometricianAgentSession: React.FC<PsychometricianAgentSessionProps> = ({ onClose, bankDataSummary }) => {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [transcript, setTranscript] = useState<string[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Base64 helper methods
  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

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

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputAudioContext;

    let micStream: MediaStream;
    let scriptProcessor: ScriptProcessorNode;

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          setIsConnecting(false);
          setIsActive(true);
          navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            micStream = stream;
            const source = inputAudioContext.createMediaStreamSource(stream);
            scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          });
        },
        onmessage: async (message: any) => {
          if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
            const base64 = message.serverContent.modelTurn.parts[0].inlineData.data;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
            source.onended = () => sourcesRef.current.delete(source);
          }
          if (message.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }
        },
        onclose: () => setIsActive(false),
        onerror: (e) => console.error("Live Session Error:", e),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: `You are a world-class psychometrician helping medical educators optimize their question bank. You have access to real-time bank health data: ${bankDataSummary}. Be direct, professional, and insightful.`,
      }
    });

    return () => {
      sessionPromise.then(s => s.close());
      micStream?.getTracks().forEach(t => t.stop());
      inputAudioContext.close();
      outputAudioContext.close();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-6">
      <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-500">
        <div className="p-10 text-center space-y-8">
          <div className="flex justify-end">
            <button onClick={onClose} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:text-accent-foreground h-8 w-8 hover:bg-gray-200"><X size={24} /></button>
          </div>
          
          <div className="flex flex-col items-center gap-6">
            <div className={`w-32 h-32 rounded-full bg-[#1BD183] flex items-center justify-center text-white shadow-2xl relative ${isActive && !isMuted ? 'animate-pulse' : ''}`}>
               <Activity size={48} className={isActive && !isMuted ? 'animate-bounce' : ''} />
               <div className="absolute inset-0 rounded-full border-4 border-[#1BD183] animate-ping opacity-20"></div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Vocal Consultation</h2>
              <p className="text-sm text-slate-500 font-medium">Psychometrician Agent: Zephyr</p>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`p-6 rounded-3xl transition-all shadow-lg ${isMuted ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
            <div className="bg-slate-100 p-6 rounded-3xl text-[#1BD183] shadow-inner flex items-center gap-2">
               <Volume2 size={28} />
               <span className="w-16 h-2 bg-slate-200 rounded-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-[#1BD183] animate-shimmer"></div>
               </span>
            </div>
          </div>

          {isConnecting ? (
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Establishing Secure Uplink...</p>
          ) : (
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
               <p className="text-xs font-bold text-black italic">"I'm reviewing the bank health data now. What specific area of discrimination or difficulty would you like to discuss?"</p>
            </div>
          )}
        </div>
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              Sena Live Active
           </div>
        </div>
      </div>
    </div>
  );
};

export default PsychometricianAgentSession;
