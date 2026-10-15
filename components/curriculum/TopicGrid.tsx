import React, { useMemo, useState } from 'react';
import { Folder, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import CreateTopicModal from './CreateTopicModal';
import { Topic } from '@/types/TestsServiceTypes';
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
  plural,
} from '@/components/curriculum-workbench/HierarchyRows';

interface TopicGridProps {
  topics: Topic[];
  onSelect: (id: string) => void;
  searchTerm: string;
  onCreateTopic?: (data: { name: string; identifier?: string }) => Promise<void>;
  onEdit?: (id: string, name: string, organSystemId?: string) => void;
  onDelete?: (id: string) => void;
  organSystemName?: string;
  organSystems?: { id: string, title: string }[];
  currentSystemId?: string;
}

/** The topics of one organ system as divided rows; each opens its subtopics. */
const TopicGrid: React.FC<TopicGridProps> = ({
  topics,
  onSelect,
  searchTerm,
  onCreateTopic,
  onEdit,
  onDelete,
  organSystemName,
  organSystems,
  currentSystemId
}: TopicGridProps) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<{id: string, name: string, identifier?: string} | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Topic | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTopics: Topic[] = topics.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleModalSubmit = async (data: { name: string; identifier?: string; organSystemId: string }) => {
    if (editingTopic && onEdit) {
      await onEdit(editingTopic.id, data.name, data.organSystemId);
    } else if (onCreateTopic) {
      await onCreateTopic(data);
    }
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingTopic(null);
  };

  const openCreate = () => {
    setEditingTopic(null);
    setIsCreateModalOpen(true);
  };

  // Stable identity so the modal doesn't reset while it's open.
  const modalInitialData = useMemo(
    () => (editingTopic ? { ...editingTopic, organSystemId: currentSystemId } : null),
    [editingTopic, currentSystemId],
  );

  const confirmDelete = async () => {
    if (!pendingDelete || !onDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      await Promise.resolve(onDelete(pendingDelete.id));
    } catch (err) {
      console.error('Failed to delete topic:', err);
      setError(errorMessage(err, `Could not delete “${pendingDelete.title}”.`));
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  const menuItemsFor = (topic: Topic): MenuItem[] => {
    const items: MenuItem[] = [];
    if (onEdit) {
      items.push({
        label: 'Edit topic',
        icon: Pencil,
        onSelect: () => {
          setEditingTopic({ id: topic.id, name: topic.title, identifier: topic.identifier });
          setIsCreateModalOpen(true);
        },
      });
    }
    if (onDelete) {
      items.push({
        label: 'Delete topic',
        icon: Trash2,
        tone: 'danger',
        onSelect: () => setPendingDelete(topic),
      });
    }
    return items;
  };

  const renderList = () => {
    if (topics.length === 0) {
      return (
        <EmptyFrame>
          <EmptyState
            icon={Folder}
            title="No topics yet"
            description={`Topics group related subtopics${
              organSystemName ? ` in ${organSystemName}` : ''
            } — for example Arrhythmias or Heart failure.`}
            action={
              onCreateTopic && (
                <Button variant="primary" icon={Plus} onClick={openCreate}>
                  New topic
                </Button>
              )
            }
          />
        </EmptyFrame>
      );
    }

    if (filteredTopics.length === 0) {
      return (
        <ListCard>
          <EmptyState
            compact
            icon={Search}
            title="No matching topics"
            description={`Nothing matches “${searchTerm.trim()}”.`}
          />
        </ListCard>
      );
    }

    return (
      <ListCard>
        <ul aria-label="Topics" className="divide-y divide-stone-100">
          {filteredTopics.map((topic) => (
            <NodeRow
              key={topic.id}
              icon={Folder}
              title={topic.title}
              meta={topic.syndromes ? plural(topic.syndromes.length, 'subtopic') : undefined}
              onOpen={() => onSelect(topic.id)}
              menuItems={menuItemsFor(topic)}
              menuLabel={`Actions for topic ${topic.title}`}
            />
          ))}
          {onCreateTopic && !searchTerm.trim() && <AddRow label="Add topic" onClick={openCreate} />}
        </ul>
      </ListCard>
    );
  };

  return (
    <div className="space-y-3">
      {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}

      {renderList()}

      <CreateTopicModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleModalSubmit}
        organSystems={organSystems || []}
        defaultSystemId={currentSystemId}
        initialData={modalInitialData}
        parentLocked={!editingTopic && Boolean(currentSystemId)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete topic?"
        description={
          pendingDelete ? (
            <>
              “{pendingDelete.title}” will be deleted
              {organSystemName ? ` from ${organSystemName}` : ''}. This can’t be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete topic"
        busy={isDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

export default TopicGrid;
