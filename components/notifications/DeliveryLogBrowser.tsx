import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Search, X } from 'lucide-react';
import {
  DELIVERY_STATUSES,
  DeliveryLog,
  DeliverySearchParams,
  DeliveryStatus,
  NOTIFICATION_CHANNELS,
  NotificationChannel,
  notificationService,
} from '../../services/notificationService';
import {
  ChannelBadge,
  ErrorBanner,
  LoadingRow,
  Pagination,
  Panel,
  StatusBadge,
  TableMessage,
  errorMessage,
  formatTimestamp,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from './shared';

const PAGE_SIZE = 25;

const WINDOW_OPTIONS = [
  { label: 'All time', value: 0 },
  { label: 'Last 24 hours', value: 24 },
  { label: 'Last 7 days', value: 24 * 7 },
  { label: 'Last 30 days', value: 24 * 30 },
];

interface Filters {
  recipient: string;
  notificationId: string;
  channel: NotificationChannel | '';
  status: DeliveryStatus | '';
  windowHours: number;
}

const emptyFilters: Filters = {
  recipient: '',
  notificationId: '',
  channel: '',
  status: '',
  windowHours: 24,
};

const DeliveryLogBrowser: React.FC = () => {
  // `filters` is the form state; `applied` is what the last query used, so
  // typing in the search box does not refetch on every keystroke.
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [offset, setOffset] = useState(0);

  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState('');

  const load = useCallback(async (active: Filters, nextOffset: number) => {
    setIsLoading(true);
    setError('');

    const params: DeliverySearchParams = {
      recipient: active.recipient.trim() || undefined,
      notificationId: active.notificationId.trim() || undefined,
      channel: active.channel || undefined,
      status: active.status || undefined,
      windowHours: active.windowHours || undefined,
      limit: PAGE_SIZE,
      offset: nextOffset,
    };

    try {
      const page = await notificationService.searchDeliveries(params);
      setLogs(page.items || []);
      setTotal(page.total || 0);
    } catch (err) {
      console.error('Failed to load delivery log:', err);
      setLogs([]);
      setTotal(0);
      setError(errorMessage(err, 'Unable to load the delivery log.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(applied, offset);
  }, [load, applied, offset]);

  const applyFilters = (next: Filters) => {
    setApplied(next);
    setOffset(0);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    applyFilters(filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    applyFilters(emptyFilters);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Delivery Log</h3>
        <p className="text-sm text-slate-500">
          Every send attempt, including retries and sends skipped by the suppression list.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-2">
            <label htmlFor="delivery-recipient" className={labelClass}>
              Recipient
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="delivery-recipient"
                type="text"
                value={filters.recipient}
                onChange={(event) => setFilters({ ...filters, recipient: event.target.value })}
                placeholder="alice@example.com"
                className={`${inputClass} pl-11`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="delivery-notification-id" className={labelClass}>
              Notification ID
            </label>
            <input
              id="delivery-notification-id"
              type="text"
              value={filters.notificationId}
              onChange={(event) => setFilters({ ...filters, notificationId: event.target.value })}
              placeholder="Exact match"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="delivery-window" className={labelClass}>
              Time range
            </label>
            <select
              id="delivery-window"
              value={filters.windowHours}
              onChange={(event) =>
                setFilters({ ...filters, windowHours: Number(event.target.value) })
              }
              className={inputClass}
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="delivery-channel" className={labelClass}>
              Channel
            </label>
            <select
              id="delivery-channel"
              value={filters.channel}
              onChange={(event) =>
                setFilters({ ...filters, channel: event.target.value as NotificationChannel | '' })
              }
              className={inputClass}
            >
              <option value="">All channels</option>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="delivery-status" className={labelClass}>
              Status
            </label>
            <select
              id="delivery-status"
              value={filters.status}
              onChange={(event) =>
                setFilters({ ...filters, status: event.target.value as DeliveryStatus | '' })
              }
              className={inputClass}
            >
              <option value="">All statuses</option>
              {DELIVERY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-3">
            <button type="submit" disabled={isLoading} className={secondaryButtonClass}>
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Search
            </button>
            <button type="button" onClick={resetFilters} className={secondaryButtonClass}>
              <X size={16} />
              Reset
            </button>
          </div>
        </div>
      </form>

      <ErrorBanner message={error} />

      <Panel
        title="Results"
        description="Newest first. Select a row to see its error and idempotency key."
        actions={
          <button
            type="button"
            onClick={() => load(applied, offset)}
            disabled={isLoading}
            className={secondaryButtonClass}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Recipient</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Channel</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Attempt</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <LoadingRow colSpan={5} label="Loading delivery log" />
              ) : logs.length === 0 ? (
                <TableMessage colSpan={5}>
                  No deliveries match these filters.
                </TableMessage>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? '' : log.id)}
                        className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-900 break-all">
                            {log.recipient || '—'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 font-mono break-all">
                            {log.notification_id}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <ChannelBadge channel={log.channel} />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">{log.attempt}</td>
                        <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                          {formatTimestamp(log.created_at)}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={5} className="px-6 py-4">
                            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <dt className={labelClass}>Idempotency key</dt>
                                <dd className="mt-1 font-mono text-xs text-slate-700 break-all">
                                  {log.idempotency_key || '—'}
                                </dd>
                              </div>
                              <div>
                                <dt className={labelClass}>Error</dt>
                                <dd className="mt-1 text-xs text-rose-700 break-words">
                                  {log.error || '—'}
                                </dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          total={total}
          disabled={isLoading}
          onChange={setOffset}
        />
      </Panel>
    </div>
  );
};

export default DeliveryLogBrowser;
