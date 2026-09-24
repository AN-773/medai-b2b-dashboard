import React, { useMemo, useState } from 'react';
import { Network, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import CreateSubTopicModal from './CreateSubTopicModal';
import { Syndrome, Topic, OrganSystem } from '@/types/TestsServiceTypes';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  type MenuItem,
} from '@/components/ui';
import {
  AddRow,
  EmptyFrame,
  ListCard,
  NodeRow,
  errorMessage,
} from '@/components/curriculum-workbench/HierarchyRows';

interface SubTopicGridProps {
  topic: Topic;
  onSelect: (subTopic: Syndrome) => void;
  onBack: () => void;
  searchTerm: string;
  onCreateSubTopic?: (data: { name: string; identifier?: string }) => Promise<void>;
  onEdit?: (id: string, name: string, topicId: string) => void;
  onDelete?: (id: string) => void;
  organSystems?: OrganSystem[];
  currentSystemId?: string;
}

/**
 * The subtopics of one topic as divided rows; each opens its learning
 * objectives. Navigating back up is the host's breadcrumb (`onBack` is kept for
 * callers that still pass it).
 */
const SubTopicGrid: React.FC<SubTopicGridProps> = ({
  topic,
  onSelect,
  searchTerm,
  onCreateSubTopic,
  onEdit,
  onDelete,
  organSystems,
  currentSystemId,
}: SubTopicGridProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSubTopic, setEditingSubTopic] = useState<{id: string, name: string, identifier?: string} | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Syndrome | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSubTopics = topic.syndromes || [];
  const subTopics: Syndrome[] = allSubTopics.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleModalSubmit = async (data: { name: string; identifier?: string; topicId: string }) => {
    if (editingSubTopic && onEdit) {
      await onEdit(editingSubTopic.id, data.name, data.topicId);
    } else if (onCreateSubTopic) {
      await onCreateSubTopic(data);
    }
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingSubTopic(null);
  };

  const openCreate = () => {
    setEditingSubTopic(null);
    setIsCreateModalOpen(true);
  };

  // Stable identity so the modal doesn't reset while it's open.
  const modalInitialData = useMemo(
    () =>
      editingSubTopic
        ? { ...editingSubTopic, topicId: topic.id, organSystemId: currentSystemId }
        : null,
    [editingSubTopic, topic.id, currentSystemId],
  );

  const confirmDelete = async () => {
    if (!pendingDelete || !onDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      await Promise.resolve(onDelete(pendingDelete.id));
    } catch (err) {
      console.error('Failed to delete subtopic:', err);
      setError(errorMessage(err, `Could not delete “${pendingDelete.title}”.`));
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  const menuItemsFor = (sub: Syndrome): MenuItem[] => {
    const items: MenuItem[] = [];
    if (onEdit) {
      items.push({
        label: 'Edit subtopic',
        icon: Pencil,
        onSelect: () => {
          setEditingSubTopic({ id: sub.id, name: sub.title, identifier: sub.identifier });
          setIsCreateModalOpen(true);
        },
      });
    }
    if (onDelete) {
      items.push({
        label: 'Delete subtopic',
        icon: Trash2,
        tone: 'danger',
        onSelect: () => setPendingDelete(sub),
      });
    }
    return items;
  };

  const renderList = () => {
    if (allSubTopics.length === 0) {
      return (
        <EmptyFrame>
          <EmptyState
            icon={Network}
            title="No subtopics yet"
            description={`Subtopics break ${topic.title} down further — each one holds its own learning objectives.`}
            action={
              onCreateSubTopic && (
                <Button variant="primary" icon={Plus} onClick={openCreate}>
                  New subtopic
                </Button>
              )
            }
          />
        </EmptyFrame>
      );
    }

    if (subTopics.length === 0) {
      return (
        <ListCard>
          <EmptyState
            compact
            icon={Search}
            title="No matching subtopics"
            description={`Nothing matches “${searchTerm.trim()}”.`}
          />
        </ListCard>
      );
    }

    return (
      <ListCard>
        <ul aria-label="Subtopics" className="divide-y divide-stone-100">
          {subTopics.map((sub) => (
            <NodeRow
              key={sub.id}
              icon={Network}
              title={sub.title}
              onOpen={() => onSelect(sub)}
              menuItems={menuItemsFor(sub)}
              menuLabel={`Actions for subtopic ${sub.title}`}
            />
          ))}
          {onCreateSubTopic && !searchTerm.trim() && (
            <AddRow label="Add subtopic" onClick={openCreate} />
          )}
        </ul>
      </ListCard>
    );
  };

  return (
    <div className="space-y-3">
      {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}

      {renderList()}

      {/* Mounted only while open: the modal fetches topics as soon as it mounts. */}
      {isCreateModalOpen && (
        <CreateSubTopicModal
          isOpen
          onClose={handleCloseModal}
          onSubmit={handleModalSubmit}
          organSystems={organSystems || []}
          defaultOrganSystemId={currentSystemId}
          defaultTopicId={topic.id}
          initialData={modalInitialData}
          parentLocked={!editingSubTopic}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete subtopic?"
        description={
          pendingDelete ? (
            <>
              “{pendingDelete.title}” will be deleted from {topic.title}. This can’t be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete subtopic"
        busy={isDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

export default SubTopicGrid;
