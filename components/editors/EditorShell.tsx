import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Link as LinkIcon, X, type LucideIcon } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  IconButton,
  SegmentedControl,
  Select,
  Textarea,
  cn,
  type BadgeTone,
} from '@/components/ui';
import type { ApiItemStatus } from '@/types/TestsServiceTypes';

/* -------------------------------------------------------------------------- */
/* Dirty tracking                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Leaving an editor with unsaved edits asks first (in-app via ConfirmDialog,
 * and the browser's own prompt on reload/close).
 */
export const useLeaveGuard = (isDirty: boolean, onLeave: () => void) => {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const requestLeave = () => {
    if (isDirty) {
      setConfirming(true);
      return;
    }
    onLeave();
  };

  const leaveDialog = (
    <ConfirmDialog
      open={confirming}
      title="Discard changes?"
      description="Your edits to this item haven't been saved."
      confirmLabel="Discard"
      onConfirm={() => {
        setConfirming(false);
        onLeave();
      }}
      onCancel={() => setConfirming(false)}
    />
  );

  return { requestLeave, leaveDialog };
};

/* -------------------------------------------------------------------------- */
/* Header pieces                                                              */
/* -------------------------------------------------------------------------- */

export interface EditorHint {
  text: string;
  tone?: 'neutral' | 'amber';
}

const STATUS_OPTIONS: { value: ApiItemStatus; label: string; tone: BadgeTone }[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'pending', label: 'Pending', tone: 'amber' },
  { value: 'live', label: 'Live', tone: 'green' },
];

/** Status next to the editor title: a select for saved items, a badge for new ones. */
export const StatusControl: React.FC<{
  value: ApiItemStatus;
  editable: boolean;
  onChange: (status: ApiItemStatus) => void;
}> = ({ value, editable, onChange }) => {
  const id = useId();
  const option = STATUS_OPTIONS.find((candidate) => candidate.value === value) ?? STATUS_OPTIONS[0];
  if (!editable) {
    return (
      <Badge tone={option.tone} dot>
        {option.label}
      </Badge>
    );
  }
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <label htmlFor={id} className="text-[13px] text-stone-500">
        Status
      </label>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as ApiItemStatus)}
        className="w-auto"
      >
        {STATUS_OPTIONS.map((candidate) => (
          <option key={candidate.value} value={candidate.value}>
            {candidate.label}
          </option>
        ))}
      </Select>
    </div>
  );
};

/** Discard/Cancel + the one primary save, for the right side of the header. */
export const EditorSaveActions: React.FC<{
  isDirty: boolean;
  saving: boolean;
  saveLabel: string;
  onDiscard: () => void;
  onSave: () => void;
}> = ({ isDirty, saving, saveLabel, onDiscard, onSave }) => (
  <>
    <Button variant="ghost" onClick={onDiscard} disabled={saving}>
      {isDirty ? 'Discard' : 'Cancel'}
    </Button>
    <Button variant="primary" onClick={onSave} loading={saving}>
      {saveLabel}
    </Button>
  </>
);

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

interface EditorShellProps {
  /** Item type shown as a badge before the title. */
  kind: { label: string; icon: LucideIcon };
  title: string;
  identifier?: string | null;
  /** Usually a `StatusControl`. */
  status?: React.ReactNode;
  onBack: () => void;
  /** Short dirty / validation hint shown before the actions. */
  hint?: EditorHint | null;
  /** Right side of the header (Discard + Save, or a step indicator). */
  actions?: React.ReactNode;
  /** Errors shown directly under the header. */
  alert?: React.ReactNode;
  /** Sticky right-hand column (live learner preview). */
  aside?: React.ReactNode;
  /** Sticky bottom bar (wizards). */
  footer?: React.ReactNode;
  width?: 'wide' | 'narrow';
  children: React.ReactNode;
}

type Pane = 'edit' | 'preview';

/**
 * Full-screen item editor frame: a sticky header bar (back, type, title,
 * status, hint, actions) over a centred body — form sections on the left and
 * an optional sticky preview on the right (toggled on small screens).
 *
 * The host provides the canvas and its padding (`p-4 sm:p-6`); the header and
 * footer bands bleed into that padding so content never shows above or below
 * them while scrolling.
 */
export const EditorShell: React.FC<EditorShellProps> = ({
  kind,
  title,
  identifier,
  status,
  onBack,
  hint,
  actions,
  alert,
  aside,
  footer,
  width = 'wide',
  children,
}) => {
  const [pane, setPane] = useState<Pane>('edit');
  const KindIcon = kind.icon;

  return (
    <div
      className={cn(
        'mx-auto w-full',
        width === 'narrow' ? 'max-w-4xl' : 'max-w-6xl',
        !footer && 'pb-16',
      )}
    >
      <div className="sticky top-0 z-30 -mt-4 bg-canvas pb-4 pt-4 sm:-mt-6 sm:pt-6">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-stone-200 bg-white px-2.5 py-2.5 shadow-card sm:px-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <IconButton icon={ArrowLeft} label="Back" onClick={onBack} />
            <span aria-hidden="true" className="h-5 w-px flex-shrink-0 bg-stone-200" />
            <Badge icon={KindIcon} className="flex-shrink-0">
              {kind.label}
            </Badge>
            <h1 className="min-w-0 truncate text-[15px] font-semibold text-stone-900">{title}</h1>
            {identifier && (
              <span className="hidden flex-shrink-0 font-mono text-xs text-stone-500 md:inline">
                {identifier}
              </span>
            )}
            {status && <div className="flex-shrink-0">{status}</div>}
          </div>
          {(hint || actions) && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {hint && (
                <span className="hidden items-center gap-1.5 text-[13px] text-stone-500 md:inline-flex">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                      hint.tone === 'amber' ? 'bg-amber-500' : 'bg-stone-400',
                    )}
                  />
                  {hint.text}
                </span>
              )}
              {actions}
            </div>
          )}
        </header>
      </div>

      {alert && <div className="mb-4 space-y-2">{alert}</div>}

      {aside ? (
        <>
          <SegmentedControl<Pane>
            label="Editor view"
            value={pane}
            onChange={setPane}
            options={[
              { value: 'edit', label: 'Edit' },
              { value: 'preview', label: 'Preview' },
            ]}
            className="mb-4 lg:hidden"
          />
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start lg:gap-6">
            <div className={cn('min-w-0 space-y-6', pane === 'preview' && 'hidden lg:block')}>
              {children}
            </div>
            <aside
              aria-label="Preview"
              className={cn(
                'custom-scrollbar lg:sticky lg:top-[6.5rem] lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto',
                pane === 'edit' && 'hidden lg:block',
              )}
            >
              {aside}
            </aside>
          </div>
        </>
      ) : (
        <div className="space-y-6">{children}</div>
      )}

      {footer && (
        <div className="sticky bottom-0 z-20 -mb-4 bg-canvas pb-4 pt-4 sm:-mb-6 sm:pb-6">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 shadow-card">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Body pieces                                                                */
/* -------------------------------------------------------------------------- */

interface EditorSectionProps {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Badges next to the title. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Id of the section's single control — the title then labels it. */
  labelFor?: string;
  /** Body without padding, for divided lists that run edge to edge. */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** One calm bordered card in the editor form. */
export const EditorSection: React.FC<EditorSectionProps> = ({
  id,
  title,
  description,
  meta,
  actions,
  labelFor,
  flush = false,
  className,
  children,
}) => {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('scroll-mt-32 rounded-xl border border-stone-200 bg-white shadow-card', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-[15px] font-semibold text-stone-900">
              {labelFor ? <label htmlFor={labelFor}>{title}</label> : title}
            </h2>
            {meta}
          </div>
          {description && (
            <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      <div className={flush ? 'mt-4 border-t border-stone-100' : 'px-5 pb-5 pt-4'}>{children}</div>
    </section>
  );
};

/** Textarea that grows with its content (never shrinks below `minRows`). */
export const AutoGrowTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }
> = ({ minRows = 3, value, ...rest }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    const height = element.scrollHeight;
    // Hidden (e.g. the mobile preview pane) measures 0 — fall back to rows.
    element.style.height = height > 0 ? `${height + 2}px` : '';
  }, []);
  useLayoutEffect(resize, [value, resize]);
  useEffect(() => {
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);
  return <Textarea ref={ref} rows={minRows} value={value} {...rest} />;
};

/** An attached image or link, with a remove button. */
export const MediaAttachment: React.FC<{
  url: string;
  type?: string;
  label: string;
  onRemove: () => void;
  size?: 'sm' | 'md';
}> = ({ url, type, label, onRemove, size = 'md' }) => (
  <div className="inline-flex max-w-full items-start gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1.5">
    {type === 'hyperlink' ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-2 px-1.5 py-1 text-[13px] text-sky-700 hover:underline"
      >
        <LinkIcon size={14} className="flex-shrink-0 text-stone-500" aria-hidden="true" />
        <span className="truncate">{url}</span>
      </a>
    ) : (
      <img
        src={url}
        alt={label}
        className={cn(
          'rounded-md bg-white object-cover',
          size === 'sm' ? 'h-16 w-auto max-w-[10rem]' : 'max-h-56 w-auto max-w-full',
        )}
      />
    )}
    <IconButton icon={X} label={`Remove ${label.toLowerCase()}`} size="sm" onClick={onRemove} />
  </div>
);

export const choiceLetter = (index: number) => String.fromCharCode(65 + index);
