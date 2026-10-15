import React, { createContext, useCallback, useContext, useEffect, useId, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Button, cn } from '@/components/ui';

/*
 * Small building blocks shared by the Settings sections (App status, App
 * versions, AI prompts): the section context that feeds the settings nav, a
 * bordered settings card, the sticky save bar, an inline switch and a toast.
 */

// --- Section context ----------------------------------------------------------

export interface SettingsSectionContextValue {
  /** Marks the section as having unsaved edits (an amber dot in the settings nav). */
  setDirty: (dirty: boolean) => void;
  /** Hides the settings header and nav so an editor can use the full width. */
  setFocused: (focused: boolean) => void;
}

const noop = () => {};

export const SettingsSectionContext = createContext<SettingsSectionContextValue>({
  setDirty: noop,
  setFocused: noop,
});

/** Reports unsaved edits to the settings nav and warns before the tab closes. */
export const useUnsavedChanges = (dirty: boolean) => {
  const { setDirty } = useContext(SettingsSectionContext);

  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);

  useEffect(() => () => setDirty(false), [setDirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
};

/** Puts the settings page into a focused, full-width mode while `focused`. */
export const useSettingsFocus = (focused: boolean) => {
  const { setFocused } = useContext(SettingsSectionContext);
  useEffect(() => {
    setFocused(focused);
    return () => setFocused(false);
  }, [focused, setFocused]);
};

/** The page sheet is the scroll container (see the page contract). */
export const scrollPageToTop = () => {
  document.getElementById('page-scroll')?.scrollTo({ top: 0 });
};

// --- Card ---------------------------------------------------------------------

interface SettingsCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Badges or counts next to the title. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Defaults to `p-5`; pass `p-0` for edge-to-edge divided rows. */
  bodyClassName?: string;
}

/** A calm bordered card: title row, then the body. */
export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  meta,
  actions,
  children,
  className,
  bodyClassName = 'p-5',
}) => {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn('rounded-xl border border-stone-200 bg-white shadow-card', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-stone-100 px-5 py-4">
        <div className="min-w-[min(100%,16rem)] flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id={titleId} className="text-[15px] font-semibold text-stone-900">
              {title}
            </h3>
            {meta}
          </div>
          {description && (
            <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-stone-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
};

// --- Save bar -----------------------------------------------------------------

interface SaveBarProps {
  dirty: boolean;
  saving?: boolean;
  onDiscard: () => void;
  /** Omit to make the save button submit the surrounding form. */
  onSave?: () => void;
  saveLabel: string;
  /** Whether the save button is enabled; defaults to `dirty`. */
  canSave?: boolean;
  dirtyText?: string;
  cleanText?: string;
  /** A save error; replaces the status text. */
  error?: string | null;
  className?: string;
}

/** Sticks to the bottom of the page while its section is on screen. */
export const SaveBar: React.FC<SaveBarProps> = ({
  dirty,
  saving = false,
  onDiscard,
  onSave,
  saveLabel,
  canSave,
  dirtyText = 'Unsaved changes',
  cleanText = 'All changes saved',
  error,
  className,
}) => (
  <div
    className={cn(
      'sticky bottom-4 z-10 mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-white/95 px-4 py-3 backdrop-blur transition-shadow',
      error
        ? 'border-red-200 shadow-pop'
        : dirty
          ? 'border-stone-300 shadow-pop'
          : 'border-stone-200 shadow-card',
      className,
    )}
  >
    <div role="status" className="mr-auto flex min-w-0 flex-1 items-start gap-2 text-[13px]">
      {error ? (
        <>
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-red-500" />
          <span className="line-clamp-2 text-red-700">{error}</span>
        </>
      ) : dirty ? (
        <>
          <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="font-medium text-stone-800">{dirtyText}</span>
        </>
      ) : (
        <>
          <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-brand-600" />
          <span className="text-stone-500">{cleanText}</span>
        </>
      )}
    </div>
    <div className="flex items-center gap-2">
      <Button variant="ghost" onClick={onDiscard} disabled={!dirty || saving}>
        Discard
      </Button>
      <Button
        variant="primary"
        type={onSave ? 'button' : 'submit'}
        onClick={onSave}
        disabled={!(canSave ?? dirty)}
        loading={saving}
      >
        {saveLabel}
      </Button>
    </div>
  </div>
);

// --- Inline switch ------------------------------------------------------------

interface InlineSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Overrides the visible label as the accessible name. */
  ariaLabel?: string;
  disabled?: boolean;
}

/** A compact toggle with its label on the right, for settings inside a row. */
export const InlineSwitch: React.FC<InlineSwitchProps> = ({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled,
}) => {
  const id = useId();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-stone-300',
        )}
      >
        <span
          className={cn(
            'inline-block h-3 w-3 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer select-none text-[13px] text-stone-700">
        {label}
      </label>
    </span>
  );
};

// --- Toast --------------------------------------------------------------------

/** Page-level success message that dismisses itself. */
export const useToast = (duration = 3500) => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), duration);
    return () => window.clearTimeout(timer);
  }, [duration, message]);

  const show = useCallback((text: string) => setMessage(text), []);
  const dismiss = useCallback(() => setMessage(null), []);

  return { message, show, dismiss };
};

export const Toast: React.FC<{ message: string | null; onDismiss: () => void }> = ({
  message,
  onDismiss,
}) =>
  message ? (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-24 left-1/2 z-[140] w-[min(92vw,420px)] -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-pop animate-dialog-in">
        <CheckCircle2 size={16} className="flex-shrink-0 text-brand-400" />
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded p-0.5 text-stone-400 transition hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  ) : null;

// --- Formatting ---------------------------------------------------------------

export const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export const plural = (count: number, word: string, pluralWord = `${word}s`) =>
  `${count.toLocaleString()} ${count === 1 ? word : pluralWord}`;
