import React, { useEffect, useRef, useState } from 'react';
import { Activity, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { Button, Drawer, Spinner, StatusDot, cn } from '@/components/ui';

interface PsychometricianAgentSessionProps {
  onClose: () => void;
  bankDataSummary: string;
}

const GREETING =
  "I'm reviewing the bank health data now. What specific area of discrimination or difficulty would you like to discuss?";

/** One message in the session transcript. */
const AgentMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-3">
    <span
      className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ai-gradient text-xs font-semibold text-white"
      aria-hidden="true"
    >
      S
    </span>
    <div className="min-w-0 max-w-[85%]">
      <p className="text-xs font-medium text-stone-500">Sina</p>
      <p className="mt-1 rounded-xl rounded-tl-sm bg-stone-100 px-3.5 py-2.5 text-sm leading-6 text-stone-800">
        {children}
      </p>
    </div>
  </li>
);

/** Animated input level — flat when the mic is muted or the session isn't live. */
const VoiceLevel: React.FC<{ active: boolean }> = ({ active }) => (
  <span className="inline-flex items-center gap-2 text-stone-400" aria-hidden="true">
    <Volume2 size={16} />
    <span className="flex h-4 items-end gap-0.5">
      {[45, 85, 60, 75, 40].map((height, index) => (
        <span
          key={index}
          className={cn('w-1 rounded-full transition-all', active ? 'animate-pulse bg-brand-500' : 'bg-stone-300')}
          style={{ height: `${active ? height : 25}%`, animationDelay: `${index * 120}ms` }}
        />
      ))}
    </span>
  </span>
);

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
    // const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputAudioContext;

    let micStream: MediaStream;
    let scriptProcessor: ScriptProcessorNode;

    // const sessionPromise = ai.live.connect({
    //   model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    //   callbacks: {
    //     onopen: () => {
    //       setIsConnecting(false);
    //       setIsActive(true);
    //       navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    //         micStream = stream;
    //         const source = inputAudioContext.createMediaStreamSource(stream);
    //         scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
    //         scriptProcessor.onaudioprocess = (e) => {
    //           if (isMuted) return;
    //           const inputData = e.inputBuffer.getChannelData(0);
    //           const int16 = new Int16Array(inputData.length);
    //           for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
    //           const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
    //           sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
    //         };
    //         source.connect(scriptProcessor);
    //         scriptProcessor.connect(inputAudioContext.destination);
    //       });
    //     },
    //     onmessage: async (message: any) => {
    //       if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
    //         const base64 = message.serverContent.modelTurn.parts[0].inlineData.data;
    //         nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
    //         const audioBuffer = await decodeAudioData(decode(base64), outputAudioContext, 24000, 1);
    //         const source = outputAudioContext.createBufferSource();
    //         source.buffer = audioBuffer;
    //         source.connect(outputAudioContext.destination);
    //         source.start(nextStartTimeRef.current);
    //         nextStartTimeRef.current += audioBuffer.duration;
    //         sourcesRef.current.add(source);
    //         source.onended = () => sourcesRef.current.delete(source);
    //       }
    //       if (message.serverContent?.interrupted) {
    //         sourcesRef.current.forEach(s => s.stop());
    //         sourcesRef.current.clear();
    //         nextStartTimeRef.current = 0;
    //       }
    //     },
    //     onclose: () => setIsActive(false),
    //     onerror: (e) => console.error("Live Session Error:", e),
    //   },
    //   config: {
    //     responseModalities: [Modality.AUDIO],
    //     speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
    //     systemInstruction: `You are a world-class psychometrician helping medical educators optimize their question bank. You have access to real-time bank health data: ${bankDataSummary}. Be direct, professional, and insightful.`,
    //   }
    // });

    return () => {
      // sessionPromise.then(s => s.close());
      micStream?.getTracks().forEach(t => t.stop());
      inputAudioContext.close();
      outputAudioContext.close();
    };
  }, []);

  const status = isConnecting
    ? { tone: 'neutral' as const, label: 'Connecting' }
    : !isActive
      ? { tone: 'neutral' as const, label: 'Ended' }
      : isMuted
        ? { tone: 'amber' as const, label: 'Muted' }
        : { tone: 'green' as const, label: 'Live' };

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-md"
      title="Voice session with Sina"
      description="Psychometrician agent · Zephyr voice"
      toolbar={
        <div className="flex items-center gap-3 border-b border-stone-100 px-6 py-3">
          <span
            className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ai-gradient text-white',
              isActive && !isMuted && 'animate-pulse',
            )}
            aria-hidden="true"
          >
            <Activity size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-stone-900">Sina</p>
            <p className="text-xs text-stone-500">Ask about difficulty, discrimination or distractors</p>
          </div>
          <StatusDot tone={status.tone}>{status.label}</StatusDot>
        </div>
      }
      footer={
        <>
          <Button
            variant={isMuted ? 'danger' : 'secondary'}
            icon={isMuted ? MicOff : Mic}
            onClick={() => setIsMuted(!isMuted)}
            aria-pressed={isMuted}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>
          <VoiceLevel active={isActive && !isMuted} />
          <Button variant="primary" icon={PhoneOff} onClick={onClose} className="ml-auto">
            End session
          </Button>
        </>
      }
    >
      <div className="space-y-5 px-6 py-5">
        {bankDataSummary && (
          <details className="group rounded-lg border border-stone-200 px-3.5 py-2.5">
            <summary className="cursor-pointer text-[13px] font-medium text-stone-700">
              Context shared with Sina
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-stone-600">{bankDataSummary}</p>
          </details>
        )}

        {isConnecting ? (
          <div className="flex flex-col items-center px-4 py-16 text-center" aria-live="polite">
            <Spinner label="Connecting to Sina…" />
            <p className="mt-2 max-w-xs text-[13px] leading-5 text-stone-500">
              Allow microphone access if your browser asks. You can start talking as soon as the session is live.
            </p>
          </div>
        ) : (
          <ol className="space-y-4" aria-live="polite" aria-label="Conversation">
            <AgentMessage>{GREETING}</AgentMessage>
            {transcript.map((line, index) => (
              <AgentMessage key={index}>{line}</AgentMessage>
            ))}
          </ol>
        )}
      </div>
    </Drawer>
  );
};

export default PsychometricianAgentSession;
