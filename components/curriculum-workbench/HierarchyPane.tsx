import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronRight, Link2, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import type {
  Curriculum,
  LearningObjective,
  Syndrome,
  Topic,
} from '@/types/TestsServiceTypes';
import type { UseCurriculumContentReturn } from '@/hooks/useCurriculumContent';
import { identifierOf } from '@/utils/resourceId';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  Menu,
  SearchInput,
  SectionHeader,
  Select,
  Spinner,
} from '@/components/ui';
import TopicGrid from '@/components/curriculum/TopicGrid';
import SubTopicGrid from '@/components/curriculum/SubTopicGrid';
import ObjectiveList from '@/components/curriculum/ObjectiveList';
import CreateTopicModal from '@/components/curriculum/CreateTopicModal';
import CreateSubTopicModal from '@/components/curriculum/CreateSubTopicModal';
import CreateObjectiveModal from '@/components/curriculum/CreateObjectiveModal';
import { AddRow, EmptyFrame, ListCard, NodeRow, errorMessage, plural } from './HierarchyRows';
import { useOrganSystemEditor } from './OrganSystemDialog';

/** Bloom levels offered by the objective filter (matches the list's filter values). */
const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze'];

type Level = 'root' | 'system' | 'topic' | 'subtopic';

type PendingDelete = { kind: 'topic'; item: Topic } | { kind: 'subtopic'; item: Syndrome };

interface HierarchyPaneProps {
  curriculum: Curriculum;
  content: UseCurriculumContentReturn;
  canManage: boolean;
  /** Select the curriculum itself (clears the organ system / topic / subtopic). */
  onSelectRoot: () => void;
  onOpenAttach: () => void;
  onViewLinked: (objective: LearningObjective) => void;
}

const Count: React.FC<{ value?: number }> = ({ value }) =>
  typeof value === 'number' ? (
    <span className="text-[15px] tabular-nums text-stone-400">{value.toLocaleString()}</span>
  ) : null;

/**
 * The main pane of the Curricula workspace: the selected node (curriculum,
 * organ system, topic or subtopic), its actions, and its children as divided
 * rows — or, for a subtopic, its learning objectives.
 */
const HierarchyPane: React.FC<HierarchyPaneProps> = ({
  curriculum,
  content,
  canManage,
  onSelectRoot,
  onOpenAttach,
  onViewLinked,
}) => {
  const { activeSystem, activeTopic, activeSubTopic } = content;
  const level: Level = !activeSystem
    ? 'root'
    : !activeTopic
      ? 'system'
      : !activeSubTopic
        ? 'topic'
        : 'subtopic';

  const [rootSearch, setRootSearch] = useState('');
  const [topicDialog, setTopicDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; topic: Topic } | null
  >(null);
  const [subTopicDialog, setSubTopicDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; subTopic: Syndrome } | null
  >(null);
  const [objectiveMode, setObjectiveMode] = useState<'manual' | 'generate' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const systemEditor = useOrganSystemEditor({
    onCreate: content.createOrganSystem,
    onRename: content.updateOrganSystem,
    onDelete: content.deleteOrganSystem,
  });

  useEffect(() => {
    setRootSearch('');
    setError(null);
  }, [curriculum.id]);

  // Stable identities so the dialogs don't reset while open.
  const topicInitialData = useMemo(
    () =>
      topicDialog?.mode === 'edit'
        ? {
            name: topicDialog.topic.title,
            identifier: topicDialog.topic.identifier,
            organSystemId: activeSystem?.id,
          }
        : null,
    [topicDialog, activeSystem?.id],
  );

  const subTopicInitialData = useMemo(
    () =>
      subTopicDialog?.mode === 'edit'
        ? {
            name: subTopicDialog.subTopic.title,
            identifier: subTopicDialog.subTopic.identifier,
            topicId: activeTopic?.id,
            organSystemId: activeSystem?.id,
          }
        : null,
    [subTopicDialog, activeTopic?.id, activeSystem?.id],
  );

  const submitTopic = async (data: { name: string; organSystemId: string }) => {
    if (topicDialog?.mode === 'edit') {
      await content.updateTopic(topicDialog.topic.id, data.name, data.organSystemId);
    } else if (activeSystem) {
      await content.createTopic(data.name, activeSystem.id);
    }
  };

  const submitSubTopic = async (data: { name: string; topicId: string }) => {
    if (subTopicDialog?.mode === 'edit') {
      await content.updateSubTopic(subTopicDialog.subTopic.id, data.name, data.topicId);
    } else if (activeTopic) {
      await content.createSubTopic(data.name, activeTopic.id);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      if (pendingDelete.kind === 'topic') await content.deleteTopic(pendingDelete.item.id);
      else await content.deleteSubTopic(pendingDelete.item.id);
    } catch (err) {
      console.error(`Failed to delete ${pendingDelete.kind}:`, err);
      setError(errorMessage(err, `Could not delete “${pendingDelete.item.title}”.`));
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  // --- Breadcrumb (ancestors of the selected node) ---------------------------------
  const renderEyebrow = () => {
    if (level === 'root') return null;
    const crumbs: { key: string; label: string; onClick: () => void }[] = [
      { key: 'curriculum', label: curriculum.title, onClick: onSelectRoot },
    ];
    if ((level === 'topic' || level === 'subtopic') && activeSystem) {
      crumbs.push({
        key: 'system',
        label: activeSystem.title,
        onClick: () => content.handleTopicSelect(null),
      });
    }
    if (level === 'subtopic' && activeTopic) {
      crumbs.push({
        key: 'topic',
        label: activeTopic.title,
        onClick: () => content.handleSubTopicSelect(null),
      });
    }
    return (
      <nav aria-label="Location in curriculum" className="mb-1.5">
        <ol className="flex min-w-0 flex-wrap items-center gap-1 text-[13px] text-stone-500">
          {crumbs.map((crumb, index) => (
            <li key={crumb.key} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight size={13} className="flex-shrink-0 text-stone-300" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={crumb.onClick}
                title={crumb.label}
                className="-mx-1 max-w-[16rem] truncate rounded px-1 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                {crumb.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    );
  };

  // --- Header for the selected node -----------------------------------------------
  const renderHeader = () => {
    if (level === 'root') {
      return (
        <SectionHeader
          title={curriculum.title}
          meta={
            <>
              <Badge tone={curriculum.visible ? 'green' : 'neutral'} dot>
                {curriculum.visible ? 'Visible' : 'Hidden'}
              </Badge>
              <span className="font-mono text-xs text-stone-400">{identifierOf(curriculum)}</span>
            </>
          }
          description={
            curriculum.summary ||
            'Organ systems are the top level of this curriculum. Open one to manage its topics.'
          }
          actions={
            canManage && (
              <>
                <Button icon={Link2} onClick={onOpenAttach}>
                  Attach existing
                </Button>
                <Button variant="primary" icon={Plus} onClick={systemEditor.openCreate}>
                  New organ system
                </Button>
              </>
            )
          }
        />
      );
    }

    if (level === 'system' && activeSystem) {
      return (
        <SectionHeader
          title={activeSystem.title}
          meta={<Count value={activeSystem.topics?.length} />}
          description="Topics in this organ system. Open one to manage its subtopics."
          actions={
            <>
              <Button variant="primary" icon={Plus} onClick={() => setTopicDialog({ mode: 'create' })}>
                New topic
              </Button>
              {canManage && (
                <Menu
                  label={`Actions for ${activeSystem.title}`}
                  items={systemEditor.menuItems(activeSystem)}
                />
              )}
            </>
          }
        />
      );
    }

    if (level === 'topic' && activeTopic) {
      return (
        <SectionHeader
          title={activeTopic.title}
          meta={<Count value={activeTopic.syndromes?.length} />}
          description="Subtopics in this topic. Open one to write its learning objectives."
          actions={
            <>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setSubTopicDialog({ mode: 'create' })}
              >
                New subtopic
              </Button>
              <Menu
                label={`Actions for ${activeTopic.title}`}
                items={[
                  {
                    label: 'Edit topic',
                    icon: Pencil,
                    onSelect: () => setTopicDialog({ mode: 'edit', topic: activeTopic }),
                  },
                  {
                    label: 'Delete topic',
                    icon: Trash2,
                    tone: 'danger',
                    onSelect: () => setPendingDelete({ kind: 'topic', item: activeTopic }),
                  },
                ]}
              />
            </>
          }
        />
      );
    }

    if (level === 'subtopic' && activeSubTopic) {
      return (
        <SectionHeader
          title={activeSubTopic.title}
          meta={
            <Count value={content.areObjectivesLoading ? undefined : content.objectivesTotal} />
          }
          description="Learning objectives for this subtopic. Click one to edit it, or open its linked items."
          actions={
            <>
              <Button variant="ai" icon={Sparkles} onClick={() => setObjectiveMode('generate')}>
                Generate with AI
              </Button>
              <Button variant="primary" icon={Plus} onClick={() => setObjectiveMode('manual')}>
                New objective
              </Button>
              <Menu
                label={`Actions for ${activeSubTopic.title}`}
                items={[
                  {
                    label: 'Edit subtopic',
                    icon: Pencil,
                    onSelect: () => setSubTopicDialog({ mode: 'edit', subTopic: activeSubTopic }),
                  },
                  {
                    label: 'Delete subtopic',
                    icon: Trash2,
                    tone: 'danger',
                    onSelect: () => setPendingDelete({ kind: 'subtopic', item: activeSubTopic }),
                  },
                ]}
              />
            </>
          }
        />
      );
    }

    return null;
  };

  // --- Toolbar (search + filters) -----------------------------------------------------
  const renderToolbar = () => {
    if (level === 'root') {
      if (content.isLoadingOrganSystems || content.organSystems.length === 0) return null;
      return (
        <SearchInput
          className="w-full sm:w-72"
          value={rootSearch}
          onChange={setRootSearch}
          placeholder="Filter organ systems"
        />
      );
    }

    const hasChildren =
      level === 'system'
        ? (activeSystem?.topics?.length ?? 0) > 0
        : level === 'topic'
          ? (activeTopic?.syndromes?.length ?? 0) > 0
          : (activeTopic?.objectives?.length ?? 0) > 0 || content.bloomFilter !== 'All';
    if (!hasChildren && !content.contentSearch) return null;

    return (
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          className="w-full sm:w-72"
          value={content.contentSearch}
          onChange={content.setContentSearch}
          placeholder={
            level === 'system'
              ? 'Filter topics'
              : level === 'topic'
                ? 'Filter subtopics'
                : 'Search objectives'
          }
        />
        {level === 'subtopic' && (
          <Select
            aria-label="Filter objectives by Bloom level"
            value={content.bloomFilter}
            onChange={(event) => content.setBloomFilter(event.target.value)}
            className="sm:w-48"
          >
            <option value="All">All Bloom levels</option>
            {BLOOM_LEVELS.map((bloom) => (
              <option key={bloom} value={bloom}>
                {bloom}
              </option>
            ))}
          </Select>
        )}
      </div>
    );
  };

  // --- Children -------------------------------------------------------------------------
  const renderOrganSystems = () => {
    if (content.isLoadingOrganSystems) {
      return <Spinner label="Loading organ systems…" className="py-16" />;
    }

    const systems = content.organSystems.filter((system) => system.title);
    if (systems.length === 0) {
      return (
        <EmptyFrame>
          <EmptyState
            icon={Activity}
            title="No organ systems yet"
            description={
              canManage
                ? 'Organ systems are the top level of a curriculum — for example Cardiovascular or Renal. Create one, or attach one you already have.'
                : 'An administrator hasn’t added any organ systems to this curriculum yet.'
            }
            action={
              canManage && (
                <>
                  <Button variant="primary" icon={Plus} onClick={systemEditor.openCreate}>
                    New organ system
                  </Button>
                  <Button icon={Link2} onClick={onOpenAttach}>
                    Attach existing
                  </Button>
                </>
              )
            }
          />
        </EmptyFrame>
      );
    }

    const needle = rootSearch.trim().toLowerCase();
    const visibleSystems = needle
      ? systems.filter((system) => system.title.toLowerCase().includes(needle))
      : systems;

    if (visibleSystems.length === 0) {
      return (
        <ListCard>
          <EmptyState
            compact
            icon={Search}
            title="No matching organ systems"
            description={`Nothing matches “${rootSearch.trim()}”.`}
            action={
              <Button variant="ghost" size="sm" onClick={() => setRootSearch('')}>
                Clear search
              </Button>
            }
          />
        </ListCard>
      );
    }

    return (
      <ListCard>
        <ul aria-label="Organ systems" className="divide-y divide-stone-100">
          {visibleSystems.map((system) => (
            <NodeRow
              key={system.id}
              icon={Activity}
              title={system.title}
              meta={system.topics ? plural(system.topics.length, 'topic') : undefined}
              onOpen={() => content.handleSystemSelect(system.id)}
              menuItems={canManage ? systemEditor.menuItems(system) : undefined}
              menuLabel={`Actions for ${system.title}`}
            />
          ))}
          {canManage && !needle && (
            <AddRow label="Add organ system" onClick={systemEditor.openCreate} />
          )}
        </ul>
      </ListCard>
    );
  };

  const renderChildren = () => {
    if (level === 'root') return renderOrganSystems();

    if (level === 'system' && activeSystem) {
      if (content.areTopicsLoading && !activeSystem.topics) {
        return <Spinner label="Loading topics…" className="py-16" />;
      }
      return (
        <TopicGrid
          topics={activeSystem.topics || []}
          onSelect={content.handleTopicSelect}
          searchTerm={content.contentSearch}
          onCreateTopic={(data) => content.createTopic(data.name, activeSystem.id)}
          onEdit={content.updateTopic}
          onDelete={content.deleteTopic}
          organSystemName={activeSystem.title}
          organSystems={content.organSystems}
          currentSystemId={activeSystem.id}
        />
      );
    }

    if (level === 'topic' && activeSystem && activeTopic) {
      if (content.areSyndromesLoading && !activeTopic.syndromes) {
        return <Spinner label="Loading subtopics…" className="py-16" />;
      }
      return (
        <SubTopicGrid
          topic={activeTopic}
          onSelect={content.handleSubTopicSelect}
          onBack={() => content.handleTopicSelect(null)}
          searchTerm={content.contentSearch}
          onCreateSubTopic={(data) => content.createSubTopic(data.name, activeTopic.id)}
          onEdit={content.updateSubTopic}
          onDelete={content.deleteSubTopic}
          organSystems={content.organSystems}
          currentSystemId={activeSystem.id}
        />
      );
    }

    if (level === 'subtopic' && activeSystem && activeTopic && activeSubTopic) {
      return (
        <ObjectiveList
          organSystemName={activeSystem.title}
          topic={activeTopic}
          subTopic={activeSubTopic}
          searchTerm={content.contentSearch}
          bloomFilter={content.bloomFilter}
          setBloomFilter={content.setBloomFilter}
          onBack={() => content.handleSubTopicSelect(null)}
          onEdit={content.updateObjective}
          onDelete={content.deleteObjective}
          onCreateObjective={content.createObjective}
          onViewLinked={onViewLinked}
          isLoading={content.areObjectivesLoading}
          currentPage={content.objectivesPage}
          totalItems={content.objectivesTotal}
          itemsPerPage={content.objectivesLimit}
          onPageChange={content.setObjectivesPage}
          onRefresh={content.refreshObjectives}
        />
      );
    }

    return null;
  };

  const toolbar = renderToolbar();

  return (
    <section aria-label="Selected item" className="min-w-0">
      {renderEyebrow()}
      {renderHeader()}

      {(error || systemEditor.error) && (
        <div className="mt-4 space-y-2">
          {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
          {systemEditor.error && (
            <InlineAlert onDismiss={systemEditor.clearError}>{systemEditor.error}</InlineAlert>
          )}
        </div>
      )}

      {toolbar && <div className="mt-5">{toolbar}</div>}
      <div className={toolbar ? 'mt-3' : 'mt-5'}>{renderChildren()}</div>

      {systemEditor.element}

      {activeSystem && (
        <CreateTopicModal
          isOpen={topicDialog !== null}
          onClose={() => setTopicDialog(null)}
          onSubmit={submitTopic}
          organSystems={content.organSystems}
          defaultSystemId={activeSystem.id}
          initialData={topicInitialData}
          parentLocked={topicDialog?.mode === 'create'}
        />
      )}

      {/* Mounted only while open: the modal fetches topics as soon as it mounts. */}
      {activeSystem && activeTopic && subTopicDialog && (
        <CreateSubTopicModal
          isOpen
          onClose={() => setSubTopicDialog(null)}
          onSubmit={submitSubTopic}
          organSystems={content.organSystems}
          defaultOrganSystemId={activeSystem.id}
          defaultTopicId={activeTopic.id}
          initialData={subTopicInitialData}
          parentLocked={subTopicDialog?.mode === 'create'}
        />
      )}

      {activeSystem && activeTopic && activeSubTopic && (
        <CreateObjectiveModal
          isOpen={objectiveMode !== null}
          onClose={() => setObjectiveMode(null)}
          onSubmit={content.createObjective}
          topic={activeTopic}
          subTopic={activeSubTopic}
          initialMode={objectiveMode ?? 'manual'}
          organSystemName={activeSystem.title}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'topic' ? 'Delete topic?' : 'Delete subtopic?'}
        description={
          pendingDelete ? (
            <>
              “{pendingDelete.item.title}” will be deleted
              {pendingDelete.kind === 'topic'
                ? activeSystem
                  ? ` from ${activeSystem.title}`
                  : ''
                : activeTopic
                  ? ` from ${activeTopic.title}`
                  : ''}
              . This can’t be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel={pendingDelete?.kind === 'topic' ? 'Delete topic' : 'Delete subtopic'}
        busy={isDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
};

export default HierarchyPane;
