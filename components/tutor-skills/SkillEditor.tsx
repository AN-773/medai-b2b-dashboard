import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, FileUp } from 'lucide-react';
import MarkdownContent from '@/components/MarkdownContent';
import { Button, Field, InlineAlert, Input, Textarea, cn } from '@/components/ui';
import {
  SKILL_BODY_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_MESSAGE_MAX,
  SKILL_MODES,
  skillProblemOf,
  tutorSkillsService,
  type SkillDraft,
} from '@/services/tutorSkillsService';
import { parseSkillFile } from '@/utils/skillFile';

interface SkillEditorProps {
  initial: SkillDraft;
  /** A skill's name is fixed once it is created: it is what the tutor loads it by. */
  nameLocked?: boolean;
  saving?: boolean;
  disabled?: boolean;
  submitLabel: string;
  /** The tutor's reasons the last save was refused for. */
  problems?: string[];
  onSubmit: (draft: SkillDraft & { message: string }) => void;
  onCancel: () => void;
  onChange?: (draft: SkillDraft) => void;
}

type Check =
  | { state: 'idle' | 'checking' }
  | { state: 'valid'; contentHash: string | null }
  | { state: 'invalid' | 'error'; problems: string[] };

const characters = (text: string) => Array.from(text).length;

/**
 * The four fields of a tutor skill, the note saved with a version, and a check
 * against the same reader the tutor loads skills with (agent-v2's validate),
 * run a second after typing stops.
 */
const SkillEditor: React.FC<SkillEditorProps> = ({
  initial,
  nameLocked = false,
  saving = false,
  disabled = false,
  submitLabel,
  problems = [],
  onSubmit,
  onCancel,
  onChange,
}) => {
  const [draft, setDraft] = useState<SkillDraft>(initial);
  const [note, setNote] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [importNotice, setImportNotice] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);
  const checkSeq = useRef(0);
  const edited = useRef(false);

  // A new starting point (another version loaded) replaces the form.
  useEffect(() => {
    setDraft(initial);
    setNote('');
    setCheck({ state: 'idle' });
    edited.current = false;
  }, [initial]);

  const runCheck = async (value: SkillDraft) => {
    const seq = ++checkSeq.current;
    setCheck({ state: 'checking' });
    try {
      const result = await tutorSkillsService.validate(value);
      if (seq !== checkSeq.current) return;
      setCheck(result.valid ? { state: 'valid', contentHash: result.contentHash } : { state: 'invalid', problems: result.problems });
    } catch (error) {
      if (seq !== checkSeq.current) return;
      setCheck({ state: 'error', problems: [skillProblemOf(error)?.message ?? 'The check could not run.'] });
    }
  };

  useEffect(() => {
    if (!edited.current || disabled) return;
    onChange?.(draft);
    const timer = window.setTimeout(() => void runCheck(draft), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const update = (patch: Partial<SkillDraft>) => {
    edited.current = true;
    setDraft((current) => ({ ...current, ...patch }));
  };

  const toggleMode = (mode: string) =>
    update({ modes: draft.modes.includes(mode) ? draft.modes.filter((m) => m !== mode) : [...draft.modes, mode] });

  const importFile = async (file: File) => {
    const parsed = parseSkillFile(await file.text());
    if (!parsed) {
      setImportNotice('That file does not start with SKILL.md frontmatter (a line of three dashes).');
      return;
    }
    setImportNotice(
      nameLocked && parsed.name && parsed.name !== draft.name
        ? `The file is for "${parsed.name}". Its text was loaded; the name stays "${draft.name}".`
        : 'SKILL.md loaded. Review it, then save.',
    );
    update({
      name: nameLocked ? draft.name : parsed.name,
      description: parsed.description,
      modes: parsed.modes,
      body: parsed.body,
    });
  };

  const shownProblems =
    problems.length > 0 ? problems : check.state === 'invalid' || check.state === 'error' ? check.problems : [];
  const bodyCharacters = characters(draft.body);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Field
          label="Name"
          description={
            nameLocked
              ? 'Fixed once created: it is what Sina loads the skill by.'
              : 'Lowercase letters, digits and single hyphens, e.g. osce-station-practice. It cannot be changed later.'
          }
        >
          {(id) => (
            <Input
              id={id}
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
              disabled={nameLocked || disabled}
              placeholder="osce-station-practice"
              className="font-mono"
            />
          )}
        </Field>
        <Field label="Modes" description="The modes in which Sina lists this skill.">
          {() => (
            <div className="flex h-9 flex-wrap items-center gap-4">
              {SKILL_MODES.map((mode) => (
                <label key={mode.value} className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                    checked={draft.modes.includes(mode.value)}
                    onChange={() => toggleMode(mode.value)}
                    disabled={disabled}
                  />
                  {mode.label}
                </label>
              ))}
            </div>
          )}
        </Field>
      </div>

      <Field
        label="When to use it"
        hint={`${characters(draft.description)} / ${SKILL_DESCRIPTION_MAX}`}
        description="One line Sina reads to decide whether a request needs this skill. Say what it is for, in the words a student would use."
      >
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            maxLength={SKILL_DESCRIPTION_MAX}
            value={draft.description}
            onChange={(event) => update({ description: event.target.value })}
            disabled={disabled}
            placeholder="Use when a student asks to practise an OSCE station…"
          />
        )}
      </Field>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-medium text-stone-700">Method (Markdown)</span>
          <span className={cn('text-[13px]', bodyCharacters > SKILL_BODY_MAX ? 'text-red-600' : 'text-stone-400')}>
            {bodyCharacters.toLocaleString()} / {SKILL_BODY_MAX.toLocaleString()}
          </span>
          <Button
            size="sm"
            variant="ghost"
            icon={showPreview ? EyeOff : Eye}
            onClick={() => setShowPreview((shown) => !shown)}
            className="ml-auto"
          >
            {showPreview ? 'Hide preview' : 'Show preview'}
          </Button>
        </div>
        <div className={cn('grid gap-4', showPreview && 'lg:grid-cols-2')}>
          <Textarea
            aria-label="Method"
            rows={24}
            value={draft.body}
            onChange={(event) => update({ body: event.target.value })}
            disabled={disabled}
            placeholder={'# The method\n\nWhat Sina does, step by step…'}
            className="resize-y font-mono text-[13px]"
          />
          {showPreview && (
            <div className="max-h-[600px] min-h-[300px] overflow-auto rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 custom-scrollbar">
              <MarkdownContent content={draft.body || '_Nothing to preview yet._'} />
            </div>
          )}
        </div>
      </div>

      {shownProblems.length > 0 ? (
        <InlineAlert tone="error" title={problems.length > 0 ? 'Not saved — fix these first' : 'This would not save yet'}>
          <ul className="list-disc space-y-1 pl-4">
            {shownProblems.map((problem, index) => (
              <li key={index}>{problem}</li>
            ))}
          </ul>
        </InlineAlert>
      ) : check.state === 'valid' ? (
        <p className="flex items-center gap-2 text-[13px] text-brand-700">
          <CheckCircle2 size={15} />
          Valid. This text would be version <span className="font-mono">{check.contentHash}</span>.
        </p>
      ) : null}

      {importNotice && (
        <InlineAlert tone="info" onDismiss={() => setImportNotice('')}>
          {importNotice}
        </InlineAlert>
      )}

      <Field label="What changed" hint="Optional" description="Saved with this version, so the history says why.">
        {(id) => (
          <Input
            id={id}
            value={note}
            maxLength={SKILL_MESSAGE_MAX}
            onChange={(event) => setNote(event.target.value)}
            disabled={disabled}
            placeholder="e.g. Shorter examiner feedback"
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".md,text/markdown,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = '';
            }}
          />
          <Button icon={FileUp} onClick={() => fileInput.current?.click()} disabled={disabled}>
            Import SKILL.md
          </Button>
          <Button
            icon={CheckCircle2}
            loading={check.state === 'checking'}
            onClick={() => void runCheck(draft)}
            disabled={disabled}
          >
            Check
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={disabled}
            onClick={() => onSubmit({ ...draft, message: note.trim() })}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SkillEditor;
