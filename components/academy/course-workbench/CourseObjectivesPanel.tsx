import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Library, Plus, Search, Sparkles, Target, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Menu,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  StatusDot,
} from '@/components/ui';
import type { TeacherCourse, TeacherLearningObjective } from '@/types/AcademyStudioTypes';
import type { useCourseFactory } from '@/hooks/useCourseFactory';
import { getCourseObjectiveCount } from './shared';
import CreateCourseObjectiveModal from './CreateCourseObjectiveModal';
import CatalogDrawer from './objectives/CatalogDrawer';
import GenerateObjectivesDrawer from './objectives/GenerateObjectivesDrawer';
import { ObjectiveMeta, PaginationFooter, revealTop } from './objectives/ListHelpers';

type CourseFactory = ReturnType<typeof useCourseFactory>;

type ContentFilter = 'all' | 'needs-content' | 'has-content';

const ATTACHED_OBJECTIVES_PAGE_SIZE = 25;

const contentTotal = (objective: TeacherLearningObjective) => objective.itemTotals?.total ?? 0;

interface CourseObjectivesPanelProps {
  course: TeacherCourse;
  attachedIds: Set<string>;
  /** Objective AI factory (upload sources → review suggestions). */
  factory: CourseFactory;
  isGenerateOpen: boolean;
  onGenerateOpenChange: (open: boolean) => void;
  onAttach: (objective: TeacherLearningObjective) => Promise<void>;
  onAddAll: (filters: {
    q?: string;
    organSystemId?: string;
    topicId?: string;
    syndromeId?: string;
  }) => Promise<{ matched: number; added: number; alreadyAttached: number }>;
  onCreate: (objective: TeacherLearningObjective) => Promise<void>;
  onRemove: (objective: TeacherLearningObjective) => Promise<void>;
  /** Jump to the Content tab with this objective preselected. */
  onBuildContent?: (objective: TeacherLearningObjective) => void;
}

const CourseObjectivesPanel: React.FC<CourseObjectivesPanelProps> = ({
  course,
  attachedIds,
  factory,
  isGenerateOpen,
  onGenerateOpenChange,
  onAttach,
  onAddAll,
  onCreate,
  onRemove,
  onBuildContent,
}) => {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isCatalogOpen, setCatalogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [attachedPage, setAttachedPage] = useState(1);
  const [pendingRemoval, setPendingRemoval] = useState<TeacherLearningObjective | null>(null);
  const [isRemoving, setRemoving] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const objectiveCount = getCourseObjectiveCount(course);
  const allObjectives = course.learningObjectives;

  const totalPendingFromAI = useMemo(
    () => factory.uploadGroups.reduce((sum, group) => sum + group.pendingCount, 0),
    [factory.uploadGroups],
  );

  // New course → start from a clean list view.
  useEffect(() => {
    setSearch('');
    setContentFilter('all');
    setAttachedPage(1);
  }, [course.id]);

  useEffect(() => {
    setAttachedPage(1);
  }, [search, contentFilter]);

  const searchMatches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return allObjectives;
    return allObjectives.filter((objective) =>
      [objective.title, objective.organSystem, objective.cognitiveSkill].some((value) =>
        value?.toLowerCase().includes(needle),
      ),
    );
  }, [allObjectives, search]);

  const contentCounts = useMemo(() => {
    const withContent = searchMatches.filter((objective) => contentTotal(objective) > 0).length;
    return {
      all: searchMatches.length,
      'has-content': withContent,
      'needs-content': searchMatches.length - withContent,
    };
  }, [searchMatches]);

  const filteredObjectives = useMemo(() => {
    if (contentFilter === 'all') return searchMatches;
    const wantContent = contentFilter === 'has-content';
    return searchMatches.filter((objective) => (contentTotal(objective) > 0) === wantContent);
  }, [contentFilter, searchMatches]);

  const totalAttachedPages = Math.max(
    1,
    Math.ceil(filteredObjectives.length / ATTACHED_OBJECTIVES_PAGE_SIZE),
  );

  useEffect(() => {
    setAttachedPage((current) => Math.min(current, totalAttachedPages));
  }, [totalAttachedPages]);

  const attachedPageStart = (attachedPage - 1) * ATTACHED_OBJECTIVES_PAGE_SIZE;
  const pageObjectives = useMemo(
    () =>
      filteredObjectives.slice(
        attachedPageStart,
        attachedPageStart + ATTACHED_OBJECTIVES_PAGE_SIZE,
      ),
    [attachedPageStart, filteredObjectives],
  );

  const clearListFilters = () => {
    setSearch('');
    setContentFilter('all');
  };

  const changePage = (page: number) => {
    setAttachedPage(page);
    revealTop(listRef.current);
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    setRemoving(true);
    try {
      await onRemove(pendingRemoval);
    } finally {
      setRemoving(false);
      setPendingRemoval(null);
    }
  };

  const openCatalog = () => setCatalogOpen(true);
  const openGenerate = () => onGenerateOpenChange(true);
  const openCreate = () => setCreateOpen(true);

  const renderFilteredEmpty = () => {
    const trimmed = search.trim();
    const description = trimmed
      ? `Nothing matches “${trimmed}”${contentFilter === 'all' ? '' : ' with this filter'}.`
      : contentFilter === 'needs-content'
        ? 'Every objective in this course has content.'
        : 'No objectives have content yet.';
    return (
      <EmptyState
        compact
        icon={Search}
        title="No matching objectives"
        description={description}
        action={
          <Button variant="ghost" size="sm" onClick={clearListFilters}>
            Show all objectives
          </Button>
        }
      />
    );
  };

  const renderRow = (objective: TeacherLearningObjective) => {
    const itemCount = contentTotal(objective);
    return (
      <li
        key={objective.id}
        className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-stone-50"
      >
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-stone-900">{objective.title}</p>
          <ObjectiveMeta objective={objective} />
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="w-28">
            {itemCount > 0 ? (
              <StatusDot tone="green">
                <span className="tabular-nums">{itemCount.toLocaleString()}</span>{' '}
                {itemCount === 1 ? 'item' : 'items'}
              </StatusDot>
            ) : (
              <StatusDot tone="amber">No content yet</StatusDot>
            )}
          </div>
          {onBuildContent && (
            <Button
              variant="ghost"
              size="sm"
              icon={Layers}
              onClick={() => onBuildContent(objective)}
              aria-label={`Build content for “${objective.title}”`}
            >
              Build content
            </Button>
          )}
          <Menu
            size="sm"
            label="Objective actions"
            items={[
              {
                label: 'Remove from course',
                icon: Trash2,
                tone: 'danger',
                onSelect: () => setPendingRemoval(objective),
              },
            ]}
          />
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Learning objectives"
        meta={
          <span className="text-[15px] tabular-nums text-stone-400">
            {objectiveCount.toLocaleString()}
          </span>
        }
        description="What learners should be able to do after this course. Content and modules are built from these."
        actions={
          <>
            <Button icon={Plus} onClick={openCreate}>
              New objective
            </Button>
            <Button icon={Library} onClick={openCatalog}>
              Add from catalog
            </Button>
            <Button variant="ai" icon={Sparkles} onClick={openGenerate}>
              Generate from sources
              {totalPendingFromAI > 0 && (
                <span className="rounded-md bg-amber-100 px-1.5 text-xs tabular-nums leading-5 text-amber-800">
                  {totalPendingFromAI.toLocaleString()}
                  <span className="sr-only"> waiting for review</span>
                </span>
              )}
            </Button>
          </>
        }
      />

      {totalPendingFromAI > 0 && !isGenerateOpen && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 py-2 pl-3.5 pr-2 text-sm text-amber-900"
        >
          <Sparkles size={15} className="flex-shrink-0 text-amber-600" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <span className="font-medium tabular-nums">{totalPendingFromAI.toLocaleString()}</span>{' '}
            AI-suggested {totalPendingFromAI === 1 ? 'objective is' : 'objectives are'} waiting
            for review
          </p>
          <Button size="sm" onClick={openGenerate}>
            Review
          </Button>
        </div>
      )}

      {allObjectives.length === 0 ? (
        <div className="rounded-xl border border-stone-200">
          <EmptyState
            icon={Target}
            title="No objectives yet"
            description="Objectives are the backbone of the course. Pick them from the catalog, generate them from your course material, or write your own."
            action={
              <>
                <Button variant="primary" icon={Library} onClick={openCatalog}>
                  Add from catalog
                </Button>
                <Button variant="ai" icon={Sparkles} onClick={openGenerate}>
                  Generate from sources
                </Button>
                <Button variant="ghost" icon={Plus} onClick={openCreate}>
                  New objective
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <div ref={listRef} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              className="w-full sm:w-80"
              value={search}
              onChange={setSearch}
              placeholder="Search objectives"
              aria-label="Search this course’s objectives"
            />
            <SegmentedControl<ContentFilter>
              label="Filter objectives by content"
              value={contentFilter}
              onChange={setContentFilter}
              options={[
                { value: 'all', label: 'All', count: contentCounts.all },
                {
                  value: 'needs-content',
                  label: 'Needs content',
                  count: contentCounts['needs-content'],
                },
                {
                  value: 'has-content',
                  label: 'Has content',
                  count: contentCounts['has-content'],
                },
              ]}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            {filteredObjectives.length === 0 ? (
              renderFilteredEmpty()
            ) : (
              <>
                <ul className="divide-y divide-stone-100">{pageObjectives.map(renderRow)}</ul>
                <PaginationFooter
                  className="border-t border-stone-100 px-4"
                  page={attachedPage}
                  pageSize={ATTACHED_OBJECTIVES_PAGE_SIZE}
                  total={filteredObjectives.length}
                  onPageChange={changePage}
                />
              </>
            )}
          </div>
        </div>
      )}

      <CatalogDrawer
        open={isCatalogOpen}
        onClose={() => setCatalogOpen(false)}
        course={course}
        attachedIds={attachedIds}
        onAttach={onAttach}
        onAddAll={onAddAll}
      />

      <GenerateObjectivesDrawer
        open={isGenerateOpen}
        onClose={() => onGenerateOpenChange(false)}
        factory={factory}
      />

      <CreateCourseObjectiveModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        course={course}
        onCreated={onCreate}
      />

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove objective?"
        description={
          pendingRemoval ? (
            <>
              “{pendingRemoval.title}” will no longer be part of {course.title}.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Remove"
        busy={isRemoving}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => void confirmRemoval()}
      />
    </div>
  );
};

export default CourseObjectivesPanel;
