import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Filter, RefreshCw, ScrollText, Search, X } from 'lucide-react';
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
  Badge,
  Button,
  EmptyState,
  IconButton,
  InlineAlert,
  Input,
  SearchInput,
  SectionHeader,
  Select,
  cn,
} from '@/components/ui';
import {
  ChannelBadge,
  CopyButton,
  DELIVERY_STATUS_LABEL,
  DataTable,
  LoadingRow,
  Pagination,
  StatusBadge,
  TableMessage,
  Timestamp,
  channelLabel,
  errorMessage,
  formatTimestamp,
  plural,
  tdClass,
} from './shared';
import { DELIVERY_LINK_KEYS, useLinkParams } from './navigation';

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

const COLUMNS = [
  { label: 'Recipient' },
  { label: 'Channel' },
  { label: 'Status' },
  { label: 'Attempt', className: 'text-right' },
  { label: 'When' },
  { label: 'Details', srOnly: true, className: 'w-12' },
];

/**
 * Filters another section linked here with (`?status=failed&window=168`,
 * `?notification=…`). A notification lookup searches all time unless a window
 * was given, so an older send is still found.
 */
const filtersFromLink = (link: Record<string, string>): Filters | null => {
  if (Object.keys(link).length === 0) return null;
  const windowValue = Number(link.window);
  const hasWindow = WINDOW_OPTIONS.some((option) => option.value === windowValue);
  return {
    ...emptyFilters,
    notificationId: link.notification ?? '',
    status: DELIVERY_STATUSES.includes(link.status as DeliveryStatus)
      ? (link.status as DeliveryStatus)
      : '',
    channel: NOTIFICATION_CHANNELS.includes(link.channel as NotificationChannel)
      ? (link.channel as NotificationChannel)
      : '',
    windowHours: hasWindow ? windowValue : link.notification ? 0 : emptyFilters.windowHours,
  };
};

const sameFilters = (a: Filters, b: Filters) =>
  a.recipient.trim() === b.recipient.trim() &&
  a.notificationId.trim() === b.notificationId.trim() &&
  a.channel === b.channel &&
  a.status === b.status &&
  a.windowHours === b.windowHours;

const Detail: React.FC<{
  label: string;
  className?: string;
  copyValue?: string;
  children: React.ReactNode;
}> = ({ label, className, copyValue, children }) => (
  <div className={cn('min-w-0', className)}>
    <dt className="text-xs text-stone-500">{label}</dt>
    <dd className="mt-1 flex items-start gap-1">
      <div className="min-w-0 flex-1 break-words text-[13px] text-stone-800">{children}</div>
      {copyValue && <CopyButton value={copyValue} label={`Copy ${label.toLowerCase()}`} className="-my-1" />}
    </dd>
  </div>
);

const DeliveryLogBrowser: React.FC = () => {
  const link = useLinkParams(DELIVERY_LINK_KEYS);
  // `filters` is the form state; `applied` is what the last query used, so
  // typing in the search box does not refetch on every keystroke. Selects
  // apply as soon as they change.
  const [filters, setFilters] = useState<Filters>(() => filtersFromLink(link) ?? emptyFilters);
  const [applied, setApplied] = useState<Filters>(() => filtersFromLink(link) ?? emptyFilters);
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

  /** For selects and clear buttons: update the form and query at once. */
  const updateAndApply = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    applyFilters(next);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    applyFilters(filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    applyFilters(emptyFilters);
  };

  const isFiltered = !sameFilters(applied, emptyFilters);
  const hasPendingText =
    filters.recipient.trim() !== applied.recipient.trim() ||
    filters.notificationId.trim() !== applied.notificationId.trim();
  const isFirstLoad = isLoading && logs.length === 0;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Delivery log"
        description="Every send attempt, newest first — including retries and sends skipped by the suppression list. Select a row for its error and idempotency key."
        meta={
          !isFirstLoad && !error ? (
            <Badge className="tabular-nums">{plural(total, 'attempt')}</Badge>
          ) : undefined
        }
        actions={
          <IconButton
            icon={RefreshCw}
            label="Refresh"
            onClick={() => load(applied, offset)}
            disabled={isLoading}
            className={isLoading ? '[&_svg]:animate-spin' : undefined}
          />
        }
      />

      <form
        role="search"
        aria-label="Filter deliveries"
        onSubmit={handleSubmit}
        className="flex flex-wrap items-center gap-2"
      >
        <SearchInput
          value={filters.recipient}
          onChange={(value) =>
            value === '' && applied.recipient
              ? updateAndApply({ recipient: '' })
              : setFilters({ ...filters, recipient: value })
          }
          placeholder="Recipient"
          aria-label="Recipient"
          className="w-full sm:w-60"
        />
        <div className="relative w-full sm:w-56">
          <Input
            value={filters.notificationId}
            onChange={(event) => setFilters({ ...filters, notificationId: event.target.value })}
            placeholder="Notification ID"
            aria-label="Notification ID (exact match)"
            title="Exact match"
            className={cn('font-mono text-[13px]', filters.notificationId && 'pr-8')}
          />
          {filters.notificationId && (
            <button
              type="button"
              onClick={() =>
                applied.notificationId
                  ? updateAndApply({ notificationId: '' })
                  : setFilters({ ...filters, notificationId: '' })
              }
              aria-label="Clear notification ID"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <Select
          aria-label="Channel"
          value={filters.channel}
          onChange={(event) =>
            updateAndApply({ channel: event.target.value as NotificationChannel | '' })
          }
          className="w-auto"
        >
          <option value="">All channels</option>
          {NOTIFICATION_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channelLabel(channel)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          value={filters.status}
          onChange={(event) => updateAndApply({ status: event.target.value as DeliveryStatus | '' })}
          className="w-auto"
        >
          <option value="">All statuses</option>
          {DELIVERY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {DELIVERY_STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Time range"
          value={filters.windowHours}
          onChange={(event) => updateAndApply({ windowHours: Number(event.target.value) })}
          className="w-auto"
        >
          {WINDOW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button
          type="submit"
          icon={Search}
          disabled={isLoading}
          title={hasPendingText ? 'Apply the recipient and notification ID filters' : undefined}
        >
          Search
        </Button>
        {isFiltered && (
          <Button variant="ghost" icon={X} onClick={resetFilters}>
            Reset
          </Button>
        )}
      </form>

      {error && (
        <InlineAlert
          title="Couldn’t load the delivery log"
          className="break-words"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              onClick={() => load(applied, offset)}
              className="-my-0.5"
            >
              Try again
            </Button>
          }
        >
          {error}
        </InlineAlert>
      )}

      {!error && (
        <DataTable
          label="Delivery attempts"
          columns={COLUMNS}
          busy={isLoading && logs.length > 0}
          footer={
            <Pagination
              offset={offset}
              limit={PAGE_SIZE}
              total={total}
              disabled={isLoading}
              onChange={setOffset}
            />
          }
        >
          {isFirstLoad ? (
            <LoadingRow colSpan={COLUMNS.length} label="Loading delivery log…" />
          ) : logs.length === 0 ? (
            <TableMessage colSpan={COLUMNS.length}>
              <EmptyState
                compact
                icon={isFiltered ? Filter : ScrollText}
                title={isFiltered ? 'No deliveries match these filters' : 'No deliveries recorded'}
                description={
                  isFiltered
                    ? 'Widen the time range or clear a filter.'
                    : 'Attempts appear here as soon as the service sends anything.'
                }
                action={
                  isFiltered ? (
                    <Button size="sm" onClick={resetFilters}>
                      Reset filters
                    </Button>
                  ) : undefined
                }
              />
            </TableMessage>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedId === log.id;
              const detailId = `delivery-detail-${log.id}`;
              const toggle = () => setExpandedId(isExpanded ? '' : log.id);

              return (
                <React.Fragment key={log.id}>
                  <tr
                    onClick={toggle}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-stone-50',
                      isExpanded && 'bg-stone-50',
                    )}
                  >
                    <td className={tdClass}>
                      <p className="max-w-[26rem] truncate font-medium text-stone-900" title={log.recipient}>
                        {log.recipient || '—'}
                      </p>
                      <p
                        className="mt-0.5 max-w-[26rem] truncate font-mono text-xs text-stone-400"
                        title={log.notification_id}
                      >
                        {log.notification_id}
                      </p>
                    </td>
                    <td className={tdClass}>
                      <ChannelBadge channel={log.channel} />
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={log.status} />
                      {log.error && (
                        <p className="mt-0.5 max-w-[18rem] truncate text-xs text-red-600" title={log.error}>
                          {log.error}
                        </p>
                      )}
                    </td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{log.attempt}</td>
                    <td className={cn(tdClass, 'text-stone-600')}>
                      <Timestamp value={log.created_at} />
                    </td>
                    <td className="w-12 py-2.5 pr-3 text-right">
                      <IconButton
                        icon={ChevronDown}
                        size="sm"
                        label={isExpanded ? 'Hide details' : 'Show details'}
                        aria-expanded={isExpanded}
                        aria-controls={detailId}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggle();
                        }}
                        className={cn('[&_svg]:transition-transform', isExpanded && '[&_svg]:rotate-180')}
                      />
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr id={detailId} className="bg-stone-50">
                      <td colSpan={COLUMNS.length} className="px-4 pb-4 pt-1">
                        <div className="rounded-lg border border-stone-200 bg-white p-4">
                          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                            <Detail label="Notification ID" copyValue={log.notification_id}>
                              <span className="break-all font-mono">{log.notification_id}</span>
                            </Detail>
                            <Detail
                              label="Idempotency key"
                              copyValue={log.idempotency_key || undefined}
                            >
                              <span className="break-all font-mono">{log.idempotency_key || '—'}</span>
                            </Detail>
                            <Detail label="Error" className="md:col-span-2">
                              {log.error ? (
                                <span className="text-red-700">{log.error}</span>
                              ) : (
                                <span className="text-stone-400">No error recorded</span>
                              )}
                            </Detail>
                            <Detail label="Recorded">{formatTimestamp(log.created_at)}</Detail>
                          </dl>
                          {applied.notificationId.trim() !== log.notification_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Filter}
                              className="-ml-2 mt-3"
                              onClick={() =>
                                updateAndApply({
                                  ...emptyFilters,
                                  notificationId: log.notification_id,
                                  windowHours: 0,
                                })
                              }
                            >
                              Show every attempt for this notification
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </DataTable>
      )}
    </div>
  );
};

export default DeliveryLogBrowser;
