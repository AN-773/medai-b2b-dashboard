import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Maximize,
  MonitorPlay,
  Pause,
  Pencil,
  Play,
  Settings,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { MOCK_LECTURES } from '../constants';
import { LectureAsset } from '../types';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  SegmentedControl,
  cn,
} from '@/components/ui';

interface LecturePlayerViewProps {
  lectureId: string;
  onBack: () => void;
  onEdit: (lecture: LectureAsset) => void;
}

type SideTab = 'MARKERS' | 'TRANSCRIPT';

const TRANSCRIPT = [
  {
    time: '0:00',
    text: 'Welcome back everyone. Today we are diving into the molecular mechanisms of insulin resistance, specifically looking at how systemic inflammation impacts GLUT4 translocation...',
  },
  {
    time: '2:45',
    text: 'Notice the role of TNF-alpha here. This cytokine induces phosphorylation of IRS-1 at serine residues rather than tyrosine residues, which effectively inhibits its activity...',
  },
  {
    time: '5:12',
    text: "Let's transition to the clinical correlate on page 14 of your USMLE outline regarding the presentation of metabolic syndrome...",
  },
];

/** Preview a lecture as students see it, with its checkpoints and transcript. */
const LecturePlayerView: React.FC<LecturePlayerViewProps> = ({ lectureId, onBack, onEdit }) => {
  const lecture = useMemo(() =>
    MOCK_LECTURES.find(l => l.id === lectureId) || MOCK_LECTURES[0]
  , [lectureId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<SideTab>('MARKERS');
  const [currentTime, setCurrentTime] = useState(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const durationSec = lecture.estimatedDurationMinutes * 60;
  const percentAt = (seconds: number) =>
    durationSec > 0 ? Math.min(100, (seconds / durationSec) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <button
            type="button"
            onClick={onBack}
            className="-mx-1 inline-flex items-center gap-1 rounded px-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <ArrowLeft size={14} />
            Item workbench
          </button>
        }
        title={lecture.title}
        meta={
          <>
            <Badge tone="neutral">Preview</Badge>
            <span className="font-mono text-xs text-stone-400">{lecture.id}</span>
          </>
        }
        description={lecture.description || undefined}
        actions={
          <Button variant="secondary" icon={Pencil} onClick={() => onEdit(lecture)}>
            Edit lecture
          </Button>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Player */}
        <section
          aria-label="Lecture player"
          className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card"
        >
          <div className="relative flex aspect-video items-center justify-center bg-stone-100">
            <MonitorPlay
              size={96}
              strokeWidth={1}
              className="absolute text-stone-300"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white text-stone-900 shadow-pop ring-1 ring-stone-200 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {isPlaying ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" className="ml-1" />
              )}
            </button>
          </div>

          {/* Seek bar with checkpoint markers */}
          <div className="px-5 pt-4">
            <div className="relative h-1.5 w-full rounded-full bg-stone-200">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-brand-500 transition-[width]"
                style={{ width: `${percentAt(currentTime)}%` }}
              />
              {lecture.engagementMarkers.map((marker, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentTime(marker.timestampSec)}
                  aria-label={`Jump to ${formatTime(marker.timestampSec)}: ${marker.description}`}
                  title={marker.description}
                  className="absolute top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 transition hover:scale-y-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  style={{ left: `${percentAt(marker.timestampSec)}%` }}
                />
              ))}
            </div>
          </div>

          {/* Transport controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div className="flex items-center gap-1">
              <IconButton icon={SkipBack} label="Skip back" />
              <IconButton
                icon={isPlaying ? Pause : Play}
                label={isPlaying ? 'Pause' : 'Play'}
                onClick={() => setIsPlaying(!isPlaying)}
                className="text-stone-900"
              />
              <IconButton icon={SkipForward} label="Skip forward" />
              <span className="ml-2 text-[13px] tabular-nums text-stone-500">
                <span className="text-stone-900">{formatTime(currentTime)}</span> /{' '}
                {formatTime(durationSec)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="mr-2 hidden items-center gap-2 sm:flex" aria-hidden="true">
                <Volume2 size={16} className="text-stone-400" />
                <div className="h-1 w-20 rounded-full bg-stone-200">
                  <div className="h-full w-2/3 rounded-full bg-stone-400" />
                </div>
              </div>
              <IconButton icon={Settings} label="Playback settings" />
              <IconButton icon={Maximize} label="Full screen" />
            </div>
          </div>
        </section>

        {/* Checkpoints, transcript and tutor insight */}
        <aside className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
          <div className="border-b border-stone-200 p-3">
            <SegmentedControl<SideTab>
              label="Lecture details"
              value={activeTab}
              onChange={setActiveTab}
              className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
              options={[
                { value: 'MARKERS', label: 'Checkpoints', count: lecture.engagementMarkers.length },
                { value: 'TRANSCRIPT', label: 'Transcript' },
              ]}
            />
          </div>

          <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
            {activeTab === 'MARKERS' ? (
              lecture.engagementMarkers.length > 0 ? (
                <ul className="divide-y divide-stone-100">
                  {lecture.engagementMarkers.map((marker, i) => {
                    const isCurrent = currentTime === marker.timestampSec;
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => setCurrentTime(marker.timestampSec)}
                          aria-current={isCurrent ? 'true' : undefined}
                          className={cn(
                            'group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                            isCurrent ? 'bg-stone-50' : 'hover:bg-stone-50',
                          )}
                        >
                          <span className="w-10 flex-shrink-0 pt-px text-[13px] font-medium tabular-nums text-brand-700">
                            {formatTime(marker.timestampSec)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm leading-5 text-stone-900">
                              {marker.description}
                            </span>
                            <span className="mt-0.5 block text-xs text-stone-500">{marker.type}</span>
                          </span>
                          <ChevronRight
                            size={16}
                            className="mt-0.5 flex-shrink-0 text-stone-300 transition-colors group-hover:text-stone-500"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  compact
                  icon={MonitorPlay}
                  title="No checkpoints"
                  description="This lecture has no engagement markers yet."
                />
              )
            ) : (
              <div className="space-y-4 p-4">
                <p className="flex items-center gap-2 text-xs text-stone-500">
                  <Badge tone="violet" icon={Sparkles}>
                    AI
                  </Badge>
                  Transcript generated from the lecture audio.
                </p>
                {TRANSCRIPT.map((line) => (
                  <p key={line.time} className="text-sm leading-6 text-stone-700">
                    <span className="mr-2 font-medium tabular-nums text-brand-700">{line.time}</span>
                    {line.text}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-stone-200 bg-stone-50/60 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
              <Sparkles size={15} className="text-violet-brand" aria-hidden="true" />
              Tutor insight
            </p>
            <p className="mt-1 text-[13px] leading-5 text-stone-600">
              Students often pause at{' '}
              <span className="font-medium tabular-nums text-stone-900">4:12</span>. Consider adding
              a self-check MCQ there to reinforce the IRS-1 phosphorylation mechanism.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default LecturePlayerView;
