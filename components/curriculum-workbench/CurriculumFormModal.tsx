import React, { useState, useEffect, useId } from 'react';
import { Check } from 'lucide-react';
import {
  Button,
  Dialog,
  Field,
  InlineAlert,
  Input,
  SwitchRow,
  Textarea,
} from '@/components/ui';

interface CurriculumFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialTitle?: string;
  initialSummary?: string;
  initialVisible?: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    visible: boolean,
    summary: string,
  ) => Promise<unknown>;
}

/** Create a curriculum, or edit its title, summary and visibility. */
const CurriculumFormModal: React.FC<CurriculumFormModalProps> = ({
  isOpen,
  mode,
  initialTitle = '',
  initialSummary = '',
  initialVisible = false,
  onClose,
  onSubmit,
}) => {
  const formId = useId();
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [visible, setVisible] = useState(initialVisible);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setSummary(initialSummary);
      setVisible(initialVisible);
      setError(null);
    }
  }, [isOpen, initialTitle, initialSummary, initialVisible]);

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('A title is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(title.trim(), visible, summary.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCreate = mode === 'create';

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      dismissible={!isSubmitting}
      width="max-w-lg"
      title={isCreate ? 'New curriculum' : 'Edit curriculum details'}
      description={
        isCreate
          ? 'A permanent URL slug is generated from the title.'
          : 'Update the title, summary and visibility. The slug stays the same.'
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
            disabled={!title.trim()}
          >
            {isCreate ? 'Create curriculum' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}

        <Field label="Title">
          {(id) => (
            <Input
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cardiology"
              disabled={isSubmitting}
            />
          )}
        </Field>

        <Field label="Summary" hint="Optional">
          {(id) => (
            <Textarea
              id={id}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="A short description of what this curriculum covers."
              disabled={isSubmitting}
              rows={3}
            />
          )}
        </Field>

        <div className="rounded-lg border border-stone-200 px-4 py-3">
          <SwitchRow
            label="Visible"
            description="Hidden curricula are only listed for administrators."
            checked={visible}
            onChange={setVisible}
            disabled={isSubmitting}
          />
        </div>
      </form>
    </Dialog>
  );
};

export default CurriculumFormModal;
