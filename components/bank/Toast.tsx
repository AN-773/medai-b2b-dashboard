import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

/** A single page-level toast that clears itself after a few seconds. */
export const useToast = (duration = 3200) => {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback(
    (text: string, tone: ToastMessage['tone'] = 'success') => {
      if (timer.current) window.clearTimeout(timer.current);
      setToast({ id: Date.now(), text, tone });
      timer.current = window.setTimeout(() => setToast(null), duration);
    },
    [duration],
  );

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return { toast, showToast, dismiss };
};

export const Toast: React.FC<{ toast: ToastMessage | null; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => (
  <div
    aria-live="polite"
    className="pointer-events-none fixed bottom-5 left-1/2 z-[140] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2"
  >
    {toast &&
      (toast.tone === 'success' ? (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-pop animate-dialog-in"
        >
          <CheckCircle2 size={16} className="flex-shrink-0 text-brand-400" aria-hidden="true" />
          <span className="flex-1">{toast.text}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded p-0.5 text-stone-400 transition hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          key={toast.id}
          role="alert"
          className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-pop animate-dialog-in"
        >
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-red-500" aria-hidden="true" />
          <p className="flex-1">{toast.text}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded p-0.5 text-red-400 transition hover:text-red-700"
          >
            <X size={14} />
          </button>
        </div>
      ))}
  </div>
);
