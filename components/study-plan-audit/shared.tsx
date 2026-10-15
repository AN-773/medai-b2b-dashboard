import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Building2, Check, Copy, ExternalLink, Inbox, RefreshCw } from 'lucide-react';
import {
  Badge,
  Button,
  Drawer as UIDrawer,
  IconButton,
  InlineAlert,
  Spinner,
  StatusDot,
  cn,
  type BadgeTone,
} from '@/components/ui';

// ---------- Value helpers ----------

/** `no_items_generated` → "No items generated". */
export const humanize = (value: string) => {
  const text = value.replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : value;
};

const STATUS_TONE: Record<string, BadgeTone> = {
  succeeded: 'green',
  success: 'green',
  completed: 'green',
  complete: 'green',
  active: 'green',
  ready: 'green',
  processed: 'green',
  done: 'green',
  live: 'green',
  started: 'blue',
  running: 'blue',
  processing: 'blue',
  generating: 'blue',
  pending: 'blue',
  queued: 'blue',
  in_progress: 'blue',
  uploaded: 'blue',
  failed: 'red',
  error: 'red',
  errored: 'red',
  no_items_generated: 'amber',
  partial: 'amber',
  partially_succeeded: 'amber',
};

/** Colour for any run / session / upload / plan status the audit API returns. */
export const statusTone = (value: string | null | undefined): BadgeTone =>
  STATUS_TONE[(value ?? '').toLowerCase()] ?? 'neutral';

const STRATEGY_TONE: Record<string, BadgeTone> = {
  weak: 'green',
  random_fill: 'blue',
  internal_reused: 'violet',
  fallback: 'amber',
};

const CHUNK_SOURCE_TONE: Record<string, BadgeTone> = {
  linked: 'green',
  similarity_fallback: 'amber',
  random_fallback: 'red',
  internal_reused: 'violet',
  internal_generated: 'violet',
};

/** Chunk sources that mean generation wasn't grounded on the objective's own chunks. */
export const FALLBACK_CHUNK_SOURCES = new Set(['similarity_fallback', 'random_fallback']);

// ---------- Atoms ----------

export const StatusPill: React.FC<{ value: string; size?: 'sm' | 'md' }> = ({
  value,
  size = 'sm',
}) => (
  <Badge
    tone={statusTone(value)}
    dot
    title={value}
    className={size === 'md' ? 'px-2 py-1' : undefined}
  >
    {humanize(value || 'unknown')}
  </Badge>
);

/** Lighter status for dense table rows. */
export const StatusLabel: React.FC<{ value: string }> = ({ value }) => (
  <span title={value}>
    <StatusDot tone={statusTone(value)}>{humanize(value || 'unknown')}</StatusDot>
  </span>
);

export const StrategyPill: React.FC<{ value: string }> = ({ value }) => (
  <Badge tone={STRATEGY_TONE[value] ?? 'neutral'} title={value}>
    {humanize(value || 'unknown')}
  </Badge>
);

export const ChunkSourcePill: React.FC<{ value: string }> = ({ value }) => (
  <Badge tone={CHUNK_SOURCE_TONE[value] ?? 'neutral'} title={`Chunk source: ${value}`}>
    {humanize(value || 'unknown')}
  </Badge>
);

/** Raw pipeline identifiers (stage, item type, session mode) — shown as code. */
export const StagePill: React.FC<{ value: string }> = ({ value }) => (
  <Badge className="font-mono">{value}</Badge>
);

export const TenantTag: React.FC<{ tenantId: string | null }> = ({ tenantId }) => (
  <span
    className="inline-flex min-w-0 max-w-[16rem] items-center gap-1 text-xs text-stone-500"
    title={tenantId ? `Tenant ${tenantId}` : 'No tenant'}
  >
    <Building2 size={12} className="flex-shrink-0 text-stone-400" aria-hidden="true" />
    <span className="sr-only">Tenant</span>
    {tenantId ? (
      <span className="truncate font-mono text-stone-600">{tenantId}</span>
    ) : (
      <span>No tenant</span>
    )}
  </span>
);

// ---------- Copy ----------

const useCopy = (text: string) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }, [text]);
  return { copied, copy };
};

/** Icon-only copy action. Never bubbles, so it's safe inside clickable rows. */
export const CopyButton: React.FC<{ text: string; label: string; className?: string }> = ({
  text,
  label,
  className,
}) => {
  const { copied, copy } = useCopy(text);
  return (
    <IconButton
      icon={copied ? Check : Copy}
      label={copied ? 'Copied' : label}
      size="sm"
      className={cn('-my-1.5', copied && 'text-brand-700', className)}
      onClick={(event) => {
        event.stopPropagation();
        void copy();
      }}
    />
  );
};

const copyLabelFor = (label?: string) =>
  !label || /^id$/i.test(label) ? 'Copy ID' : `Copy ${label.toLowerCase()} ID`;

// ---------- ID chip (monospace ID + copy) ----------

export const IdChip: React.FC<{
  value: string;
  label?: string;
  truncate?: number;
}> = ({ value, label, truncate = 10 }) => {
  const display = value.length > truncate ? `${value.slice(0, truncate)}…` : value;
  return (
    <span className="inline-flex max-w-full items-center gap-1 align-middle text-xs">
      {label && <span className="text-stone-400">{label}</span>}
      <code className="truncate font-mono text-stone-600" title={value}>
        {display}
      </code>
      <CopyButton text={value} label={copyLabelFor(label)} />
    </span>
  );
};

// ---------- External Langfuse link ----------

export const LangfuseLink: React.FC<{
  href: string;
  label?: string;
}> = ({ href, label = 'Langfuse' }) => {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded text-[13px] font-medium text-stone-700 underline decoration-stone-300 underline-offset-2 transition hover:text-stone-950 hover:decoration-stone-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {label}
      <ExternalLink size={12} aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
};

// ---------- Time formatting ----------

const safeParse = (iso: string | null) => {
  if (!iso) return null;
  try {
    const date = parseISO(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

/** Relative (or absolute UTC) time. Inherits size and colour from its context. */
export const TimeAgo: React.FC<{ iso: string | null; absolute?: boolean }> = ({
  iso,
  absolute = false,
}) => {
  const d = safeParse(iso);
  if (!d) return <span className="text-stone-400">—</span>;
  return (
    <time dateTime={iso ?? undefined} title={iso ?? ''} className="whitespace-nowrap tabular-nums">
      {absolute
        ? `${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`
        : formatDistanceToNowStrict(d, { addSuffix: true })}
    </time>
  );
};

export const formatDurationMs = (ms: number) => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return `${m}m ${r}s`;
};

export const formatNumber = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US').format(n);
};

export const computeDurationMs = (
  startIso: string | null,
  endIso: string | null,
): number | null => {
  const s = safeParse(startIso);
  const e = safeParse(endIso);
  if (!s || !e) return null;
  return Math.max(0, e.getTime() - s.getTime());
};

export const plural = (count: number, word: string, pluralWord = `${word}s`) =>
  `${formatNumber(count)} ${count === 1 ? word : pluralWord}`;

// ---------- Key/value grid ----------

export const KV: React.FC<{
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}> = ({ label, children, mono = false }) => (
  <div className="min-w-0">
    <dt className="text-xs text-stone-500">{label}</dt>
    <dd
      className={cn(
        'mt-1 min-w-0 break-words text-sm text-stone-900',
        mono && 'font-mono text-[13px] tabular-nums',
      )}
    >
      {children}
    </dd>
  </div>
);

export const KVGrid: React.FC<{ children: React.ReactNode; cols?: number }> = ({
  children,
  cols = 4,
}) => {
  const colClass =
    cols === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : cols === 3
        ? 'grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-2 lg:grid-cols-4';
  return <dl className={cn('grid gap-x-6 gap-y-4', colClass)}>{children}</dl>;
};

// ---------- Section card ----------

export const Section: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  dense?: boolean;
}> = ({ title, subtitle, right, children, dense = false }) => (
  <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-stone-100 px-4 py-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {subtitle && <div className="mt-0.5 text-[13px] text-stone-500">{subtitle}</div>}
      </div>
      {right && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </header>
    <div className={dense ? '' : 'p-4'}>{children}</div>
  </section>
);

/** Small heading inside a section (e.g. "Runs", "Source chunks"). */
export const SubHeading: React.FC<{
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  right?: React.ReactNode;
}> = ({ icon: Icon, children, right }) => (
  <div className="mb-2 flex items-center justify-between gap-3">
    <h4 className="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone-700">
      {Icon && <Icon size={14} className="text-stone-400" />}
      {children}
    </h4>
    {right}
  </div>
);

// ---------- JSON block ----------

export const JsonBlock: React.FC<{ value: unknown; maxHeight?: number }> = ({
  value,
  maxHeight = 240,
}) => {
  const text = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);
  return (
    <div className="relative rounded-lg border border-stone-200 bg-stone-50">
      <div className="absolute right-1.5 top-2.5">
        <CopyButton text={text} label="Copy JSON" />
      </div>
      <pre
        className="overflow-auto p-3 pr-10 font-mono text-xs leading-5 text-stone-800 custom-scrollbar"
        style={{ maxHeight }}
      >
        {text}
      </pre>
    </div>
  );
};

// ---------- Empty / error / loading states ----------

export const LoadingBlock: React.FC<{ label?: string }> = ({
  label = 'Loading audit data…',
}) => <Spinner label={label} className="py-16" />;

export const ErrorBlock: React.FC<{
  error: string;
  onRetry?: () => void;
}> = ({ error, onRetry }) => (
  <InlineAlert
    title="Couldn't load audit data"
    action={
      onRetry ? (
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry}>
          Retry
        </Button>
      ) : undefined
    }
  >
    {error}
  </InlineAlert>
);

export const EmptyBlock: React.FC<{
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}> = ({ title, hint, icon }) => (
  <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
      {icon ?? <Inbox size={17} />}
    </div>
    <p className="text-sm font-semibold text-stone-900">{title}</p>
    {hint && <p className="mt-1 max-w-sm text-[13px] leading-5 text-stone-500">{hint}</p>}
  </div>
);

// ---------- Compact stat ----------

const STAT_TONES = {
  default: 'text-stone-900',
  success: 'text-brand-700',
  warn: 'text-amber-700',
  danger: 'text-red-700',
} as const;

/** One figure. Place several inside a `StatStrip` so they share one frame. */
export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'success' | 'warn' | 'danger';
}> = ({ label, value, hint, tone = 'default' }) => (
  <div className="min-w-0 bg-white px-4 py-3.5">
    <div className="text-[13px] text-stone-500">{label}</div>
    <div className={cn('mt-1 text-xl font-semibold tabular-nums tracking-tight', STAT_TONES[tone])}>
      {value}
    </div>
    {hint && <div className="mt-0.5 text-xs text-stone-500">{hint}</div>}
  </div>
);

/**
 * A single bordered frame with hairline dividers between `Stat`s (pass grid-cols-*).
 * Each cell draws its own top/left rule; the outer ones are clipped away, so a
 * part-filled last row stays white instead of showing filler.
 */
export const StatStrip: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
    <div
      className={cn(
        '-ml-px -mt-px grid [&>*]:border-l [&>*]:border-t [&>*]:border-stone-100',
        className,
      )}
    >
      {children}
    </div>
  </div>
);

// ---------- Drawer ----------

/** The audit inspector: the design-system drawer with an optional toolbar row. */
export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  widthClass?: string;
}> = ({ open, onClose, title, subtitle, right, children, widthClass = 'max-w-3xl' }) => (
  <UIDrawer
    open={open}
    onClose={onClose}
    title={title}
    description={subtitle}
    width={widthClass}
    toolbar={
      right ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-100 px-6 py-2.5">
          {right}
        </div>
      ) : undefined
    }
  >
    <div className="px-6 py-5">{children}</div>
  </UIDrawer>
);
