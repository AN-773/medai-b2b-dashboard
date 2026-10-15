import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { Check, Zap } from 'lucide-react';
import { MOCK_EXAM_BLUEPRINTS, MOCK_RELIABILITY_TARGETS, MOCK_ORGAN_SYSTEMS } from '../constants';
import DashboardCard from '../components/DashboardCard';
import {
  Button,
  Field,
  InlineAlert,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  StatusDot,
} from '@/components/ui';
import {
  CHART_COLORS,
  ChartFrame,
  ChartTooltipCard,
  axisLabel,
  axisTick,
  tooltipDatum,
  type ChartTooltipProps,
} from '@/components/analytics/chartTheme';

/** Published items that currently match this blueprint (static until the bank query is wired up). */
const ELIGIBLE_PUBLISHED_ITEMS = 412;

const DELIVERY_RULES = [
  'Linear sequential delivery',
  'Block timing: 60 minutes',
  'System-based stratification enabled',
  'Non-functional-distractor items suppressed',
];

const MIN_ITEMS = 5;
const MAX_ITEMS = 500;

/** P-value band each difficulty label targets (matches the curve below). */
const DIFFICULTY_RANGES: Record<string, string> = {
  Easy: 'P ≥ 0.70',
  Moderate: 'P 0.40–0.70',
  Hard: 'P ≤ 0.40',
};

/** Readable names for blueprint system ids that aren't in the organ-system catalog. */
const SYSTEM_ABBREVIATIONS: Record<string, string> = {
  CV: 'Cardiovascular',
  RENAL: 'Renal & urinary',
  GI: 'Gastrointestinal',
  RESP: 'Respiratory',
  ENDO: 'Endocrine',
  NEURO: 'Nervous system',
  MSK: 'Musculoskeletal',
  REPRO: 'Reproductive',
  HEME: 'Blood & lymphoreticular',
};

/**
 * Splits `total` into whole numbers proportional to `shares` (largest-remainder
 * method), so rows always add up exactly to the form length.
 */
const allocate = (shares: number[], total: number): number[] => {
  const sum = shares.reduce((acc, share) => acc + share, 0);
  if (sum <= 0 || total <= 0) return shares.map(() => 0);
  const exact = shares.map((share) => (share / sum) * total);
  const counts = exact.map(Math.floor);
  let remainder = total - counts.reduce((acc, count) => acc + count, 0);
  exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction)
    .forEach(({ index }) => {
      if (remainder > 0) {
        counts[index] += 1;
        remainder -= 1;
      }
    });
  return counts;
};

interface CompositionRow {
  key: string;
  label: React.ReactNode;
  meta?: string;
  /** 0–100 */
  share: number;
  count: number;
  tone?: 'brand' | 'amber';
}

/** Share/questions table with a totals row — used for every composition dimension. */
const CompositionTable: React.FC<{
  caption: string;
  firstColumn: string;
  rows: CompositionRow[];
  total: number;
  showBars?: boolean;
}> = ({ caption, firstColumn, rows, total, showBars = false }) => (
  <table className="w-full text-left text-[13px]">
    <caption className="sr-only">{caption}</caption>
    <thead>
      <tr className="border-b border-stone-200 text-stone-500">
        <th scope="col" className="py-2 pr-3 font-medium">{firstColumn}</th>
        {showBars && (
          <th scope="col" className="hidden w-[32%] py-2 pr-3 font-medium sm:table-cell">
            <span className="sr-only">Share bar</span>
          </th>
        )}
        <th scope="col" className="py-2 pr-3 text-right font-medium">Share</th>
        <th scope="col" className="py-2 text-right font-medium">Questions</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.key} className="border-b border-stone-100">
          <td className="py-2.5 pr-3">
            <span className="text-sm text-stone-900">{row.label}</span>
            {row.meta && <span className="ml-2 text-xs text-stone-500">{row.meta}</span>}
          </td>
          {showBars && (
            <td className="hidden py-2.5 pr-3 sm:table-cell">
              <ProgressBar value={row.share} max={100} tone={row.tone} label={`${row.share}% share`} />
            </td>
          )}
          <td className="py-2.5 pr-3 text-right tabular-nums text-stone-700">{row.share}%</td>
          <td className="py-2.5 text-right font-medium tabular-nums text-stone-900">
            {row.count.toLocaleString()}
          </td>
        </tr>
      ))}
    </tbody>
    <tfoot>
      <tr>
        <th scope="row" className="pt-2.5 pr-3 font-medium text-stone-900">Total</th>
        {showBars && <td className="hidden sm:table-cell" />}
        <td className="pt-2.5 pr-3 text-right font-medium tabular-nums text-stone-900">
          {rows.reduce((acc, row) => acc + row.share, 0)}%
        </td>
        <td className="pt-2.5 text-right font-semibold tabular-nums text-stone-900">
          {total.toLocaleString()}
        </td>
      </tr>
    </tfoot>
  </table>
);

const ExamBlueprintView: React.FC = () => {
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>(MOCK_EXAM_BLUEPRINTS[0].id);
  const [itemCount, setItemCount] = useState(MOCK_EXAM_BLUEPRINTS[0].totalItems);
  const [showAssembleNotice, setShowAssembleNotice] = useState(false);

  const selectedBlueprint = useMemo(() =>
    MOCK_EXAM_BLUEPRINTS.find(b => b.id === selectedBlueprintId) || MOCK_EXAM_BLUEPRINTS[0]
  , [selectedBlueprintId]);

  const reliabilityTarget = useMemo(() =>
    MOCK_RELIABILITY_TARGETS.find(t => t.context.toLowerCase().includes(selectedBlueprint.name.toLowerCase().split(' ')[0]))
    || MOCK_RELIABILITY_TARGETS[0]
  , [selectedBlueprint]);

  // Transform Difficulty Distribution for AreaChart
  const difficultyData = useMemo(() => {
    // Generate a curve based on proportions
    const points = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

    return points.map(p => {
      let weight = 0;
      selectedBlueprint.difficultyDistribution.forEach(dist => {
        if (dist.label === 'Easy' && p >= 0.7) weight += dist.proportion * Math.exp(-Math.pow(p - 0.8, 2) / 0.02);
        if (dist.label === 'Moderate' && p >= 0.4 && p <= 0.7) weight += dist.proportion * Math.exp(-Math.pow(p - 0.55, 2) / 0.01);
        if (dist.label === 'Hard' && p <= 0.4) weight += dist.proportion * Math.exp(-Math.pow(p - 0.25, 2) / 0.02);
      });
      return { pValue: p, weight: Math.round(weight * 100) };
    });
  }, [selectedBlueprint]);

  const getSystemName = (id: string) => {
    const known = MOCK_ORGAN_SYSTEMS.find(s => s.id === id)?.name;
    if (known) return known;
    const code = id.replace(/^(USMLE|SYS)-/, '');
    return SYSTEM_ABBREVIATIONS[code] ?? id;
  };

  const selectTemplate = (id: string) => {
    const template = MOCK_EXAM_BLUEPRINTS.find(bp => bp.id === id);
    if (!template) return;
    setSelectedBlueprintId(template.id);
    setItemCount(template.totalItems);
  };

  // ---- Composition ------------------------------------------------------------
  const systemRows = useMemo(() => {
    const weights = selectedBlueprint.organSystemWeights;
    const allocated = weights.reduce((acc, sys) => acc + sys.weightPercent, 0);
    const unallocated = Math.max(0, 100 - allocated);
    const counts = allocate([...weights.map(sys => sys.weightPercent), unallocated], itemCount);
    const rows: CompositionRow[] = weights.map((sys, index) => ({
      key: sys.organSystemId,
      label: getSystemName(sys.organSystemId),
      share: sys.weightPercent,
      count: counts[index],
    }));
    if (unallocated > 0) {
      rows.push({
        key: 'unallocated',
        label: <StatusDot tone="amber">Not assigned to a system</StatusDot>,
        share: unallocated,
        count: counts[counts.length - 1],
        tone: 'amber',
      });
    }
    return { rows, allocated, unallocated, unallocatedCount: unallocated > 0 ? counts[counts.length - 1] : 0 };
    // getSystemName is a pure lookup over constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlueprint, itemCount]);

  const difficultyRows = useMemo<CompositionRow[]>(() => {
    const counts = allocate(selectedBlueprint.difficultyDistribution.map(d => d.proportion), itemCount);
    return selectedBlueprint.difficultyDistribution.map((dist, index) => ({
      key: dist.label,
      label: dist.label,
      meta: DIFFICULTY_RANGES[dist.label],
      share: Math.round(dist.proportion * 100),
      count: counts[index],
    }));
  }, [selectedBlueprint, itemCount]);

  const bloomRows = useMemo<CompositionRow[]>(() => {
    const counts = allocate(selectedBlueprint.bloomDistribution.map(b => b.proportion), itemCount);
    return selectedBlueprint.bloomDistribution.map((bloom, index) => ({
      key: bloom.bloomLevel,
      label: bloom.bloomLevel,
      share: Math.round(bloom.proportion * 100),
      count: counts[index],
    }));
  }, [selectedBlueprint, itemCount]);

  const bloomData = bloomRows.map(row => ({ level: String(row.label), share: row.share, count: row.count }));

  const rankedSummary = (rows: CompositionRow[], noun: string) => {
    const ranked = [...rows].sort((left, right) => right.share - left.share);
    if (ranked.length === 0) return `No ${noun} targets set.`;
    const [top, second] = ranked;
    return second
      ? `${String(top.label)} carries the most weight (${top.share}%), followed by ${String(second.label).toLowerCase()} (${second.share}%).`
      : `All questions are ${String(top.label).toLowerCase()}.`;
  };
  const difficultySummary = rankedSummary(difficultyRows, 'difficulty');
  const bloomSummary = rankedSummary(bloomRows, "Bloom's");

  const systemsSummary =
    systemRows.unallocated > 0
      ? `${selectedBlueprint.organSystemWeights.length} systems carry ${systemRows.allocated}% of the form; ${systemRows.unallocatedCount.toLocaleString()} questions (${systemRows.unallocated}%) aren't tied to a system.`
      : `All questions are spread across ${selectedBlueprint.organSystemWeights.length} systems.`;

  const hasEnoughItems = ELIGIBLE_PUBLISHED_ITEMS >= itemCount;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Blueprint builder"
        description="Pick a template and form length, check how questions are spread across systems, difficulty and cognitive level, then assemble the form from your bank."
        actions={
          <Button variant="primary" icon={Zap} onClick={() => setShowAssembleNotice(true)}>
            Assemble form
          </Button>
        }
      />

      {showAssembleNotice && (
        <InlineAlert tone="info" title="Form assembly isn't connected yet" onDismiss={() => setShowAssembleNotice(false)}>
          This blueprint is a preview. Nothing has been generated or saved.
        </InlineAlert>
      )}

      <section aria-labelledby="blueprint-setup" className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <h2 id="blueprint-setup" className="text-[15px] font-semibold text-stone-900">Setup</h2>
        <div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
          <Field label="Template" description={selectedBlueprint.description}>
            {(id) => (
              <Select id={id} value={selectedBlueprintId} onChange={(event) => selectTemplate(event.target.value)}>
                {MOCK_EXAM_BLUEPRINTS.map(bp => (
                  <option key={bp.id} value={bp.id}>
                    {bp.name} · {bp.totalItems} items · {bp.organSystemWeights.length} systems
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Questions"
            description={`Template default: ${selectedBlueprint.totalItems.toLocaleString()}`}
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={MIN_ITEMS}
                max={MAX_ITEMS}
                step={5}
                value={itemCount === 0 ? '' : itemCount}
                onChange={(event) => {
                  const next = event.target.valueAsNumber;
                  setItemCount(Number.isFinite(next) ? Math.min(MAX_ITEMS, Math.max(0, Math.round(next))) : 0);
                }}
                onBlur={() => setItemCount(count => Math.min(MAX_ITEMS, Math.max(MIN_ITEMS, count)))}
                className="tabular-nums"
              />
            )}
          </Field>
          <div className="min-w-0">
            <p className="mb-1.5 text-[13px] font-medium text-stone-700">Reliability target</p>
            <div className="flex h-9 items-center gap-2 rounded-lg bg-stone-50 px-3 text-sm ring-1 ring-inset ring-stone-200">
              <span className="font-medium text-stone-900">KR-20 ≥ {reliabilityTarget.targetKR20}</span>
              <span className="text-stone-300" aria-hidden="true">·</span>
              <span className="truncate text-stone-600">Cronbach's α ≥ {reliabilityTarget.targetCronbachAlpha}</span>
            </div>
            <p className="mt-1.5 text-xs text-stone-500">For {reliabilityTarget.context}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DashboardCard title="Organ systems" subtitle={systemsSummary} headingLevel={2}>
          <CompositionTable
            caption={`Questions per organ system for a ${itemCount}-question form`}
            firstColumn="System"
            rows={systemRows.rows}
            total={itemCount}
            showBars
          />
        </DashboardCard>

        <DashboardCard
          title="Readiness"
          subtitle="Whether your bank can fill this blueprint."
          headingLevel={2}
        >
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-stone-700">Eligible published items</span>
            <span className="text-[22px] font-semibold leading-none tabular-nums text-stone-900">
              {ELIGIBLE_PUBLISHED_ITEMS.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 space-y-1">
            <StatusDot tone={hasEnoughItems ? 'green' : 'amber'}>
              {hasEnoughItems
                ? `Enough to fill ${itemCount.toLocaleString()} questions`
                : `${(itemCount - ELIGIBLE_PUBLISHED_ITEMS).toLocaleString()} short of ${itemCount.toLocaleString()} questions`}
            </StatusDot>
            <p className="text-[13px] text-stone-500">Sufficient variance detected across all target p-value clusters.</p>
          </div>

          <div className="mt-5 border-t border-stone-100 pt-4">
            <h3 className="text-sm font-medium text-stone-900">Delivery rules</h3>
            <ul className="mt-2 space-y-2">
              {DELIVERY_RULES.map(rule => (
                <li key={rule} className="flex items-center gap-2.5 text-sm text-stone-700">
                  <Check size={15} className="flex-shrink-0 text-brand-600" aria-hidden="true" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard title="Difficulty mix" subtitle={difficultySummary} headingLevel={2}>
          <ChartFrame label={`Target difficulty curve across P-values. ${difficultySummary}`} className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={difficultyData} margin={{ top: 8, right: 8, bottom: 16, left: 8 }}>
                <defs>
                  <linearGradient id="blueprintCurveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.brand} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={CHART_COLORS.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis
                  dataKey="pValue"
                  axisLine={{ stroke: CHART_COLORS.axis }}
                  tickLine={false}
                  tick={axisTick}
                  tickFormatter={(value: number) => value.toFixed(1)}
                  label={{ value: 'Difficulty (P-value)', position: 'insideBottom', offset: -10, ...axisLabel }}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ stroke: CHART_COLORS.axis }}
                  content={(props: ChartTooltipProps) => {
                    const point = tooltipDatum<{ pValue: number; weight: number }>(props);
                    if (!point) return null;
                    return (
                      <ChartTooltipCard
                        title={`P ${point.pValue.toFixed(1)}`}
                        rows={[{ label: 'Relative weight', value: point.weight, color: CHART_COLORS.brand }]}
                      />
                    );
                  }}
                />
                <Area type="monotone" dataKey="weight" stroke={CHART_COLORS.brand} strokeWidth={2} fill="url(#blueprintCurveFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
          <div className="mt-4">
            <CompositionTable
              caption="Questions per difficulty level"
              firstColumn="Level"
              rows={difficultyRows}
              total={itemCount}
            />
          </div>
        </DashboardCard>

        <DashboardCard title="Cognitive level (Bloom's)" subtitle={bloomSummary} headingLevel={2}>
          <ChartFrame label={`Bar chart of question share by Bloom's level. ${bloomSummary}`} className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bloomData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="level" axisLine={{ stroke: CHART_COLORS.axis }} tickLine={false} tick={axisTick} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  tickFormatter={(value: number) => `${value}%`}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: CHART_COLORS.hover }}
                  content={(props: ChartTooltipProps) => {
                    const bar = tooltipDatum<{ level: string; share: number; count: number }>(props);
                    if (!bar) return null;
                    return (
                      <ChartTooltipCard
                        title={bar.level}
                        rows={[
                          { label: 'Share', value: `${bar.share}%`, color: CHART_COLORS.brand },
                          { label: 'Questions', value: bar.count.toLocaleString() },
                        ]}
                      />
                    );
                  }}
                />
                <Bar dataKey="share" fill={CHART_COLORS.brand} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <div className="mt-4">
            <CompositionTable
              caption="Questions per Bloom's level"
              firstColumn="Level"
              rows={bloomRows}
              total={itemCount}
            />
          </div>
        </DashboardCard>
      </div>
    </div>
  );
};

export default ExamBlueprintView;
