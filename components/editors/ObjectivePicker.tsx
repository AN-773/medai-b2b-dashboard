import React, { useEffect, useId, useMemo } from 'react';
import { Loader2, Plus, Target } from 'lucide-react';
import { Field, SearchInput, Select, cn } from '@/components/ui';
import SearchableSelect, { type SelectOption } from '@/components/SearchableSelect';
import type { useQuestionEditorData } from '@/hooks/useQuestionEditorData';
import type { LearningObjective } from '@/types/TestsServiceTypes';

export type QuestionEditorData = ReturnType<typeof useQuestionEditorData>;

const LoadingLine: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-500">
    <Loader2 size={12} className="animate-spin text-brand-600" aria-hidden="true" />
    {children}
  </p>
);

interface PickerSelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  loading?: string | false;
  onAdd?: () => void;
  addLabel?: string;
  className?: string;
}

/** A labelled searchable select (the select itself renders no label). */
export const PickerSelect: React.FC<PickerSelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  loading,
  onAdd,
  addLabel = 'New',
  className,
}) => {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span id={labelId} className="text-[13px] font-medium text-stone-700">
          {label}
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-stone-500 transition-colors hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <Plus size={13} aria-hidden="true" />
            {addLabel}
          </button>
        )}
      </div>
      <SearchableSelect
        options={options}
        value={value || 'ALL'}
        onChange={(next) => onChange(next === 'ALL' ? '' : next)}
        disabled={disabled}
        placeholder={placeholder}
        allOption={{ id: 'ALL', name: placeholder }}
      />
      {loading && <LoadingLine>{loading}</LoadingLine>}
    </div>
  );
};

interface ObjectivePickerProps {
  data: QuestionEditorData;
  /** Called on every change the user makes (dirty tracking). */
  onEdit?: () => void;
  /** After a search result has filled the hierarchy. */
  onSearchResultPicked?: (objective: LearningObjective) => void;
  /** After the learning objective select changed. */
  onObjectiveSelected?: (id: string) => void;
  onAddTopic?: () => void;
  onAddSubtopic?: () => void;
  /** Extra controls between the hierarchy and the objective (e.g. cognitive skill). */
  beforeObjective?: React.ReactNode;
}

/**
 * Where an item sits in the curriculum: the chosen objective summarised on
 * top, then free-text search, then the exam → organ system → topic →
 * syndrome → objective hierarchy.
 */
export const ObjectivePicker: React.FC<ObjectivePickerProps> = ({
  data,
  onEdit,
  onSearchResultPicked,
  onObjectiveSelected,
  onAddTopic,
  onAddSubtopic,
  beforeObjective,
}) => {
  const {
    organSystems,
    topics,
    syndromes,
    objectives,
    isLoadingOrganSystems,
    isLoadingTopics,
    isLoadingSyndromes,
    isLoadingObjectives,
    selectedOrganSystemId,
    selectedTopicId,
    selectedSyndromeId,
    selectedObjectiveId,
    objectiveSearchQuery,
    setSelectedOrganSystemId,
    setSelectedTopicId,
    setSelectedSyndromeId,
    setSelectedObjectiveId,
    setObjectiveSearchQuery,
    searchObjectives,
    fillFiltersFromObjective,
    clearFilters,
    selectedExam,
    setSelectedExam,
  } = data;

  // Debounced objective search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (objectiveSearchQuery && objectiveSearchQuery.length >= 2) {
        searchObjectives(objectiveSearchQuery, true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [objectiveSearchQuery, searchObjectives]);

  const organSystemOptions: SelectOption[] = useMemo(
    () => organSystems.map((os) => ({ id: os.id, name: os.title })),
    [organSystems],
  );
  const topicOptions: SelectOption[] = useMemo(
    () => topics.map((t) => ({ id: t.id, name: t.title })),
    [topics],
  );
  const syndromeOptions: SelectOption[] = useMemo(
    () => syndromes.map((s) => ({ id: s.id, name: s.title })),
    [syndromes],
  );
  const objectiveOptions: SelectOption[] = useMemo(
    () => objectives.map((obj) => ({ id: obj.id, name: obj.title || 'Untitled objective' })),
    [objectives],
  );

  const selectedObjective = objectives.find((o) => o.id === selectedObjectiveId);
  const selectedPath = [
    organSystems.find((os) => os.id === selectedOrganSystemId)?.title,
    topics.find((t) => t.id === selectedTopicId)?.title,
    syndromes.find((s) => s.id === selectedSyndromeId)?.title,
  ].filter(Boolean);
  const canClear = Boolean(selectedOrganSystemId || objectiveSearchQuery || selectedObjectiveId);
  const showResults = Boolean(objectiveSearchQuery) && objectives.length > 0;

  const edit = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    fn(...args);
    onEdit?.();
  };

  return (
    <div className="space-y-5">
      {/* The current objective, in full. */}
      {selectedObjectiveId ? (
        <div className="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50/60 px-3.5 py-3">
          <Target size={16} className="mt-0.5 flex-shrink-0 text-brand-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-brand-800">Learning objective</p>
            <p className="mt-0.5 line-clamp-2 text-sm leading-5 text-stone-900">
              {selectedObjective?.title || (isLoadingObjectives ? 'Loading objective…' : 'Selected objective')}
            </p>
            {selectedPath.length > 0 && (
              <p className="mt-1 truncate text-xs text-stone-500">{selectedPath.join(' · ')}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3.5 py-3">
          <Target size={16} className="mt-0.5 flex-shrink-0 text-stone-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-700">No learning objective yet</p>
            <p className="mt-0.5 text-[13px] text-stone-500">
              Search for one, or browse the curriculum below.
            </p>
          </div>
        </div>
      )}

      <Field label="Find an objective">
        {(id) => (
          <div>
            <SearchInput
              id={id}
              value={objectiveSearchQuery}
              onChange={setObjectiveSearchQuery}
              placeholder="Search by objective text"
              autoComplete="off"
            />
            {isLoadingObjectives && objectiveSearchQuery && <LoadingLine>Searching…</LoadingLine>}
            {showResults && (
              <ul
                aria-label="Matching objectives"
                className="custom-scrollbar mt-2 max-h-56 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-card"
              >
                {objectives.map((obj) => (
                  <li key={obj.id}>
                    <button
                      type="button"
                      onClick={async () => {
                        const fullObjective = await fillFiltersFromObjective(obj);
                        onSearchResultPicked?.(fullObjective);
                        setObjectiveSearchQuery('');
                        onEdit?.();
                      }}
                      className="w-full px-3 py-2.5 text-left transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none"
                    >
                      <span className="line-clamp-2 text-sm text-stone-800">{obj.title}</span>
                      {obj.syndrome && (
                        <span className="mt-0.5 block text-xs text-stone-500">{obj.syndrome.title}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Field>

      <div className="flex items-center gap-3">
        <span className="text-[13px] text-stone-500">Or browse the curriculum</span>
        <span aria-hidden="true" className="h-px flex-1 bg-stone-100" />
        {canClear && (
          <button
            type="button"
            onClick={edit(clearFilters)}
            className="rounded text-[13px] font-medium text-stone-500 transition-colors hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Exam">
          {(id) => (
            <Select
              id={id}
              value={selectedExam}
              onChange={(event) => {
                setSelectedExam(event.target.value as 'STEP 1' | 'STEP 2' | '');
                onEdit?.();
              }}
            >
              <option value="">Not set</option>
              <option value="STEP 1">Step 1</option>
              <option value="STEP 2">Step 2</option>
            </Select>
          )}
        </Field>
        <PickerSelect
          label="Organ system"
          options={organSystemOptions}
          value={selectedOrganSystemId}
          onChange={edit(setSelectedOrganSystemId)}
          disabled={isLoadingOrganSystems}
          placeholder="Select organ system"
          loading={isLoadingOrganSystems && 'Loading organ systems…'}
        />
        <PickerSelect
          label="Topic"
          options={topicOptions}
          value={selectedTopicId}
          onChange={edit(setSelectedTopicId)}
          disabled={!selectedOrganSystemId || isLoadingTopics}
          placeholder="Select topic"
          loading={isLoadingTopics && 'Loading topics…'}
          onAdd={onAddTopic}
          addLabel="New topic"
        />
        <PickerSelect
          label="Syndrome / subtopic"
          options={syndromeOptions}
          value={selectedSyndromeId}
          onChange={edit(setSelectedSyndromeId)}
          disabled={!selectedTopicId || isLoadingSyndromes}
          placeholder="Select syndrome"
          loading={isLoadingSyndromes && 'Loading syndromes…'}
          onAdd={onAddSubtopic}
          addLabel="New subtopic"
        />
      </div>

      {beforeObjective}

      <PickerSelect
        label="Learning objective"
        options={objectiveOptions}
        value={selectedObjectiveId}
        onChange={(id) => {
          setSelectedObjectiveId(id);
          onObjectiveSelected?.(id);
          onEdit?.();
        }}
        disabled={!selectedSyndromeId || objectives.length === 0}
        placeholder="Select objective"
        loading={isLoadingObjectives && Boolean(selectedSyndromeId) && 'Loading objectives…'}
      />
    </div>
  );
};
