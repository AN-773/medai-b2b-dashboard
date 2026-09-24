import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import {
  AdminOverview,
  DELIVERY_STATUSES,
  DeliveryStatus,
  HealthStatus,
  NOTIFICATION_CHANNELS,
  NotificationChannel,
  WhoAmI,
  notificationService,
} from '../../services/notificationService';
import {
  Badge,
  EmptyState,
  IconButton,
  InlineAlert,
  SectionHeader,
  SegmentedControl,
  cn,
} from '@/components/ui';
import {
  CHANNEL_ICON,
  DELIVERY_STATUS_LABEL,
  channelLabel,
  errorMessage,
  plural,
} from './shared';
import { useNotificationTabs } from './navigation';

type WindowValue = '24' | '168' | '720';

const WINDOW_OPTIONS: { value: WindowValue; label: string; long: string }[] = [
  { value: '24', label: '24 hours', long: 'the last 24 hours' },
  { value: '168', label: '7 days', long: 'the last 7 days' },
  { value: '720', label: '30 days', long: 'the last 30 days' },
];

/** Segment colours for the outcome bar — same meaning as the status dots. */
const STATUS_BAR: Record<DeliveryStatus, string> = {
  sent: 'bg-brand-500',
  failed: 'bg-red-500',
  skipped: 'bg-amber-500',
  pending: 'bg-stone-300',
};

interface ChannelDatum {
  channel: NotificationChannel;
  label: string;
  count: number;
  share: number;
}

const KpiTile: React.FC<{
  label: string;
  icon: LucideIcon;
  value: React.ReactNode;
  detail: React.ReactNode;
  alarming?: boolean;
  actionLabel: string;
  onAction: () => void;
}> = ({ label, icon: Icon, value, detail, alarming = false, actionLabel, onAction }) => (
  <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-card">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <Icon size={16} className="ml-auto text-stone-300" aria-hidden="true" />
    </div>
    <div
      className={cn(
        'mt-4 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums',
        alarming ? 'text-red-600' : 'text-stone-900',
      )}
    >
      {value}
    </div>
    <div className="mt-2 min-h-[20px] text-[13px] text-stone-500">{detail}</div>
    <button
      type="button"
      onClick={onAction}
      className="group mt-4 inline-flex w-fit items-center gap-1.5 rounded text-[13px] font-medium text-stone-700 transition hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {actionLabel}
      <ArrowRight size={14} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  </div>
);

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-xs text-stone-500">{label}</dt>
    <dd className="mt-1 flex min-h-[24px] flex-wrap items-center gap-1.5 text-sm font-medium text-stone-900">
      {children}
    </dd>
  </div>
);

const Health: React.FC<{ tone: 'green' | 'red' | 'neutral'; children: React.ReactNode }> = ({
  tone,
  children,
}) => (
  <span className="inline-flex items-center gap-2">
    <span
      className={cn(
        'h-2 w-2 rounded-full',
        tone === 'green' ? 'bg-brand-500' : tone === 'red' ? 'bg-red-500' : 'bg-stone-300',
      )}
      aria-hidden="true"
    />
    {children}
  </span>
);

const ChannelTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload as ChannelDatum;
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-[13px] shadow-pop">
      <p className="font-medium text-stone-900">{datum.label}</p>
      <p className="tabular-nums text-stone-500">
        {plural(datum.count, 'attempt')} · {datum.share}%
      </p>
    </div>
  );
};

const NotificationOverview: React.FC = () => {
  const { openTab } = useNotificationTabs();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [identity, setIdentity] = useState<WhoAmI | null>(null);
  const [readiness, setReadiness] = useState<HealthStatus | null>(null);
  const [readinessError, setReadinessError] = useState('');
  const [windowHours, setWindowHours] = useState(24);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (hours: number) => {
    setIsLoading(true);
    setError('');

    // Readiness is unauthenticated and reported separately: a red probe with a
    // working overview means something different from both failing.
    try {
      setReadiness(await notificationService.readiness());
      setReadinessError('');
    } catch (err) {
      setReadiness(null);
      setReadinessError(errorMessage(err, 'Readiness probe failed.'));
    }

    try {
      const [data, who] = await Promise.all([
        notificationService.getOverview(hours),
        notificationService.whoami().catch(() => null),
      ]);
      setOverview(data);
      setIdentity(who);
    } catch (err) {
      console.error('Failed to load notification overview:', err);
      setOverview(null);
      setError(errorMessage(err, 'Unable to load the notification overview.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(windowHours);
  }, [load, windowHours]);

  const stats = overview?.deliveries;
  const sent = stats?.by_status.sent ?? 0;
  const failed = stats?.by_status.failed ?? 0;
  const skipped = stats?.by_status.skipped ?? 0;
  const total = stats?.total ?? 0;
  const successRate = total > 0 ? Math.round((sent / total) * 100) : null;
  const hasOverview = overview !== null;

  const inactiveChannels = NOTIFICATION_CHANNELS.filter(
    (channel) => !(overview?.channels ?? []).includes(channel)
  );

  const windowValue = String(windowHours) as WindowValue;
  const windowPhrase =
    WINDOW_OPTIONS.find((option) => option.value === windowValue)?.long ??
    `the last ${overview?.window_hours ?? windowHours} hours`;

  const channelData: ChannelDatum[] = NOTIFICATION_CHANNELS.map((channel) => {
    const count = stats?.by_channel[channel] ?? 0;
    return {
      channel,
      label: channelLabel(channel),
      count,
      share: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  const figure = (value: number | undefined) =>
    hasOverview ? (value ?? 0).toLocaleString() : '—';

  const readinessState =
    readiness?.status === 'ready'
      ? { tone: 'green' as const, label: 'Ready' }
      : isLoading && !readiness && !readinessError
        ? { tone: 'neutral' as const, label: 'Checking…' }
        : { tone: 'red' as const, label: readinessError ? 'Unreachable' : 'Not ready' };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Service health"
        description={`Delivery outcomes over ${windowPhrase}, and what the service is configured with.`}
        actions={
          <>
            <SegmentedControl
              label="Stats window"
              value={windowValue}
              onChange={(value) => setWindowHours(Number(value))}
              options={WINDOW_OPTIONS.map(({ value, label }) => ({ value, label }))}
            />
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              onClick={() => load(windowHours)}
              disabled={isLoading}
              className={isLoading ? '[&_svg]:animate-spin' : undefined}
            />
          </>
        }
      />

      {error && <InlineAlert title="Couldn’t load the overview">{error}</InlineAlert>}
      {readinessError && (
        <InlineAlert title="Readiness probe failed" className="break-words">
          {readinessError}
        </InlineAlert>
      )}
      {hasOverview && inactiveChannels.length > 0 && (
        <InlineAlert
          tone="warning"
          title={`${inactiveChannels.map(channelLabel).join(', ')} ${
            inactiveChannels.length === 1 ? 'is' : 'are'
          } disabled`}
        >
          No sender is registered for {inactiveChannels.length === 1 ? 'this channel' : 'these channels'}{' '}
          — check the notification service environment.
        </InlineAlert>
      )}

      {/* What the service is and who you are to it — quiet unless something is off. */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-card sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="Service">
          <Health tone={readinessState.tone}>{readinessState.label}</Health>
        </Fact>
        <Fact label="Active channels">
          {(overview?.channels ?? []).length > 0 ? (
            (overview?.channels ?? []).map((channel) => (
              <Badge key={channel} icon={CHANNEL_ICON[channel]}>
                {channelLabel(channel)}
              </Badge>
            ))
          ) : (
            <span className="text-stone-400">—</span>
          )}
        </Fact>
        <Fact label="Templates">
          <button
            type="button"
            onClick={() => openTab('templates')}
            aria-label={`Manage templates (${figure(overview?.templates)})`}
            className="rounded tabular-nums underline decoration-stone-300 underline-offset-4 transition hover:decoration-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {figure(overview?.templates)}
          </button>
        </Fact>
        <Fact label="Teams webhooks">
          <button
            type="button"
            onClick={() => openTab('webhooks')}
            aria-label={`Manage Teams webhooks (${figure(overview?.webhooks)})`}
            className="rounded tabular-nums underline decoration-stone-300 underline-offset-4 transition hover:decoration-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {figure(overview?.webhooks)}
          </button>
        </Fact>
        <Fact label="Your access">
          {identity ? (
            <span className="min-w-0 truncate" title={identity.email || identity.user_id}>
              {identity.email || identity.user_id || 'Authenticated'}
              <span className="font-normal text-stone-500"> · {identity.auth_method}</span>
            </span>
          ) : (
            <span className="text-stone-400">—</span>
          )}
        </Fact>
      </dl>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Delivered"
          icon={CheckCircle2}
          value={figure(sent)}
          detail={
            !hasOverview ? null : successRate === null ? (
              'No traffic in this window'
            ) : (
              <span className={successRate >= 95 ? 'text-brand-700' : undefined}>
                {successRate}% of attempts
              </span>
            )
          }
          actionLabel="View sent"
          onAction={() => openTab('deliveries', { status: 'sent', window: windowHours })}
        />
        <KpiTile
          label="Failed"
          icon={XCircle}
          value={figure(failed)}
          alarming={failed > 0}
          detail={
            hasOverview
              ? skipped > 0
                ? `${skipped.toLocaleString()} skipped`
                : 'No skipped sends'
              : null
          }
          actionLabel="View failures"
          onAction={() => openTab('deliveries', { status: 'failed', window: windowHours })}
        />
        <KpiTile
          label="Suppressed addresses"
          icon={ShieldAlert}
          value={figure(overview?.suppressions)}
          detail="Never emailed again"
          actionLabel="Manage list"
          onAction={() => openTab('suppressions')}
        />
        <KpiTile
          label="Device tokens"
          icon={Smartphone}
          value={figure(overview?.device_tokens)}
          detail="Registered for push"
          actionLabel="Browse devices"
          onAction={() => openTab('devices')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-card lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-[15px] font-semibold text-stone-900">Attempts by channel</h3>
            <span className="text-[13px] tabular-nums text-stone-500">
              {hasOverview ? plural(total, 'attempt') : '—'}
            </span>
          </div>
          {total === 0 ? (
            <EmptyState
              compact
              icon={BarChart3}
              title={hasOverview ? 'No traffic in this window' : 'No data yet'}
              description={
                hasOverview
                  ? 'Nothing was sent over ' + windowPhrase + '. Try a longer window.'
                  : 'Channel traffic appears once the overview loads.'
              }
            />
          ) : (
            // Colours come from Tailwind via `currentColor`: the wrapper's
            // stone text colours the axes and grid, the bar's class the bars.
            <div className="mt-4 h-44 text-stone-500">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={channelData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid horizontal={false} stroke="currentColor" strokeOpacity={0.18} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tick={{ fill: 'currentColor', fontSize: 13 }}
                  />
                  <Tooltip
                    content={<ChannelTooltip />}
                    cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
                  />
                  <Bar
                    dataKey="count"
                    name="Attempts"
                    fill="currentColor"
                    className="text-brand-500"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={22}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-card">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-stone-900">Outcomes</h3>
            {successRate !== null && (
              <span className="text-[13px] tabular-nums text-stone-500">{successRate}% delivered</span>
            )}
          </div>
          <div
            className="mt-4 flex h-2 overflow-hidden rounded-full bg-stone-100"
            role="img"
            aria-label={DELIVERY_STATUSES.map(
              (status) => `${DELIVERY_STATUS_LABEL[status]} ${(stats?.by_status[status] ?? 0).toLocaleString()}`,
            ).join(', ')}
          >
            {total > 0 &&
              DELIVERY_STATUSES.map((status) => {
                const count = stats?.by_status[status] ?? 0;
                if (count === 0) return null;
                return (
                  <span
                    key={status}
                    className={cn('h-full', STATUS_BAR[status])}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                );
              })}
          </div>
          <ul className="mt-3 divide-y divide-stone-100">
            {DELIVERY_STATUSES.map((status) => {
              const count = stats?.by_status[status] ?? 0;
              const share = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <li key={status}>
                  <button
                    type="button"
                    onClick={() => openTab('deliveries', { status, window: windowHours })}
                    className="group flex w-full items-center gap-2.5 rounded-md py-2 text-left text-sm text-stone-700 transition-colors hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', STATUS_BAR[status])} aria-hidden="true" />
                    {DELIVERY_STATUS_LABEL[status]}
                    <span className="ml-auto tabular-nums text-stone-900">
                      {hasOverview ? count.toLocaleString() : '—'}
                    </span>
                    <span className="w-10 text-right text-[13px] tabular-nums text-stone-400">
                      {total > 0 ? `${share}%` : ''}
                    </span>
                    <ChevronRight
                      size={14}
                      className="flex-shrink-0 text-stone-300 transition group-hover:text-stone-500"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <p className="text-xs text-stone-500">
        Stats come from the delivery log, which records every attempt including retries. Stats window:{' '}
        {overview?.window_hours ?? windowHours}h.
      </p>
    </div>
  );
};

export default NotificationOverview;
