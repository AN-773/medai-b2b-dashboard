import React, { useState } from 'react';
import { ArrowRight, Check, ChevronRight, Loader2, ShieldCheck, Sparkles, X } from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { BackendItem } from '../types';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  InlineAlert,
  Spinner,
  StatusDot,
  cn,
  type BadgeTone,
} from '@/components/ui';

interface ItemIntegrityViewProps {
  items: BackendItem[];
  onUpdate: (item: BackendItem) => void;
}

// Recharts needs literal colours: stone-200 gridlines, stone-500 axis labels,
// stone-900 tooltip values. The series itself uses currentColor (brand-500).
const CHART_GRID = '#e7e5e4';
const CHART_AXIS = '#78716c';
const CHART_TEXT = '#1c1917';

const STATUS_TONE: Record<BackendItem['status'], BadgeTone> = {
  Published: 'green',
  Draft: 'neutral',
  Archived: 'neutral',
};

const STATUS_LABEL: Record<BackendItem['status'], string> = {
  Published: 'Live',
  Draft: 'Draft',
  Archived: 'Archived',
};

const optionLetter = (index: number) => String.fromCharCode(65 + index);

interface OptionListProps {
  options: { text: string; isCorrect: boolean }[];
  columns?: boolean;
}

const OptionList: React.FC<OptionListProps> = ({ options, columns = false }) => (
  <ol className={cn('grid gap-2', columns && 'md:grid-cols-2')}>
    {options.map((option, index) => (
      <li
        key={index}
        className={cn(
          'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm',
          option.isCorrect ? 'border-brand-200 bg-brand-50/70' : 'border-stone-200 bg-white',
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-semibold',
            option.isCorrect
              ? 'bg-brand-600 text-white'
              : 'bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200',
          )}
        >
          {optionLetter(index)}
        </span>
        <span className="min-w-0 flex-1 text-stone-800">{option.text}</span>
        {option.isCorrect && (
          <Check size={15} className="flex-shrink-0 text-brand-700" aria-label="Correct answer" />
        )}
      </li>
    ))}
  </ol>
);

/** Audit queue: pick an item, get a writing-flaw and psychometric report plus a suggested rewrite. */
const ItemIntegrityView: React.FC<ItemIntegrityViewProps> = ({ items, onUpdate }) => {
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  /*
  {
    integrityScore: 58,
    flaws: [
      'Stem contains ambiguous clinical language.',
      'Distractor options lack plausibility.',
      'Item shows significant performance drift over time.'
    ],
    reconstructedItem: {
      stem: 'A 45-year-old male presents with chest pain and shortness of breath. Which of the following is the most likely diagnosis?',
      options: [
        { text: 'Myocardial Infarction', isCorrect: true },
        { text: 'Gastroesophageal Reflux Disease', isCorrect: false },
        { text: 'Panic Attack', isCorrect: false },
        { text: 'Pneumonia', isCorrect: false }
      ]
    },

  }
  */
  const [selectedItem, setSelectedItem] = useState<BackendItem | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Simulated drift history until psychometrics are wired to the audit.
  const driftHistory = [
    { month: 'Jan', pValue: 0.72 },
    { month: 'Feb', pValue: 0.68 },
    { month: 'Mar', pValue: 0.65 },
    { month: 'Apr', pValue: 0.61 },
    { month: 'Current', pValue: 0.58 },
  ];

  const handleAudit = async (item: BackendItem) => {
    setAuditingId(item.id);
    setSelectedItem(item);
    // const result = await auditQuestionIntegrity(item);
    const result = null;
    if (result) {
      setAuditResult(result);
    }
    setAuditingId(null);
  };

  const applyRemedy = () => {
    if (!selectedItem || !auditResult?.reconstructedItem) return;
    setIsApplying(true);
    // Simulate commit to DB
    setTimeout(() => {
      const updated: BackendItem = {
        ...selectedItem,
        stem: auditResult.reconstructedItem.stem,
        options: auditResult.reconstructedItem.options.map((o: any, i: number) => ({
          id: `opt-rem-${Date.now()}-${i}`,
          text: o.text,
          isCorrect: o.isCorrect,
          label: String.fromCharCode(65 + i)
        })),
        updatedAt: new Date().toISOString()
      };
      onUpdate(updated);
      setAuditResult(null);
      setSelectedItem(null);
      setIsApplying(false);
    }, 1200);
  };

  const renderQueue = () => (
    <section
      aria-labelledby="integrity-queue"
      className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card"
    >
      <div className="border-b border-stone-200 px-4 py-3">
        <h3 id="integrity-queue" className="text-[15px] font-semibold text-stone-900">
          Items to audit
        </h3>
        <p className="mt-0.5 text-[13px] text-stone-500">
          {items.length > 0
            ? `${items.length.toLocaleString()} ${items.length === 1 ? 'item' : 'items'} · select one to run an audit`
            : 'Nothing to audit for this type'}
        </p>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y divide-stone-100">
          {items.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            const hasStats = typeof item.pValue === 'number' || typeof item.sampleSize === 'number';
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void handleAudit(item)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                    isSelected ? 'bg-stone-50' : 'hover:bg-stone-50',
                  )}
                >
                  {isSelected && (
                    <span className="absolute inset-y-0 left-0 w-0.5 bg-brand-500" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm leading-5 text-stone-900">
                      {item.stem || <span className="text-stone-400">Untitled item</span>}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-stone-500">
                      <span className="font-mono text-stone-400">
                        {item.identifier || item.id.slice(0, 8)}
                      </span>
                      {hasStats && (
                        <>
                          <span aria-hidden="true">·</span>
                          {typeof item.pValue === 'number' && (
                            <span className="tabular-nums">P {item.pValue.toFixed(2)}</span>
                          )}
                          {typeof item.sampleSize === 'number' && (
                            <span className="tabular-nums">
                              {item.sampleSize.toLocaleString()} attempts
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </span>
                  <StatusDot tone={STATUS_TONE[item.status] ?? 'neutral'}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </StatusDot>
                  {auditingId === item.id ? (
                    <Loader2 size={16} className="mt-0.5 flex-shrink-0 animate-spin text-brand-600" />
                  ) : (
                    <ChevronRight
                      size={16}
                      className="mt-0.5 flex-shrink-0 text-stone-300 transition-colors group-hover:text-stone-500"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={ShieldCheck}
          title="No items to audit"
          description="Items of this type show up here once they're in the bank."
        />
      )}
    </section>
  );

  const renderReport = () => (
    <div className="space-y-6">
      {/* Report */}
      <section
        aria-labelledby="integrity-report"
        className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card"
      >
        <div className="flex items-start gap-3 border-b border-stone-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 id="integrity-report" className="text-[15px] font-semibold text-stone-900">
              Audit report
            </h3>
            <p className="mt-0.5 truncate font-mono text-xs text-stone-400">
              {selectedItem?.identifier || selectedItem?.id}
            </p>
          </div>
          <IconButton icon={X} size="sm" label="Close report" onClick={() => setAuditResult(null)} />
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-2">
          <div className="space-y-5">
            <div>
              <p className="text-[13px] text-stone-500">Integrity score</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-stone-900 tabular-nums">
                  {auditResult.integrityScore}
                </span>
                <span className="text-sm text-stone-500">/ 100</span>
                <Badge tone={auditResult.integrityScore > 70 ? 'green' : 'red'} dot className="ml-1">
                  {auditResult.integrityScore > 70 ? 'Sound' : 'Needs work'}
                </Badge>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-stone-900">Flaws found</p>
              <ul className="space-y-2">
                {auditResult.flaws.map((flaw: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-6 text-stone-700">
                    <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    {flaw}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-stone-900">Difficulty over time</p>
            <div className="h-36 w-full text-brand-500">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={driftHistory} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: CHART_AXIS, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_GRID }}
                  />
                  <YAxis
                    domain={[0.4, 0.8]}
                    tick={{ fill: CHART_AXIS, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: `1px solid ${CHART_GRID}`,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: CHART_AXIS }}
                    itemStyle={{ color: CHART_TEXT }}
                    formatter={(value) => [Number(value).toFixed(2), 'P-value']}
                  />
                  <Line
                    type="monotone"
                    dataKey="pValue"
                    stroke="currentColor"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'currentColor', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[13px]">
              <div className="flex-1 rounded-lg border border-stone-200 px-3 py-2">
                <p className="text-xs text-stone-500">Baseline P</p>
                <p className="font-semibold text-stone-900 tabular-nums">0.72</p>
              </div>
              <ArrowRight size={15} className="flex-shrink-0 text-stone-300" aria-hidden="true" />
              <div className="flex-1 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
                <p className="text-xs text-red-700">Current P</p>
                <p className="font-semibold text-red-700 tabular-nums">0.58</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Suggested rewrite */}
      <section
        aria-labelledby="integrity-rewrite"
        className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-5 py-4">
          <h3 id="integrity-rewrite" className="mr-1 text-[15px] font-semibold text-stone-900">
            Suggested rewrite
          </h3>
          <Badge tone="violet" icon={Sparkles}>
            AI
          </Badge>
          <Badge tone="amber" dot>
            Needs review
          </Badge>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-stone-500">Stem</p>
            <p className="text-[15px] leading-7 text-stone-900">{auditResult.reconstructedItem.stem}</p>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-stone-500">Options</p>
            <OptionList options={auditResult.reconstructedItem.options} columns />
          </div>
          {auditResult.suggestedRemedy && (
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="mb-1 text-[13px] font-medium text-stone-500">Why this rewrite</p>
              <p className="text-sm leading-6 text-stone-700">{auditResult.suggestedRemedy}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 px-5 py-3">
          <p className="mr-auto text-[13px] text-stone-500">
            Applying replaces the item's stem and options.
          </p>
          <Button variant="ghost" onClick={() => setAuditResult(null)} disabled={isApplying}>
            Dismiss
          </Button>
          <Button variant="primary" icon={Check} loading={isApplying} onClick={applyRemedy}>
            {isApplying ? 'Applying…' : 'Apply rewrite'}
          </Button>
        </div>
      </section>
    </div>
  );

  const renderDetail = () => {
    if (auditResult) return renderReport();

    if (!selectedItem) {
      return (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white">
          <EmptyState
            icon={ShieldCheck}
            title="Select an item to audit"
            description="An audit checks the stem and distractors for writing flaws and compares how the item performs now with its baseline, then suggests a rewrite."
            className="min-h-[360px]"
          />
        </div>
      );
    }

    if (auditingId === selectedItem.id) {
      return (
        <div className="rounded-xl border border-stone-200 bg-white py-24">
          <Spinner label="Auditing item…" />
        </div>
      );
    }

    return (
      <section
        aria-labelledby="integrity-selected"
        className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card"
      >
        <div className="flex items-start gap-3 border-b border-stone-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 id="integrity-selected" className="text-[15px] font-semibold text-stone-900">
              Selected item
            </h3>
            <p className="mt-0.5 truncate font-mono text-xs text-stone-400">
              {selectedItem.identifier || selectedItem.id}
            </p>
          </div>
          <IconButton icon={X} size="sm" label="Clear selection" onClick={() => setSelectedItem(null)} />
        </div>
        <div className="space-y-5 p-5">
          <InlineAlert tone="info">
            Automated audits aren't connected yet, so there's no report for this item.
          </InlineAlert>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-stone-500">Stem</p>
            <p className="text-[15px] leading-7 text-stone-900">
              {selectedItem.stem || <span className="text-stone-400">No stem</span>}
            </p>
          </div>
          {selectedItem.options && selectedItem.options.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-medium text-stone-500">Options</p>
              <OptionList options={selectedItem.options} />
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {renderQueue()}
      <div className="min-w-0 xl:sticky xl:top-6">{renderDetail()}</div>
    </div>
  );
};

export default ItemIntegrityView;
