import React, { useEffect, useState } from 'react';
import { Button, Dialog, Field, InlineAlert, Input, Textarea } from '@/components/ui';
import {
  emptyCohortForm,
  getCohortDateRangeError,
  getErrorMessage,
  type CohortFormValues,
} from './cohortModel';

interface CohortDetailsDialogProps {
  open: boolean;
  /** 'create' shows "New cohort"; 'edit' pre-fills from `initialValues`. */
  mode: 'create' | 'edit';
  initialValues?: CohortFormValues;
  onClose: () => void;
  /** Resolves true when saved; false/throws keeps the dialog open. */
  onSubmit: (values: CohortFormValues) => Promise<boolean>;
}

/** Create a cohort or edit its title, term, description and dates. */
const CohortDetailsDialog: React.FC<CohortDetailsDialogProps> = ({
  open,
  mode,
  initialValues,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<CohortFormValues>(emptyCohortForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDateError, setShowDateError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initialValues ?? emptyCohortForm);
    setError(null);
    setShowDateError(false);
    // Reset only when the dialog opens, not when the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dateError = getCohortDateRangeError(form.startDate, form.endDate);
  const isDirty =
    mode === 'create' ||
    !initialValues ||
    (Object.keys(form) as Array<keyof CohortFormValues>).some(
      (key) => form[key] !== initialValues[key],
    );
  const canSubmit = Boolean(form.title.trim()) && isDirty && !isSaving;

  const update = (key: keyof CohortFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!canSubmit) return;
    if (dateError) {
      setShowDateError(true);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const saved = await onSubmit(form);
      if (saved) onClose();
    } catch (submitError) {
      setError(
        getErrorMessage(
          submitError,
          mode === 'create' ? 'Unable to create this cohort.' : 'Unable to save this cohort.',
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
      width="max-w-lg"
      title={mode === 'create' ? 'New cohort' : 'Edit cohort details'}
      description={
        mode === 'create'
          ? "You'll add learners and attach courses once it's created."
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={!canSubmit}
            loading={isSaving}
          >
            {mode === 'create' ? 'Create cohort' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
        <Field label="Title">
          {(id) => (
            <Input
              id={id}
              value={form.title}
              onChange={update('title')}
              placeholder="e.g. Class of 2028 · Block A"
            />
          )}
        </Field>
        <Field label="Term or intake" hint="Optional">
          {(id) => (
            <Input id={id} value={form.term} onChange={update('term')} placeholder="e.g. Fall 2026" />
          )}
        </Field>
        <Field label="Description" hint="Optional">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={form.description}
              onChange={update('description')}
              placeholder="Who is in this cohort and what they're working towards"
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" hint="Optional">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={form.startDate}
                onChange={(event) => {
                  update('startDate')(event);
                  setShowDateError(false);
                }}
              />
            )}
          </Field>
          <Field label="End date" hint="Optional">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={form.endDate}
                onChange={(event) => {
                  update('endDate')(event);
                  setShowDateError(false);
                }}
              />
            )}
          </Field>
        </div>
        {showDateError && dateError ? (
          <p className="-mt-2 text-xs text-red-600">{dateError}</p>
        ) : (
          <p className="-mt-2 text-xs text-stone-500">Set both dates, or leave both empty.</p>
        )}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
};

export default CohortDetailsDialog;
