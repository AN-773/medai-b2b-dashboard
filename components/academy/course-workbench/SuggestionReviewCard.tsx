import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import {
  LearningObjectiveSuggestion,
  SuggestionEvidenceChunk,
  SUGGESTION_BLOOM_LEVELS,
} from '@/types/CourseStudioTypes';
import MarkdownContent from '@/components/MarkdownContent';
import { bloomStyle } from './shared';

interface SuggestionReviewCardProps {
  suggestion: LearningObjectiveSuggestion;
  isBusy: boolean;
  onSave: (payload: { title?: string; bloomLevel?: string }) => Promise<boolean>;
  onAccept: () => Promise<boolean>;
  onReject: () => Promise<boolean>;
}

const STATUS_BADGE: Record<string, string> = {
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-600 border-rose-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

const evidenceCanExpand = (content: string) =>
  content.trim().length > 260 || content.split(/\n+/).length > 4;

interface EvidenceChunkCardProps {
  chunk: SuggestionEvidenceChunk;
  expanded: boolean;
  onToggleExpanded: () => void;
}

const EvidenceChunkCard: React.FC<EvidenceChunkCardProps> = ({
  chunk,
  expanded,
  onToggleExpanded,
}) => {
  const canExpand = evidenceCanExpand(chunk.content);

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-3">
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
        <FileText size={12} className="flex-shrink-0" />
        <span className="truncate">{chunk.sourceFile || 'Source'}</span>
        {chunk.heading && (
          <>
            <span className="text-slate-300">·</span>
            <span className="truncate text-slate-600">{chunk.heading}</span>
          </>
        )}
        {typeof chunk.chunkIndex === 'number' && (
          <span className="ml-auto flex-shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-400">
            #{chunk.chunkIndex}
          </span>
        )}
      </div>

      <div className="mt-2">
        <div className={`relative ${!expanded && canExpand ? 'max-h-32 overflow-hidden' : ''}`}>
          <MarkdownContent content={chunk.content} />
          {!expanded && canExpand && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent" />
          )}
        </div>

        {canExpand && (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:border-slate-300"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
    </div>
  );
};

const SuggestionReviewCard: React.FC<SuggestionReviewCardProps> = ({
  suggestion,
  isBusy,
  onSave,
  onAccept,
  onReject,
}) => {
  const [title, setTitle] = useState(suggestion.title);
  const [bloomLevel, setBloomLevel] = useState(suggestion.bloomLevel);
  const [showEvidence, setShowEvidence] = useState(false);
  const [expandedChunkIds, setExpandedChunkIds] = useState<Record<string, boolean>>({});

  const isPending = suggestion.status === 'pending';

  useEffect(() => {
    setTitle(suggestion.title);
    setBloomLevel(suggestion.bloomLevel);
  }, [suggestion.id, suggestion.title, suggestion.bloomLevel]);

  useEffect(() => {
    setExpandedChunkIds({});
  }, [suggestion.id]);

  const isDirty = useMemo(
    () =>
      title.trim() !== suggestion.title || bloomLevel !== suggestion.bloomLevel,
    [title, bloomLevel, suggestion.title, suggestion.bloomLevel],
  );

  const persistEdits = async () => {
    if (!isDirty) return true;
    return onSave({ title: title.trim(), bloomLevel });
  };

  const handleAccept = async () => {
    if (isDirty) {
      const saved = await persistEdits();
      if (!saved) return;
    }
    await onAccept();
  };

  const chunkCount = suggestion.chunks?.length || 0;

  return (
    <div className={`px-1 py-4 transition ${isPending ? '' : 'opacity-75'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isPending ? (
            <textarea
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold leading-snug text-slate-900 outline-none transition focus:border-[#1BD183] focus:bg-white focus:ring-2 focus:ring-[#1BD183]/15"
            />
          ) : (
            <p className="text-sm font-bold leading-snug text-slate-800">
              {suggestion.title}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isPending ? (
              <div className="relative">
                <select
                  value={bloomLevel}
                  onChange={(event) => setBloomLevel(event.target.value)}
                  className={`appearance-none rounded-lg border px-2.5 py-1 pr-7 text-[11px] font-black uppercase tracking-[0.12em] outline-none ${bloomStyle(bloomLevel)}`}
                >
                  {SUGGESTION_BLOOM_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                  {!SUGGESTION_BLOOM_LEVELS.includes(bloomLevel as never) && (
                    <option value={bloomLevel}>{bloomLevel}</option>
                  )}
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-60"
                />
              </div>
            ) : (
              <span
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${bloomStyle(suggestion.bloomLevel)}`}
              >
                {suggestion.bloomLevel}
              </span>
            )}

            {chunkCount > 0 && (
              <button
                type="button"
                onClick={() => setShowEvidence((open) => !open)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:border-slate-300"
              >
                {showEvidence ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {chunkCount} evidence chunk{chunkCount === 1 ? '' : 's'}
              </button>
            )}

            {!isPending && (
              <span
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${STATUS_BADGE[suggestion.status]}`}
              >
                {suggestion.status}
              </span>
            )}
          </div>
        </div>

        {isPending && (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {isDirty && (
              <button
                type="button"
                onClick={() => void persistEdits()}
                disabled={isBusy || !title.trim()}
                title="Save edits"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
              >
                <Save size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => void onReject()}
              disabled={isBusy}
              title="Reject"
              className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
            >
              <X size={16} />
            </button>
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={isBusy || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1BD183] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#06241a] transition hover:brightness-105 disabled:opacity-50"
            >
              {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Accept
            </button>
          </div>
        )}
      </div>

      {showEvidence && chunkCount > 0 && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {suggestion.chunks.map((chunk) => (
            <EvidenceChunkCard
              key={chunk.id}
              chunk={chunk}
              expanded={Boolean(expandedChunkIds[chunk.id])}
              onToggleExpanded={() =>
                setExpandedChunkIds((current) => ({
                  ...current,
                  [chunk.id]: !current[chunk.id],
                }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestionReviewCard;
