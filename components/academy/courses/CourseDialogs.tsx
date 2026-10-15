import React, { useEffect, useState } from 'react';
import type { TeacherCourse } from '@/types/AcademyStudioTypes';
import type { Curriculum } from '@/types/TestsServiceTypes';
import { Button, Dialog, Field, Input, Select, SwitchRow, Textarea } from '@/components/ui';

export interface NewCourseInput {
  title: string;
  summary: string;
  curriculumId: string;
}

interface NewCourseDialogProps {
  open: boolean;
  curricula: Curriculum[];
  defaultCurriculumId: string | null;
  onClose: () => void;
  /** Rejects on failure; the dialog stays open so the teacher can retry. */
  onCreate: (input: NewCourseInput) => Promise<void>;
}

export const NewCourseDialog: React.FC<NewCourseDialogProps> = ({
  open,
  curricula,
  defaultCurriculumId,
  onClose,
  onCreate,
}) => {
  const [form, setForm] = useState<NewCourseInput>({ title: '', summary: '', curriculumId: '' });
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ title: '', summary: '', curriculumId: defaultCurriculumId ?? curricula[0]?.id ?? '' });
    }
  }, [curricula, defaultCurriculumId, open]);

  const canSubmit = Boolean(form.title.trim() && form.curriculumId) && !isSaving;

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onCreate(form);
      onClose();
    } catch {
      // The page shows the error toast; keep the dialog open for a retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!isSaving}
      title="New course"
      description="You'll add objectives, content and modules after it's created."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!canSubmit} loading={isSaving}>
            Create course
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          {(id) => (
            <Input
              id={id}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="e.g. Internal Medicine Clerkship"
            />
          )}
        </Field>
        <Field label="Summary" hint="Optional">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={form.summary}
              onChange={(event) =>
                setForm((current) => ({ ...current, summary: event.target.value }))
              }
              placeholder="What this course covers"
            />
          )}
        </Field>
        <Field label="Curriculum" description="Objectives are drawn from this curriculum's catalog.">
          {(id) => (
            <Select
              id={id}
              value={form.curriculumId}
              onChange={(event) =>
                setForm((current) => ({ ...current, curriculumId: event.target.value }))
              }
            >
              {curricula.map((curriculum) => (
                <option key={curriculum.id} value={curriculum.id}>
                  {curriculum.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {/* Enter in the title submits. */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
};

export interface CourseDetailsInput {
  title: string;
  summary: string;
  locked: boolean;
}

interface CourseDetailsDialogProps {
  open: boolean;
  course: TeacherCourse;
  onClose: () => void;
  onSave: (input: CourseDetailsInput) => Promise<void>;
}

export const CourseDetailsDialog: React.FC<CourseDetailsDialogProps> = ({
  open,
  course,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<CourseDetailsInput>({
    title: course.title,
    summary: course.summary,
    locked: course.locked,
  });
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ title: course.title, summary: course.summary, locked: course.locked });
  }, [course.locked, course.summary, course.title, open]);

  const isDirty =
    form.title.trim() !== course.title ||
    form.summary.trim() !== course.summary ||
    form.locked !== course.locked;

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!form.title.trim() || !isDirty || isSaving) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!isSaving}
      width="max-w-lg"
      title="Course details"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={!form.title.trim() || !isDirty}
            loading={isSaving}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          {(id) => (
            <Input
              id={id}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
          )}
        </Field>
        <Field label="Summary" hint="Optional">
          {(id) => (
            <Textarea
              id={id}
              rows={4}
              value={form.summary}
              onChange={(event) =>
                setForm((current) => ({ ...current, summary: event.target.value }))
              }
              placeholder="What this course covers"
            />
          )}
        </Field>
        <div className="rounded-lg border border-stone-200 px-4 py-3">
          <SwitchRow
            checked={form.locked}
            onChange={(locked) => setForm((current) => ({ ...current, locked }))}
            label="Lock course content"
            description={
              form.locked
                ? 'Only items linked to this course’s objectives are delivered.'
                : 'Study plan sessions can use AI fallback content.'
            }
          />
        </div>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
};
