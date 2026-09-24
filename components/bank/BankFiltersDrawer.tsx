import React from 'react';
import { Button, Drawer, Field, Select } from '@/components/ui';
import MultiSelectList from '@/components/academy/course-workbench/objectives/MultiSelectList';
import {
  ALL,
  EXAM_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  countActiveFilters,
  plural,
  type BankFilterState,
  type Option,
} from './itemMeta';

interface BankFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: BankFilterState;
  onChange: (patch: Partial<BankFilterState>) => void;
  /** Resets every filter in this drawer (search and QID are left alone). */
  onClear: () => void;
  organSystems: Option[];
  topics: Option[];
  subTopics: Option[];
  topicsLoading: boolean;
  subTopicsLoading: boolean;
  cognitiveSkills: Option[];
  subjects: Option[];
  disciplines: Option[];
  tags: Option[];
  /** Organ systems, subjects, disciplines and tags are still loading. */
  optionsLoading: boolean;
  resultTotal: number;
  isLoadingResults: boolean;
}

const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  allLabel: string;
  disabled?: boolean;
  description?: string;
  /** Receive focus when the drawer opens. */
  autoFocus?: boolean;
}> = ({ label, value, onChange, options, allLabel, disabled, description, autoFocus }) => (
  <Field label={label} description={description}>
    {(id) => (
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        data-autofocus={autoFocus || undefined}
      >
        <option value={ALL}>{allLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
    )}
  </Field>
);

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <section className="space-y-4">
    <div>
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      {description && <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>}
    </div>
    {children}
  </section>
);

/** Every item-bank filter in one place. Changes apply to the list immediately. */
const BankFiltersDrawer: React.FC<BankFiltersDrawerProps> = ({
  open,
  onClose,
  filters,
  onChange,
  onClear,
  organSystems,
  topics,
  subTopics,
  topicsLoading,
  subTopicsLoading,
  cognitiveSkills,
  subjects,
  disciplines,
  tags,
  optionsLoading,
  resultTotal,
  isLoadingResults,
}) => {
  const activeCount = countActiveFilters(filters);
  const hasSystem = filters.organSystemId !== ALL;
  const hasTopic = filters.topicId !== ALL;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title="All filters"
      description={
        activeCount > 0 ? `${plural(activeCount, 'filter')} applied` : 'Narrow the item bank'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClear} disabled={activeCount === 0}>
            Clear all
          </Button>
          <p
            aria-live="polite"
            className="min-w-0 flex-1 truncate text-right text-[13px] tabular-nums text-stone-500"
          >
            {isLoadingResults ? 'Updating…' : `${plural(resultTotal, 'item')} match`}
          </p>
          <Button variant="primary" onClick={onClose}>
            Show results
          </Button>
        </>
      }
    >
      <div className="space-y-8 px-6 py-5">
        <Section title="Item">
          <div className="grid gap-4 sm:grid-cols-2">
            <FilterSelect
              label="Type"
              value={filters.type}
              onChange={(type) => onChange({ type })}
              options={TYPE_OPTIONS}
              allLabel="All types"
              autoFocus
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(status) => onChange({ status })}
              options={STATUS_OPTIONS}
              allLabel="All statuses"
            />
            <FilterSelect
              label="Exam"
              value={filters.examType}
              onChange={(examType) => onChange({ examType })}
              options={EXAM_OPTIONS}
              allLabel="All exams"
            />
            <FilterSelect
              label="Cognitive skill"
              value={filters.cognitiveSkillId}
              onChange={(cognitiveSkillId) => onChange({ cognitiveSkillId })}
              options={cognitiveSkills}
              allLabel="All skills"
            />
          </div>
        </Section>

        <Section
          title="Curriculum placement"
          description="Where the item’s learning objective sits in the organ-system outline."
        >
          <FilterSelect
            label="Organ system"
            value={filters.organSystemId}
            onChange={(organSystemId) =>
              onChange({ organSystemId, topicId: ALL, subTopicId: ALL })
            }
            options={organSystems}
            allLabel={optionsLoading ? 'Loading…' : 'All organ systems'}
            disabled={optionsLoading}
          />
          <FilterSelect
            label="Topic"
            value={filters.topicId}
            onChange={(topicId) => onChange({ topicId, subTopicId: ALL })}
            options={topics}
            allLabel={topicsLoading ? 'Loading…' : 'All topics'}
            disabled={!hasSystem || topicsLoading}
            description={hasSystem ? undefined : 'Choose an organ system first.'}
          />
          <FilterSelect
            label="Subtopic"
            value={filters.subTopicId}
            onChange={(subTopicId) => onChange({ subTopicId })}
            options={subTopics}
            allLabel={subTopicsLoading ? 'Loading…' : 'All subtopics'}
            disabled={!hasTopic || subTopicsLoading}
            description={hasTopic ? undefined : 'Choose a topic first.'}
          />
        </Section>

        <Section title="Classification">
          <FilterSelect
            label="Subject"
            value={filters.subjectId}
            onChange={(subjectId) => onChange({ subjectId })}
            options={subjects}
            allLabel={optionsLoading ? 'Loading…' : 'All subjects'}
            disabled={optionsLoading}
          />
          <Field label="Disciplines">
            {(id) => (
              <MultiSelectList
                id={id}
                options={disciplines}
                values={filters.disciplines}
                onChange={(values) => onChange({ disciplines: values })}
                disabled={optionsLoading}
                placeholder="Search disciplines"
                emptyLabel={optionsLoading ? 'Loading…' : 'No disciplines'}
              />
            )}
          </Field>
          <Field label="Tags">
            {(id) => (
              <MultiSelectList
                id={id}
                options={tags}
                values={filters.tags}
                onChange={(values) => onChange({ tags: values })}
                disabled={optionsLoading}
                placeholder="Search tags"
                emptyLabel={optionsLoading ? 'Loading…' : 'No tags'}
              />
            )}
          </Field>
        </Section>
      </div>
    </Drawer>
  );
};

export default BankFiltersDrawer;
