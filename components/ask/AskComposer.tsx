import React from 'react';
import { ArrowUp, Square, UsersRound, X } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';
import { MAX_TURN_MESSAGE_CHARS } from '@/services/facultyChatWire';

interface AskComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  /** A new question may be sent now. */
  canSend: boolean;
  /** An answer is being written: offer Stop instead of Ask. */
  isAnswering: boolean;
  /** What the question is about, when it was opened from a page. */
  contextLabel?: string | null;
  onClearContext?: () => void;
}

/** Where a dean types. Enter asks, Shift+Enter starts a new line. */
export const AskComposer: React.FC<AskComposerProps> = ({
  value,
  onChange,
  onSubmit,
  onStop,
  canSend,
  isAnswering,
  contextLabel,
  onClearContext,
}) => {
  const ready = canSend && value.trim() !== '';

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (ready) onSubmit();
  };

  return (
    <form
      className="flex-shrink-0 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSubmit();
      }}
    >
      {contextLabel && (
        <p className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-stone-100 py-1 pl-2 pr-1 text-[13px] text-stone-700">
          <UsersRound size={14} className="flex-shrink-0 text-stone-500" aria-hidden="true" />
          <span className="truncate">About {contextLabel}</span>
          {onClearContext && (
            <button
              type="button"
              onClick={onClearContext}
              aria-label="Stop asking about this cohort"
              title="Stop asking about this cohort"
              className="flex-shrink-0 rounded p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-700"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          dir="auto"
          rows={2}
          value={value}
          maxLength={MAX_TURN_MESSAGE_CHARS}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your curriculum and students"
          aria-label="Your question"
        />
        {isAnswering ? (
          <Button variant="secondary" icon={Square} onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" variant="primary" icon={ArrowUp} disabled={!ready}>
            Ask
          </Button>
        )}
      </div>
    </form>
  );
};
