import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'progress';

export interface ToastMessage {
  message: string;
  type: ToastTone;
}

interface WorkbenchToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

/** Page-level feedback, bottom-centre. Sits above editor overlays and dialogs. */
const WorkbenchToast: React.FC<WorkbenchToastProps> = ({ toast, onDismiss }) => (
  <div
    aria-live="polite"
    className="pointer-events-none fixed bottom-5 left-1/2 z-[140] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2"
  >
    {toast &&
      (toast.type === 'error' ? (
        <div
          role="alert"
          className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-pop animate-dialog-in"
        >
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
          <p className="flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded p-0.5 text-red-400 transition hover:text-red-700"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-pop animate-dialog-in">
          {toast.type === 'progress' ? (
            <Loader2 size={16} className="flex-shrink-0 animate-spin text-stone-300" />
          ) : (
            <CheckCircle2 size={16} className="flex-shrink-0 text-brand-400" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded p-0.5 text-stone-400 transition hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      ))}
  </div>
);

export default WorkbenchToast;
