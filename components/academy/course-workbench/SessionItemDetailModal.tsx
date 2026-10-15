import React from 'react';
import { CheckCircle2, Hash, Layers, Target } from 'lucide-react';
import { Badge, Button, Dialog, cn, type BadgeTone } from '@/components/ui';
import type { BackendApiItem } from '@/types/TestsServiceTypes';
import {
  itemTitle,
  MODALITIES,
} from '@/components/academy/course-workbench/ObjectiveItemsList';

export interface SessionItemDetail extends BackendApiItem {
  objectiveTitle?: string;
}

interface SessionItemDetailModalProps {
  item: SessionItemDetail | null;
  onClose: () => void;
}

const STATUS_TONES: Record<BackendApiItem['status'], BadgeTone> = {
  live: 'green',
  draft: 'neutral',
  pending: 'amber',
};

const TYPE_NAMES: Record<string, string> = {
  mcq: 'Multiple-choice question',
  saq: 'Short-answer question',
  flashcard: 'Flashcard',
  lecture: 'Lecture',
};

const modalityByType = new Map(
  MODALITIES.map((modality) => [modality.type, modality] as const),
);

const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const Section: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className,
}) => (
  <section className={cn('min-w-0', className)}>
    <h3 className="text-[13px] font-medium text-stone-500">{label}</h3>
    <div className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-stone-700">
      {children}
    </div>
  </section>
);

const Missing: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-stone-400">{children}</span>
);

const McqBody: React.FC<{ mcq: NonNullable<BackendApiItem['mcq']> }> = ({ mcq }) => (
  <div className="space-y-5">
    <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-stone-900">
      {mcq.stem || <Missing>No stem provided.</Missing>}
    </p>
    <section>
      <h3 className="text-[13px] font-medium text-stone-500">Choices</h3>
      {mcq.choices.length === 0 ? (
        <p className="mt-1.5 text-sm text-stone-400">No choices provided.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {mcq.choices.map((choice, index) => (
            <li
              key={choice.id || index}
              className={cn(
                'rounded-lg border px-3.5 py-3',
                choice.isCorrect ? 'border-brand-300 bg-brand-50' : 'border-stone-200 bg-white',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium',
                    choice.isCorrect ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600',
                  )}
                  aria-hidden="true"
                >
                  {choice.isCorrect ? <CheckCircle2 size={13} /> : String.fromCharCode(65 + index)}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6',
                    choice.isCorrect ? 'text-brand-900' : 'text-stone-700',
                  )}
                >
                  {choice.content || <Missing>Empty choice</Missing>}
                </span>
                {choice.isCorrect && (
                  <span className="mt-0.5 flex-shrink-0 text-xs font-medium text-brand-700">
                    Correct
                  </span>
                )}
              </div>
              {choice.explanation && (
                <p
                  className={cn(
                    'ml-8 mt-2 whitespace-pre-wrap break-words border-t pt-2 text-[13px] leading-5',
                    choice.isCorrect
                      ? 'border-brand-200 text-brand-900/80'
                      : 'border-stone-100 text-stone-500',
                  )}
                >
                  {choice.explanation}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  </div>
);

const ItemBody: React.FC<{ item: SessionItemDetail }> = ({ item }) => {
  if (item.type === 'mcq' && item.mcq) return <McqBody mcq={item.mcq} />;

  if (item.type === 'saq' && item.saq) {
    return (
      <div className="space-y-5">
        <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-stone-900">
          {item.saq.question || <Missing>No question provided.</Missing>}
        </p>
        <section className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
          <h3 className="text-[13px] font-medium text-brand-800">Model answer</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-stone-800">
            {item.saq.answer || <Missing>No answer provided.</Missing>}
          </p>
        </section>
      </div>
    );
  }

  if (item.type === 'lecture' && item.lecture) {
    return (
      <div className="space-y-5">
        {item.lecture.summary && <Section label="Summary">{item.lecture.summary}</Section>}
        <Section label="Content">
          {item.lecture.content || <Missing>No content provided.</Missing>}
        </Section>
      </div>
    );
  }

  if (item.type === 'flashcard' && item.flashcard) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-stone-200 px-4 py-3">
          <h3 className="text-[13px] font-medium text-stone-500">Front</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-stone-900">
            {item.flashcard.front || <Missing>No front provided.</Missing>}
          </p>
        </section>
        <section className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <h3 className="text-[13px] font-medium text-stone-500">Back</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-stone-800">
            {item.flashcard.back || <Missing>No back provided.</Missing>}
          </p>
        </section>
      </div>
    );
  }

  return <p className="text-sm text-stone-500">No additional details are available for this item.</p>;
};

/** Read-only preview of one item (an existing item or an AI draft shaped like one). */
const SessionItemDetailModal: React.FC<SessionItemDetailModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  const modality = modalityByType.get(item.type);
  const title =
    item.type === 'lecture' && item.lecture?.title
      ? item.lecture.title
      : (TYPE_NAMES[item.type] ?? itemTitle(item));

  return (
    <Dialog
      open
      onClose={onClose}
      width="max-w-2xl"
      title={title}
      description={
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge icon={modality?.icon ?? Layers}>{modality?.label ?? item.type}</Badge>
          <Badge tone={STATUS_TONES[item.status] ?? 'neutral'} dot>
            {capitalize(item.status)}
          </Badge>
          {item.objectiveTitle && (
            <Badge icon={Target} title={item.objectiveTitle} className="max-w-full">
              <span className="min-w-0 truncate">{item.objectiveTitle}</span>
            </Badge>
          )}
          {(item.identifier || item.id) && (
            <Badge icon={Hash} className="font-mono">
              {item.identifier || item.id.slice(0, 8)}
            </Badge>
          )}
        </div>
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="custom-scrollbar -mx-6 -my-5 max-h-[min(60vh,640px)] overflow-y-auto px-6 py-5">
        <ItemBody item={item} />

        {item.tags && item.tags.length > 0 && (
          <div className="mt-6 border-t border-stone-100 pt-4">
            <h3 className="text-[13px] font-medium text-stone-500">Tags</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <Badge key={tag.id}>{tag.title}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default SessionItemDetailModal;
