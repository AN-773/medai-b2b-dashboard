import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Library, Link2, Plus } from 'lucide-react';
import { Curriculum, OrganSystem, Topic } from '../../types/TestsServiceTypes';
import { identifierOf } from '../../utils/resourceId';
import {
  Badge,
  Button,
  Field,
  IconButton,
  InlineAlert,
  Menu,
  SearchInput,
  Select,
  Spinner,
  cn,
} from '@/components/ui';
import { WorkbenchTreeContext } from './WorkbenchTreeContext';
import { useOrganSystemEditor } from './OrganSystemDialog';

interface WorkbenchSidebarProps {
  curricula: Curriculum[];
  isLoadingCurricula: boolean;
  activeCurriculumIdentifier: string | null;
  onCurriculumChange: (identifier: string) => void;
  onCreateCurriculum: () => void;

  organSystems: OrganSystem[];
  isLoadingOrganSystems: boolean;
  activeSystemId: string | null;
  onSelectSystem: (id: string) => void;
  onCreateSystem: (name: string) => Promise<void>;
  onOpenAttach: () => void;
  onEditSystem: (id: string, name: string) => Promise<void>;
  onDeleteSystem: (id: string) => Promise<void>;

  canManage: boolean;
}

const ROW =
  'flex w-full min-w-0 items-center rounded-lg text-left text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';
/** The selected node. */
const ROW_CURRENT = 'bg-white font-medium text-stone-900 shadow-card ring-1 ring-stone-200/80';
/** An ancestor of the selected node. */
const ROW_PATH = 'font-medium text-stone-900 hover:bg-stone-100';
const ROW_IDLE = 'text-stone-600 hover:bg-stone-100 hover:text-stone-900';

/** Nested level: indented under a thin guide line. */
const Branch: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <ul aria-label={label} className="mb-1 ml-[15px] mt-0.5 space-y-0.5 border-l border-stone-200 pl-1.5">
    {children}
  </ul>
);

const BranchNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="px-2 py-1.5 text-[13px] text-stone-400">{children}</li>
);

/**
 * The Curricula outline rail: the curriculum root, then organ systems → topics
 * → subtopics along the open path. Organ systems are created, attached,
 * renamed and deleted here; the deeper levels come from `WorkbenchTreeContext`.
 */
const WorkbenchSidebar: React.FC<WorkbenchSidebarProps> = ({
  curricula,
  isLoadingCurricula,
  activeCurriculumIdentifier,
  onCurriculumChange,
  onCreateCurriculum,
  organSystems,
  isLoadingOrganSystems,
  activeSystemId,
  onSelectSystem,
  onCreateSystem,
  onOpenAttach,
  onEditSystem,
  onDeleteSystem,
  canManage,
}) => {
  const tree = useContext(WorkbenchTreeContext);
  const [searchTerm, setSearchTerm] = useState('');
  const systemEditor = useOrganSystemEditor({
    onCreate: onCreateSystem,
    onRename: onEditSystem,
    onDelete: onDeleteSystem,
  });

  // A new curriculum starts with an unfiltered outline.
  useEffect(() => {
    setSearchTerm('');
  }, [activeCurriculumIdentifier]);

  const activeCurriculum = useMemo(
    () => curricula.find((c) => identifierOf(c) === activeCurriculumIdentifier) ?? null,
    [curricula, activeCurriculumIdentifier],
  );

  const displaySystems = useMemo(
    () =>
      organSystems
        .filter((s) => s.title)
        .filter((s) => s.title.toLowerCase().includes(searchTerm.toLowerCase())),
    [organSystems, searchTerm],
  );

  // Standalone fallback: without a curriculum the rail is just a picker.
  if (!activeCurriculumIdentifier) {
    return (
      <aside
        aria-label="Curriculum outline"
        className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4"
      >
        <Field label="Curriculum">
          {(id) => (
            <Select
              id={id}
              value=""
              onChange={(e) => e.target.value && onCurriculumChange(e.target.value)}
              disabled={isLoadingCurricula}
            >
              <option value="">{isLoadingCurricula ? 'Loading…' : 'Select a curriculum'}</option>
              {curricula.map((c) => (
                <option key={c.id} value={identifierOf(c)}>
                  {c.title}
                  {c.visible ? '' : ' · hidden'}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="text-[13px] text-stone-500">Choose a curriculum to see its organ systems.</p>
        {canManage && (
          <Button size="sm" icon={Plus} onClick={onCreateCurriculum} className="w-full">
            New curriculum
          </Button>
        )}
      </aside>
    );
  }

  const renderSubTopics = (topic: Topic) => {
    if (!tree) return null;
    const subTopics = topic.syndromes;
    return (
      <Branch label={`Subtopics of ${topic.title}`}>
        {!subTopics ? (
          tree.areSubTopicsLoading ? (
            <li>
              <Spinner label="Loading…" className="justify-start px-2 py-1.5" />
            </li>
          ) : null
        ) : subTopics.length === 0 ? (
          <BranchNote>No subtopics yet</BranchNote>
        ) : (
          subTopics.map((sub) => {
            const isCurrent = sub.id === tree.activeSubTopicId;
            return (
              <li key={sub.id}>
                <button
                  type="button"
                  onClick={() => tree.onSelectSubTopic(sub)}
                  aria-current={isCurrent ? 'true' : undefined}
                  title={sub.title}
                  className={cn(ROW, 'h-8 px-2', isCurrent ? ROW_CURRENT : ROW_IDLE)}
                >
                  <span className="truncate">{sub.title}</span>
                </button>
              </li>
            );
          })
        )}
      </Branch>
    );
  };

  const renderTopics = (system: OrganSystem) => {
    if (!tree) return null;
    const topics = system.topics;
    return (
      <Branch label={`Topics of ${system.title}`}>
        {!topics ? (
          tree.areTopicsLoading ? (
            <li>
              <Spinner label="Loading…" className="justify-start px-2 py-1.5" />
            </li>
          ) : null
        ) : topics.length === 0 ? (
          <BranchNote>No topics yet</BranchNote>
        ) : (
          topics.map((topic) => {
            const isOpen = topic.id === tree.activeTopicId;
            const hasActiveChild =
              isOpen && Boolean(topic.syndromes?.some((sub) => sub.id === tree.activeSubTopicId));
            const isCurrent = isOpen && !hasActiveChild;
            return (
              <li key={topic.id}>
                <button
                  type="button"
                  onClick={() => tree.onSelectTopic(topic.id)}
                  aria-expanded={isOpen}
                  aria-current={isCurrent ? 'true' : undefined}
                  title={topic.title}
                  className={cn(
                    ROW,
                    'h-8 gap-1.5 pl-1.5 pr-2',
                    isCurrent ? ROW_CURRENT : isOpen ? ROW_PATH : ROW_IDLE,
                  )}
                >
                  <ChevronRight
                    size={13}
                    aria-hidden="true"
                    className={cn(
                      'flex-shrink-0 text-stone-400 transition-transform',
                      isOpen && 'rotate-90',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{topic.title}</span>
                  {isOpen && topic.syndromes && (
                    <span className="text-xs font-normal tabular-nums text-stone-400">
                      {topic.syndromes.length}
                    </span>
                  )}
                </button>
                {isOpen && renderSubTopics(topic)}
              </li>
            );
          })
        )}
      </Branch>
    );
  };

  const renderSystem = (system: OrganSystem) => {
    const isOpen = system.id === activeSystemId;
    const hasActiveChild =
      isOpen && Boolean(tree && system.topics?.some((topic) => topic.id === tree.activeTopicId));
    const isCurrent = isOpen && !hasActiveChild;
    return (
      <li key={system.id}>
        <div
          className={cn(
            'group flex items-center rounded-lg transition-colors',
            isCurrent ? ROW_CURRENT : isOpen ? ROW_PATH : ROW_IDLE,
          )}
        >
          <button
            type="button"
            onClick={() => onSelectSystem(system.id)}
            aria-expanded={tree ? isOpen : undefined}
            aria-current={isCurrent ? 'true' : undefined}
            title={system.title}
            className={cn(ROW, 'h-8 gap-1.5 pl-1.5 pr-1')}
          >
            {tree ? (
              <ChevronRight
                size={14}
                aria-hidden="true"
                className={cn(
                  'flex-shrink-0 text-stone-400 transition-transform',
                  isOpen && 'rotate-90',
                )}
              />
            ) : null}
            <span className="min-w-0 flex-1 truncate">{system.title}</span>
            {isOpen && system.topics && (
              <span className="text-xs font-normal tabular-nums text-stone-400">
                {system.topics.length}
              </span>
            )}
          </button>
          {canManage && (
            <span
              className={cn(
                'flex-shrink-0 pr-0.5 transition-opacity',
                !isCurrent &&
                  'opacity-0 focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100',
              )}
            >
              <Menu
                size="sm"
                label={`Actions for ${system.title}`}
                items={systemEditor.menuItems(system)}
              />
            </span>
          )}
        </div>
        {isOpen && renderTopics(system)}
      </li>
    );
  };

  const isRootCurrent = Boolean(tree?.isRootActive);

  return (
    <aside
      aria-label="Curriculum outline"
      className="flex min-w-0 flex-col rounded-xl border border-stone-200 bg-stone-50/50 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-6.5rem)] xl:max-h-[calc(100dvh-7.5rem)]"
    >
      <div className="border-b border-stone-200 p-2">
        <button
          type="button"
          onClick={tree?.onSelectRoot}
          disabled={!tree}
          aria-current={isRootCurrent ? 'true' : undefined}
          title={activeCurriculum?.title}
          className={cn(
            ROW,
            'h-9 gap-2 px-2 disabled:cursor-default',
            isRootCurrent ? ROW_CURRENT : 'font-medium text-stone-900 hover:bg-stone-100',
          )}
        >
          <Library
            size={15}
            aria-hidden="true"
            className={cn('flex-shrink-0', isRootCurrent ? 'text-brand-600' : 'text-stone-400')}
          />
          <span className="min-w-0 flex-1 truncate text-sm">
            {activeCurriculum?.title ?? 'Curriculum'}
          </span>
          {activeCurriculum && !activeCurriculum.visible && <Badge>Hidden</Badge>}
        </button>
      </div>

      <div className="flex items-center gap-1 pb-1 pl-4 pr-2 pt-3">
        <h2 className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[13px] font-medium text-stone-700">
          Organ systems
          {!isLoadingOrganSystems && (
            <span className="font-normal tabular-nums text-stone-400">
              {organSystems.length.toLocaleString()}
            </span>
          )}
        </h2>
        {canManage && (
          <>
            <IconButton
              icon={Link2}
              label="Attach existing organ systems"
              size="sm"
              onClick={onOpenAttach}
            />
            <IconButton
              icon={Plus}
              label="New organ system"
              size="sm"
              onClick={systemEditor.openCreate}
            />
          </>
        )}
      </div>

      {organSystems.length > 0 && (
        <div className="px-2 pb-1 pt-1">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Filter organ systems"
          />
        </div>
      )}

      {systemEditor.error && (
        <div className="px-2 pt-1">
          <InlineAlert onDismiss={systemEditor.clearError}>{systemEditor.error}</InlineAlert>
        </div>
      )}

      <nav
        aria-label="Organ systems"
        className="max-h-80 min-h-0 flex-1 overflow-y-auto p-2 custom-scrollbar lg:max-h-none"
      >
        {isLoadingOrganSystems ? (
          <Spinner label="Loading…" className="py-8" />
        ) : displaySystems.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-[13px] text-stone-500">
              {searchTerm ? 'No matching organ systems' : 'No organ systems yet'}
            </p>
            {!searchTerm && canManage && (
              <Button
                variant="ghost"
                size="sm"
                icon={Plus}
                onClick={systemEditor.openCreate}
                className="mt-2"
              >
                New organ system
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5">{displaySystems.map(renderSystem)}</ul>
        )}
      </nav>

      {systemEditor.element}
    </aside>
  );
};

export default WorkbenchSidebar;
