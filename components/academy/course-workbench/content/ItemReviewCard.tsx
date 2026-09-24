import React, { useEffect, useId, useState } from 'react';
import { Check, Pencil, Save, Sparkles, X } from 'lucide-react';
import {
  Badge,
  Button,
  cn,
  controlClass,
  Field,
  IconButton,
  Input,
  Textarea,
  type BadgeTone,
} from '@/components/ui';
import type { SuggestionStatus } from '@/types/CourseStudioTypes';
import type {
  ItemSuggestion,
  ItemSuggestionDraft,
  ItemSuggestionType,
} from '@/types/CourseAITypes';
import { MODALITIES } from '../ObjectiveItemsList';
import { ITEM_TYPE_META } from './contentConfig';

const STATUS_BADGE: Record<SuggestionStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: 'amber', label: 'Needs review' },
  accepted: { tone: 'green', label: 'Accepted' },
  rejected: { tone: 'neutral', label: 'Rejected' },
};

const cloneItemSuggestionDraft = (draft: ItemSuggestionDraft): ItemSuggestionDraft =>
  JSON.parse(JSON.stringify(draft)) as ItemSuggestionDraft;

const choiceLetter = (index: number) => String.fromCharCode(65 + index);

const getDraftEditError = (type: ItemSuggestionType, draft: ItemSuggestionDraft) => {
  if (type === 'mcq') {
    if (!draft.mcq?.stem.trim()) return 'Stem is required.';
    if (!draft.mcq.choices.length) return 'Choices are required.';
    if (draft.mcq.choices.some((choice) => !choice.content.trim())) {
      return 'Every choice needs text.';
    }
    const correctCount = draft.mcq.choices.filter((choice) => choice.isCorrect).length;
    if (correctCount !== 1) return 'Select exactly one correct option.';
  }
  if (type === 'saq') {
    if (!draft.saq?.question.trim()) return 'Question is required.';
    if (!draft.saq.answer.trim()) return 'Answer is required.';
  }
  if (type === 'flashcard') {
    if (!draft.flashcard?.front.trim()) return 'Front is required.';
    if (!draft.flashcard.back.trim()) return 'Back is required.';
  }
  if (type === 'lecture') {
    if (!draft.lecture?.title.trim()) return 'Title is required.';
    if (!draft.lecture.summary.trim()) return 'Summary is required.';
    if (!draft.lecture.content.trim()) return 'Content is required.';
  }
  return null;
};

// --- Read-only draft ---------------------------------------------------------

const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-1 text-xs font-medium text-stone-500">{children}</p>
);

export const ItemDraftBody: React.FC<{ suggestion: ItemSuggestion }> = ({ suggestion }) => {
  const { draft, type } = suggestion;

  if (type === 'mcq' && draft.mcq) {
    return (
      <div className="space-y-2.5">
        <p className="text-sm font-medium leading-6 text-stone-900">{draft.mcq.stem}</p>
        <ul className="space-y-1.5">
          {draft.mcq.choices.map((choice, index) => (
            <li
              key={index}
              className={cn(
                'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-[13px] leading-5',
                choice.isCorrect
                  ? 'border-brand-200 bg-brand-50 text-brand-900'
                  : 'border-stone-200 bg-white text-stone-700',
              )}
            >
              <span
                className={cn(
                  'w-4 flex-shrink-0 font-medium',
                  choice.isCorrect ? 'text-brand-700' : 'text-stone-400',
                )}
              >
                {choiceLetter(index)}
              </span>
              <span className="min-w-0 flex-1">{choice.content}</span>
              {choice.isCorrect && (
                <>
                  <Check size={14} className="mt-0.5 flex-shrink-0 text-brand-700" aria-hidden="true" />
                  <span className="sr-only">(correct answer)</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (type === 'saq' && draft.saq) {
    return (
      <div className="space-y-2.5">
        <p className="text-sm font-medium leading-6 text-stone-900">{draft.saq.question}</p>
        <div className="rounded-lg bg-stone-50 px-3 py-2">
          <Caption>Model answer</Caption>
          <p className="text-[13px] leading-5 text-stone-700">{draft.saq.answer}</p>
        </div>
      </div>
    );
  }

  if (type === 'flashcard' && draft.flashcard) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
          <Caption>Front</Caption>
          <p className="text-sm font-medium leading-6 text-stone-900">{draft.flashcard.front}</p>
        </div>
        <div className="rounded-lg bg-stone-50 px-3 py-2">
          <Caption>Back</Caption>
          <p className="text-[13px] leading-5 text-stone-700">{draft.flashcard.back}</p>
        </div>
      </div>
    );
  }

  if (type === 'lecture' && draft.lecture) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium leading-6 text-stone-900">{draft.lecture.title}</p>
        <p className="text-[13px] leading-5 text-stone-500">{draft.lecture.summary}</p>
        <p className="line-clamp-3 text-[13px] leading-5 text-stone-700">{draft.lecture.content}</p>
      </div>
    );
  }

  return null;
};

// --- Inline editor -----------------------------------------------------------

export const ItemDraftEditor: React.FC<{
  suggestion: ItemSuggestion;
  draft: ItemSuggestionDraft;
  setDraft: React.Dispatch<React.SetStateAction<ItemSuggestionDraft>>;
}> = ({ suggestion, draft, setDraft }) => {
  const radioName = useId();

  if (suggestion.type === 'mcq' && draft.mcq) {
    const updateMCQ = (next: NonNullable<ItemSuggestionDraft['mcq']>) =>
      setDraft((current) => ({ ...current, mcq: next }));
    return (
      <div className="space-y-4">
        <Field label="Stem">
          {(id) => (
            <Textarea
              id={id}
              value={draft.mcq!.stem}
              onChange={(event) => updateMCQ({ ...draft.mcq!, stem: event.target.value })}
              rows={3}
            />
          )}
        </Field>
        <fieldset>
          <legend className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium text-stone-700">
            Choices
            <span className="font-normal text-stone-400">Select the correct answer</span>
          </legend>
          <div className="space-y-2">
            {draft.mcq.choices.map((choice, index) => (
              <div
                key={index}
                className={cn(
                  controlClass,
                  'flex items-center gap-2.5 py-1.5 focus-within:border-brand-500 focus-within:ring-[3px] focus-within:ring-brand-500/15',
                )}
              >
                <input
                  type="radio"
                  name={radioName}
                  checked={choice.isCorrect}
                  aria-label={`Mark choice ${choiceLetter(index)} as correct`}
                  onChange={() =>
                    updateMCQ({
                      ...draft.mcq!,
                      choices: draft.mcq!.choices.map((candidate, choiceIndex) => ({
                        ...candidate,
                        isCorrect: choiceIndex === index,
                      })),
                    })
                  }
                  className="h-4 w-4 flex-shrink-0 cursor-pointer accent-brand-600"
                />
                <span className="w-4 flex-shrink-0 text-[13px] font-medium text-stone-400">
                  {choiceLetter(index)}
                </span>
                <input
                  value={choice.content}
                  aria-label={`Choice ${choiceLetter(index)}`}
                  onChange={(event) =>
                    updateMCQ({
                      ...draft.mcq!,
                      choices: draft.mcq!.choices.map((candidate, choiceIndex) =>
                        choiceIndex === index
                          ? { ...candidate, content: event.target.value }
                          : candidate,
                      ),
                    })
                  }
                  className="min-w-0 flex-1 bg-transparent py-0.5 text-sm text-stone-900 outline-none"
                />
              </div>
            ))}
          </div>
        </fieldset>
      </div>
    );
  }

  if (suggestion.type === 'saq' && draft.saq) {
    return (
      <div className="space-y-4">
        <Field label="Question">
          {(id) => (
            <Textarea
              id={id}
              value={draft.saq!.question}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  saq: { ...current.saq!, question: event.target.value },
                }))
              }
              rows={2}
            />
          )}
        </Field>
        <Field label="Model answer">
          {(id) => (
            <Textarea
              id={id}
              value={draft.saq!.answer}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  saq: { ...current.saq!, answer: event.target.value },
                }))
              }
              rows={3}
            />
          )}
        </Field>
      </div>
    );
  }

  if (suggestion.type === 'flashcard' && draft.flashcard) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Front">
          {(id) => (
            <Textarea
              id={id}
              value={draft.flashcard!.front}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  flashcard: { ...current.flashcard!, front: event.target.value },
                }))
              }
              rows={3}
            />
          )}
        </Field>
        <Field label="Back">
          {(id) => (
            <Textarea
              id={id}
              value={draft.flashcard!.back}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  flashcard: { ...current.flashcard!, back: event.target.value },
                }))
              }
              rows={3}
            />
          )}
        </Field>
      </div>
    );
  }

  if (suggestion.type === 'lecture' && draft.lecture) {
    return (
      <div className="space-y-4">
        <Field label="Title">
          {(id) => (
            <Input
              id={id}
              value={draft.lecture!.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  lecture: { ...current.lecture!, title: event.target.value },
                }))
              }
            />
          )}
        </Field>
        <Field label="Summary">
          {(id) => (
            <Textarea
              id={id}
              value={draft.lecture!.summary}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  lecture: { ...current.lecture!, summary: event.target.value },
                }))
              }
              rows={2}
            />
          )}
        </Field>
        <Field label="Content">
          {(id) => (
            <Textarea
              id={id}
              value={draft.lecture!.content}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  lecture: { ...current.lecture!, content: event.target.value },
                }))
              }
              rows={6}
            />
          )}
        </Field>
      </div>
    );
  }

  return null;
};

// --- Review card ---------------------------------------------------------------

interface ItemReviewCardProps {
  suggestion: ItemSuggestion;
  isBusy: boolean;
  /** Locks actions while a bulk accept/reject is running. */
  locked?: boolean;
  onSave: (draft: ItemSuggestionDraft) => Promise<boolean>;
  onAccept: () => void;
  onReject: () => void;
  /** Optional context line above the draft, e.g. the objective it belongs to. */
  context?: React.ReactNode;
}

/** One AI draft: read view with Accept / Reject, or an inline editor. */
const ItemReviewCard: React.FC<ItemReviewCardProps> = ({
  suggestion,
  isBusy,
  locked = false,
  onSave,
  onAccept,
  onReject,
  context,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<ItemSuggestionDraft>(() =>
    cloneItemSuggestionDraft(suggestion.draft),
  );

  useEffect(() => {
    setIsEditing(false);
    setEditDraft(cloneItemSuggestionDraft(suggestion.draft));
  }, [suggestion.id, suggestion.draft, suggestion.updatedAt]);

  const editError = isEditing ? getDraftEditError(suggestion.type, editDraft) : null;
  // Disabled while this card is processing, or a bulk op is running.
  const actionsDisabled = isBusy || locked;
  const isPending = suggestion.status === 'pending';
  const modality = MODALITIES.find((candidate) => candidate.type === suggestion.type);
  const status = STATUS_BADGE[suggestion.status];

  const handleSave = async () => {
    if (editError) return;
    const ok = await onSave(editDraft);
    if (ok) setIsEditing(false);
  };

  return (
    <article className="px-4 py-4">
      {context}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Badge tone="violet" icon={Sparkles}>
          AI draft
        </Badge>
        <Badge tone="neutral" icon={modality?.icon} title={ITEM_TYPE_META[suggestion.type].label}>
          {ITEM_TYPE_META[suggestion.type].short}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          {isPending && !isEditing && (
            <IconButton
              icon={Pencil}
              label="Edit draft"
              size="sm"
              disabled={actionsDisabled}
              onClick={() => setIsEditing(true)}
            />
          )}
        </div>
      </div>

      {isEditing ? (
        <ItemDraftEditor suggestion={suggestion} draft={editDraft} setDraft={setEditDraft} />
      ) : (
        <ItemDraftBody suggestion={suggestion} />
      )}

      {editError && <p className="mt-2 text-xs text-red-600">{editError}</p>}

      {isPending && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="primary"
                size="sm"
                icon={Save}
                loading={isBusy}
                disabled={actionsDisabled || Boolean(editError)}
                onClick={() => void handleSave()}
              >
                Save draft
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={actionsDisabled}
                onClick={() => {
                  setEditDraft(cloneItemSuggestionDraft(suggestion.draft));
                  setIsEditing(false);
                }}
              >
                Discard changes
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                icon={Check}
                loading={isBusy}
                disabled={actionsDisabled}
                onClick={onAccept}
              >
                Accept
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                disabled={actionsDisabled}
                onClick={onReject}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      )}
    </article>
  );
};

export default ItemReviewCard;
