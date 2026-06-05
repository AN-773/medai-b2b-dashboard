import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  XCircle,
} from 'lucide-react';

// ---------- Status colors ----------

const STATUS_TONE: Record<string, string> = {
  succeeded:
    'bg-emerald-50 text-emerald-700 ring-emerald-200',
  started: 'bg-sky-50 text-sky-700 ring-sky-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
  no_items_generated:
    'bg-amber-50 text-amber-700 ring-amber-200',
};

const STRATEGY_TONE: Record<string, string> = {
  weak: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  random_fill: 'bg-sky-50 text-sky-700 ring-sky-200',
  internal_reused: 'bg-violet-50 text-violet-700 ring-violet-200',
  fallback: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const CHUNK_SOURCE_TONE: Record<string, string> = {
  linked: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  similarity_fallback: 'bg-amber-50 text-amber-700 ring-amber-200',
  random_fallback: 'bg-rose-50 text-rose-700 ring-rose-200',
  internal_reused: 'bg-violet-50 text-violet-700 ring-violet-200',
};

// ---------- Atoms ----------

export const StatusPill: React.FC<{ value: string; size?: 'sm' | 'md' }> = ({
  value,
  size = 'sm',
}) => {
  const tone =
    STATUS_TONE[value] || 'bg-slate-100 text-slate-700 ring-slate-200';
  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-mono font-semibold uppercase tracking-wider ring-1 ${tone} ${px}`}
    >
      {value === 'failed' && <XCircle size={10} />}
      {value === 'succeeded' && <Check size={10} />}
      {value}
    </span>
  );
};

export const StrategyPill: React.FC<{ value: string }> = ({ value }) => {
  const tone =
    STRATEGY_TONE[value] || 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ring-1 ${tone}`}
    >
      {value}
    </span>
  );
};

export const ChunkSourcePill: React.FC<{ value: string }> = ({ value }) => {
  const tone =
    CHUNK_SOURCE_TONE[value] || 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ring-1 ${tone}`}
    >
      {value}
    </span>
  );
};

export const StagePill: React.FC<{ value: string }> = ({ value }) => (
  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-700 ring-1 ring-slate-200">
    {value}
  </span>
);

export const TenantTag: React.FC<{ tenantId: string | null }> = ({
  tenantId,
}) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200">
    tenant
    <span className="text-slate-700">{tenantId ?? '—'}</span>
  </span>
);

// ---------- ID chip (click to copy) ----------

export const IdChip: React.FC<{
  value: string;
  label?: string;
  truncate?: number;
}> = ({ value, label, truncate = 10 }) => {
  const [copied, setCopied] = useState(false);
  const display =
    value.length > truncate ? `${value.slice(0, truncate)}…` : value;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`${label ?? 'id'}: ${value}`}
      className="inline-flex items-center gap-1 rounded-md bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-800"
    >
      {label && (
        <span className="text-slate-400 normal-case">{label}:</span>
      )}
      <span>{display}</span>
      {copied ? <Check size={10} /> : <Copy size={10} className="opacity-60" />}
    </button>
  );
};

// ---------- External Langfuse link ----------

export const LangfuseLink: React.FC<{
  href: string;
  label?: string;
}> = ({ href, label = 'langfuse' }) => {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-violet-200 transition hover:bg-violet-100"
    >
      {label}
      <ExternalLink size={10} />
    </a>
  );
};

// ---------- Time formatting ----------

const safeParse = (iso: string | null) => {
  if (!iso) return null;
  try {
    return parseISO(iso);
  } catch {
    return null;
  }
};

export const TimeAgo: React.FC<{ iso: string | null; absolute?: boolean }> = ({
  iso,
  absolute = false,
}) => {
  const d = safeParse(iso);
  if (!d) return <span className="text-slate-400">—</span>;
  if (absolute) {
    return (
      <span className="font-mono text-[11px] text-slate-600" title={iso ?? ''}>
        {d.toISOString().replace('T', ' ').slice(0, 19)}
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] text-slate-600" title={iso ?? ''}>
      {formatDistanceToNowStrict(d, { addSuffix: true })}
    </span>
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

// ---------- Key/value grid ----------

export const KV: React.FC<{
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}> = ({ label, children, mono = false }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
      {label}
    </span>
    <div
      className={`text-sm text-slate-800 ${mono ? 'font-mono' : ''}`.trim()}
    >
      {children}
    </div>
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
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  return (
    <div className={`grid gap-4 ${colClass}`}>{children}</div>
  );
};

// ---------- Section card ----------

export const Section: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  dense?: boolean;
}> = ({ title, subtitle, right, children, dense = false }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-700">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
    <div className={dense ? '' : 'p-4'}>{children}</div>
  </section>
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
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-slate-100">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200 ring-1 ring-slate-700 opacity-0 transition group-hover:opacity-100"
      >
        {copied ? <Check size={10} /> : <Copy size={10} />}
        {copied ? 'copied' : 'copy'}
      </button>
      <pre
        className="overflow-auto p-3 font-mono text-[11.5px] leading-relaxed"
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
}) => (
  <div className="flex h-64 items-center justify-center text-slate-400">
    <div className="inline-flex items-center gap-2 text-sm">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  </div>
);

export const ErrorBlock: React.FC<{
  error: string;
  onRetry?: () => void;
}> = ({ error, onRetry }) => (
  <div className="flex h-64 flex-col items-center justify-center gap-3 text-rose-700">
    <div className="inline-flex items-center gap-2 text-sm">
      <AlertCircle size={16} />
      {error}
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
      >
        Retry
      </button>
    )}
  </div>
);

export const EmptyBlock: React.FC<{
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}> = ({ title, hint, icon }) => (
  <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
    {icon}
    <div className="text-sm font-semibold text-slate-600">{title}</div>
    {hint && <div className="text-xs text-slate-400">{hint}</div>}
  </div>
);

// ---------- Compact stat ----------

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'success' | 'warn' | 'danger';
}> = ({ label, value, hint, tone = 'default' }) => {
  const accent =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/40'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50/40'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50/40'
          : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-xl border ${accent} p-4`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
};

// ---------- Drawer ----------

export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  widthClass?: string;
}> = ({ open, onClose, title, subtitle, right, children, widthClass = 'max-w-3xl' }) => {
  if (!open) return null;
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className={`relative ml-auto flex h-full w-full ${widthClass} flex-col bg-[#F8FAFB] shadow-2xl`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">
              audit inspector
            </div>
            <div className="mt-0.5 truncate text-base font-bold text-slate-900">
              {title}
            </div>
            {subtitle && (
              <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {right}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>,
    document.body,
  );
};
