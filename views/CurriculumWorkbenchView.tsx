import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Library, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCurriculumWorkbench } from '../hooks/useCurriculumWorkbench';
import { useCurriculumContent } from '../hooks/useCurriculumContent';
import WorkbenchSidebar from '../components/curriculum-workbench/WorkbenchSidebar';
import CurriculumFormModal from '../components/curriculum-workbench/CurriculumFormModal';
import AttachOrganSystemModal from '../components/curriculum-workbench/AttachOrganSystemModal';
import HierarchyPane from '../components/curriculum-workbench/HierarchyPane';
import {
  WorkbenchTreeContext,
  type WorkbenchTreeState,
} from '../components/curriculum-workbench/WorkbenchTreeContext';
import LinkedItemsPanel from '../components/curriculum/LinkedItemsPanel';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  Menu,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui';
import { identifierOf } from '../utils/resourceId';
import type { LearningObjective } from '../types/TestsServiceTypes';

/**
 * Curricula: pick a curriculum, then edit its hierarchy — organ systems →
 * topics → subtopics → learning objectives — in a two-pane workspace (outline
 * rail on the left, the selected node and its children on the right).
 */
const CurriculumWorkbenchView: React.FC = () => {
  const navigate = useNavigate();
  const {
    curricula,
    isLoadingList,
    selectedIdentifier,
    selectedCurriculum,
    isLoadingDetail,
    selectCurriculum,
    isMutating,
    actionError,
    clearActionError,
    createCurriculum,
    renameCurriculum,
    deleteCurriculum,
    canManage,
  } = useCurriculumWorkbench();

  const content = useCurriculumContent(selectedCurriculum?.id ?? null);

  const [formModal, setFormModal] = useState<'create' | 'edit' | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [viewLinkedItems, setViewLinkedItems] = useState<LearningObjective | null>(null);

  const handleCreateLinkedItem = (obj: LearningObjective, redirectTo?: string) => {
    const context: Record<string, unknown> = {
      questionId: 'new',
      organSystemId: content.activeSystemId,
      topicId: content.activeTopicId,
      syndromeId: content.activeSubTopicId,
      learningObjectiveId: obj.id,
      cognitiveSkillId: obj.cognitiveSkillId || '',
    };
    if (redirectTo) context.redirect = redirectTo;
    setViewLinkedItems(null);
    const params = new URLSearchParams();
    Object.entries(context).forEach(([k, v]) => {
      if (v) params.append(k, String(v));
    });
    navigate(`/workbench?${params.toString()}`);
  };

  // Re-selecting the current curriculum clears the organ system / topic /
  // subtopic from the URL, which puts the curriculum itself in focus.
  const selectRoot = () => {
    if (selectedIdentifier) selectCurriculum(selectedIdentifier);
  };

  const treeState: WorkbenchTreeState = {
    isRootActive: !content.activeSystem,
    onSelectRoot: selectRoot,
    activeTopicId: content.activeTopicId,
    activeSubTopicId: content.activeSubTopicId,
    areTopicsLoading: content.areTopicsLoading,
    areSubTopicsLoading: content.areSyndromesLoading,
    onSelectTopic: (topicId) => content.handleTopicSelect(topicId),
    onSelectSubTopic: content.handleSubTopicSelect,
  };

  // Keep the picker showing the open curriculum even if the list doesn't include it.
  const pickerCurricula = useMemo(() => {
    if (!selectedCurriculum) return curricula;
    const slug = identifierOf(selectedCurriculum);
    return curricula.some((c) => identifierOf(c) === slug)
      ? curricula
      : [selectedCurriculum, ...curricula];
  }, [curricula, selectedCurriculum]);

  const confirmDeleteCurriculum = async () => {
    if (!selectedCurriculum) return;
    setIsDeleting(true);
    try {
      await deleteCurriculum(identifierOf(selectedCurriculum));
    } catch {
      /* surfaced via actionError */
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  // --- Header ---------------------------------------------------------------------------
  const headerActions = (
    <>
      <Select
        aria-label="Curriculum"
        value={selectedIdentifier ?? ''}
        onChange={(e) => e.target.value && selectCurriculum(e.target.value)}
        disabled={isLoadingList && curricula.length === 0}
        className="min-w-[12rem] sm:w-64"
      >
        <option value="" disabled>
          {isLoadingList && curricula.length === 0 ? 'Loading…' : 'Select a curriculum'}
        </option>
        {pickerCurricula.map((c) => {
          const slug = identifierOf(c);
          return (
            <option key={c.id} value={slug}>
              {c.title}
              {c.visible ? '' : ' · hidden'}
            </option>
          );
        })}
      </Select>
      {canManage && (
        <Button icon={Plus} onClick={() => setFormModal('create')}>
          New curriculum
        </Button>
      )}
      {canManage && selectedCurriculum && (
        <Menu
          label="Curriculum actions"
          items={[
            {
              label: 'Edit details',
              icon: Pencil,
              disabled: isMutating,
              onSelect: () => setFormModal('edit'),
            },
            {
              label: 'Delete curriculum',
              icon: Trash2,
              tone: 'danger',
              disabled: isMutating,
              onSelect: () => setIsDeleteOpen(true),
            },
          ]}
        />
      )}
    </>
  );

  // --- Body -----------------------------------------------------------------------------
  const renderBody = () => {
    if (!selectedIdentifier) {
      if (isLoadingList && curricula.length === 0) {
        return <Spinner label="Loading curricula…" className="py-24" />;
      }
      if (curricula.length === 0) {
        return (
          <EmptyState
            icon={Library}
            title="No curricula yet"
            description={
              canManage
                ? 'A curriculum holds the organ systems, topics and learning objectives your courses are built from.'
                : 'An administrator needs to create a curriculum before you can manage its content.'
            }
            action={
              canManage && (
                <Button variant="primary" icon={Plus} onClick={() => setFormModal('create')}>
                  New curriculum
                </Button>
              )
            }
          />
        );
      }
      return (
        <EmptyState
          icon={Library}
          title="Choose a curriculum"
          description="Pick a curriculum above to manage its organ systems, topics and learning objectives."
        />
      );
    }

    if ((isLoadingDetail || isLoadingList) && !selectedCurriculum) {
      return <Spinner label="Loading curriculum…" className="py-24" />;
    }

    if (!selectedCurriculum) {
      return (
        <EmptyState
          icon={Library}
          title="Curriculum not found"
          description="It may have been deleted, or you may no longer have access to it."
          action={
            <Button variant="ghost" onClick={() => selectCurriculum(null)}>
              Choose another curriculum
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid items-start gap-6 lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)]">
        <WorkbenchTreeContext.Provider value={treeState}>
          <WorkbenchSidebar
            curricula={curricula}
            isLoadingCurricula={isLoadingList}
            activeCurriculumIdentifier={selectedIdentifier}
            onCurriculumChange={selectCurriculum}
            onCreateCurriculum={() => setFormModal('create')}
            organSystems={content.organSystems}
            isLoadingOrganSystems={content.isLoadingOrganSystems}
            activeSystemId={content.activeSystemId}
            onSelectSystem={content.handleSystemSelect}
            onCreateSystem={content.createOrganSystem}
            onOpenAttach={() => setIsAttachOpen(true)}
            onEditSystem={content.updateOrganSystem}
            onDeleteSystem={content.deleteOrganSystem}
            canManage={canManage}
          />
        </WorkbenchTreeContext.Provider>

        <HierarchyPane
          curriculum={selectedCurriculum}
          content={content}
          canManage={canManage}
          onSelectRoot={selectRoot}
          onOpenAttach={() => setIsAttachOpen(true)}
          onViewLinked={setViewLinkedItems}
        />
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Curricula"
        description="Organise a curriculum into organ systems, topics and subtopics, then write the learning objectives your courses are built from."
        actions={headerActions}
      />

      {actionError && (
        <InlineAlert className="mt-6" onDismiss={clearActionError}>
          {actionError}
        </InlineAlert>
      )}

      <div className="mt-6">{renderBody()}</div>

      {/* Curriculum create / edit */}
      <CurriculumFormModal
        isOpen={formModal !== null}
        mode={formModal ?? 'create'}
        initialTitle={formModal === 'edit' ? selectedCurriculum?.title ?? '' : ''}
        initialSummary={formModal === 'edit' ? selectedCurriculum?.summary ?? '' : ''}
        initialVisible={formModal === 'edit' ? selectedCurriculum?.visible ?? false : false}
        onClose={() => setFormModal(null)}
        onSubmit={async (title, visible, summary) => {
          if (formModal === 'edit' && selectedCurriculum) {
            await renameCurriculum(selectedCurriculum.id, title, visible, summary);
          } else {
            await createCurriculum(title, visible, summary);
          }
        }}
      />

      {/* Attach existing organ systems */}
      <AttachOrganSystemModal
        isOpen={isAttachOpen}
        curriculumId={selectedCurriculum?.id ?? null}
        linkedIds={content.organSystems.map((s) => s.id)}
        onClose={() => setIsAttachOpen(false)}
        onAttach={content.attachOrganSystems}
      />

      {/* Delete curriculum */}
      <ConfirmDialog
        open={isDeleteOpen}
        title="Delete curriculum?"
        description={`“${selectedCurriculum?.title ?? ''}” will be removed and no longer listed. Its organ systems are not deleted. If it still has linked resources, deletion is blocked. This can’t be undone.`}
        confirmLabel="Delete curriculum"
        busy={isDeleting}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() => void confirmDeleteCurriculum()}
      />

      {/* Linked items for an objective */}
      {viewLinkedItems && (
        <LinkedItemsPanel
          objective={viewLinkedItems}
          onClose={() => setViewLinkedItems(null)}
          onCreateNew={handleCreateLinkedItem}
        />
      )}
    </>
  );
};

export default CurriculumWorkbenchView;
