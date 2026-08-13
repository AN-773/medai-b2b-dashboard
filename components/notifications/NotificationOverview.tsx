import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Smartphone,
  XCircle,
} from 'lucide-react';
import {
  AdminOverview,
  HealthStatus,
  NOTIFICATION_CHANNELS,
  WhoAmI,
  notificationService,
} from '../../services/notificationService';
import { ErrorBanner, Panel, errorMessage, labelClass, secondaryButtonClass } from './shared';

const WINDOW_OPTIONS = [
  { label: '24 hours', value: 24 },
  { label: '7 days', value: 24 * 7 },
  { label: '30 days', value: 24 * 30 },
];

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ElementType;
  tone?: 'default' | 'good' | 'bad';
}> = ({ label, value, hint, icon: Icon, tone = 'default' }) => {
  const toneClass =
    tone === 'good'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'bad'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-100 text-slate-600';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={labelClass}>{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900 tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${toneClass}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
};

const NotificationOverview: React.FC = () => {
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

  const inactiveChannels = NOTIFICATION_CHANNELS.filter(
    (channel) => !(overview?.channels ?? []).includes(channel)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Notification Health</h3>
          <p className="text-sm text-slate-500">
            Delivery outcomes and registry sizes for the notification service.
          </p>
        </div>

        <div className="flex items-end gap-3">
          <div className="space-y-2">
            <label htmlFor="overview-window" className={labelClass}>
              Window
            </label>
            <select
              id="overview-window"
              value={windowHours}
              onChange={(event) => setWindowHours(Number(event.target.value))}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => load(windowHours)}
            disabled={isLoading}
            className={secondaryButtonClass}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      </div>

      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Delivered"
          value={sent.toLocaleString()}
          hint={successRate === null ? 'No traffic in window' : `${successRate}% of attempts`}
          icon={CheckCircle2}
          tone={successRate !== null && successRate >= 95 ? 'good' : 'default'}
        />
        <StatCard
          label="Failed"
          value={failed.toLocaleString()}
          hint={skipped > 0 ? `${skipped.toLocaleString()} skipped` : 'No skipped sends'}
          icon={XCircle}
          tone={failed > 0 ? 'bad' : 'default'}
        />
        <StatCard
          label="Suppressed Addresses"
          value={(overview?.suppressions ?? 0).toLocaleString()}
          hint="Never sent to again"
          icon={ShieldAlert}
          tone={(overview?.suppressions ?? 0) > 0 ? 'bad' : 'default'}
        />
        <StatCard
          label="Device Tokens"
          value={(overview?.device_tokens ?? 0).toLocaleString()}
          hint="Registered for push"
          icon={Smartphone}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Service status" description="Live state of the notification service process.">
          <dl className="divide-y divide-slate-100">
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <dt className="text-sm font-semibold text-slate-700">Readiness probe</dt>
              <dd className="text-sm">
                {readiness?.status === 'ready' ? (
                  <span className="inline-flex items-center gap-2 font-bold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 font-bold text-rose-700">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    {readinessError ? 'Unreachable' : 'Not ready'}
                  </span>
                )}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <dt className="text-sm font-semibold text-slate-700">Active channels</dt>
              <dd className="text-sm text-slate-900 font-medium capitalize">
                {(overview?.channels ?? []).join(', ') || '—'}
              </dd>
            </div>

            {inactiveChannels.length > 0 && (
              <div className="flex items-start justify-between gap-4 px-6 py-4">
                <dt className="text-sm font-semibold text-slate-700">Disabled channels</dt>
                <dd className="text-sm text-amber-700 font-medium capitalize text-right">
                  {inactiveChannels.join(', ')}
                  <span className="block text-xs font-normal text-slate-500 normal-case">
                    No sender registered — check the service env
                  </span>
                </dd>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <dt className="text-sm font-semibold text-slate-700">Your access</dt>
              <dd className="text-sm text-slate-900 font-medium">
                {identity
                  ? `${identity.email || identity.user_id || 'authenticated'} (${identity.auth_method})`
                  : '—'}
              </dd>
            </div>
          </dl>

          {readinessError && (
            <div className="px-6 pb-6">
              <ErrorBanner message={readinessError} />
            </div>
          )}
        </Panel>

        <Panel title="Traffic by channel" description="Delivery attempts in the selected window.">
          <div className="p-6 space-y-4">
            {NOTIFICATION_CHANNELS.map((channel) => {
              const count = stats?.by_channel[channel] ?? 0;
              const share = total > 0 ? Math.round((count / total) * 100) : 0;

              return (
                <div key={channel}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-semibold text-slate-700 capitalize">{channel}</span>
                    <span className="text-slate-500">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <p className={labelClass}>Total attempts</p>
                <p className="mt-1 text-lg font-black text-slate-900">{total.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <p className={labelClass}>Templates</p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {(overview?.templates ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Templates" value={overview?.templates ?? 0} icon={FileText} />
        <StatCard label="Teams webhooks" value={overview?.webhooks ?? 0} icon={BellRing} />
        <StatCard
          label="Window"
          value={`${overview?.window_hours ?? windowHours}h`}
          hint="Stats period"
          icon={Activity}
        />
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <Send size={12} />
        Stats come from the delivery log, which records every attempt including retries.
      </p>
    </div>
  );
};

export default NotificationOverview;
