import React, { useState, useEffect, useId, useRef } from 'react';
import { Check } from 'lucide-react';
import { OrganSystem, Topic } from '@/types/TestsServiceTypes';
import { testsService } from '@/services/testsService';
import { Button, Dialog, Field, InlineAlert, Input, Select } from '@/components/ui';

interface CreateSubTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    identifier?: string;
    topicId: string;
  }) => Promise<void>;
  organSystems: OrganSystem[];
  defaultOrganSystemId?: string;
  defaultTopicId?: string;
  initialData?: { name: string; identifier?: string; topicId?: string; organSystemId?: string } | null;
  /**
   * Keep the subtopic in `defaultTopicId` (shown as context, not pickers) — for
   * creating a subtopic from inside a topic. Optional; defaults to false.
   */
  parentLocked?: boolean;
}

const CreateSubTopicModal: React.FC<CreateSubTopicModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  organSystems,
  defaultOrganSystemId,
  defaultTopicId,
  initialData,
  parentLocked = false,
}) => {
  const formId = useId();
  const [name, setName] = useState(initialData?.name || '');
  const [identifier, setIdentifier] = useState(initialData?.identifier || '');
  const [selectedOrganSystemId, setSelectedOrganSystemId] = useState(defaultOrganSystemId || '');
  const [selectedTopicId, setSelectedTopicId] = useState(
    initialData?.topicId || defaultTopicId || '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch topics dynamically from API when organ system changes
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  useEffect(() => {
    if (!selectedOrganSystemId) {
      setAvailableTopics([]);
      return;
    }
    let active = true;
    setLoadingTopics(true);
    testsService.getTopics(selectedOrganSystemId).then(res => {
      if (active) setAvailableTopics(res.items);
    }).catch(err => {
      console.error('Failed to fetch topics:', err);
      if (active) setAvailableTopics([]);
    }).finally(() => {
      if (active) setLoadingTopics(false);
    });
    return () => { active = false; };
  }, [selectedOrganSystemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Subtopic name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        identifier: identifier.trim() || undefined,
        topicId: selectedTopicId,
      });
      // Reset form and close
      setName('');
      setIdentifier('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create subtopic',
      );
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

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;
      setName(initialData?.name || '');
      setIdentifier(initialData?.identifier || '');
      setSelectedTopicId(initialData?.topicId || defaultTopicId || '');
      setSelectedOrganSystemId(initialData?.organSystemId || defaultOrganSystemId || '');
    }
    if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen, initialData, defaultTopicId, defaultOrganSystemId]);

  const isEdit = Boolean(initialData);
  const organSystemTitle = organSystems.find((s) => s.id === selectedOrganSystemId)?.title;
  const topicTitle = availableTopics.find((t) => t.id === selectedTopicId)?.title;
  const showPickers = !parentLocked || !selectedTopicId;

  const renderLockedContext = () => {
    const parts = [organSystemTitle, topicTitle ?? (loadingTopics ? 'Loading…' : undefined)].filter(
      (part): part is string => Boolean(part),
    );
    if (parts.length === 0) return 'Subtopics hold the learning objectives for a topic.';
    return (
      <>
        In <span className="font-medium text-stone-700">{parts.join(' › ')}</span>
      </>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      dismissible={!isSubmitting}
      width={showPickers ? 'max-w-lg' : 'max-w-md'}
      title={isEdit ? 'Edit subtopic' : 'New subtopic'}
      description={
        !showPickers
          ? renderLockedContext()
          : isEdit
            ? 'Rename the subtopic or move it to another topic.'
            : 'Subtopics hold the learning objectives for a topic.'
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
            disabled={!name.trim() || !selectedTopicId}
          >
            {isEdit ? 'Save changes' : 'Create subtopic'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}

        {showPickers && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organ system">
              {(id) => (
                <Select
                  id={id}
                  value={selectedOrganSystemId}
                  onChange={(e) => {
                    setSelectedOrganSystemId(e.target.value);
                    // Reset topic selection when organ system changes
                    setSelectedTopicId('');
                  }}
                  disabled={isSubmitting}
                >
                  <option value="" disabled>
                    Select an organ system
                  </option>
                  {organSystems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Topic">
              {(id) => (
                <Select
                  id={id}
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  disabled={isSubmitting || !selectedOrganSystemId || loadingTopics}
                >
                  <option value="" disabled>
                    {loadingTopics
                      ? 'Loading topics…'
                      : selectedOrganSystemId
                        ? 'Select a topic'
                        : 'Choose an organ system first'}
                  </option>
                  {availableTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}

        <Field label="Subtopic name">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Atrial fibrillation"
              disabled={isSubmitting}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
};


export default CreateSubTopicModal;
