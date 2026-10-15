import React, { useState, useMemo } from 'react';
import { Check, FlaskConical, Plus, Search, Sparkles, X } from 'lucide-react';
import { BackendItem, Taxonomy } from '../types';
import { MOCK_ITEMS } from '../constants';
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  SearchInput,
  SegmentedControl,
  Textarea,
  cn,
} from '@/components/ui';

interface AILabViewProps {
  onSaveNew: (item: BackendItem) => void;
}

// A synthesis seed is a question excerpt, not a persisted/publishable item.
type SynthesisSeed = Pick<BackendItem, 'id' | 'type' | 'stem' | 'options'> & {
  taxonomy: Pick<Taxonomy, 'bloomLevel'> &
    Partial<Pick<Taxonomy, 'organSystemId' | 'disciplineId'>>;
};

const BLOOM_LEVELS = ['Recall', 'Understand', 'Apply', 'Analyze'];

const PRESETS = [
  {
    label: 'Clinical vignette',
    prompt: 'Convert this item into a complex USMLE Step 1 clinical vignette with vital signs and labs.',
  },
  {
    label: 'Pharmacology focus',
    prompt: 'Refocus assessment on the side-effect profile or MOA of the first-line medication.',
  },
  {
    label: 'Raise cognitive load',
    prompt: 'Add second-order or third-order reasoning requirements to the lead-in.',
  },
  {
    label: 'Next best step',
    prompt: "Change the lead-in to focus on the 'Next Best Step' rather than diagnosis.",
  },
];

const optionLetter = (index: number) => String.fromCharCode(65 + index);

interface RangeFieldProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}

const RangeField: React.FC<RangeFieldProps> = ({ label, description, value, onChange }) => (
  <Field label={label} description={description}>
    {(id) => (
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-brand-600"
        />
        <span className="w-10 flex-shrink-0 text-right text-[13px] tabular-nums text-stone-600">
          {value}%
        </span>
      </div>
    )}
  </Field>
);

const SectionTitle: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({
  title,
  description,
  action,
}) => (
  <div className="mb-3 flex items-start justify-between gap-3">
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      {description && <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{description}</p>}
    </div>
    {action}
  </div>
);

/** Sandbox for drafting a new item with AI, optionally by rewriting an existing one. */
const AILabView: React.FC<AILabViewProps> = ({ onSaveNew }) => {
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any>({
    newStem: 'a 45-year-old male presents with chest pain and shortness of breath. His ECG shows ST-elevation in leads II, III, and aVF. What is the most likely diagnosis?',
    newOptions: [
      { text: 'Anterior MI', isCorrect: false },
      { text: 'Inferior MI', isCorrect: true },
      { text: 'Lateral MI', isCorrect: false },
    ],
    explanation: 'The ECG findings of ST-elevation in leads II, III, and aVF indicate an inferior myocardial infarction (MI), which is typically caused by occlusion of the right coronary artery. Anterior MI would show changes in leads V1-V4, while lateral MI would affect leads I, aVL, V5, and V6.'

  });
  const [selectedItem, setSelectedItem] = useState<SynthesisSeed | null>({
    id: 'LAB-BASE-001',
    type: 'MCQ',
    stem: 'A 45-year-old male presents with chest pain and shortness of breath. His ECG shows ST-elevation in leads II, III, and aVF. What is the most likely diagnosis?',
    options: [
      { id: 'opt1', text: 'Anterior MI', isCorrect: false, label: 'A' },
      { id: 'opt2', text: 'Inferior MI', isCorrect: true, label: 'B' },
      { id: 'opt3', text: 'Lateral MI', isCorrect: false, label: 'C' },
    ],
    taxonomy: { bloomLevel: 'Apply' }

  });
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  // Precision Sliders
  const [complexity, setComplexity] = useState(50);
  const [bloomTarget, setBloomTarget] = useState('Apply');
  const [clinicalDensity, setClinicalDensity] = useState(70);

  const filteredItems = useMemo(() => {
    return MOCK_ITEMS.filter(item =>
      item.stem.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleRemaster = async () => {
    setIsProcessing(true);

    const contextItem = selectedItem || {
      stem: "General USMLE medical context regarding pathophysiology and diagnosis.",
      options: [],
      taxonomy: { bloomLevel: 'Recall' }
    };

    const directives = `
      INSTRUCTION: ${prompt || 'Remaster the item for clinical vignette density and USMLE Step 1 rigor.'}
      PARAMETERS:
      - Cognitive Level: ${bloomTarget}
      - Complexity Index: ${complexity}/100
      - Patient Specifics: Increase diversity and realistic clinical labs.
    `;

    try {
      // const result = await remasterQuestion(contextItem as BackendItem, directives);
      const result = null;
      if (result) {
        setGeneratedResult(result);
      }
    } catch (e) {
      console.error("Remastering Error", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = () => {
    if (!generatedResult) return;
    const newItem: BackendItem = {
      id: `LAB-${Date.now()}`,
      type: 'MCQ',
      stem: generatedResult.newStem,
      options: generatedResult.newOptions.map((o: any, i: number) => ({
        id: `lab-opt-${Date.now()}-${i}`,
        text: o.text,
        isCorrect: o.isCorrect,
        label: String.fromCharCode(65+i)
      })),
      explanation: generatedResult.explanation,
      status: 'Published',
      version: 1,
      authorId: 'SINA-LAB',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeToAuthorMinutes: 1,
      itemType: 'single-best-answer',
      taxonomy: {
        organSystemId: selectedItem?.taxonomy.organSystemId || 'USMLE-GEN',
        disciplineId: selectedItem?.taxonomy.disciplineId || 'DISC-PHYS',
        bloomLevel: bloomTarget,
        syndromeTopicId: 'TOPIC-GEN',
        usmleContentId: 'USMLE-GEN'
      },
      linkedMediaIds: [],
      linkedLectureIds: [],
      learningObjective: `Synthesized in Sina Lab using ${bloomTarget} trajectory.`
    };
    onSaveNew(newItem);
  };

  const renderSource = () =>
    selectedItem ? (
      <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-5 text-stone-900">{selectedItem.stem}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-stone-500">
            <span className="font-mono text-stone-400">{selectedItem.id}</span>
            <span aria-hidden="true">·</span>
            <span>{selectedItem.taxonomy.bloomLevel}</span>
            {selectedItem.options?.length ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{selectedItem.options.length} options</span>
              </>
            ) : null}
          </p>
        </div>
        <IconButton
          icon={X}
          size="sm"
          label="Remove source item"
          onClick={() => setSelectedItem(null)}
        />
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setIsItemPickerOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 px-4 py-4 text-sm font-medium text-stone-600 transition hover:border-stone-400 hover:bg-stone-50 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <Search size={15} />
        Choose a source item
      </button>
    );

  const renderDraft = () => {
    if (!generatedResult) {
      return (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white">
          <EmptyState
            icon={FlaskConical}
            title="No draft yet"
            description="Pick a source item, set the level and add instructions, then generate a draft to review here."
            action={
              <Button icon={Search} onClick={() => setIsItemPickerOpen(true)}>
                Choose a source item
              </Button>
            }
            className="min-h-[420px]"
          />
        </div>
      );
    }

    return (
      <section
        aria-labelledby="ai-lab-draft"
        className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-5 py-4">
          <h3 id="ai-lab-draft" className="mr-1 text-[15px] font-semibold text-stone-900">
            Draft
          </h3>
          <Badge tone="violet" icon={Sparkles}>
            AI
          </Badge>
          <Badge tone="amber" dot>
            Needs review
          </Badge>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{bloomTarget}</Badge>
            <Badge tone="neutral" className="tabular-nums">
              Complexity {complexity}%
            </Badge>
          </span>
        </div>

        <div className="space-y-6 p-5">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-stone-500">Stem</p>
            <p className="text-[15px] leading-7 text-stone-900">{generatedResult.newStem}</p>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-stone-500">Options</p>
            <ol className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200">
              {generatedResult.newOptions.map((opt: any, i: number) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 text-sm',
                    opt.isCorrect ? 'bg-brand-50/70' : 'bg-white',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-xs font-semibold',
                      opt.isCorrect
                        ? 'bg-brand-600 text-white'
                        : 'bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200',
                    )}
                  >
                    {optionLetter(i)}
                  </span>
                  <span className="min-w-0 flex-1 text-stone-800">{opt.text}</span>
                  {opt.isCorrect && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                      <Check size={14} aria-hidden="true" />
                      Correct
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg bg-stone-50 p-4">
            <p className="mb-1 text-[13px] font-medium text-stone-500">Explanation</p>
            <p className="text-sm leading-6 text-stone-700">{generatedResult.explanation}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 px-5 py-3">
          <p className="mr-auto text-[13px] text-stone-500">Check the draft before adding it.</p>
          <Button variant="ghost" onClick={() => setIsDiscardOpen(true)}>
            Discard
          </Button>
          <Button variant="primary" icon={Plus} onClick={handleCommit}>
            Add to items
          </Button>
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <InlineAlert tone="info" title="The AI lab is a preview">
        Generation isn't connected yet, so the draft shown is a sample. Adding it puts it in this
        page's list only — it isn't saved to your item bank.
      </InlineAlert>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Setup */}
        <section
          aria-label="Draft setup"
          className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-card"
        >
          <div className="p-5">
            <SectionTitle
              title="Start from"
              description="Optional. Sina rewrites this item instead of writing from scratch."
              action={
                selectedItem ? (
                  <Button variant="ghost" size="sm" onClick={() => setIsItemPickerOpen(true)}>
                    Change
                  </Button>
                ) : undefined
              }
            />
            {renderSource()}
          </div>

          <div className="space-y-5 p-5">
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-stone-700">Cognitive level</p>
              <SegmentedControl
                label="Cognitive level"
                value={bloomTarget}
                onChange={setBloomTarget}
                options={BLOOM_LEVELS.map((level) => ({ value: level, label: level }))}
                className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
              />
            </div>
            <RangeField
              label="Complexity"
              description="How much reasoning the lead-in demands."
              value={complexity}
              onChange={setComplexity}
            />
            <RangeField
              label="Clinical detail"
              description="How much history, vitals and lab data the vignette includes."
              value={clinicalDensity}
              onChange={setClinicalDensity}
            />
          </div>

          <div className="space-y-3 p-5">
            <Field label="Instructions" hint="Optional">
              {(id) => (
                <Textarea
                  id={id}
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Tell Sina what to change, e.g. focus on the mechanism of the first-line drug."
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Instruction presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setPrompt(preset.prompt)}
                  aria-pressed={prompt === preset.prompt}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                    prompt === preset.prompt
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 rounded-b-xl bg-stone-50/60 px-5 py-3">
            <Button
              variant="ai"
              icon={Sparkles}
              loading={isProcessing}
              onClick={() => void handleRemaster()}
            >
              {isProcessing ? 'Generating…' : 'Generate draft'}
            </Button>
          </div>
        </section>

        {/* Draft preview */}
        <div className="min-w-0 xl:sticky xl:top-6">{renderDraft()}</div>
      </div>

      {/* Source picker */}
      <Dialog
        open={isItemPickerOpen}
        onClose={() => setIsItemPickerOpen(false)}
        title="Choose a source item"
        description="Sina rewrites the item you pick. These are sample items."
        width="max-w-2xl"
      >
        <div className="space-y-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by ID or stem"
            data-autofocus
          />
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-stone-200 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <EmptyState compact icon={Search} title="No items match" description="Try a different search." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {filteredItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItem(item);
                        setIsItemPickerOpen(false);
                      }}
                      className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm leading-5 text-stone-900">{item.stem}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-stone-500">
                          <span className="font-mono text-stone-400">{item.id}</span>
                          {item.taxonomy.organSystemId && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{item.taxonomy.organSystemId}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{item.taxonomy.bloomLevel}</span>
                        </span>
                      </span>
                      {selectedItem?.id === item.id && (
                        <Badge tone="green">Selected</Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={isDiscardOpen}
        title="Discard this draft?"
        description="The draft will be cleared. You can generate a new one at any time."
        confirmLabel="Discard draft"
        onConfirm={() => {
          setGeneratedResult(null);
          setIsDiscardOpen(false);
        }}
        onCancel={() => setIsDiscardOpen(false)}
      />
    </div>
  );
};

export default AILabView;
