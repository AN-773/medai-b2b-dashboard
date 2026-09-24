import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Mail,
  MessageSquare,
  Smartphone,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { DeliveryStatus, NotificationChannel } from '@/services/notificationService';
import {
  Badge,
  Button,
  IconButton,
  InlineAlert,
  Spinner,
  StatusDot,
  cn,
  controlClass,
  type BadgeTone,
} from '@/components/ui';

/* -------------------------------------------------------------------------- */
/* Class names kept for compatibility — new code uses `@/components/ui`.       */
/* -------------------------------------------------------------------------- */

export const inputClass = cn(controlClass, 'py-2');

export const labelClass = 'text-[13px] font-medium text-stone-700';

export const primaryButtonClass =
  'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-stone-900 px-3.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300';

export const secondaryButtonClass =
  'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 text-sm font-medium text-stone-800 shadow-card transition-colors hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400';

/* -------------------------------------------------------------------------- */
/* Channels and delivery statuses                                              */
/* -------------------------------------------------------------------------- */

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  email: 'Email',
  push: 'Push',
  teams: 'Teams',
};

export const CHANNEL_ICON: Record<NotificationChannel, LucideIcon> = {
  email: Mail,
  push: Smartphone,
  teams: MessageSquare,
};

export const channelLabel = (channel: string): string =>
  CHANNEL_LABEL[channel as NotificationChannel] ?? channel;

export const DELIVERY_STATUS_TONE: Record<DeliveryStatus, BadgeTone> = {
  sent: 'green',
  failed: 'red',
  skipped: 'amber',
  pending: 'neutral',
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  sent: 'Sent',
  failed: 'Failed',
  skipped: 'Skipped',
  pending: 'Pending',
};

/** Delivery status for dense rows: a coloured dot and the word. */
export const StatusBadge: React.FC<{ status: DeliveryStatus }> = ({ status }) => (
  <StatusDot tone={DELIVERY_STATUS_TONE[status] ?? 'neutral'}>
    {DELIVERY_STATUS_LABEL[status] ?? status}
  </StatusDot>
);

/** Channels are categories, not states, so they stay neutral with an icon. */
export const ChannelBadge: React.FC<{ channel: NotificationChannel }> = ({ channel }) => (
  <Badge icon={CHANNEL_ICON[channel]}>{channelLabel(channel)}</Badge>
);

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

export const ErrorBanner: React.FC<{ message: string }> = ({ message }) => {
  if (!message) return null;
  return <InlineAlert className="break-words">{message}</InlineAlert>;
};

/** A bordered card with a small header — for grouped content inside a tab. */
export const Panel: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, actions, children }) => (
  <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </header>
    {children}
  </section>
);

/* -------------------------------------------------------------------------- */
/* Tables                                                                      */
/* -------------------------------------------------------------------------- */

export const thClass = 'whitespace-nowrap px-4 py-2.5 text-xs font-medium text-stone-500';
export const tdClass = 'px-4 py-2.5';

export interface TableColumn {
  label: string;
  className?: string;
  /** Visually hidden header, e.g. for an actions column. */
  srOnly?: boolean;
}

/** One bordered card holding a dense `text-[13px]` table and its footer. */
export const DataTable: React.FC<{
  label: string;
  columns: TableColumn[];
  /** Dims the rows while a refetch is in flight. */
  busy?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, columns, busy = false, footer, children }) => (
  <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
    <div className="overflow-x-auto custom-scrollbar">
      <table
        aria-label={label}
        aria-busy={busy || undefined}
        className="w-full border-collapse text-left text-[13px] text-stone-700"
      >
        <thead className="border-b border-stone-200 bg-stone-50/70">
          <tr>
            {columns.map((column) => (
              <th key={column.label} scope="col" className={cn(thClass, column.className)}>
                {column.srOnly ? <span className="sr-only">{column.label}</span> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          className={cn(
            'divide-y divide-stone-100 transition-opacity',
            busy && 'pointer-events-none opacity-50',
          )}
        >
          {children}
        </tbody>
      </table>
    </div>
    {footer}
  </div>
);

export const TableMessage: React.FC<{ colSpan: number; children: React.ReactNode }> = ({
  colSpan,
  children,
}) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-2 text-center text-[13px] text-stone-500">
      {children}
    </td>
  </tr>
);

export const LoadingRow: React.FC<{ colSpan: number; label: string }> = ({ colSpan, label }) => (
  <tr>
    <td colSpan={colSpan}>
      <Spinner label={label} className="py-14" />
    </td>
  </tr>
);

/** Table footer: the visible range and Previous / Next. */
export const Pagination: React.FC<{
  offset: number;
  limit: number;
  total: number;
  disabled?: boolean;
  onChange: (offset: number) => void;
}> = ({ offset, limit, total, disabled = false, onChange }) => {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const hasPages = total > limit || offset > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-2.5">
      <p className="text-[13px] tabular-nums text-stone-500">
        {total === 0
          ? 'No results'
          : `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
      </p>
      {hasPages && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            icon={ChevronLeft}
            onClick={() => onChange(Math.max(0, offset - limit))}
            disabled={disabled || offset <= 0}
          >
            Previous
          </Button>
          <Button
            size="sm"
            iconRight={ChevronRight}
            onClick={() => onChange(offset + limit)}
            disabled={disabled || offset + limit >= total}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Small pieces                                                                */
/* -------------------------------------------------------------------------- */

/** Copies a value (IDs, tokens) and confirms with a check for a moment. */
export const CopyButton: React.FC<{ value: string; label: string; className?: string }> = ({
  value,
  label,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <IconButton
      icon={copied ? Check : Copy}
      label={copied ? 'Copied' : label}
      size="sm"
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        if (!navigator.clipboard) return;
        navigator.clipboard
          .writeText(value)
          .then(() => setCopied(true))
          .catch(() => undefined);
      }}
    />
  );
};

/** Success feedback for a finished action. Auto-dismisses after a few seconds. */
export const useToast = () => {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string) => {
    counter.current += 1;
    setToast({ id: counter.current, message });
  }, []);

  const node = toast
    ? createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-5 left-1/2 z-[140] w-[min(92vw,420px)] -translate-x-1/2"
        >
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-pop animate-dialog-in"
          >
            <CheckCircle2 size={16} className="flex-shrink-0 text-brand-400" aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-stone-400 transition hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return { toast: node, showToast };
};

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

export const formatTimestamp = (value?: string | null): string =>
  value ? new Date(value).toLocaleString() : '—';

/** Go's zero time and unparsable values mean "not recorded". */
const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1970) return null;
  return date;
};

/** Compact form for dense tables: "Sep 24, 14:05" (year only when not this year). */
export const formatShortTimestamp = (value?: string | null): string => {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** A short timestamp with the full one on hover. */
export const Timestamp: React.FC<{ value?: string | null }> = ({ value }) => {
  const date = parseDate(value);
  if (!date || !value) return <span className="text-stone-400">—</span>;
  return (
    <time dateTime={value} title={formatTimestamp(value)} className="whitespace-nowrap tabular-nums">
      {formatShortTimestamp(value)}
    </time>
  );
};

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;

/**
 * The notification service returns plain-text errors; surface them verbatim
 * so an operator sees the service's own wording rather than a generic message.
 */
export const errorMessage = (error: unknown, fallback: string): string => {
  const message = (error as { message?: string })?.message?.trim();
  const status = (error as { status?: number })?.status;

  if (status === 401) {
    return (
      message ||
      'The notification service rejected your token. It needs NOTIFY_JWKS_URL set and your role listed in NOTIFY_ADMIN_ROLES.'
    );
  }
  if (message === 'API Error: No response received') {
    return 'Could not reach the notification service. Check VITE_NOTIFICATIONS_API_URL and that NOTIFY_CORS_ORIGINS allows this origin.';
  }
  return message || fallback;
};
