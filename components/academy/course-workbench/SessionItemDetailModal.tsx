import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Circle, Hash, Layers, Target, X } from 'lucide-react';
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

const STATUS_STYLES: Record<BackendApiItem['status'], string> = {
  live: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-slate-100 text-slate-500 border-slate-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

const modalityByType = new Map(
  MODALITIES.map((modality) => [modality.type, modality] as const),
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="min-w-0">
    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
      {label}
    </p>
    <div className="mt-1.5 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-slate-700">
      {children}
    </div>
  </div>
);

const ItemBody: React.FC<{ item: SessionItemDetail }> = ({ item }) => {
  if (item.type === 'mcq' && item.mcq) {
    return (
      <div className="space-y-5">
        <Field label="Stem">{item.mcq.stem || 'No stem provided.'}</Field>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Choices
          </p>
          <ul className="mt-2 space-y-2">
            {item.mcq.choices.length === 0 ? (
              <li className="text-sm font-medium text-slate-400">
                No choices provided.
              </li>
            ) : (
              item.mcq.choices.map((choice, index) => (
                <li
                  key={choice.id || index}
                  className={`rounded-xl border px-3.5 py-3 ${
                    choice.isCorrect
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {choice.isCorrect ? (
                      <CheckCircle2
                        size={16}
                        className="mt-0.5 flex-shrink-0 text-emerald-600"
                      />
                    ) : (
                      <Circle
                        size={16}
                        className="mt-0.5 flex-shrink-0 text-slate-300"
                      />
                    )}
                    <span className="min-w-0 whitespace-pre-wrap break-words text-sm font-medium text-slate-700">
                      {choice.content || 'Empty choice'}
                    </span>
                  </div>
                  {choice.explanation && (
                    <p className="mt-2 whitespace-pre-wrap break-words border-t border-slate-100 pt-2 text-xs font-medium leading-5 text-slate-500">
                      {choice.explanation}
                    </p>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    );
  }

  if (item.type === 'saq' && item.saq) {
    return (
      <div className="space-y-5">
        <Field label="Question">
          {item.saq.question || 'No question provided.'}
        </Field>
        <Field label="Answer">{item.saq.answer || 'No answer provided.'}</Field>
      </div>
    );
  }

  if (item.type === 'lecture' && item.lecture) {
    return (
      <div className="space-y-5">
        {item.lecture.summary && (
          <Field label="Summary">{item.lecture.summary}</Field>
        )}
        <Field label="Content">
          {item.lecture.content || 'No content provided.'}
        </Field>
      </div>
    );
  }

  if (item.type === 'flashcard' && item.flashcard) {
    return (
      <div className="space-y-5">
        <Field label="Front">
          {item.flashcard.front || 'No front provided.'}
        </Field>
        <Field label="Back">{item.flashcard.back || 'No back provided.'}</Field>
      </div>
    );
  }

  return (
    <p className="text-sm font-medium text-slate-500">
      No additional details are available for this item.
    </p>
  );
};

const SessionItemDetailModal: React.FC<SessionItemDetailModalProps> = ({
  item,
  onClose,
}) => {
  useEffect(() => {
    if (!item) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;
  if (typeof document === 'undefined') return null;

  const modality = modalityByType.get(item.type);
  const Icon = modality?.icon || Layers;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-6">
          <div className="flex min-w-0 items-start gap-3.5">
            <span
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border ${modality?.badge || 'border-slate-200 bg-slate-50 text-slate-500'}`}
            >
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {modality?.label || item.type}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${STATUS_STYLES[item.status]}`}
                >
                  {item.status}
                </span>
              </div>
              <h2 className="mt-1.5 break-words text-lg font-black leading-6 text-slate-900">
                {itemTitle(item)}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-xs font-semibold text-slate-500">
          {item.objectiveTitle && (
            <span className="flex min-w-0 items-center gap-1.5">
              <Target size={13} className="flex-shrink-0 text-slate-400" />
              <span className="truncate">{item.objectiveTitle}</span>
            </span>
          )}
          {(item.identifier || item.id) && (
            <span className="flex min-w-0 items-center gap-1.5 font-mono">
              <Hash size={13} className="flex-shrink-0 text-slate-400" />
              <span className="truncate">
                {item.identifier || item.id.slice(0, 8)}
              </span>
            </span>
          )}
        </div>

        {/* Body */}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
          <ItemBody item={item} />

          {item.tags && item.tags.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Tags
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600"
                  >
                    {tag.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SessionItemDetailModal;
