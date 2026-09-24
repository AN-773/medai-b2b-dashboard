import React, { useState, useEffect, useId } from 'react';
import { Check } from 'lucide-react';
import { OrganSystem } from '@/types/TestsServiceTypes';
import { Button, Dialog, Field, InlineAlert, Input, Select } from '@/components/ui';

interface CreateTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    identifier?: string;
    organSystemId: string;
  }) => Promise<void>;
  organSystems: Pick<OrganSystem, 'id' | 'title'>[];
  defaultSystemId?: string;
  initialData?: {
    name: string;
    identifier?: string;
    organSystemId?: string;
  } | null;
  /**
   * Keep the topic in `defaultSystemId` (shown as context, not a picker) — for
   * creating a topic from inside an organ system. Optional; defaults to false.
   */
  parentLocked?: boolean;
}

const CreateTopicModal: React.FC<CreateTopicModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  organSystems,
  defaultSystemId,
  initialData,
  parentLocked = false,
}) => {
  const formId = useId();
  const [name, setName] = useState(initialData?.name || '');
  const [identifier, setIdentifier] = useState(initialData?.identifier || '');
  const [selectedSystemId, setSelectedSystemId] = useState(
    initialData?.organSystemId || defaultSystemId || '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Topic name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        identifier: identifier.trim() || undefined,
        organSystemId: selectedSystemId,
      });
      // Reset form and close
      setName('');
      setIdentifier('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create topic');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName('');
      setIdentifier('');
      setError(null);
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setIdentifier(initialData?.identifier || '');
      setSelectedSystemId(initialData?.organSystemId || defaultSystemId || '');
    }
  }, [isOpen, initialData, defaultSystemId]);

  const isEdit = Boolean(initialData);
  const lockedSystemTitle = parentLocked
    ? organSystems.find((system) => system.id === selectedSystemId)?.title
    : undefined;

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      dismissible={!isSubmitting}
      title={isEdit ? 'Edit topic' : 'New topic'}
      description={
        lockedSystemTitle ? (
          <>
            In <span className="font-medium text-stone-700">{lockedSystemTitle}</span>
          </>
        ) : isEdit ? (
          'Rename the topic or move it to another organ system.'
        ) : (
          'Topics group related subtopics within an organ system.'
        )
      }
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            icon={Check}
            loading={isSubmitting}
            disabled={!name.trim() || !selectedSystemId}
          >
            {isEdit ? 'Save changes' : 'Create topic'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}

        {!lockedSystemTitle && (
          <Field label="Organ system">
            {(id) => (
              <Select
                id={id}
                value={selectedSystemId}
                onChange={(e) => setSelectedSystemId(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="" disabled>
                  Select an organ system
                </option>
                {organSystems.map((sys) => (
                  <option key={sys.id} value={sys.id}>
                    {sys.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <Field label="Topic name">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cardiac arrhythmias"
              disabled={isSubmitting}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
};

export default CreateTopicModal;
