import React, { useState } from 'react';
import { Check, ChevronDown, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button, IconButton, Menu, cn } from '@/components/ui';
import type { FacultyFeedbackBody, FacultyFlag, FacultyRating } from '@/services/facultyChatWire';

export type SubmitFeedback = (body: FacultyFeedbackBody) => Promise<void>;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

/** Tracks one verdict: what was chosen, and whether it reached the server. */
const useVerdict = <T,>(submit: (choice: T) => Promise<void>) => {
  const [choice, setChoice] = useState<T | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');

  const choose = async (next: T) => {
    setChoice(next);
    setStatus('saving');
    try {
      await submit(next);
      setStatus('saved');
    } catch {
      setStatus('failed');
    }
  };

  return { choice, status, choose };
};

interface AnswerRatingProps {
  operationId: string;
  onSubmit: SubmitFeedback;
}

/** Thumbs under an answer. */
export const AnswerRating: React.FC<AnswerRatingProps> = ({ operationId, onSubmit }) => {
  const { choice, status, choose } = useVerdict<FacultyRating>((rating) => onSubmit({ operationId, rating }));

  const pressed = (rating: FacultyRating) =>
    choice === rating && status !== 'failed' ? 'bg-stone-100 text-stone-900' : undefined;

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-[13px] text-stone-500">Was this useful?</span>
      <IconButton
        icon={ThumbsUp}
        label="Useful answer"
        size="sm"
        aria-pressed={choice === 'up'}
        disabled={status === 'saving'}
        className={pressed('up')}
        onClick={() => void choose('up')}
      />
      <IconButton
        icon={ThumbsDown}
        label="Not a useful answer"
        size="sm"
        aria-pressed={choice === 'down'}
        disabled={status === 'saving'}
        className={pressed('down')}
        onClick={() => void choose('down')}
      />
      <span role="status" className="ml-1 text-[13px] text-stone-500">
        {status === 'saved' && 'Thanks for your feedback.'}
        {status === 'failed' && <span className="text-red-700">Couldn’t save that. Please try again.</span>}
      </span>
    </div>
  );
};

const FLAG_OPTIONS: { value: FacultyFlag; label: string }[] = [
  { value: 'useful', label: 'Useful' },
  { value: 'not_useful', label: 'Not useful' },
  { value: 'incorrectly_flagged', label: 'Incorrectly flagged' },
];

interface LearnerFlagFeedbackProps {
  operationId: string;
  queryId: string;
  learnerId: string;
  onSubmit: SubmitFeedback;
}

/** On a student marked "needs attention": was that flag right? */
export const LearnerFlagFeedback: React.FC<LearnerFlagFeedbackProps> = ({
  operationId,
  queryId,
  learnerId,
  onSubmit,
}) => {
  const { choice, status, choose } = useVerdict<FacultyFlag>((flag) =>
    onSubmit({ operationId, queryId, learnerId, flag }),
  );
  const chosen = FLAG_OPTIONS.find((option) => option.value === choice);

  return (
    <Menu
      label="Feedback on this flag"
      align="end"
      items={FLAG_OPTIONS.map((option) => ({
        label: option.label,
        icon: option.value === choice ? Check : undefined,
        onSelect: () => void choose(option.value),
      }))}
      trigger={(props) => (
        <Button
          {...props}
          size="sm"
          variant="ghost"
          iconRight={ChevronDown}
          loading={status === 'saving'}
          aria-label={chosen ? `Feedback on this flag: ${chosen.label}` : 'Feedback on this flag'}
          className={cn(status === 'failed' && 'text-red-700 hover:text-red-700')}
        >
          {status === 'failed' ? 'Not saved' : (chosen?.label ?? 'Rate flag')}
        </Button>
      )}
    />
  );
};
