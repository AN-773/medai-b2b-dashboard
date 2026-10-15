import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ChevronUp, FileText, Save, X } from 'lucide-react';
import {
  LearningObjectiveSuggestion,
  SuggestionEvidenceChunk,
  SUGGESTION_BLOOM_LEVELS,
} from '@/types/CourseStudioTypes';
import MarkdownContent from '@/components/MarkdownContent';
import { Badge, Button, Select, Textarea, cn } from '@/components/ui';

interface SuggestionReviewCardProps {
  suggestion: LearningObjectiveSuggestion;
  isBusy: boolean;
  /** Locks actions while a bulk accept/reject is running for this source. */
  locked?: boolean;
  onSave: (payload: { title?: string; bloomLevel?: string }) => Promise<boolean>;
  onAccept: () => Promise<boolean>;
  onReject: () => Promise<boolean>;
}

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
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-xs text-stone-500">
        <FileText size={13} className="flex-shrink-0 text-stone-400" aria-hidden="true" />
        <span className="truncate">{chunk.sourceFile || 'Source'}</span>
        {chunk.heading && (
          <>
            <span aria-hidden="true" className="text-stone-300">
              ·
            </span>
            <span className="truncate text-stone-600">{chunk.heading}</span>
          </>
        )}
        {typeof chunk.chunkIndex === 'number' && (
          <span className="ml-auto flex-shrink-0 tabular-nums text-stone-400">
            #{chunk.chunkIndex}
          </span>
        )}
      </div>

      <div className="mt-2 text-sm text-stone-700">
        <div className={cn('relative', !expanded && canExpand && 'max-h-32 overflow-hidden')}>
          <MarkdownContent content={chunk.content} />
          {!expanded && canExpand && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-stone-50 via-stone-50/95 to-transparent" />
          )}
        </div>

        {canExpand && (
          <Button
            variant="ghost"
            size="sm"
            icon={expanded ? ChevronUp : ChevronDown}
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className="-ml-2.5 mt-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        )}
      </div>
    </div>
  );
};

/** One AI-suggested objective: edit its text / Bloom level, then accept or reject. */
const SuggestionReviewCard: React.FC<SuggestionReviewCardProps> = ({
  suggestion,
  isBusy,
  locked = false,
  onSave,
  onAccept,
  onReject,
}) => {
  const [title, setTitle] = useState(suggestion.title);
  const [bloomLevel, setBloomLevel] = useState(suggestion.bloomLevel);
  const [showEvidence, setShowEvidence] = useState(false);
  const [expandedChunkIds, setExpandedChunkIds] = useState<Record<string, boolean>>({});

  const isPending = suggestion.status === 'pending';
  // Disabled while this card is processing, or a bulk op is running for the source.
  const actionsDisabled = isBusy || locked;

  useEffect(() => {
    setTitle(suggestion.title);
    setBloomLevel(suggestion.bloomLevel);
  }, [suggestion.id, suggestion.title, suggestion.bloomLevel]);

  useEffect(() => {
    setExpandedChunkIds({});
  }, [suggestion.id]);

  const isDirty = useMemo(
    () => title.trim() !== suggestion.title || bloomLevel !== suggestion.bloomLevel,
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
    <div
      className={cn(
        'px-4 py-3.5',
        // Amber edge = still needs a decision.
        isPending && 'shadow-[inset_2px_0_0_#fbbf24]',
      )}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {isPending ? (
            <Textarea
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              rows={2}
              aria-label="Suggested objective"
              className="text-stone-900"
            />
          ) : (
            <p className="text-sm leading-6 text-stone-600">{suggestion.title}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isPending ? (
              <div className="w-36">
                <Select
                  value={bloomLevel}
                  onChange={(event) => setBloomLevel(event.target.value)}
                  aria-label="Bloom level"
                  className="!h-8 text-[13px]"
                >
                  {SUGGESTION_BLOOM_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                  {!SUGGESTION_BLOOM_LEVELS.includes(bloomLevel as never) && (
                    <option value={bloomLevel}>{bloomLevel}</option>
                  )}
                </Select>
              </div>
            ) : (
              <Badge>{suggestion.bloomLevel}</Badge>
            )}

            {!isPending && (
              <Badge tone={suggestion.status === 'accepted' ? 'green' : 'red'} dot>
                {suggestion.status === 'accepted' ? 'Accepted' : 'Rejected'}
              </Badge>
            )}

            {chunkCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={showEvidence ? ChevronDown : ChevronRight}
                onClick={() => setShowEvidence((open) => !open)}
                aria-expanded={showEvidence}
              >
                {chunkCount} evidence {chunkCount === 1 ? 'excerpt' : 'excerpts'}
              </Button>
            )}

            {isPending && isDirty && (
              <span className="text-xs text-amber-700">Unsaved edits</span>
            )}
          </div>
        </div>

        {isPending && (
          <div className="flex flex-shrink-0 items-center gap-1">
            {isDirty && (
              <Button
                variant="ghost"
                size="sm"
                icon={Save}
                onClick={() => void persistEdits()}
                disabled={actionsDisabled || !title.trim()}
              >
                Save
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => void onReject()}
              disabled={actionsDisabled}
            >
              Reject
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Check}
              loading={isBusy}
              onClick={() => void handleAccept()}
              disabled={actionsDisabled || !title.trim()}
            >
              Accept
            </Button>
          </div>
        )}
      </div>

      {showEvidence && chunkCount > 0 && (
        <div className="mt-3 space-y-2">
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
