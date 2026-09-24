import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, FileText, Sparkles } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  InlineAlert,
  Input,
  SegmentedControl,
  Select,
  Spinner,
  SwitchRow,
  Textarea,
  cn,
} from '@/components/ui';
import type { CourseUpload } from '@/types/CourseStudioTypes';
import type {
  ModuleGenerationItemType,
  ModuleGenerationOptions,
} from '@/types/ModuleGenerationTypes';
import { moduleGenerationMock } from '@/services/moduleGenerationService';
import type { ModuleGenerationMockScenario } from '@/services/moduleGenerationService.mock';
import { MODALITIES } from '@/components/academy/course-workbench/ObjectiveItemsList';
import { MAX_INSTRUCTIONS_LENGTH } from './planUtils';
import { WizardFooter } from './WizardFooter';

interface OptionsStepProps {
  uploads: CourseUpload[];
  uploadsLoading: boolean;
  isStarting: boolean;
  error: string | null;
  onStart: (options: ModuleGenerationOptions) => void;
  onClose: () => void;
}

const ITEM_TYPES: ModuleGenerationItemType[] = ['mcq', 'saq', 'flashcard', 'lecture'];
const MAX_MODULE_COUNT = 30;

const parseCount = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : NaN;
};

const SectionHeading: React.FC<{
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="flex items-end justify-between gap-4">
    <div className="min-w-0">
      <h3 className="text-[15px] font-semibold text-stone-900">{title}</h3>
      {description && <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{description}</p>}
    </div>
    {action}
  </div>
);

const OptionsStep: React.FC<OptionsStepProps> = ({
  uploads,
  uploadsLoading,
  isStarting,
  error,
  onStart,
  onClose,
}) => {
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    () => new Set(uploads.map((upload) => upload.id)),
  );
  const touchedFilesRef = useRef(false);
  const [instructions, setInstructions] = useState('');
  const [moduleCountMode, setModuleCountMode] = useState<'auto' | 'fixed'>('auto');
  const [moduleCount, setModuleCount] = useState('4');
  const [sessionsMin, setSessionsMin] = useState('');
  const [sessionsMax, setSessionsMax] = useState('');
  const [allowItemCreation, setAllowItemCreation] = useState(true);
  const [itemTypes, setItemTypes] = useState<Set<ModuleGenerationItemType>>(
    () => new Set(ITEM_TYPES),
  );
  const [scenario, setScenario] = useState<ModuleGenerationMockScenario | null>(
    () => moduleGenerationMock?.getScenario() ?? null,
  );
  const moduleCountLabelId = useId();
  const sessionsLabelId = useId();

  // Default to every completed upload until the teacher picks files.
  useEffect(() => {
    if (!touchedFilesRef.current) {
      setSelectedFileIds(new Set(uploads.map((upload) => upload.id)));
    }
  }, [uploads]);

  const toggleFile = (id: string) => {
    touchedFilesRef.current = true;
    setSelectedFileIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = uploads.length > 0 && uploads.every((upload) => selectedFileIds.has(upload.id));
  const selectedCount = uploads.filter((upload) => selectedFileIds.has(upload.id)).length;
  const setAllFiles = (selected: boolean) => {
    touchedFilesRef.current = true;
    setSelectedFileIds(selected ? new Set(uploads.map((upload) => upload.id)) : new Set());
  };

  const toggleItemType = (type: ModuleGenerationItemType) =>
    setItemTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (uploads.length > 0 && selectedFileIds.size === 0) errors.push('Choose at least one file.');
    if (moduleCountMode === 'fixed') {
      const count = parseCount(moduleCount);
      if (count === null || Number.isNaN(count) || count < 1 || count > MAX_MODULE_COUNT) {
        errors.push(`Module count must be a whole number from 1 to ${MAX_MODULE_COUNT}.`);
      }
    }
    const min = parseCount(sessionsMin);
    const max = parseCount(sessionsMax);
    if (Number.isNaN(min) || (min !== null && min < 1)) errors.push('Minimum sessions must be a whole number of at least 1.');
    if (Number.isNaN(max) || (max !== null && max < 1)) errors.push('Maximum sessions must be a whole number of at least 1.');
    if (min !== null && max !== null && !Number.isNaN(min) && !Number.isNaN(max) && min > max) {
      errors.push('Minimum sessions cannot be more than the maximum.');
    }
    if (allowItemCreation && itemTypes.size === 0) errors.push('Pick at least one item type, or turn off item drafting.');
    if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
      errors.push(`Instructions are limited to ${MAX_INSTRUCTIONS_LENGTH} characters.`);
    }
    return errors;
  }, [allowItemCreation, instructions, itemTypes, moduleCount, moduleCountMode, selectedFileIds, sessionsMax, sessionsMin, uploads.length]);

  const handleStart = () => {
    if (validation.length > 0) return;
    const min = parseCount(sessionsMin);
    const max = parseCount(sessionsMax);
    const options: ModuleGenerationOptions = {
      allowItemCreation,
      triggerSource: 'modules_tab',
    };
    if (instructions.trim()) options.instructions = instructions.trim();
    if (moduleCountMode === 'fixed') options.targetModuleCount = parseCount(moduleCount);
    if (min !== null || max !== null) {
      options.sessionsPerModule = {
        ...(min !== null ? { min } : {}),
        ...(max !== null ? { max } : {}),
      };
    }
    // Omitted = every completed upload, which also covers files that finish
    // processing between opening the wizard and the job starting.
    if (!allSelected) options.fileIds = Array.from(selectedFileIds);
    if (allowItemCreation && itemTypes.size < ITEM_TYPES.length) {
      options.itemTypes = ITEM_TYPES.filter((type) => itemTypes.has(type));
    }
    if (moduleGenerationMock && scenario) moduleGenerationMock.setScenario(scenario);
    onStart(options);
  };

  const noFiles = uploads.length === 0;
  const instructionsNearLimit = instructions.length > MAX_INSTRUCTIONS_LENGTH * 0.9;
  const footerHint =
    noFiles && !uploadsLoading ? (
      'Upload course files first.'
    ) : validation.length > 0 ? (
      <span className="text-amber-700">{validation[0]}</span>
    ) : (
      'Runs in the background and usually takes a few minutes.'
    );

  return (
    <>
      <div className="space-y-8 px-6 py-6">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}

        <Field
          label="Instructions"
          hint="Optional"
          error={
            instructions.length > MAX_INSTRUCTIONS_LENGTH
              ? `${instructions.length.toLocaleString()} / ${MAX_INSTRUCTIONS_LENGTH.toLocaleString()} characters`
              : null
          }
          description={
            instructionsNearLimit
              ? `${instructions.length.toLocaleString()} / ${MAX_INSTRUCTIONS_LENGTH.toLocaleString()} characters`
              : 'Tell the AI how to group or order the course.'
          }
        >
          {(id) => (
            <Textarea
              id={id}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={3}
              placeholder="e.g. Group by organ system; keep pharmacology in its own module."
            />
          )}
        </Field>

        <section>
          <SectionHeading
            title="Source files"
            description="Processed course files the AI reads. All are used by default."
            action={
              uploads.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => setAllFiles(!allSelected)}>
                  {allSelected ? 'Clear' : 'Select all'}
                </Button>
              ) : null
            }
          />
          <div className="mt-3">
            {uploadsLoading && noFiles ? (
              <Spinner label="Loading files…" className="rounded-xl border border-stone-200 py-8" />
            ) : noFiles ? (
              <EmptyState
                compact
                icon={FileText}
                title="No processed files yet"
                description="Upload course files and wait for them to finish processing."
                className="rounded-xl border border-dashed border-stone-200"
              />
            ) : (
              <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                {uploads.map((upload) => {
                  const selected = selectedFileIds.has(upload.id);
                  const name = upload.fileName || upload.identifier;
                  return (
                    <li key={upload.id}>
                      <label className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-stone-50">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleFile(upload.id)}
                          className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded accent-brand-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-stone-900" title={name}>
                            {name}
                          </span>
                          {upload.briefTopics && upload.briefTopics.length > 0 ? (
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              {upload.briefTopics.slice(0, 5).map((topic) => (
                                <Badge key={topic}>{topic}</Badge>
                              ))}
                            </span>
                          ) : (
                            <span className="mt-0.5 block text-[13px] text-stone-500">
                              No summary yet; the AI will use the file’s outline.
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {uploads.length > 1 && (
            <p className="mt-2 text-xs tabular-nums text-stone-500">
              {selectedCount} of {uploads.length} selected
            </p>
          )}
        </section>

        <section className="space-y-5">
          <SectionHeading title="Structure" />
          <div role="group" aria-labelledby={moduleCountLabelId}>
            <p id={moduleCountLabelId} className="mb-1.5 text-[13px] font-medium text-stone-700">
              Number of modules
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl<'auto' | 'fixed'>
                label="Number of modules"
                value={moduleCountMode}
                onChange={setModuleCountMode}
                options={[
                  { value: 'auto', label: 'Let AI decide' },
                  { value: 'fixed', label: 'Set a number' },
                ]}
              />
              {moduleCountMode === 'fixed' && (
                <div className="w-20">
                  <Input
                    type="number"
                    min={1}
                    max={MAX_MODULE_COUNT}
                    value={moduleCount}
                    onChange={(event) => setModuleCount(event.target.value)}
                    aria-label="Number of modules"
                    className="tabular-nums"
                  />
                </div>
              )}
            </div>
          </div>
          <div role="group" aria-labelledby={sessionsLabelId}>
            <p id={sessionsLabelId} className="mb-1.5 text-[13px] font-medium text-stone-700">
              Sessions per module
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-stone-500">
              <div className="w-20">
                <Input
                  type="number"
                  min={1}
                  value={sessionsMin}
                  onChange={(event) => setSessionsMin(event.target.value)}
                  placeholder="Min"
                  aria-label="Minimum sessions per module"
                  className="tabular-nums"
                />
              </div>
              to
              <div className="w-20">
                <Input
                  type="number"
                  min={1}
                  value={sessionsMax}
                  onChange={(event) => setSessionsMax(event.target.value)}
                  placeholder="Max"
                  aria-label="Maximum sessions per module"
                  className="tabular-nums"
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-stone-500">Leave blank to let the AI decide.</p>
          </div>
        </section>

        <section className="space-y-3">
          <SwitchRow
            checked={allowItemCreation}
            onChange={setAllowItemCreation}
            label="Draft missing items"
            description="Let the AI draft items for objectives a session needs but that have none. Drafts become items only when you accept the plan."
          />
          {allowItemCreation && (
            <div role="group" aria-label="Item types to draft" className="flex flex-wrap gap-2">
              {MODALITIES.map((modality) => {
                const active = itemTypes.has(modality.type);
                const Icon = modality.icon;
                return (
                  <button
                    key={modality.type}
                    type="button"
                    onClick={() => toggleItemType(modality.type)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                      active
                        ? 'border-brand-300 bg-brand-50 text-brand-800'
                        : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-800',
                    )}
                  >
                    {active ? <Check size={14} aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />}
                    {modality.plural}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {moduleGenerationMock && scenario && (
          <section className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4">
            <Field label="Mock scenario" hint="Demo only">
              {(id) => (
                <Select
                  id={id}
                  value={scenario}
                  onChange={(event) => setScenario(event.target.value as ModuleGenerationMockScenario)}
                >
                  {moduleGenerationMock!.scenarios.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </section>
        )}
      </div>

      <WizardFooter hint={footerHint}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={Sparkles}
          onClick={handleStart}
          loading={isStarting}
          disabled={validation.length > 0 || noFiles}
        >
          Start drafting
        </Button>
      </WizardFooter>
    </>
  );
};

export default OptionsStep;
