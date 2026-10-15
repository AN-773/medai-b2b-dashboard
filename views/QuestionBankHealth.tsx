import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceArea, ReferenceLine,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  Gauge,
  ListChecks,
  SearchX,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';

import DashboardCard from '../components/DashboardCard';
import CustomTooltip from '../components/Tooltip';
import { testsService } from '../services/testsService';
import { Psychometric, DashboardStatsResponse } from '../types/TestsServiceTypes';
import { useGlobal } from '../contexts/GlobalContext';
import { OrganSystem, Topic, Discipline, Tag, Subject, Competency } from '../types/TestsServiceTypes';
import {
  Button,
  Dialog,
  Drawer,
  EmptyState,
  InlineAlert,
  PageHeader,
  SearchInput,
  SectionHeader,
  Select,
  Spinner,
  StatusDot,
  cn,
  type BadgeTone,
} from '@/components/ui';
import { KpiTile } from '@/components/analytics/KpiTile';
import { FilterChecklist, type FilterOption } from '@/components/analytics/FilterChecklist';
import {
  CHART_COLORS,
  ChartFrame,
  ChartLegend,
  ChartTooltipCard,
  axisLabel,
  axisTick,
  formatPercent,
  tooltipDatum,
  type ChartTooltipProps,
} from '@/components/analytics/chartTheme';

const EXAM_OPTIONS = [
  { id: 'STEP 1', name: 'Step 1' },
  { id: 'STEP 2', name: 'Step 2' },
  { id: 'STEP 3', name: 'Step 3' },
];

type DifficultyBand = 'ideal' | 'acceptable' | 'out';

const BAND_COLORS: Record<DifficultyBand, string> = {
  ideal: CHART_COLORS.brand,
  acceptable: CHART_COLORS.brandSoft,
  out: CHART_COLORS.amber,
};

interface DifficultyBin {
  range: string;
  label: string;
  count: number;
  band: DifficultyBand;
}

interface ScatterPoint {
  x: number;
  y: number;
  id: string;
  z: number;
  displayId: string;
  editorId: string;
}

/** Question ids arrive as resource paths (".../questions/QID-1"); the editor wants the last segment. */
const parseQuestionId = (questionId?: string) => {
  const questionIdMatch = questionId?.match(/\/questions\/([^/]+)$/);
  const displayId = questionIdMatch ? questionIdMatch[1] : questionId || 'Unknown';
  const editorId = questionIdMatch
    ? questionIdMatch[1]
    : (questionId || '').split('/').filter(Boolean).pop() || '';
  return { displayId, editorId };
};

const discriminationColor = (r: number) =>
  r < 0 ? CHART_COLORS.red : r < 0.3 ? CHART_COLORS.amber : CHART_COLORS.brand;

const fmt = (value: number) => value.toLocaleString();

const SORT_HELP: Record<string, string> = {
  total_answer_count: 'How many learner answers this item has.',
  p_value: 'Difficulty: the share of learners who answered correctly (0–1). Target 0.30–0.70.',
  r_b: 'Discrimination: point-biserial correlation with total score. 0.30 or higher is good; below 0 means strong learners miss it.',
  must_revise: 'Whether every distractor attracts learners, or the item needs revision.',
};

interface SortHeaderProps {
  column: string;
  label: string;
  align?: 'left' | 'right';
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
}

const SortHeader: React.FC<SortHeaderProps> = ({
  column,
  label,
  align = 'left',
  sortColumn,
  sortDirection,
  onSort,
}) => {
  const active = sortColumn === column;
  const SortIcon = !active ? ChevronsUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;
  const help = SORT_HELP[column];
  return (
    <th
      scope="col"
      aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('whitespace-nowrap px-4 py-2.5 font-medium', align === 'right' && 'text-right')}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        <button
          type="button"
          onClick={() => onSort(column)}
          className={cn(
            'inline-flex items-center gap-1 rounded transition hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
            active && 'text-stone-900',
          )}
        >
          {label}
          <SortIcon size={13} className={active ? 'text-stone-700' : 'text-stone-300'} aria-hidden="true" />
        </button>
        {help && (
          <CustomTooltip content={help} position="top">
            <span
              tabIndex={0}
              aria-label={`About ${label.toLowerCase()}: ${help}`}
              className="inline-flex rounded text-stone-300 transition hover:text-stone-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <CircleHelp size={13} aria-hidden="true" />
            </span>
          </CustomTooltip>
        )}
      </span>
    </th>
  );
};

const StandardRow: React.FC<{ tone: BadgeTone; label: string; detail: string }> = ({
  tone,
  label,
  detail,
}) => (
  <li className="flex items-baseline justify-between gap-4 py-2">
    <StatusDot tone={tone}>{label}</StatusDot>
    <span className="text-right text-[13px] tabular-nums text-stone-700">{detail}</span>
  </li>
);

const QuestionBankHealth: React.FC = () => {
  const navigate = useNavigate();
  const [isStandardsModalOpen, setIsStandardsModalOpen] = useState(false);
  const [psychometrics, setPsychometrics] = useState<Psychometric[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 10;
  const totalPages = Math.ceil(totalItems / limit);

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string>('p_value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter State
  const { cognitiveSkills } = useGlobal();
  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  const [selectedExamType, setSelectedExamType] = useState<string>('ALL');
  const [selectedIdentifier, setSelectedIdentifier] = useState<string>('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const [selectedOrganSystems, setSelectedOrganSystems] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedCognitiveSkills, setSelectedCognitiveSkills] = useState<string[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);

  const [showFilters, setShowFilters] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectedIdentifier(localSearchQuery);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setFiltersLoading(true);
        const [sysRes, discRes, tagsRes, subjRes, compRes] = await Promise.all([
          testsService.getOrganSystems(),
          testsService.getDisciplines(1, 200),
          testsService.getTags(1, 200),
          testsService.getSubjects(1, 200),
          testsService.getCompetencies(1, 200)
        ]);

        setOrganSystems(sysRes.items || []);
        setDisciplines(discRes.items || []);
        setTags(tagsRes.items || []);
        setSubjects(subjRes.items || []);
        setCompetencies(compRes.items || []);
      } catch (error) {
        console.error('Failed to fetch initial filter data:', error);
      } finally {
        setFiltersLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch topics when organ systems change
  useEffect(() => {
    const fetchTopics = async () => {
      if (selectedOrganSystems.length === 0) {
        setTopics([]);
        return;
      }
      try {
        // Topics are fetched for the primary (first) selected system.
        const response = await testsService.getTopics(selectedOrganSystems[0]);
        setTopics(response.items || []);
      } catch (error) {
        console.error('Failed to fetch topics:', error);
      }
    };
    fetchTopics();
  }, [selectedOrganSystems]);

  useEffect(() => {
    const fetchPsychometrics = async () => {
      try {
        setLoading(true);
        setItemsError(null);
        const res = await testsService.getPyschometrics(
          page,
          limit,
          sortColumn,
          sortDirection,
          selectedExamType === 'ALL' ? undefined : selectedExamType,
          selectedIdentifier || undefined,
          selectedOrganSystems.length > 0 ? selectedOrganSystems.join(',') : undefined,
          selectedTopics.length > 0 ? selectedTopics.join(',') : undefined,
          selectedCognitiveSkills.length > 0 ? selectedCognitiveSkills.join(',') : undefined,
          selectedDisciplines.length > 0 ? selectedDisciplines.join(',') : undefined,
          selectedSubjects.length > 0 ? selectedSubjects.join(',') : undefined,
          selectedTags.length > 0 ? selectedTags.join(',') : undefined,
          selectedCompetencies.length > 0 ? selectedCompetencies.join(',') : undefined
        );
        setPsychometrics(res.items || []);
        setTotalItems(res.total || 0);
      } catch (err) {
        console.error("Failed to fetch psychometrics", err);
        setItemsError("Couldn't load item statistics. Try again in a moment.");
      } finally {
        setLoading(false);
      }
    };
    fetchPsychometrics();
  }, [page, sortColumn, sortDirection, selectedExamType, selectedIdentifier, selectedOrganSystems, selectedTopics, selectedCognitiveSkills, selectedDisciplines, selectedSubjects, selectedTags, selectedCompetencies]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        setStatsError(null);
        const res = await testsService.getDashboardStats(
          selectedExamType === 'ALL' ? undefined : selectedExamType,
          selectedIdentifier || undefined,
          selectedOrganSystems.length > 0 ? selectedOrganSystems.join(',') : undefined,
          selectedTopics.length > 0 ? selectedTopics.join(',') : undefined,
          selectedCognitiveSkills.length > 0 ? selectedCognitiveSkills.join(',') : undefined,
          selectedDisciplines.length > 0 ? selectedDisciplines.join(',') : undefined,
          selectedSubjects.length > 0 ? selectedSubjects.join(',') : undefined,
          selectedTags.length > 0 ? selectedTags.join(',') : undefined,
          selectedCompetencies.length > 0 ? selectedCompetencies.join(',') : undefined
        );
        setDashboardStats(res);
      } catch (err) {
        console.error("Failed to fetch dashboard stats", err);
        setStatsError("Couldn't load bank-level statistics. The item table below may still be available.");
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [selectedExamType, selectedIdentifier, selectedOrganSystems, selectedTopics, selectedCognitiveSkills, selectedDisciplines, selectedSubjects, selectedTags, selectedCompetencies]);

  const clearFilters = () => {
    setSelectedExamType('ALL');
    setLocalSearchQuery('');
    setSelectedIdentifier('');
    setSelectedOrganSystems([]);
    setSelectedTopics([]);
    setSelectedCognitiveSkills([]);
    setSelectedDisciplines([]);
    setSelectedSubjects([]);
    setSelectedTags([]);
    setSelectedCompetencies([]);
    setPage(1);
  };

  const hasActiveFilters = localSearchQuery !== '' || selectedExamType !== 'ALL' || selectedOrganSystems.length > 0 || selectedTopics.length > 0 || selectedCognitiveSkills.length > 0 || selectedDisciplines.length > 0 || selectedSubjects.length > 0 || selectedTags.length > 0 || selectedCompetencies.length > 0;

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc'); // Default to descending for new sorts
    }
    setPage(1); // Reset to first page on sort
  };

  const showFlaggedItems = () => {
    setSortColumn('must_revise');
    setSortDirection('desc');
    setPage(1);
    document.getElementById('item-audit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openInWorkbench = (editorQuestionId: string) => {
    if (!editorQuestionId || editorQuestionId === 'Unknown') return;
    navigate(`/workbench?questionId=${encodeURIComponent(editorQuestionId)}`);
  };

  // ---- Filter groups (drawer + active chips) ----------------------------------
  const filterGroups: Array<{
    key: string;
    label: string;
    options: FilterOption[];
    values: string[];
    onChange: (values: string[]) => void;
    loading?: boolean;
    disabled?: boolean;
    disabledHint?: string;
  }> = [
    {
      key: 'organSystems',
      label: 'Organ systems',
      options: organSystems.map(x => ({ id: x.id, name: x.title || x.id })),
      values: selectedOrganSystems,
      onChange: (v) => { setSelectedOrganSystems(v); setSelectedTopics([]); setPage(1); },
      loading: filtersLoading,
    },
    {
      key: 'topics',
      label: 'Topics',
      options: topics.map(x => ({ id: x.id, name: x.title || x.id })),
      values: selectedTopics,
      onChange: (v) => { setSelectedTopics(v); setPage(1); },
      disabled: selectedOrganSystems.length === 0,
      disabledHint: 'Choose an organ system first — topics are listed for the first system you pick.',
    },
    {
      key: 'cognitiveSkills',
      label: 'Cognitive skills',
      options: (cognitiveSkills || []).map(x => ({ id: x.id, name: x.title })),
      values: selectedCognitiveSkills,
      onChange: (v) => { setSelectedCognitiveSkills(v); setPage(1); },
    },
    {
      key: 'disciplines',
      label: 'Disciplines',
      options: disciplines.map(x => ({ id: x.id, name: x.title })),
      values: selectedDisciplines,
      onChange: (v) => { setSelectedDisciplines(v); setPage(1); },
      loading: filtersLoading,
    },
    {
      key: 'subjects',
      label: 'Subjects',
      options: subjects.map(x => ({ id: x.id, name: x.title })),
      values: selectedSubjects,
      onChange: (v) => { setSelectedSubjects(v); setPage(1); },
      loading: filtersLoading,
    },
    {
      key: 'tags',
      label: 'Tags',
      options: tags.map(x => ({ id: x.id, name: x.title })),
      values: selectedTags,
      onChange: (v) => { setSelectedTags(v); setPage(1); },
      loading: filtersLoading,
    },
    {
      key: 'competencies',
      label: 'Competencies',
      options: competencies.map(x => ({ id: x.id, name: x.title })),
      values: selectedCompetencies,
      onChange: (v) => { setSelectedCompetencies(v); setPage(1); },
      loading: filtersLoading,
    },
  ];

  const activeGroups = filterGroups.filter(group => group.values.length > 0);
  const clearAttributeFilters = () => {
    setSelectedOrganSystems([]);
    setSelectedTopics([]);
    setSelectedCognitiveSkills([]);
    setSelectedDisciplines([]);
    setSelectedSubjects([]);
    setSelectedTags([]);
    setSelectedCompetencies([]);
    setPage(1);
  };

  const chipLabel = (group: (typeof filterGroups)[number]) => {
    if (group.values.length === 1) {
      const name = group.options.find(option => option.id === group.values[0])?.name;
      if (name) return `${group.label}: ${name}`;
    }
    return `${group.label} · ${group.values.length}`;
  };

  // ---- Chart data ---------------------------------------------------------------
  const pValueDist: DifficultyBin[] = dashboardStats ? [
    { range: '<0.30', label: 'Too hard', count: dashboardStats.difficulty_distribution.too_hard, band: 'out' },
    { range: '0.30–0.50', label: 'Acceptable', count: dashboardStats.difficulty_distribution.acceptable_low, band: 'acceptable' },
    { range: '0.50–0.60', label: 'Ideal', count: dashboardStats.difficulty_distribution.ideal, band: 'ideal' },
    { range: '0.60–0.70', label: 'Acceptable', count: dashboardStats.difficulty_distribution.acceptable_high, band: 'acceptable' },
    { range: '>0.70', label: 'Too easy', count: dashboardStats.difficulty_distribution.too_easy, band: 'out' },
  ] : [];

  const scatterData: ScatterPoint[] = (dashboardStats?.scatter_plot_data || []).map(i => ({
    x: i.p_value,
    y: i.r_b,
    id: i.question_id,
    z: 100,
    ...parseQuestionId(i.question_id),
  }));

  const difficultySummary = useMemo(() => {
    if (!dashboardStats) return statsLoading ? 'Loading difficulty…' : 'No difficulty data.';
    const d = dashboardStats.difficulty_distribution;
    const total = d.too_hard + d.acceptable_low + d.ideal + d.acceptable_high + d.too_easy;
    if (total === 0) return 'No items with learner attempts in this selection yet.';
    const inRange = d.acceptable_low + d.ideal + d.acceptable_high;
    return `${formatPercent(inRange, total)} of ${fmt(total)} items sit in the 0.30–0.70 target range · ${fmt(d.too_hard)} too hard, ${fmt(d.too_easy)} too easy.`;
  }, [dashboardStats, statsLoading]);

  const discriminationSummary = useMemo(() => {
    if (!dashboardStats) return statsLoading ? 'Loading discrimination…' : 'No discrimination data.';
    const points = dashboardStats.scatter_plot_data || [];
    if (points.length === 0) return 'No items with learner attempts in this selection yet.';
    const negative = points.filter(point => point.r_b < 0).length;
    const weak = points.filter(point => point.r_b >= 0 && point.r_b < 0.3).length;
    const good = points.length - negative - weak;
    return `${fmt(good)} of ${fmt(points.length)} items discriminate well (r ≥ 0.30) · ${fmt(weak)} weak, ${fmt(negative)} negative.`;
  }, [dashboardStats, statsLoading]);

  const metrics = dashboardStats?.metrics;
  const trend = metrics?.bank_strength_trend ?? 0;
  const revisionCount = metrics?.items_requiring_revision ?? 0;

  const rangeStart = psychometrics.length > 0 ? (page - 1) * limit + 1 : 0;
  const rangeEnd = Math.min(page * limit, totalItems);

  // ---- Render -------------------------------------------------------------------
  const renderTableBody = () => {
    if (loading && psychometrics.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <Spinner label="Loading item statistics…" className="py-16" />
          </td>
        </tr>
      );
    }
    if (psychometrics.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            {hasActiveFilters ? (
              <EmptyState
                compact
                icon={SearchX}
                title="No items match these filters"
                description="Try a different ID or remove a filter."
                action={
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                compact
                icon={ClipboardList}
                title="No item statistics yet"
                description="Statistics appear here once learners have answered questions from your bank."
              />
            )}
          </td>
        </tr>
      );
    }
    return psychometrics.map(item => {
      const { displayId, editorId: editorQuestionId } = parseQuestionId(item.question_id);

      const nfdString = item.stats?.Flawed_Distractor_Choice || "";
      const nfdCount = nfdString ? nfdString.split(',').filter(Boolean).length : 0;
      const rb = item.stats?.R_B ?? 0;
      const title = item.title || 'Untitled question';

      return (
        <tr key={item.question_id} className="border-b border-stone-100 transition last:border-b-0 hover:bg-stone-50">
          <td className="px-4 py-3 align-top">
            <div className="max-w-xl">
              <p className="line-clamp-2 text-sm font-medium leading-5 text-stone-900" title={title}>
                {title}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">{displayId}</p>
            </div>
          </td>
          <td className="px-4 py-3 text-right align-top tabular-nums text-stone-600">
            {fmt(item.stats?.Total_Answer_Count || 0)}
          </td>
          <td className="px-4 py-3 text-right align-top font-medium tabular-nums text-stone-900">
            {item.stats?.P_value?.toFixed(2) || '0.00'}
          </td>
          <td className={cn('px-4 py-3 text-right align-top font-medium tabular-nums', rb < 0 ? 'text-red-600' : 'text-stone-900')}>
            {item.stats?.R_B?.toFixed(2) || '0.00'}
          </td>
          <td className="px-4 py-3 align-top">
            {item.stats?.must_revise ? (
              <StatusDot tone="red">Revision required</StatusDot>
            ) : nfdCount > 0 ? (
              <StatusDot tone="amber">
                {nfdCount} non-functional option{nfdCount === 1 ? '' : 's'}
              </StatusDot>
            ) : (
              <StatusDot tone="green">All distractors working</StatusDot>
            )}
          </td>
          <td className="px-4 py-2.5 text-right align-top">
            <Button
              size="sm"
              variant="secondary"
              iconRight={ArrowUpRight}
              onClick={() => openInWorkbench(editorQuestionId)}
              disabled={!editorQuestionId || editorQuestionId === 'Unknown'}
              aria-label={`Review ${title}`}
            >
              Review
            </Button>
          </td>
        </tr>
      );
    });
  };

  const examLabel = EXAM_OPTIONS.find(option => option.id === selectedExamType)?.name ?? selectedExamType;

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Bank health"
          description="How your questions perform with learners — difficulty, discrimination and distractor quality — so you know which items to revise first."
          actions={
            <>
              <Select
                aria-label="Exam"
                value={selectedExamType}
                onChange={(event) => { setSelectedExamType(event.target.value); setPage(1); }}
                className="w-36"
              >
                <option value="ALL">All exams</option>
                {EXAM_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </Select>
              <Button icon={SlidersHorizontal} onClick={() => setShowFilters(true)}>
                Filters
                {activeGroups.length > 0 && (
                  <span className="rounded bg-stone-900 px-1.5 text-xs leading-5 text-white tabular-nums">
                    {activeGroups.length}
                  </span>
                )}
              </Button>
              <Button variant="ghost" icon={BookOpen} onClick={() => setIsStandardsModalOpen(true)}>
                Standards
              </Button>
            </>
          }
        />

        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
            {selectedExamType !== 'ALL' && (
              <FilterChip
                label={`Exam: ${examLabel}`}
                onRemove={() => { setSelectedExamType('ALL'); setPage(1); }}
              />
            )}
            {localSearchQuery && (
              <FilterChip label={`ID: ${localSearchQuery}`} onRemove={() => setLocalSearchQuery('')} />
            )}
            {activeGroups.map(group => (
              <FilterChip key={group.key} label={chipLabel(group)} onRemove={() => group.onChange([])} />
            ))}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {statsError && <InlineAlert tone="warning" onDismiss={() => setStatsError(null)}>{statsError}</InlineAlert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Bank strength"
          icon={Gauge}
          loading={statsLoading}
          value={metrics ? `${metrics.bank_strength_score}%` : '—'}
          context={
            metrics ? (
              <>
                <span className={cn('font-medium tabular-nums', trend >= 0 ? 'text-brand-700' : 'text-red-600')}>
                  {trend > 0 ? '+' : ''}{trend}%
                </span>{' '}
                trend
              </>
            ) : (
              'Overall item quality score'
            )
          }
        />
        <KpiTile
          label="Learner attempts"
          icon={Users}
          loading={statsLoading}
          value={metrics ? fmt(metrics.total_active_samples) : '—'}
          context="Answers recorded on matching items"
        />
        <KpiTile
          label="Functional distractors"
          icon={ListChecks}
          loading={statsLoading}
          value={metrics ? `${metrics.functional_efficiency_rate}%` : '—'}
          context="Share of distractors that learners actually choose"
        />
        <KpiTile
          label="Needs revision"
          icon={AlertTriangle}
          loading={statsLoading}
          value={metrics ? fmt(revisionCount) : '—'}
          context={
            !metrics ? (
              'Items flagged for revision'
            ) : revisionCount > 0 ? (
              <StatusDot tone="amber">{revisionCount === 1 ? 'Item' : 'Items'} flagged for revision</StatusDot>
            ) : (
              <StatusDot tone="green">No items flagged</StatusDot>
            )
          }
          action={revisionCount > 0 ? { label: 'Show flagged items', onClick: showFlaggedItems } : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardCard
          title="Difficulty distribution"
          subtitle={difficultySummary}
          headingLevel={2}
          actions={statsLoading ? <Spinner /> : undefined}
        >
          <ChartFrame label={`Bar chart of items by P-value range. ${difficultySummary}`} className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pValueDist} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="range" axisLine={{ stroke: CHART_COLORS.axis }} tickLine={false} tick={axisTick} />
                <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} />
                <RechartsTooltip
                  cursor={{ fill: CHART_COLORS.hover }}
                  content={(props: ChartTooltipProps) => {
                    const bin = tooltipDatum<DifficultyBin>(props);
                    if (!bin) return null;
                    return (
                      <ChartTooltipCard
                        title={`P ${bin.range}`}
                        rows={[{ label: bin.label, value: fmt(bin.count), color: BAND_COLORS[bin.band] }]}
                      />
                    );
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
                  {pValueDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={BAND_COLORS[entry.band]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ChartLegend
            className="mt-3"
            items={[
              { label: 'Ideal (0.50–0.60)', color: BAND_COLORS.ideal, shape: 'square' },
              { label: 'Acceptable', color: BAND_COLORS.acceptable, shape: 'square' },
              { label: 'Too hard / too easy', color: BAND_COLORS.out, shape: 'square' },
            ]}
          />
        </DashboardCard>

        <DashboardCard
          title="Discrimination map"
          subtitle={discriminationSummary}
          headingLevel={2}
          actions={statsLoading ? <Spinner /> : undefined}
        >
          <ChartFrame
            label={`Scatter plot of item difficulty against discrimination. ${discriminationSummary}`}
            className="h-64"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, bottom: 20, left: 0 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="P"
                  domain={[0, 1]}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={{ stroke: CHART_COLORS.axis }}
                  label={{ value: 'Difficulty (P)', position: 'insideBottom', offset: -10, ...axisLabel }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="r"
                  domain={[-0.5, 1]}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={{ stroke: CHART_COLORS.axis }}
                  width={56}
                  label={{ value: 'Discrimination (r)', angle: -90, position: 'insideLeft', offset: 4, style: { textAnchor: 'middle' }, ...axisLabel }}
                />
                <ZAxis type="number" dataKey="z" range={[48, 48]} />
                <ReferenceArea x1={0.3} x2={0.7} y1={0.3} y2={1} fill={CHART_COLORS.brand} fillOpacity={0.07} />
                <ReferenceLine y={0.3} stroke={CHART_COLORS.brand} strokeDasharray="4 4" />
                <ReferenceLine y={0} stroke={CHART_COLORS.muted} />
                <RechartsTooltip
                  cursor={{ strokeDasharray: '3 3', stroke: CHART_COLORS.axis }}
                  content={(props: ChartTooltipProps) => {
                    const point = tooltipDatum<ScatterPoint>(props);
                    if (!point) return null;
                    return (
                      <ChartTooltipCard
                        title={point.displayId}
                        rows={[
                          { label: 'Difficulty (P)', value: point.x.toFixed(2) },
                          { label: 'Discrimination (r)', value: point.y.toFixed(2), color: discriminationColor(point.y) },
                        ]}
                        footer="Click to open in the workbench"
                      />
                    );
                  }}
                />
                <Scatter
                  name="Items"
                  data={scatterData}
                  cursor="pointer"
                  onClick={(entry: { payload?: ScatterPoint }) => {
                    if (entry?.payload) openInWorkbench(entry.payload.editorId);
                  }}
                >
                  {scatterData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={discriminationColor(entry.y)} fillOpacity={0.85} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </ChartFrame>
          <ChartLegend
            className="mt-3"
            items={[
              { label: 'Good (r ≥ 0.30)', color: CHART_COLORS.brand },
              { label: 'Weak (0–0.30)', color: CHART_COLORS.amber },
              { label: 'Negative', color: CHART_COLORS.red },
              { label: 'Target zone', color: CHART_COLORS.brandTint, shape: 'square' },
            ]}
          />
        </DashboardCard>
      </div>

      <section id="item-audit" className="scroll-mt-6 space-y-4">
        <SectionHeader
          title="Item audit"
          meta={<span className="text-[13px] tabular-nums text-stone-500">{fmt(totalItems)} items</span>}
          description="Every item with its difficulty, discrimination and distractor check. Sort by a column, then open an item to revise it."
          actions={
            <SearchInput
              value={localSearchQuery}
              onChange={setLocalSearchQuery}
              placeholder="Search by item ID"
              className="w-full sm:w-64"
            />
          }
        />

        {itemsError && <InlineAlert onDismiss={() => setItemsError(null)}>{itemsError}</InlineAlert>}

        <div className="rounded-xl border border-stone-200 bg-white shadow-card">
          <div className="overflow-x-auto rounded-t-xl custom-scrollbar">
            <table className={cn('w-full min-w-[820px] text-left text-[13px] transition-opacity', loading && psychometrics.length > 0 && 'opacity-60')} aria-busy={loading}>
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-stone-500">
                  <th scope="col" className="px-4 py-2.5 font-medium">Item</th>
                  <SortHeader column="total_answer_count" label="Attempts" align="right" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  <SortHeader column="p_value" label="Difficulty (P)" align="right" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  <SortHeader column="r_b" label="Discrimination (r)" align="right" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  <SortHeader column="must_revise" label="Distractors" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>{renderTableBody()}</tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 text-[13px] text-stone-500">
            <span className="tabular-nums">
              {totalItems > 0
                ? `Showing ${fmt(rangeStart)}–${fmt(rangeEnd)} of ${fmt(totalItems)} items`
                : 'No items'}
            </span>
            <div className="flex items-center gap-2">
              {loading && psychometrics.length > 0 && <Spinner />}
              <Button
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <span className="px-1 tabular-nums">
                Page {page} of {totalPages || 1}
              </span>
              <Button
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Drawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        width="max-w-md"
        title="Filter items"
        description="Narrow the stats and the item table to part of your bank."
        footer={
          <>
            <Button variant="ghost" onClick={clearAttributeFilters} disabled={activeGroups.length === 0}>
              Clear filters
            </Button>
            <span className="ml-auto text-[13px] text-stone-500">Filters apply as you choose</span>
            <Button variant="primary" onClick={() => setShowFilters(false)}>
              Done
            </Button>
          </>
        }
      >
        <div className="divide-y divide-stone-100 px-6 py-2">
          {filterGroups.map(group => (
            <FilterChecklist
              key={group.key}
              label={group.label}
              options={group.options}
              values={group.values}
              onChange={group.onChange}
              loading={group.loading}
              disabled={group.disabled}
              disabledHint={group.disabledHint}
            />
          ))}
        </div>
      </Drawer>

      <Dialog
        open={isStandardsModalOpen}
        onClose={() => setIsStandardsModalOpen(false)}
        width="max-w-lg"
        title="Psychometric standards"
        description="The thresholds this page uses to judge each item."
        footer={
          <Button variant="primary" onClick={() => setIsStandardsModalOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-medium text-stone-900">Difficulty (P-value)</h3>
            <p className="mt-0.5 text-[13px] text-stone-500">The share of learners who answer the item correctly.</p>
            <ul className="mt-2 divide-y divide-stone-100">
              <StandardRow tone="green" label="Ideal" detail="0.50–0.60" />
              <StandardRow tone="blue" label="Acceptable" detail="0.30–0.50 and 0.60–0.70" />
              <StandardRow tone="amber" label="Too hard / too easy" detail="Below 0.30 / above 0.70" />
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-medium text-stone-900">Discrimination (point-biserial r)</h3>
            <p className="mt-0.5 text-[13px] text-stone-500">How well the item separates stronger from weaker learners.</p>
            <ul className="mt-2 divide-y divide-stone-100">
              <StandardRow tone="green" label="Good" detail="0.30 or higher" />
              <StandardRow tone="amber" label="Weak — review" detail="0 to 0.30" />
              <StandardRow tone="red" label="Negative — revise" detail="Below 0" />
            </ul>
          </section>
          <section>
            <h3 className="text-sm font-medium text-stone-900">Distractors</h3>
            <p className="mt-0.5 text-[13px] leading-5 text-stone-500">
              A distractor is non-functional when almost no learners choose it (typically under 5%).
              Items with non-functional options show an amber status; items the analysis marks for
              revision show red.
            </p>
          </section>
        </div>
      </Dialog>
    </div>
  );
};

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-stone-100 py-1 pl-2.5 pr-1 text-xs font-medium text-stone-700">
    <span className="truncate">{label}</span>
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter ${label}`}
      className="rounded p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-800"
    >
      <X size={13} />
    </button>
  </span>
);

export default QuestionBankHealth;
