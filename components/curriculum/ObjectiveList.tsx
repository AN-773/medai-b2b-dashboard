import React, { useState, useMemo } from 'react';
import { ChevronDown, ListChecks, Loader2, Pencil, Plus, Search, Sparkles, Target, Trash2 } from 'lucide-react';
import { LearningObjective, Syndrome, Topic } from '@/types/TestsServiceTypes';
import { testsService } from '../../services/testsService';
import CreateObjectiveModal from './CreateObjectiveModal';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  Menu,
  Spinner,
  StatusDot,
} from '@/components/ui';
import {
  EmptyFrame,
  ListCard,
  errorMessage,
  plural,
} from '@/components/curriculum-workbench/HierarchyRows';

interface ObjectiveListProps {
  organSystemName: string;
  topic: Topic;
  subTopic?: Syndrome | null;
  searchTerm: string;
  bloomFilter: string;
  setBloomFilter: (val: string) => void;
  onBack: () => void;
  onEdit: (id: string, data: { title: string; syndromeId: string; cognitiveSkillId: string; disciplines: string[]; exam?: string; subjectId?: string }) => Promise<void>;
  onDelete: (id: string) => void;
  onCreateObjective?: (data: { title: string; syndromeId: string; cognitiveSkillId: string; disciplines: string[]; exam?: string; subjectId?: string }) => Promise<void>;
  onViewLinked: (obj: LearningObjective) => void;
  isLoading?: boolean;
  currentPage?: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  onRefresh?: () => void;
  curriculumMode?: 'STEP 1' | 'STEP 2';
}

/** Cognitive skill · disciplines · subject · linked items — the meta line under an objective. */
const ObjectiveMetaLine: React.FC<{ objective: LearningObjective }> = ({ objective }) => {
  const parts = [
    objective.cognitiveSkill?.title,
    objective.disciplines?.map((discipline) => discipline.title).join(', '),
    objective.subject?.title,
  ].filter((part): part is string => Boolean(part));
  const itemCount = objective.questions?.length || 0;
  if (parts.length === 0 && itemCount === 0) return null;

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-stone-500">
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          {index > 0 && (
            <span aria-hidden="true" className="text-stone-300">
              ·
            </span>
          )}
          <span>{part}</span>
        </React.Fragment>
      ))}
      {itemCount > 0 && (
        <>
          {parts.length > 0 && (
            <span aria-hidden="true" className="text-stone-300">
              ·
            </span>
          )}
          <StatusDot tone="green">{plural(itemCount, 'item')}</StatusDot>
        </>
      )}
    </span>
  );
};

/**
 * The learning objectives of a subtopic, in the same row style as a course's
 * Objectives tab. Click a row to edit it; "Linked items" opens the items that
 * assess it. Search, the Bloom filter and the page header live with the host.
 */
const ObjectiveList: React.FC<ObjectiveListProps> = ({
  organSystemName, topic, subTopic, searchTerm, bloomFilter, onEdit, onDelete, onCreateObjective, onViewLinked, isLoading,
  currentPage = 1, totalItems = 0, itemsPerPage = 20, onPageChange, onRefresh, curriculumMode
}: ObjectiveListProps) => {
  const [editingObj, setEditingObj] = useState<LearningObjective | null>(null);
  const [isFetchingObj, setIsFetchingObj] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LearningObjective | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'manual' | 'generate'>('manual');

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const hasMorePages = currentPage < totalPages;

  const allObjectives = topic?.objectives || [];

  const filteredObjectives = useMemo(() => {
    let filtered = topic?.objectives || [];

    if (searchTerm) {
      const lowerQuery = searchTerm.toLowerCase();
      filtered = filtered.filter(obj =>
        obj.title.toLowerCase().includes(lowerQuery)
      );
    }

    if (bloomFilter && bloomFilter !== 'All') {
      filtered = filtered.filter(obj =>
        obj.cognitiveSkill?.title === bloomFilter
      );
    }

    return filtered;
  }, [topic?.objectives, searchTerm, bloomFilter]);

  const handleStartEdit = async (obj: LearningObjective) => {
    try {
      setIsFetchingObj(true);
      setFetchingId(obj.id);
      const fullObj = await testsService.getLearningObjective(obj.id?.split("/")?.pop() || "");
      setEditingObj(fullObj);
      setModalMode('manual');
      setIsCreateModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch full learning objective', err);
      // Fallback
      setEditingObj(obj);
      setModalMode('manual');
      setIsCreateModalOpen(true);
    } finally {
      setIsFetchingObj(false);
      setFetchingId(null);
    }
  };

  const openCreate = (mode: 'manual' | 'generate') => {
    setEditingObj(null);
    setModalMode(mode);
    setIsCreateModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      await Promise.resolve(onDelete(pendingDelete.id));
    } catch (err) {
      console.error('Failed to delete objective:', err);
      setError(errorMessage(err, 'Could not delete this objective.'));
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  // Stable identity so the drawer doesn't reset while it's open.
  const modalInitialData = useMemo(
    () =>
      editingObj
        ? {
            title: editingObj.title,
            syndromeId: editingObj.syndromeId,
            cognitiveSkillId: editingObj.cognitiveSkillId,
            disciplines: editingObj.disciplines?.map((d) => d.id) || [],
            exam: editingObj.exam,
            organSystemId: editingObj.syndrome?.topic?.organSystemId,
            topicId: editingObj.syndrome?.topicId,
            subjectId: editingObj.subjectId,
          }
        : null,
    [editingObj],
  );

  const canLoadMore = hasMorePages && !searchTerm && bloomFilter === 'All';
  const remaining = Math.max(0, totalItems - filteredObjectives.length);
  const isBloomFiltered = Boolean(bloomFilter) && bloomFilter !== 'All';
  const isFiltering = Boolean(searchTerm) || isBloomFiltered;

  const renderRow = (obj: LearningObjective) => {
    const isFetchingThis = fetchingId === obj.id;
    return (
      <li key={obj.id} className="flex items-start gap-1 pr-2 transition-colors hover:bg-stone-50">
        <button
          type="button"
          onClick={() => void handleStartEdit(obj)}
          disabled={isFetchingObj}
          className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 pr-2 text-left disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
        >
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm font-medium leading-5 text-stone-900">
              <span className="sr-only">Edit objective: </span>
              {obj.title}
            </span>
            <ObjectiveMetaLine objective={obj} />
          </span>
          {isFetchingThis && (
            <Loader2 size={16} className="mt-0.5 flex-shrink-0 animate-spin text-brand-600" aria-hidden="true" />
          )}
        </button>
        <div className="flex flex-shrink-0 items-center gap-1 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            icon={ListChecks}
            onClick={() => onViewLinked(obj)}
            aria-label={`Linked items for “${obj.title}”`}
          >
            <span className="hidden sm:inline">Linked items</span>
          </Button>
          <Menu
            size="sm"
            label="Objective actions"
            items={[
              {
                label: 'Edit objective',
                icon: Pencil,
                disabled: isFetchingObj,
                onSelect: () => void handleStartEdit(obj),
              },
              {
                label: 'Delete objective',
                icon: Trash2,
                tone: 'danger',
                disabled: isFetchingObj,
                onSelect: () => setPendingDelete(obj),
              },
            ]}
          />
        </div>
      </li>
    );
  };

  const renderBody = () => {
    // Full spinner only for a first page; "Load more" keeps the list on screen.
    if (isLoading && (currentPage <= 1 || allObjectives.length === 0)) {
      return <Spinner label="Loading objectives…" className="py-16" />;
    }

    if (allObjectives.length === 0) {
      return (
        <EmptyFrame>
          <EmptyState
            icon={Target}
            title="No objectives yet"
            description={`Write what learners should be able to do for ${subTopic?.title || topic.title}, or let AI draft one for you to review.`}
            action={
              onCreateObjective && (
                <>
                  <Button variant="primary" icon={Plus} onClick={() => openCreate('manual')}>
                    New objective
                  </Button>
                  <Button variant="ai" icon={Sparkles} onClick={() => openCreate('generate')}>
                    Generate with AI
                  </Button>
                </>
              )
            }
          />
        </EmptyFrame>
      );
    }

    if (filteredObjectives.length === 0) {
      const trimmed = searchTerm.trim();
      return (
        <ListCard>
          <EmptyState
            compact
            icon={Search}
            title="No matching objectives"
            description={
              trimmed
                ? `Nothing matches “${trimmed}”${isBloomFiltered ? ` at the ${bloomFilter} level` : ''}.`
                : `No loaded objectives are at the ${bloomFilter} level.`
            }
          />
        </ListCard>
      );
    }

    return (
      <ListCard>
        <ul aria-label="Learning objectives" className="divide-y divide-stone-100">
          {filteredObjectives.map(renderRow)}
        </ul>
        <div className="flex min-h-11 items-center justify-between gap-3 border-t border-stone-100 px-4 text-[13px] text-stone-500">
          <p className="tabular-nums">
            {isFiltering
              ? `${plural(filteredObjectives.length, 'match', 'matches')} in ${allObjectives.length.toLocaleString()} loaded`
              : `${allObjectives.length.toLocaleString()} of ${plural(totalItems || allObjectives.length, 'objective')}`}
          </p>
          {canLoadMore && (
            <Button
              variant="ghost"
              size="sm"
              icon={ChevronDown}
              loading={isLoading}
              onClick={() => onPageChange?.(currentPage + 1)}
            >
              Load more
              <span className="tabular-nums text-stone-400">{remaining.toLocaleString()}</span>
            </Button>
          )}
        </div>
      </ListCard>
    );
  };

  return (
    <div className="space-y-3">
      {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}

      {renderBody()}

      <CreateObjectiveModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingObj(null);
        }}
        topic={topic}
        subTopic={subTopic}
        onSubmit={async (data: { title: string; syndromeId: string; cognitiveSkillId: string; disciplines: string[]; exam?: string; subjectId?: string }) => {
          if (editingObj) {
            const originalSyndromeId = editingObj.syndromeId;
            await onEdit(editingObj.id, data);
            if (originalSyndromeId && data.syndromeId !== originalSyndromeId) {
              onRefresh?.();
            }
          } else if (onCreateObjective) {
            await onCreateObjective(data);
          }
        }}
        initialMode={modalMode}
        initialData={modalInitialData}
        organSystemName={organSystemName}
        curriculumMode={curriculumMode}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete objective?"
        description={
          pendingDelete ? (
            <>“{pendingDelete.title}” will be permanently deleted. This can’t be undone.</>
          ) : (
            ''
          )
        }
        confirmLabel="Delete objective"
        busy={isDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

export default ObjectiveList;
