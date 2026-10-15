import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckSquare, FileText, Loader2, Square } from 'lucide-react';
import type { CourseUpload } from '@/types/CourseStudioTypes';
import type {
  ModuleGenerationItemType,
  ModuleGenerationOptions,
} from '@/types/ModuleGenerationTypes';
import { moduleGenerationMock } from '@/services/moduleGenerationService';
import type { ModuleGenerationMockScenario } from '@/services/moduleGenerationService.mock';
import { MODALITIES } from '@/components/academy/course-workbench/ObjectiveItemsList';
import { inputClass, SectionLabel } from '../shared';
import { MAX_INSTRUCTIONS_LENGTH } from './planUtils';

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
    if (allowItemCreation && itemTypes.size === 0) errors.push('Pick at least one item type, or turn off item creation.');
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

  const numberInputClass = `${inputClass} !w-24 !px-3 !py-2 text-center`;

  return (
    <>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <SectionLabel>Source files</SectionLabel>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Processed course files the AI reads. All are used by default.
                </p>
              </div>
              {uploads.length > 1 && (
                <button
                  type="button"
                  onClick={() => setAllFiles(!allSelected)}
                  className="flex-shrink-0 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700 hover:text-emerald-900"
                >
                  {allSelected ? 'Clear' : 'Select all'}
                </button>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {uploadsLoading && uploads.length === 0 ? (
                <div className="flex items-center gap-2 py-6 text-sm font-semibold text-slate-500">
                  <Loader2 size={15} className="animate-spin" /> Loading files…
                </div>
              ) : uploads.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                  No processed files yet. Upload course files first.
                </p>
              ) : (
                uploads.map((upload) => {
                  const selected = selectedFileIds.has(upload.id);
                  return (
                    <button
                      key={upload.id}
                      type="button"
                      onClick={() => toggleFile(upload.id)}
                      aria-pressed={selected}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                        selected
                          ? 'border-emerald-200 bg-emerald-50/60'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {selected ? (
                        <CheckSquare size={17} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                      ) : (
                        <Square size={17} className="mt-0.5 flex-shrink-0 text-slate-300" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                          <FileText size={13} className="flex-shrink-0 text-slate-400" />
                          <span className="truncate">{upload.fileName || upload.identifier}</span>
                        </span>
                        {upload.briefTopics && upload.briefTopics.length > 0 ? (
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {upload.briefTopics.slice(0, 5).map((topic) => (
                              <span
                                key={topic}
                                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500"
                              >
                                {topic}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="mt-1 block text-[11px] font-medium text-slate-400">
                            No summary yet; the AI will use the file’s outline.
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <div className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <SectionLabel>Instructions (optional)</SectionLabel>
              <textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                rows={4}
                placeholder="e.g. Group by organ system; keep pharmacology in its own module."
                className={`${inputClass} mt-3 resize-none`}
              />
              {instructions.length > MAX_INSTRUCTIONS_LENGTH * 0.9 && (
                <p className="mt-1 text-right text-[11px] font-bold text-slate-400">
                  {instructions.length}/{MAX_INSTRUCTIONS_LENGTH}
                </p>
              )}
            </section>

            <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
              <SectionLabel>Structure</SectionLabel>
              <div>
                <p className="text-sm font-bold text-slate-700">Number of modules</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(['auto', 'fixed'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setModuleCountMode(mode)}
                      aria-pressed={moduleCountMode === mode}
                      className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                        moduleCountMode === mode
                          ? 'border-[#16324F] bg-[#16324F] text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {mode === 'auto' ? 'Let AI decide' : 'Exactly'}
                    </button>
                  ))}
                  {moduleCountMode === 'fixed' && (
                    <input
                      type="number"
                      min={1}
                      max={MAX_MODULE_COUNT}
                      value={moduleCount}
                      onChange={(event) => setModuleCount(event.target.value)}
                      aria-label="Number of modules"
                      className={numberInputClass}
                    />
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Sessions per module</p>
                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-500">
                  <input
                    type="number"
                    min={1}
                    value={sessionsMin}
                    onChange={(event) => setSessionsMin(event.target.value)}
                    placeholder="Min"
                    aria-label="Minimum sessions per module"
                    className={numberInputClass}
                  />
                  to
                  <input
                    type="number"
                    min={1}
                    value={sessionsMax}
                    onChange={(event) => setSessionsMax(event.target.value)}
                    placeholder="Max"
                    aria-label="Maximum sessions per module"
                    className={numberInputClass}
                  />
                  <span className="font-medium text-slate-400">Blank = AI decides</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <span>
                  <SectionLabel>New items</SectionLabel>
                  <span className="mt-1 block text-xs font-medium text-slate-500">
                    Let the AI draft items for objectives a session needs but that have none.
                    Drafts become items only when you accept the plan.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={allowItemCreation}
                  onChange={(event) => setAllowItemCreation(event.target.checked)}
                  className="mt-1 h-4 w-4 flex-shrink-0 accent-[#1BD183]"
                />
              </label>
              <div className={`mt-3 flex flex-wrap gap-2 ${allowItemCreation ? '' : 'pointer-events-none opacity-40'}`}>
                {MODALITIES.map((modality) => {
                  const active = itemTypes.has(modality.type);
                  const Icon = modality.icon;
                  return (
                    <button
                      key={modality.type}
                      type="button"
                      onClick={() => toggleItemType(modality.type)}
                      aria-pressed={active}
                      disabled={!allowItemCreation}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] transition ${
                        active ? modality.badge : 'border-slate-200 bg-white text-slate-400'
                      }`}
                    >
                      <Icon size={12} />
                      {modality.plural}
                    </button>
                  );
                })}
              </div>
            </section>

            {moduleGenerationMock && scenario && (
              <section className="rounded-3xl border border-dashed border-amber-300 bg-amber-50/60 p-5">
                <SectionLabel>Mock scenario (demo only)</SectionLabel>
                <select
                  value={scenario}
                  onChange={(event) => setScenario(event.target.value as ModuleGenerationMockScenario)}
                  className={`${inputClass} mt-3 !py-2`}
                >
                  {moduleGenerationMock.scenarios.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </section>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-xs font-semibold">
          {error ? (
            <span className="flex items-start gap-1.5 text-rose-600">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> {error}
            </span>
          ) : validation.length > 0 ? (
            <span className="text-amber-700">{validation[0]}</span>
          ) : (
            <span className="text-slate-400">Runs in the background; it usually takes a few minutes.</span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={isStarting || validation.length > 0 || uploads.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-gradient px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:opacity-90 disabled:opacity-50"
          >
            {isStarting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            Start generating
          </button>
        </div>
      </div>
    </>
  );
};

export default OptionsStep;
