import React, { useEffect, useId, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { OrganSystem } from '@/types/TestsServiceTypes';
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  InlineAlert,
  Input,
  type MenuItem,
} from '@/components/ui';
import { errorMessage } from './HierarchyRows';

type SystemRef = Pick<OrganSystem, 'id' | 'title'>;

interface OrganSystemDialogProps {
  open: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

/** Short name form for creating or renaming an organ system. */
export const OrganSystemDialog: React.FC<OrganSystemDialogProps> = ({
  open,
  mode,
  initialName = '',
  onClose,
  onSubmit,
}) => {
  const formId = useId();
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setError(null);
  }, [open, initialName]);

  const trimmed = name.trim();
  const isUnchanged = mode === 'rename' && trimmed === initialName.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed || isUnchanged) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      console.error(`Failed to ${mode} organ system:`, err);
      setError(
        errorMessage(
          err,
          mode === 'create' ? 'Could not create the organ system.' : 'Could not rename the organ system.',
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!isSaving}
      title={mode === 'create' ? 'New organ system' : 'Rename organ system'}
      description={
        mode === 'create'
          ? 'It’s added to this curriculum. You’ll add its topics next.'
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={isSaving}
            disabled={!trimmed || isUnchanged}
          >
            {mode === 'create' ? 'Create organ system' : 'Save'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Cardiovascular"
              disabled={isSaving}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
};

interface OrganSystemEditorOptions {
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/**
 * Create / rename / delete for organ systems wherever they're listed (the
 * outline rail and the curriculum pane). Render `element` once; wire
 * `openCreate` and `menuItems(system)` to buttons and `⋯` menus.
 */
export const useOrganSystemEditor = ({ onCreate, onRename, onDelete }: OrganSystemEditorOptions) => {
  const [dialog, setDialog] = useState<
    { mode: 'create' } | { mode: 'rename'; system: SystemRef } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<SystemRef | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete(pendingDelete.id);
    } catch (err) {
      console.error('Failed to delete organ system:', err);
      setError(errorMessage(err, `Could not delete “${pendingDelete.title}”.`));
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  const menuItems = (system: SystemRef): MenuItem[] => [
    {
      label: 'Rename',
      icon: Pencil,
      onSelect: () => setDialog({ mode: 'rename', system }),
    },
    {
      label: 'Delete organ system',
      icon: Trash2,
      tone: 'danger',
      onSelect: () => setPendingDelete(system),
    },
  ];

  const element = (
    <>
      <OrganSystemDialog
        open={dialog !== null}
        mode={dialog?.mode ?? 'create'}
        initialName={dialog?.mode === 'rename' ? dialog.system.title : ''}
        onClose={() => setDialog(null)}
        onSubmit={async (name) => {
          if (dialog?.mode === 'rename') await onRename(dialog.system.id, name);
          else await onCreate(name);
        }}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete organ system?"
        description={
          pendingDelete ? (
            <>
              “{pendingDelete.title}” and its topics and subtopics will be deleted for every
              curriculum that uses it, not just this one. This can’t be undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete organ system"
        busy={isDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );

  return {
    openCreate: () => setDialog({ mode: 'create' }),
    menuItems,
    element,
    error,
    clearError: () => setError(null),
  };
};
