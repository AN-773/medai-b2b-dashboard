import React from 'react';
import { RefreshCw, Sparkles, Target } from 'lucide-react';
import {
  Button,
  EmptyState,
  IconButton,
  InlineAlert,
  SegmentedControl,
  Spinner,
} from '@/components/ui';
import type { SuggestionStatus } from '@/types/CourseStudioTypes';
import type { ItemSuggestion, ItemSuggestionDraft } from '@/types/CourseAITypes';
import ItemReviewCard from './ItemReviewCard';
import { DRAFT_STATUS_OPTIONS } from './contentConfig';

interface CourseDraftsCardProps {
  status: SuggestionStatus;
  onStatusChange: (status: SuggestionStatus) => void;
  counts: Record<SuggestionStatus, number>;
  suggestions: ItemSuggestion[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  objectiveTitleFor: (suggestion: ItemSuggestion) => string;
  busySuggestionId: string | null;
  isBulkBusy: boolean;
  onSave: (suggestion: ItemSuggestion, draft: ItemSuggestionDraft) => Promise<boolean>;
  onAccept: (suggestion: ItemSuggestion) => void;
  onReject: (suggestion: ItemSuggestion) => void;
}

const EMPTY_COPY: Record<SuggestionStatus, { title: string; description: string }> = {
  pending: {
    title: 'Nothing to review',
    description: 'AI drafts that need your review will show up here, across every objective.',
  },
  accepted: {
    title: 'No accepted drafts',
    description: 'Drafts you accept become live items on their objective.',
  },
  rejected: {
    title: 'No rejected drafts',
    description: 'Drafts you reject are kept here for reference.',
  },
};

/** Course-wide review queue of AI drafts, filterable by status. */
const CourseDraftsCard: React.FC<CourseDraftsCardProps> = ({
  status,
  onStatusChange,
  counts,
  suggestions,
  isLoading,
  error,
  onRefresh,
  objectiveTitleFor,
  busySuggestionId,
  isBulkBusy,
  onSave,
  onAccept,
  onReject,
}) => {
  const renderBody = () => {
    if (isLoading) return <Spinner label="Loading drafts…" className="py-16" />;

    if (error) {
      return (
        <div className="p-4">
          <InlineAlert
            tone="error"
            action={
              <Button size="sm" icon={RefreshCw} onClick={onRefresh}>
                Retry
              </Button>
            }
          >
            {error}
          </InlineAlert>
        </div>
      );
    }

    if (suggestions.length === 0) {
      return (
        <EmptyState
          compact
          icon={Sparkles}
          title={EMPTY_COPY[status].title}
          description={EMPTY_COPY[status].description}
        />
      );
    }

    return (
      <div className="divide-y divide-stone-100">
        {suggestions.map((suggestion) => (
          <ItemReviewCard
            key={suggestion.id}
            suggestion={suggestion}
            isBusy={busySuggestionId === suggestion.id}
            locked={isBulkBusy}
            onSave={(draft) => onSave(suggestion, draft)}
            onAccept={() => onAccept(suggestion)}
            onReject={() => onReject(suggestion)}
            context={
              <p className="mb-2 flex items-start gap-1.5 text-[13px] leading-5 text-stone-500">
                <Target size={14} className="mt-0.5 flex-shrink-0 text-stone-400" aria-hidden="true" />
                <span className="line-clamp-2">{objectiveTitleFor(suggestion)}</span>
              </p>
            }
          />
        ))}
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <SegmentedControl
          label="Draft status"
          size="sm"
          value={status}
          onChange={onStatusChange}
          options={DRAFT_STATUS_OPTIONS.map((option) => ({
            ...option,
            count: counts[option.value],
          }))}
        />
        <IconButton
          icon={RefreshCw}
          label="Refresh drafts"
          size="sm"
          disabled={isLoading}
          onClick={onRefresh}
        />
      </div>
      {renderBody()}
    </div>
  );
};

export default CourseDraftsCard;
