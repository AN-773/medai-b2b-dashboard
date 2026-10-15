import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  FlaskConical,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { testsService } from '../services/testsService';
import type { Discipline } from '../types/TestsServiceTypes';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Spinner,
} from '@/components/ui';
import DisciplineList from '@/components/disciplines/DisciplineList';
import DisciplineDetailDrawer from '@/components/disciplines/DisciplineDetailDrawer';
import {
  DisciplineTitleDialog,
  MoveObjectivesDialog,
} from '@/components/disciplines/DisciplineDialogs';
import {
  formatLearningObjectiveCount,
  getShortIdentifier,
  plural,
} from '@/components/disciplines/shared';

const LIST_LIMIT = 500;
const TOAST_DURATION_MS = 4000;

type DisciplineFilter = 'all' | 'in-use' | 'unused';

/** Where a form/action error is shown — the surface the user is looking at. */
type ErrorSurface = 'create' | 'rename' | 'move' | 'drawer' | 'page';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const matchesFilter = (discipline: Discipline, filter: DisciplineFilter) => {
  const count = discipline.learningObjectivesTotal;
  if (filter === 'in-use') return typeof count === 'number' && count > 0;
  if (filter === 'unused') return count === 0;
  return true;
};

const DisciplinesView: React.FC = () => {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [totalDisciplines, setTotalDisciplines] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<DisciplineFilter>('all');
  const [newTitle, setNewTitle] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Discipline | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [moveSourceId, setMoveSourceId] = useState('');
  const [moveTargetId, setMoveTargetId] = useState('');
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isMoveConfirmOpen, setIsMoveConfirmOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const loadDisciplines = async (options?: { background?: boolean }) => {
    const background = options?.background === true;

    if (background) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setLoadError(null);

    try {
      const response = await testsService.getDisciplines(1, LIST_LIMIT);
      const sortedItems = [...(response.items || [])].sort((left, right) =>
        left.title.localeCompare(right.title),
      );

      setDisciplines(sortedItems);
      setTotalDisciplines(response.total || sortedItems.length);
    } catch (error) {
      console.error('Failed to load disciplines:', error);
      setLoadError(
        getErrorMessage(error, 'Unable to load disciplines right now.'),
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDisciplines();
  }, []);

  // Success feedback is a short-lived toast.
  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const filteredDisciplines = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return disciplines;
    }

    return disciplines.filter(
      (discipline) =>
        discipline.title.toLowerCase().includes(normalizedQuery) ||
        getShortIdentifier(discipline.id).toLowerCase().includes(normalizedQuery),
    );
  }, [deferredSearchQuery, disciplines]);

  const filterCounts = useMemo(
    () => ({
      all: filteredDisciplines.length,
      'in-use': filteredDisciplines.filter((discipline) => matchesFilter(discipline, 'in-use'))
        .length,
      unused: filteredDisciplines.filter((discipline) => matchesFilter(discipline, 'unused'))
        .length,
    }),
    [filteredDisciplines],
  );

  const visibleDisciplines = useMemo(
    () => filteredDisciplines.filter((discipline) => matchesFilter(discipline, filter)),
    [filter, filteredDisciplines],
  );

  const disciplineMap = useMemo(
    () => new Map(disciplines.map((discipline) => [discipline.id, discipline])),
    [disciplines],
  );

  const moveSourceDiscipline = moveSourceId
    ? (disciplineMap.get(moveSourceId) ?? null)
    : null;
  const moveTargetDiscipline = moveTargetId
    ? (disciplineMap.get(moveTargetId) ?? null)
    : null;
  const moveSourceObjectiveCount =
    typeof moveSourceDiscipline?.learningObjectivesTotal === 'number'
      ? moveSourceDiscipline.learningObjectivesTotal
      : null;
  const moveSelectionError =
    moveSourceId && moveTargetId && moveSourceId === moveTargetId
      ? 'Source and target disciplines must be different.'
      : null;

  const editingDiscipline = editingId ? (disciplineMap.get(editingId) ?? null) : null;
  const selectedDiscipline = selectedId ? (disciplineMap.get(selectedId) ?? null) : null;

  const errorSurface: ErrorSurface = isCreateOpen
    ? 'create'
    : editingDiscipline
      ? 'rename'
      : isMoveOpen
        ? 'move'
        : selectedDiscipline
          ? 'drawer'
          : 'page';
  const errorFor = (surface: ErrorSurface) => (errorSurface === surface ? formError : null);
  const dismissFormError = () => setFormError(null);

  const resetMessages = () => {
    setFormError(null);
    setSuccessMessage(null);
  };

  // --- Create ---------------------------------------------------------------

  const openCreate = () => {
    resetMessages();
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    if (isSaving) return;
    setIsCreateOpen(false);
    setFormError(null);
  };

  const handleCreate = async () => {
    const normalizedTitle = newTitle.trim();

    if (!normalizedTitle) {
      setFormError('Discipline title is required.');
      setSuccessMessage(null);
      return;
    }

    setIsSaving(true);
    resetMessages();

    try {
      await testsService.upsertDiscipline(normalizedTitle);
      setNewTitle('');
      setIsCreateOpen(false);
      setSuccessMessage(`Created "${normalizedTitle}".`);
      await loadDisciplines({ background: true });
    } catch (error) {
      console.error('Failed to create discipline:', error);
      setFormError(
        getErrorMessage(error, 'Unable to create discipline right now.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // --- Rename ---------------------------------------------------------------

  const beginEdit = (discipline: Discipline) => {
    resetMessages();
    setEditingId(discipline.id);
    setEditingTitle(discipline.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const closeEdit = () => {
    if (isSaving) return;
    cancelEdit();
    setFormError(null);
  };

  const handleSaveEdit = async (discipline: Discipline) => {
    const normalizedTitle = editingTitle.trim();

    if (!normalizedTitle) {
      setFormError('Discipline title is required.');
      setSuccessMessage(null);
      return;
    }

    setIsSaving(true);
    resetMessages();

    try {
      await testsService.upsertDiscipline(normalizedTitle, discipline.id);
      setSuccessMessage(`Updated "${discipline.title}" to "${normalizedTitle}".`);
      cancelEdit();
      await loadDisciplines({ background: true });
    } catch (error) {
      console.error('Failed to update discipline:', error);
      setFormError(
        getErrorMessage(error, 'Unable to update discipline right now.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // --- Delete ---------------------------------------------------------------

  const requestDelete = (discipline: Discipline) => {
    resetMessages();
    setPendingDelete(discipline);
  };

  const handleDelete = async (discipline: Discipline) => {
    setDeletingId(discipline.id);
    resetMessages();

    try {
      await testsService.deleteDiscipline(getShortIdentifier(discipline.id));
      if (editingId === discipline.id) {
        cancelEdit();
      }
      if (moveSourceId === discipline.id) {
        setMoveSourceId('');
      }
      if (moveTargetId === discipline.id) {
        setMoveTargetId('');
      }
      if (selectedId === discipline.id) {
        setSelectedId(null);
      }
      setSuccessMessage(`Deleted "${discipline.title}".`);
      await loadDisciplines({ background: true });
    } catch (error) {
      console.error('Failed to delete discipline:', error);
      setFormError(
        getErrorMessage(error, 'Unable to delete discipline right now.'),
      );
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  // --- Move learning objectives ---------------------------------------------

  const openMove = () => {
    resetMessages();
    setIsMoveOpen(true);
  };

  const closeMove = () => {
    if (isMoving) return;
    setIsMoveOpen(false);
    setFormError(null);
  };

  const assignMoveDiscipline = (
    type: 'source' | 'target',
    discipline: Discipline,
  ) => {
    resetMessages();
    let nextSourceId = moveSourceId;
    let nextTargetId = moveTargetId;

    if (type === 'source') {
      nextSourceId = discipline.id;
      if (moveTargetId === discipline.id) {
        nextTargetId = '';
      }
    } else {
      nextTargetId = discipline.id;
      if (moveSourceId === discipline.id) {
        nextSourceId = '';
      }
    }

    setMoveSourceId(nextSourceId);
    setMoveTargetId(nextTargetId);
    setIsMoveOpen(true);
  };

  const handleSwapMoveDisciplines = () => {
    if (!moveSourceId && !moveTargetId) {
      return;
    }

    resetMessages();
    setMoveSourceId(moveTargetId);
    setMoveTargetId(moveSourceId);
  };

  const openMoveConfirmation = () => {
    resetMessages();

    if (!moveSourceId || !moveTargetId) {
      setFormError(
        'Select both a source and target discipline before moving learning objectives.',
      );
      return;
    }

    if (moveSelectionError) {
      setFormError(moveSelectionError);
      return;
    }

    setIsMoveConfirmOpen(true);
  };

  const handleMoveLearningObjectives = async () => {
    if (!moveSourceId || !moveTargetId || moveSourceId === moveTargetId) {
      return;
    }

    const sourceTitle =
      moveSourceDiscipline?.title || getShortIdentifier(moveSourceId);
    const targetTitle =
      moveTargetDiscipline?.title || getShortIdentifier(moveTargetId);

    setIsMoving(true);
    resetMessages();

    try {
      const response = await testsService.moveDisciplineLearningObjectives(
        moveSourceId,
        moveTargetId,
      );
      const movedLabel = `${response.moved} learning objective${
        response.moved === 1 ? '' : 's'
      }`;

      setSuccessMessage(
        `Moved ${movedLabel} from "${sourceTitle}" to "${targetTitle}".`,
      );
      // Keep the target so another discipline can be merged into it next.
      setMoveSourceId('');
      setMoveTargetId(moveTargetId);
      setIsMoveOpen(false);
      await loadDisciplines({ background: true });
    } catch (error) {
      console.error('Failed to move discipline learning objectives:', error);
      setFormError(
        getErrorMessage(
          error,
          'Unable to move learning objectives between disciplines right now.',
        ),
      );
    } finally {
      setIsMoving(false);
      setIsMoveConfirmOpen(false);
    }
  };

  // --- Render ---------------------------------------------------------------

  const clearFilters = () => {
    setSearchQuery('');
    setFilter('all');
  };

  const isRowBusy = (discipline: Discipline) =>
    isSaving || isMoving || deletingId === discipline.id;

  const statusText = isLoading
    ? 'Loading…'
    : isRefreshing
      ? 'Refreshing…'
      : visibleDisciplines.length === totalDisciplines
        ? plural(totalDisciplines, 'discipline')
        : `Showing ${visibleDisciplines.length.toLocaleString()} of ${totalDisciplines.toLocaleString()}`;

  const renderBody = () => {
    if (isLoading) {
      return <Spinner label="Loading disciplines…" className="py-24" />;
    }

    if (disciplines.length === 0) {
      return (
        <div className="rounded-xl border border-stone-200">
          {loadError ? (
            <EmptyState
              icon={FlaskConical}
              title="Couldn't load disciplines"
              description={loadError}
              action={
                <Button icon={RefreshCw} onClick={() => void loadDisciplines()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FlaskConical}
              title="No disciplines yet"
              description="Create the first discipline to start managing the taxonomy."
              action={
                <Button variant="primary" icon={Plus} onClick={openCreate}>
                  New discipline
                </Button>
              }
            />
          )}
        </div>
      );
    }

    if (visibleDisciplines.length === 0) {
      const trimmed = searchQuery.trim();
      const description = trimmed
        ? `Nothing matches “${trimmed}”${filter === 'all' ? '' : ' with this filter'}.`
        : filter === 'unused'
          ? 'Every discipline has linked learning objectives.'
          : 'No discipline has linked learning objectives yet.';
      return (
        <div className="rounded-xl border border-stone-200">
          <EmptyState
            compact
            icon={Search}
            title="No matching disciplines"
            description={description}
            action={
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Show all disciplines
              </Button>
            }
          />
        </div>
      );
    }

    return (
      <DisciplineList
        disciplines={visibleDisciplines}
        selectedId={selectedId}
        isBusy={isRowBusy}
        onOpen={(discipline) => {
          resetMessages();
          setSelectedId(discipline.id);
        }}
        onRename={beginEdit}
        onMoveFrom={(discipline) => assignMoveDiscipline('source', discipline)}
        onDelete={requestDelete}
      />
    );
  };

  const pageError = errorFor('page');
  const showRefreshError = Boolean(loadError) && disciplines.length > 0;
  const showLimitWarning = totalDisciplines > LIST_LIMIT;

  return (
    <div>
      <PageHeader
        title="Disciplines"
        description="The discipline taxonomy used to tag learning objectives and item metadata — add, rename, merge or retire disciplines."
        actions={
          <>
            <Button
              icon={ArrowRightLeft}
              onClick={openMove}
              disabled={isLoading || disciplines.length < 2}
            >
              Move objectives
            </Button>
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              New discipline
            </Button>
          </>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search disciplines"
          className="w-full sm:w-80"
          disabled={isLoading && disciplines.length === 0}
        />
        {disciplines.length > 0 && (
          <SegmentedControl<DisciplineFilter>
            label="Filter disciplines by use"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: filterCounts.all },
              { value: 'in-use', label: 'In use', count: filterCounts['in-use'] },
              { value: 'unused', label: 'Unused', count: filterCounts.unused },
            ]}
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[13px] tabular-nums text-stone-500" aria-live="polite">
            {statusText}
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            loading={isRefreshing}
            onClick={() => void loadDisciplines({ background: true })}
            disabled={isLoading || isRefreshing}
          >
            Refresh
          </Button>
        </div>
      </div>

      {(pageError || showRefreshError || showLimitWarning) && (
        <div className="mt-5 space-y-3">
          {pageError && <InlineAlert onDismiss={dismissFormError}>{pageError}</InlineAlert>}
          {showRefreshError && (
            <InlineAlert
              onDismiss={() => setLoadError(null)}
              action={
                <Button
                  size="sm"
                  onClick={() => void loadDisciplines({ background: true })}
                  loading={isRefreshing}
                >
                  Try again
                </Button>
              }
            >
              {loadError}
            </InlineAlert>
          )}
          {showLimitWarning && (
            <InlineAlert tone="warning">
              Only the first {LIST_LIMIT} disciplines are loaded in this view. Increase the page
              size or add pagination if the taxonomy grows beyond that.
            </InlineAlert>
          )}
        </div>
      )}

      <div className="mt-5">{renderBody()}</div>

      <DisciplineDetailDrawer
        discipline={selectedDiscipline}
        onClose={() => {
          setSelectedId(null);
          setFormError(null);
        }}
        onRename={beginEdit}
        onMoveFrom={(discipline) => assignMoveDiscipline('source', discipline)}
        onMoveTo={(discipline) => assignMoveDiscipline('target', discipline)}
        onDelete={requestDelete}
        busy={selectedDiscipline ? isRowBusy(selectedDiscipline) : false}
        error={errorFor('drawer')}
        onDismissError={dismissFormError}
      />

      <DisciplineTitleDialog
        open={isCreateOpen}
        value={newTitle}
        onChange={setNewTitle}
        onSubmit={() => void handleCreate()}
        onClose={closeCreate}
        saving={isSaving}
        disabled={isMoving}
        error={errorFor('create')}
        onDismissError={dismissFormError}
      />

      <DisciplineTitleDialog
        open={editingDiscipline !== null}
        discipline={editingDiscipline}
        value={editingTitle}
        onChange={setEditingTitle}
        onSubmit={() => {
          if (editingDiscipline) void handleSaveEdit(editingDiscipline);
        }}
        onClose={closeEdit}
        saving={isSaving}
        disabled={isMoving}
        error={errorFor('rename')}
        onDismissError={dismissFormError}
      />

      <MoveObjectivesDialog
        open={isMoveOpen}
        onClose={closeMove}
        disciplines={disciplines}
        sourceId={moveSourceId}
        targetId={moveTargetId}
        onSourceChange={(value) => {
          resetMessages();
          setMoveSourceId(value);
        }}
        onTargetChange={(value) => {
          resetMessages();
          setMoveTargetId(value);
        }}
        onSwap={handleSwapMoveDisciplines}
        onSubmit={openMoveConfirmation}
        isMoving={isMoving}
        isSaving={isSaving}
        selectionError={moveSelectionError}
        error={errorFor('move')}
        onDismissError={dismissFormError}
      />

      <ConfirmDialog
        open={isMoveConfirmOpen}
        tone="default"
        title="Move learning objectives?"
        description={
          moveSourceDiscipline && moveTargetDiscipline
            ? moveSourceObjectiveCount === null
              ? `This will move all linked learning objectives from "${moveSourceDiscipline.title}" to "${moveTargetDiscipline.title}".`
              : `This will move ${formatLearningObjectiveCount(
                  moveSourceObjectiveCount,
                ).toLowerCase()} from "${moveSourceDiscipline.title}" to "${moveTargetDiscipline.title}".`
            : 'Confirm moving learning objectives between the selected disciplines.'
        }
        confirmLabel="Move objectives"
        busy={isMoving}
        onConfirm={() => void handleMoveLearningObjectives()}
        onCancel={() => {
          if (!isMoving) {
            setIsMoveConfirmOpen(false);
          }
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete discipline?"
        description={
          pendingDelete
            ? `“${pendingDelete.title}” will be removed from the taxonomy. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete discipline"
        busy={deletingId !== null}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete);
        }}
        onCancel={() => {
          if (deletingId === null) {
            setPendingDelete(null);
          }
        }}
      />

      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-[140] flex w-[min(92vw,440px)] -translate-x-1/2 items-center gap-2.5 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-pop animate-dialog-in"
        >
          <CheckCircle2 size={16} className="flex-shrink-0 text-brand-400" />
          <span className="min-w-0 flex-1">{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 text-stone-400 transition hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DisciplinesView;
