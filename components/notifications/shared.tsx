import React from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  DeliveryStatus,
  NotificationChannel,
} from '../../services/notificationService';

export const inputClass =
  'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500';

export const labelClass =
  'text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]';

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

export const secondaryButtonClass =
  'inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const statusBadgeClass: Record<DeliveryStatus, string> = {
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  skipped: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const StatusBadge: React.FC<{ status: DeliveryStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize ${
      statusBadgeClass[status] ?? statusBadgeClass.pending
    }`}
  >
    {status}
  </span>
);

const channelBadgeClass: Record<NotificationChannel, string> = {
  email: 'bg-sky-50 text-sky-700 border-sky-200',
  push: 'bg-violet-50 text-violet-700 border-violet-200',
  teams: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export const ChannelBadge: React.FC<{ channel: NotificationChannel }> = ({ channel }) => (
  <span
    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize ${
      channelBadgeClass[channel] ?? 'bg-slate-100 text-slate-500 border-slate-200'
    }`}
  >
    {channel}
  </span>
);

export const ErrorBanner: React.FC<{ message: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-900">
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <p className="text-sm break-words">{message}</p>
    </div>
  );
};

export const Panel: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, actions, children }) => (
  <section className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
    <header className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
    {children}
  </section>
);

export const TableMessage: React.FC<{ colSpan: number; children: React.ReactNode }> = ({
  colSpan,
  children,
}) => (
  <tr>
    <td colSpan={colSpan} className="px-6 py-12 text-center text-slate-500 text-sm">
      {children}
    </td>
  </tr>
);

export const LoadingRow: React.FC<{ colSpan: number; label: string }> = ({ colSpan, label }) => (
  <TableMessage colSpan={colSpan}>
    <span className="inline-flex items-center gap-2">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </span>
  </TableMessage>
);

export const Pagination: React.FC<{
  offset: number;
  limit: number;
  total: number;
  disabled?: boolean;
  onChange: (offset: number) => void;
}> = ({ offset, limit, total, disabled = false, onChange }) => {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        {total === 0 ? 'No results' : `Showing ${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, offset - limit))}
          disabled={disabled || offset <= 0}
          className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <button
          type="button"
          onClick={() => onChange(offset + limit)}
          disabled={disabled || offset + limit >= total}
          className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export const formatTimestamp = (value?: string | null): string =>
  value ? new Date(value).toLocaleString() : '—';

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
