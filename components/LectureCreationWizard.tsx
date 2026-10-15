import React, { useState, useMemo, useEffect, useId, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  FileText,
  MonitorPlay,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useQuestionEditorData } from '../hooks/useQuestionEditorData';
import { testsService } from '../services/testsService';
import {
  BackendApiItem,
  ItemUpsertRequest,
  LearningObjective,
  MultimediaUpsertRequest,
} from '../types/TestsServiceTypes';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  SearchInput,
  Spinner,
  Textarea,
  cn,
} from '@/components/ui';
import {
  AutoGrowTextarea,
  EditorSection,
  EditorShell,
  useLeaveGuard,
} from './editors/EditorShell';
import { ObjectivePicker } from './editors/ObjectivePicker';

interface LectureCreationWizardProps {
  onBack: () => void;
  onComplete: (request: ItemUpsertRequest) => void;
  initialItem?: BackendApiItem | null;
}

type Step = 1 | 2 | 3;

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: 'Details' },
  { step: 2, label: 'Content' },
  { step: 3, label: 'Review' },
];

/** Quiet numbered steps; finished steps turn green and can be revisited. */
const StepIndicator: React.FC<{ step: Step; onSelect: (step: Step) => void }> = ({
  step,
  onSelect,
}) => (
  <ol aria-label="Steps" className="flex items-center gap-2">
    {STEPS.map((entry, index) => {
      const done = step > entry.step;
      const active = step === entry.step;
      const content = (
        <>
          <span
            className={cn(
              'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums',
              done
                ? 'bg-brand-600 text-white'
                : active
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-500',
            )}
          >
            {done ? <Check size={12} strokeWidth={3} aria-label="Done" /> : entry.step}
          </span>
          <span
            className={cn(
              'text-[13px]',
              active ? 'font-medium text-stone-900' : done ? 'text-stone-600' : 'text-stone-500',
              !active && 'hidden sm:inline',
            )}
          >
            {entry.label}
          </span>
        </>
      );
      return (
        <li
          key={entry.step}
          aria-current={active ? 'step' : undefined}
          className="flex items-center gap-2"
        >
          {index > 0 && <span aria-hidden="true" className="h-px w-4 bg-stone-200 sm:w-6" />}
          {done ? (
            <button
              type="button"
              onClick={() => onSelect(entry.step)}
              className="flex items-center gap-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {content}
            </button>
          ) : (
            <span className="flex items-center gap-2">{content}</span>
          )}
        </li>
      );
    })}
  </ol>
);

/** One optional file attachment with a choose/replace/remove control. */
const FileRow: React.FC<{
  icon: LucideIcon;
  title: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
}> = ({ icon: Icon, title, description, file, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-900">{title}</p>
        <p className={cn('truncate text-[13px]', file ? 'text-stone-700' : 'text-stone-500')}>
          {file ? file.name : description}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        aria-label={`${title} file`}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onChange(e.target.files[0]);
          e.target.value = '';
        }}
      />
      {file && (
        <IconButton
          icon={X}
          size="sm"
          label={`Remove ${title.toLowerCase()} file`}
          onClick={() => onChange(null)}
        />
      )}
      <Button variant="secondary" size="sm" icon={Upload} onClick={() => inputRef.current?.click()}>
        {file ? 'Replace' : 'Choose file'}
      </Button>
    </li>
  );
};

const LectureCreationWizard: React.FC<LectureCreationWizardProps> = ({ onBack, onComplete, initialItem }) => {
  const baseId = useId();
  const [step, setStep] = useState<Step>(1);

  const editorData = useQuestionEditorData();
  const {
    objectives,
    selectedOrganSystemId,
    selectedTopicId,
    selectedObjectiveId,
    fillFiltersFromObjective,
  } = editorData;

  // Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Content
  const [lectureText, setLectureText] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);

  // Review: item mapping
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [mappableItems, setMappableItems] = useState<BackendApiItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemQuery, setItemQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Set by any user edit; reset when a (new) item is loaded.
  const [isDirty, setIsDirty] = useState(false);
  const touch = () => setIsDirty(true);
  const { requestLeave, leaveDialog } = useLeaveGuard(isDirty, onBack);

  // Initialize from existing item
  useEffect(() => {
    if (initialItem) {
      setTitle(initialItem.lecture?.title || '');
      setDescription(initialItem.lecture?.summary || '');
      setLectureText(initialItem.lecture?.content || '');

      if (initialItem.learningObjectiveId) {
        const loStub: LearningObjective = {
          id: initialItem.learningObjectiveId,
          title: '',
          identifier: '',
          createdAt: '',
          updatedAt: '',
        };
        fillFiltersFromObjective(loStub);
      }
    }
    setIsDirty(false);
  }, [initialItem, fillFiltersFromObjective]);

  // Fetch items for mapping when reaching the review step
  useEffect(() => {
    if (step === 3) {
      const fetchItems = async () => {
        setIsLoadingItems(true);
        try {
          const response = await testsService.getItems(
            1, 200, 'mcq,saq', undefined, undefined, undefined,
            selectedOrganSystemId || undefined
          );
          setMappableItems(response.items);
        } catch (e) {
          console.error('Failed to fetch items for mapping:', e);
        } finally {
          setIsLoadingItems(false);
        }
      };
      fetchItems();
    }
  }, [step, selectedOrganSystemId]);

  // Each step starts at its top, even when advanced from the sticky footer.
  const stepTopId = `${baseId}-step-top`;
  const isFirstStepRender = useRef(true);
  useEffect(() => {
    if (isFirstStepRender.current) {
      isFirstStepRender.current = false;
      return;
    }
    document.getElementById(stepTopId)?.scrollIntoView({ block: 'start' });
  }, [step, stepTopId]);

  const toggleItemMapping = (id: string) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
    touch();
  };

  const handleFinalize = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      let multimedia: MultimediaUpsertRequest | null = null;

      // Upload video file first, then link it as multimedia
      if (videoFile) {
        const uploaded = await testsService.uploadFile(videoFile);
        multimedia = {
          multimedia: { url: uploaded.url, type: uploaded.type },
          fileId: uploaded.id,
        };
      }

      const request: ItemUpsertRequest = {
        item: {
          ...(initialItem?.id ? { id: initialItem.id } : {}),
          type: 'lecture',
          status: 'draft',
          lecture: {
            title,
            content: lectureText,
            summary: description,
          },
        },
        learningObjectiveId: selectedObjectiveId || undefined,
        tags: [],
        multimedia,
      };
      onComplete(request);
    } catch (e: any) {
      console.error('Failed to finalize lecture:', e);
      setSaveError(e.message || 'Failed to upload media or save lecture.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Derived ---------------------------------------------------------------

  const isAligned = Boolean(selectedObjectiveId) || Boolean(selectedOrganSystemId && selectedTopicId);
  const canContinue = step === 1 ? Boolean(title.trim()) && isAligned : true;
  const footerHint =
    step === 1
      ? !title.trim()
        ? 'Add a title to continue'
        : !isAligned
          ? 'Choose an objective, or at least an organ system and topic'
          : null
      : step === 2
        ? 'Text and files are optional'
        : `${selectedItemIds.length} question${selectedItemIds.length === 1 ? '' : 's'} linked`;

  const selectedObjective = objectives.find(o => o.id === selectedObjectiveId);
  const wordCount = lectureText.trim() ? lectureText.trim().split(/\s+/).length : 0;
  const filteredItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    if (!query) return mappableItems;
    return mappableItems.filter((item) =>
      [item.identifier, item.mcq?.stem, item.saq?.question]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(query)),
    );
  }, [itemQuery, mappableItems]);

  const contentId = `${baseId}-content`;

  const goNext = () => {
    if (!canContinue) return;
    setStep((current) => (current < 3 ? ((current + 1) as Step) : current));
  };

  const summaryRows: { label: string; value: React.ReactNode; wide?: boolean }[] = [
    { label: 'Title', value: title || <span className="text-stone-400">Untitled</span> },
    {
      label: 'Learning objective',
      value: selectedObjective?.title || <span className="text-stone-400">Not set</span>,
    },
    {
      label: 'Summary',
      value: description || <span className="text-stone-400">None</span>,
      wide: true,
    },
    {
      label: 'Lecture text',
      value: wordCount > 0 ? `${wordCount.toLocaleString()} words` : <span className="text-stone-400">None</span>,
    },
    {
      label: 'Files',
      value:
        videoFile || transcriptFile ? (
          [videoFile?.name, transcriptFile?.name].filter(Boolean).join(' · ')
        ) : (
          <span className="text-stone-400">None</span>
        ),
    },
  ];

  return (
    <>
      <EditorShell
        kind={{ label: 'Lecture', icon: MonitorPlay }}
        title={initialItem?.id ? 'Edit lecture' : 'New lecture'}
        identifier={initialItem?.identifier}
        onBack={requestLeave}
        actions={<StepIndicator step={step} onSelect={setStep} />}
        alert={
          saveError && (
            <InlineAlert onDismiss={() => setSaveError(null)}>{saveError}</InlineAlert>
          )
        }
        width="narrow"
        footer={
          <>
            <Button variant="ghost" onClick={requestLeave} disabled={isSaving}>
              {isDirty ? 'Discard' : 'Cancel'}
            </Button>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {footerHint && (
                <span className="hidden text-[13px] text-stone-500 sm:inline">{footerHint}</span>
              )}
              {step > 1 && (
                <Button
                  variant="secondary"
                  icon={ArrowLeft}
                  onClick={() => setStep((current) => (current - 1) as Step)}
                  disabled={isSaving}
                >
                  Back
                </Button>
              )}
              {step < 3 ? (
                <Button variant="primary" iconRight={ArrowRight} onClick={goNext} disabled={!canContinue}>
                  Continue
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void handleFinalize()} loading={isSaving}>
                  {isSaving ? 'Uploading…' : initialItem?.id ? 'Save lecture' : 'Create lecture'}
                </Button>
              )}
            </div>
          </>
        }
      >
        {step === 1 && (
          <>
            <EditorSection
              id={stepTopId}
              title="Details"
              description="What learners see in the course outline."
            >
              <div className="space-y-4">
                <Field label="Title">
                  {(id) => (
                    <Input
                      id={id}
                      value={title}
                      onChange={e => {
                        setTitle(e.target.value);
                        touch();
                      }}
                      placeholder="e.g. Molecular mechanisms of insulin resistance"
                    />
                  )}
                </Field>
                <Field label="Summary" hint="Optional">
                  {(id) => (
                    <AutoGrowTextarea
                      id={id}
                      minRows={3}
                      value={description}
                      onChange={e => {
                        setDescription(e.target.value);
                        touch();
                      }}
                      placeholder="What this lecture covers and why it matters clinically"
                    />
                  )}
                </Field>
              </div>
            </EditorSection>

            <EditorSection
              title="Curriculum alignment"
              description="The learning objective this lecture teaches."
              meta={
                selectedObjectiveId ? (
                  <Badge tone="green" dot>
                    Objective set
                  </Badge>
                ) : undefined
              }
            >
              <ObjectivePicker data={editorData} onEdit={touch} />
            </EditorSection>
          </>
        )}

        {step === 2 && (
          <>
            <EditorSection
              id={stepTopId}
              title="Lecture text"
              labelFor={contentId}
              description="The core material learners read. Markdown is supported."
            >
              <Textarea
                id={contentId}
                rows={18}
                value={lectureText}
                onChange={e => {
                  setLectureText(e.target.value);
                  touch();
                }}
                placeholder="Paste or write the lecture content"
                className="font-mono"
              />
            </EditorSection>

            <EditorSection title="Files" description="Optional attachments for this lecture." flush>
              <ul className="divide-y divide-stone-100">
                <FileRow
                  icon={MonitorPlay}
                  title="Video"
                  description="A lecture recording or clinical case. Uploaded when you save."
                  file={videoFile}
                  onChange={(file) => {
                    setVideoFile(file);
                    touch();
                  }}
                />
                <FileRow
                  icon={FileText}
                  title="Transcript"
                  description="A VTT closed-caption file, for AI review."
                  file={transcriptFile}
                  onChange={(file) => {
                    setTranscriptFile(file);
                    touch();
                  }}
                />
              </ul>
            </EditorSection>
          </>
        )}

        {step === 3 && (
          <>
            <EditorSection
              id={stepTopId}
              title="Review"
              description="Check the lecture before saving. It's saved as a draft."
              actions={
                <>
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                    Edit details
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                    Edit content
                  </Button>
                </>
              }
            >
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {summaryRows.map((row) => (
                  <div key={row.label} className={cn('min-w-0', row.wide && 'sm:col-span-2')}>
                    <dt className="text-[13px] text-stone-500">{row.label}</dt>
                    <dd className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-sm text-stone-900">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </EditorSection>

            <EditorSection
              title="Linked questions"
              description="MCQs and SAQs learners should complete after this lecture."
              meta={<Badge tone={selectedItemIds.length > 0 ? 'green' : 'neutral'}>{selectedItemIds.length} linked</Badge>}
              flush
            >
              <div className="border-b border-stone-100 px-5 py-3">
                <SearchInput
                  value={itemQuery}
                  onChange={setItemQuery}
                  placeholder="Search questions"
                  className="w-full sm:w-72"
                />
              </div>
              {isLoadingItems ? (
                <Spinner label="Loading questions…" className="py-12" />
              ) : filteredItems.length === 0 ? (
                <EmptyState
                  compact
                  icon={ClipboardList}
                  title={mappableItems.length === 0 ? 'No questions to link' : 'No questions match'}
                  description={
                    mappableItems.length === 0
                      ? 'MCQs and SAQs in this organ system will appear here.'
                      : 'Try a different search.'
                  }
                />
              ) : (
                <ul className="custom-scrollbar max-h-[28rem] divide-y divide-stone-100 overflow-y-auto rounded-b-xl">
                  {filteredItems.map(item => {
                    const checked = selectedItemIds.includes(item.id);
                    const checkboxId = `${baseId}-item-${item.id}`;
                    return (
                      <li key={item.id}>
                        <label
                          htmlFor={checkboxId}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors hover:bg-stone-50',
                            checked && 'bg-brand-50/50',
                          )}
                        >
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItemMapping(item.id)}
                            className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded accent-brand-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <Badge>{item.type === 'saq' ? 'SAQ' : 'MCQ'}</Badge>
                              <span className="font-mono text-xs text-stone-500">{item.identifier}</span>
                            </span>
                            <span className="mt-1 line-clamp-2 text-sm text-stone-800">
                              {item.mcq?.stem || item.saq?.question || ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </EditorSection>
          </>
        )}
      </EditorShell>
      {leaveDialog}
    </>
  );
};

export default LectureCreationWizard;
