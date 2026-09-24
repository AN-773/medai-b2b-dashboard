import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_AGENT_STATUS, MOCK_AI_INSIGHT_LOGS } from '../constants';
import PsychometricianAgentSession from '../components/PsychometricianAgentSession';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  ChevronRight,
  Download,
  FileText,
  Info,
  Network,
  Pause,
  PenLine,
  Play,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  SectionHeader,
  SegmentedControl,
  Spinner,
  StatusDot,
  cn,
  type BadgeTone,
} from '@/components/ui';

type InsightFilter = 'all' | 'action';

const SEVERITY: Record<string, { label: string; tone: BadgeTone; icon: LucideIcon; tile: string }> = {
  critical: { label: 'Critical', tone: 'red', icon: AlertTriangle, tile: 'bg-red-50 text-red-600' },
  warning: { label: 'Warning', tone: 'amber', icon: AlertTriangle, tile: 'bg-amber-50 text-amber-600' },
  info: { label: 'Info', tone: 'blue', icon: Info, tile: 'bg-sky-50 text-sky-600' },
};
const severityOf = (severity: string) => SEVERITY[severity] ?? SEVERITY.info;

const CATEGORY_LABELS: Record<string, string> = {
  QB_HEALTH: 'Bank health',
  STUDENT_MASTERY: 'Mastery',
  CURRICULUM: 'Curriculum',
  PSYCHOMETRICS: 'Psychometrics',
};

const agentIcon = (name: string): LucideIcon =>
  /psychometric/i.test(name) ? BarChart3 : /curriculum/i.test(name) ? Network : /authoring/i.test(name) ? PenLine : Bot;

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const AIAgentCenter: React.FC = () => {
  const navigate = useNavigate();
  const [briefingText, setBriefingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);
  const [insightFilter, setInsightFilter] = useState<InsightFilter>('all');

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

  /** Downloads the insight feed as CSV. */
  const exportAudit = () => {
    const header = ['Time', 'Agent', 'Severity', 'Priority', 'Category', 'Message', 'Suggested actions', 'Entity'];
    const rows = MOCK_AI_INSIGHT_LOGS.map(log => [
      log.timestamp,
      log.agentName,
      log.severity,
      log.priority,
      CATEGORY_LABELS[log.category] ?? log.category,
      log.message,
      log.suggestedActions.join('; '),
      log.entityId ?? '',
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sina-insights-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onlineCount = MOCK_AGENT_STATUS.filter(agent => agent.status === 'online').length;
  const actionCount = MOCK_AI_INSIGHT_LOGS.filter(log => log.actionRequired).length;
  const visibleInsights = MOCK_AI_INSIGHT_LOGS.filter(log => insightFilter === 'all' || log.actionRequired);

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI agents"
        description="Sina's agents watch your question bank, curriculum and authoring queue, and flag what needs your attention."
        actions={
          <>
            <Button icon={RefreshCw} onClick={startBriefingAudit} loading={isStreaming}>
              Refresh briefing
            </Button>
            <Button variant="ai" icon={Sparkles} onClick={() => setIsLiveSessionOpen(true)}>
              Talk to Sina
            </Button>
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <section className="space-y-4">
            <SectionHeader
              title="Agents"
              meta={
                <span className="text-[13px] tabular-nums text-stone-500">
                  {onlineCount} of {MOCK_AGENT_STATUS.length} online
                </span>
              }
            />
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-card">
              {MOCK_AGENT_STATUS.map((agent) => {
                const Icon = agentIcon(agent.name);
                const online = agent.status === 'online';
                return (
                  <li key={agent.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-ai-gradient">
                      <Icon size={16} className="text-violet-brand" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">{agent.name}</p>
                      <p className="text-[13px] text-stone-500">
                        <span className="tabular-nums">{agent.recentTasksProcessed.toLocaleString()}</span> tasks processed · Heartbeat 2s ago
                      </p>
                    </div>
                    <StatusDot tone={online ? 'green' : 'amber'}>{online ? 'Online' : 'Needs attention'}</StatusDot>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title="Insights"
              description="What the agents noticed, with the suggested next move."
              actions={
                <>
                  <SegmentedControl<InsightFilter>
                    label="Filter insights"
                    size="sm"
                    value={insightFilter}
                    onChange={setInsightFilter}
                    options={[
                      { value: 'all', label: 'All', count: MOCK_AI_INSIGHT_LOGS.length },
                      { value: 'action', label: 'Needs action', count: actionCount },
                    ]}
                  />
                  <Button size="sm" icon={Download} onClick={exportAudit}>
                    Export audit
                  </Button>
                </>
              }
            />
            {visibleInsights.length === 0 ? (
              <div className="rounded-xl border border-stone-200">
                <EmptyState
                  compact
                  icon={FileText}
                  title={insightFilter === 'action' ? 'Nothing needs action' : 'No insights yet'}
                  description={
                    insightFilter === 'action'
                      ? 'The agents have no open items for you right now.'
                      : 'Insights appear here as the agents review your bank and cohorts.'
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-card">
                {visibleInsights.map((log) => {
                  const severity = severityOf(log.severity);
                  const SeverityIcon = severity.icon;
                  return (
                    <li key={log.id} className="flex gap-3 px-4 py-4">
                      <span
                        className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', severity.tile)}
                        aria-hidden="true"
                      >
                        <SeverityIcon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-medium text-stone-900">{log.agentName}</p>
                          <Badge tone={severity.tone}>{severity.label}</Badge>
                          <time dateTime={log.timestamp} className="ml-auto text-xs tabular-nums text-stone-500">
                            {formatTime(log.timestamp)}
                          </time>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-stone-700">{log.message}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {log.suggestedActions.map((action, i) => (
                            <Button key={i} size="sm" iconRight={ChevronRight}>
                              {action}
                            </Button>
                          ))}
                          <span className="ml-auto flex items-center gap-3 text-xs text-stone-500">
                            {CATEGORY_LABELS[log.category] ?? log.category}
                            {log.actionRequired && <StatusDot tone="amber">Needs action</StatusDot>}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <section
            aria-labelledby="briefing-title"
            className="flex flex-col rounded-xl border border-stone-200 bg-white shadow-card"
          >
            <div className="flex items-start gap-3 px-5 pt-5">
              <Sparkles size={16} className="mt-1 flex-shrink-0 text-violet-brand" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h2 id="briefing-title" className="text-[15px] font-semibold text-stone-900">Briefing</h2>
                <p className="text-[13px] text-stone-500">Sina's summary of recent agent activity</p>
              </div>
            </div>

            <div className="min-h-[12rem] px-5 py-4" aria-live="polite" aria-busy={isStreaming}>
              {briefingText ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">
                  {briefingText}
                  {isStreaming && (
                    <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-brand-500 align-middle" />
                  )}
                </p>
              ) : isStreaming ? (
                <Spinner label="Preparing briefing…" className="py-12" />
              ) : (
                <EmptyState
                  compact
                  icon={FileText}
                  title="No briefing yet"
                  description="Refresh to ask Sina for a summary of what the agents found."
                  action={
                    <Button size="sm" variant="ghost" icon={RefreshCw} onClick={startBriefingAudit}>
                      Refresh
                    </Button>
                  }
                />
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-stone-100 px-5 py-4">
              <Button
                icon={isPlaying ? Pause : Play}
                onClick={handlePlayAudio}
                loading={isAudioLoading}
                disabled={isStreaming || !briefingText}
                aria-pressed={isPlaying}
              >
                {isPlaying ? 'Stop' : 'Listen'}
              </Button>
              <p className="text-[13px] text-stone-500">Hear the briefing read aloud</p>
            </div>

            <div className="border-t border-stone-100 px-5 py-4">
              <h3 className="text-[13px] font-medium text-stone-500">Next steps</h3>
              <button
                type="button"
                onClick={() => navigate('/qb-health')}
                className="group -mx-2 mt-1.5 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm font-medium text-stone-800 transition hover:bg-stone-50"
              >
                Audit drifting items
                <ArrowRight size={15} className="text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-700" aria-hidden="true" />
              </button>
            </div>
          </section>
        </aside>
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
