import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';

interface CohortToastsProps {
  message: string | null;
  error: string | null;
  /** Shows a quiet "Saving…" pill while a cohort request is in flight. */
  isSaving: boolean;
  onDismissMessage: () => void;
  onDismissError: () => void;
}

/** Bottom-centre toast stack: page-level success, action errors and a saving hint. */
const CohortToasts: React.FC<CohortToastsProps> = ({
  message,
  error,
  isSaving,
  onDismissMessage,
  onDismissError,
}) => {
  if (!message && !error && !isSaving) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[150] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-2"
    >
      {isSaving && !message && (
        <div className="flex items-center gap-2 rounded-lg bg-stone-900 px-3.5 py-2 text-[13px] text-white shadow-pop animate-fade-in">
          <Loader2 size={14} className="animate-spin text-brand-400" />
          Saving…
        </div>
      )}
      {message && (
        <div
          role="status"
          className="pointer-events-auto flex w-full items-center gap-2.5 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-pop animate-dialog-in"
        >
          <CheckCircle2 size={16} className="flex-shrink-0 text-brand-400" />
          <span className="flex-1">{message}</span>
          <button
            type="button"
            onClick={onDismissMessage}
            aria-label="Dismiss"
            className="rounded p-0.5 text-stone-400 transition hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-pop animate-dialog-in"
        >
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss"
            className="rounded p-0.5 text-red-400 transition hover:text-red-700"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CohortToasts;
