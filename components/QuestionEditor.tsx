import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  ImageIcon,
  Link as LinkIcon,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { testsService } from '../services/testsService';
import { QuestionOption } from '../types';
import {
  BackendApiItem,
  ItemUpsertRequest,
  Choice,
  GeneratedQuestion,
  ChatMessage,
  LearningObjective,
} from '../types/TestsServiceTypes';
import { useQuestionEditorData } from '../hooks/useQuestionEditorData';
import { useGlobal } from '../contexts/GlobalContext';
import { SelectOption } from './SearchableSelect';
import MultiSearchableSelect from './MultiSearchableSelect';
import CreateTopicModal from './curriculum/CreateTopicModal';
import CreateSubTopicModal from './curriculum/CreateSubTopicModal';
import ImageSelectionModal, { MultimediaType, MultimediaSelection } from './ImageSelectionModal';
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  IconButton,
  InlineAlert,
  Input,
  SegmentedControl,
  Textarea,
  cn,
} from '@/components/ui';
import {
  AutoGrowTextarea,
  EditorSaveActions,
  EditorSection,
  EditorShell,
  MediaAttachment,
  StatusControl,
  choiceLetter,
  useLeaveGuard,
  type EditorHint,
} from './editors/EditorShell';
import { ObjectivePicker } from './editors/ObjectivePicker';

interface QuestionEditorProps {
  onBack: () => void;
  onSave: (request: ItemUpsertRequest) => void | Promise<void>;
  initialQuestion?: BackendApiItem | null;
}

type PreviewMode = 'question' | 'answers';

/** Minimal markdown for explanations: `### headings` and `**bold**`. */
const RenderMarkdown = ({ content }: { content: string }) => {
  if (!content) return null;
  const sections = content.split(/\n\n+/);
  return (
    <div className="space-y-2 text-[13px] leading-5 text-stone-600">
      {sections.map((section, idx) => {
        if (section.trim().startsWith('###')) {
          const headerText = section.replace(/^###\s*/, '').replace(/\*\*/g, '');
          return (
            <h4 key={idx} className="pt-1 text-[13px] font-semibold text-stone-900">
              {headerText}
            </h4>
          );
        }
        const parts = section.split(/(\*\*.*?\*\*)/);
        return (
          <p key={idx} className="whitespace-pre-wrap break-words">
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={i} className="font-semibold text-stone-900">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

const formatList = (parts: string[]) =>
  parts.length <= 1
    ? parts.join('')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

const hasOptionContent = (option: QuestionOption) =>
  Boolean(
    option.text?.trim() ||
      option.explanation?.trim() ||
      option.multimediaUrl ||
      option.explanationMultimediaUrl,
  );

const QuestionEditor: React.FC<QuestionEditorProps> = ({ onBack, onSave, initialQuestion }) => {
  const baseId = useId();
  const classificationId = `${baseId}-classification`;
  const stemId = `${baseId}-stem`;

  const [additionalContext, setAdditionalContext] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [stemMultimediaFileId, setStemMultimediaFileId] = useState<string | undefined>(undefined);
  const [stemMultimediaType, setStemMultimediaType] = useState<MultimediaType>('image');
  const [imageModalTarget, setImageModalTarget] = useState<string>('stem'); // 'stem' | 'choice-N' | 'explanation-N'
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'draft' | 'pending' | 'live'>('draft');

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [followUpPrompt, setFollowUpPrompt] = useState('');

  const [options, setOptions] = useState<QuestionOption[]>([
    { id: '1', text: '', isCorrect: false, explanation: '' },
    { id: '2', text: '', isCorrect: false, explanation: '' },
    { id: '3', text: '', isCorrect: false, explanation: '' },
    { id: '4', text: '', isCorrect: false, explanation: '' },
  ]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedCompetencies] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [references, setReferences] = useState<string[]>([]);

  const [isCreateTopicModalOpen, setIsCreateTopicModalOpen] = useState(false);
  const [isCreateSubTopicModalOpen, setIsCreateSubTopicModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [deleteChoiceIdx, setDeleteChoiceIdx] = useState<number | null>(null);
  const [isConfirmingGenerate, setIsConfirmingGenerate] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('answers');
  const [focusChoiceIdx, setFocusChoiceIdx] = useState<number | null>(null);

  // Set by any user edit; reset when a (new) item is loaded.
  const [isDirty, setIsDirty] = useState(false);
  const touch = () => setIsDirty(true);
  const { requestLeave, leaveDialog } = useLeaveGuard(isDirty, onBack);

  // Curriculum Data Hook
  const editorData = useQuestionEditorData();
  const {
    organSystems,
    topics,
    syndromes,
    objectives,
    selectedOrganSystemId,
    selectedTopicId,
    selectedSyndromeId,
    selectedObjectiveId,
    fillFiltersFromObjective,
    refreshTopics,
    refreshSyndromes,
    setSelectedTopicId,
    setSelectedSyndromeId,
    // Metadata
    tags: availableTags,
    disciplines: availableDisciplines,
    competencies: availableCompetencies,
    isLoadingTags,
    selectedSkillId,
    setSelectedSkillId,
    selectedExam,
  } = editorData;

  // Global cognitive skills
  const { cognitiveSkills, isLoadingSkills } = useGlobal();

  const tagOptions: SelectOption[] = useMemo(
    () => availableTags.map((t) => ({ id: t.id, name: t.title })),
    [availableTags],
  );

  useEffect(() => {
    if (initialQuestion) {
      setSelectedStatus(initialQuestion.status);

      // Read from BackendApiItem shape
      setQuestionText(initialQuestion.mcq?.stem || '');

      // New items arrive with no choices — keep the blank A–D rows then.
      if (initialQuestion.mcq?.choices && initialQuestion.mcq.choices.length > 0) {
        setOptions(
          initialQuestion.mcq.choices.map((c: Choice) => ({
            id: c.id || '',
            text: c.content,
            isCorrect: c.isCorrect,
            explanation: c.explanation || '',
            multimediaUrl: c.multimedia?.url,
            multimediaFileId: c.multimedia?.fileId,
            multimediaType: (c.multimedia?.type as MultimediaType) || undefined,
            explanationMultimediaUrl: c.explanationMultimedia?.url,
            explanationMultimediaFileId: c.explanationMultimedia?.fileId,
            explanationMultimediaType:
              (c.explanationMultimedia?.type as MultimediaType) || undefined,
          })),
        );
      }

      // Tags
      if (initialQuestion.tags) setSelectedTags(initialQuestion.tags.map((t) => t.id));

      // Populate hierarchy filters from the LearningObjective
      if (initialQuestion.learningObjectiveId) {
        // Use fillFiltersFromObjective to auto-populate organSystem/topic/syndrome/skill/exam
        const loStub: LearningObjective = {
          id: initialQuestion.learningObjectiveId,
          title: '',
          identifier: '',
          createdAt: '',
          updatedAt: '',
        };
        fillFiltersFromObjective(loStub).then((fullObj) => {
          // Populate read-only metadata from the LO
          if (fullObj.disciplines) setSelectedDisciplines(fullObj.disciplines.map((d) => d.id));
          if (fullObj.subject) setSelectedSubject(fullObj.subject.title);
        });
      }

      // Load references from metadata (will be on item.metadata once backend supports it)
      const metadata = (initialQuestion as any).metadata;
      if (metadata?.references && Array.isArray(metadata.references)) {
        setReferences(metadata.references as string[]);
      }
    } else {
      setSelectedStatus('draft');
    }
    setIsDirty(false);
  }, [initialQuestion, fillFiltersFromObjective]);

  // Focus a newly added choice.
  useEffect(() => {
    if (focusChoiceIdx === null) return;
    document.getElementById(`${baseId}-choice-${focusChoiceIdx}`)?.focus();
    setFocusChoiceIdx(null);
  }, [focusChoiceIdx, baseId, options.length]);

  // --- Media --------------------------------------------------------------

  const openImageModal = (target: string) => {
    setImageModalTarget(target);
    setIsImageModalOpen(true);
  };

  const handleMultimediaSelected = (data: MultimediaSelection) => {
    touch();
    if (imageModalTarget === 'stem') {
      setAttachedImage(data.url);
      setStemMultimediaFileId(data.fileId);
      setStemMultimediaType(data.type);
    } else if (imageModalTarget.startsWith('choice-')) {
      const idx = parseInt(imageModalTarget.split('-')[1]);
      updateOption(idx, {
        multimediaUrl: data.url,
        multimediaFileId: data.fileId,
        multimediaType: data.type,
      });
    } else if (imageModalTarget.startsWith('explanation-')) {
      const idx = parseInt(imageModalTarget.split('-')[1]);
      updateOption(idx, {
        explanationMultimediaUrl: data.url,
        explanationMultimediaFileId: data.fileId,
        explanationMultimediaType: data.type,
      });
    }
  };

  // --- Choices ------------------------------------------------------------

  function updateOption(idx: number, patch: Partial<QuestionOption>) {
    setOptions((current) =>
      current.map((option, index) => (index === idx ? { ...option, ...patch } : option)),
    );
    touch();
  }

  const markCorrect = (idx: number) => {
    setOptions((current) => current.map((option, index) => ({ ...option, isCorrect: index === idx })));
    touch();
  };

  const moveOption = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= options.length) return;
    setOptions((current) => {
      const next = [...current];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    touch();
  };

  const addOption = () => {
    setOptions((current) => [
      ...current,
      { id: `temp_${Date.now()}`, text: '', isCorrect: false, explanation: '' },
    ]);
    setFocusChoiceIdx(options.length);
    touch();
  };

  const removeOption = (idx: number) => {
    setOptions((current) => current.filter((_, i) => i !== idx));
    touch();
  };

  /** Empty choices go straight away; anything with content is confirmed. */
  const requestRemoveOption = (idx: number) => {
    if (hasOptionContent(options[idx])) {
      setDeleteChoiceIdx(idx);
      return;
    }
    removeOption(idx);
  };

  // --- AI -----------------------------------------------------------------

  const handleGenerate = async (isFollowUp = false) => {
    if (!selectedObjectiveId) {
      setError('Please select a learning objective first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const difficulty = 'Medium';
      const tags = selectedTags; // IDs is fine, backend expects strings

      let currentHistory = [...chatHistory];
      if (isFollowUp && followUpPrompt.trim()) {
        currentHistory.push({ role: 'user', content: followUpPrompt });
        setFollowUpPrompt('');
        setChatHistory(currentHistory);
      } else if (!isFollowUp) {
        currentHistory = [];
        setChatHistory(currentHistory);
      }

      const generatedQuestion: GeneratedQuestion = await testsService.generateQuestion(
        `Organ System ${selectedOrganSystem?.title} - Topic ${selectedTopic?.title} - Syndrome ${selectedSyndrome?.title} - Learning Objective ${selectedObjective?.title}`,
        difficulty,
        tags,
        selectedExam,
        additionalContext,
        currentHistory.length > 0 ? currentHistory : undefined,
      );

      if (generatedQuestion) {
        setQuestionText(generatedQuestion.stem);
        setReferences(generatedQuestion.references);
        if (generatedQuestion.subject) {
          const newSub = generatedQuestion.subject.trim();
          if (newSub) {
            setSelectedSubject(newSub);
          }
        }
        setOptions(
          generatedQuestion.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            isCorrect: generatedQuestion.correct_option_id === opt.id,
            explanation:
              generatedQuestion.correct_option_id === opt.id
                ? generatedQuestion.correct_explanation
                : generatedQuestion.distractor_explanations.find((d) => d.id === opt.id)
                    ?.explanation || '',
          })),
        );

        setChatHistory([
          ...currentHistory,
          { role: 'assistant', content: JSON.stringify(generatedQuestion) },
        ]);
        touch();
      }
    } catch (e: any) {
      console.error('Generation error:', e);
      setError('Failed to generate question. Please try again. ' + (e.message || ''));
    } finally {
      setIsGenerating(false);
    }
  };

  const hasDraftContent = Boolean(questionText.trim()) || options.some(hasOptionContent);

  /** A fresh draft replaces the editor's content, so confirm when there is any. */
  const requestFreshDraft = () => {
    if (hasDraftContent) {
      setIsConfirmingGenerate(true);
      return;
    }
    void handleGenerate(false);
  };

  // --- Save ---------------------------------------------------------------

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    if (!questionText || options.length < 2 || !options.some((o) => o.isCorrect)) {
      setError('Please ensure question text exists and there is at least one correct option.');
      return;
    }
    const request: ItemUpsertRequest = {
      item: {
        ...(initialQuestion?.id ? { id: initialQuestion.id } : {}),
        type: 'mcq',
        status: selectedStatus,
        metadata: references.length > 0 ? { references } : undefined,
        mcq: { stem: questionText },
      },
      learningObjectiveId: selectedObjectiveId || undefined,
      tags: selectedTags,
      multimedia: attachedImage
        ? {
            multimedia: { url: attachedImage, type: stemMultimediaType || 'image' },
            fileId: stemMultimediaFileId,
          }
        : null,
      choices: options.map((o) => ({
        choice: {
          ...(o.id.length > 5 && !o.id.startsWith('temp_') ? { id: o.id } : {}),
          content: o.text,
          isCorrect: o.isCorrect,
          explanation: o.explanation || '',
        },
        multimedia: o.multimediaUrl
          ? {
              multimedia: { url: o.multimediaUrl, type: o.multimediaType || 'image' },
              fileId: o.multimediaFileId,
            }
          : null,
        explanationMultimedia: o.explanationMultimediaUrl
          ? {
              multimedia: {
                url: o.explanationMultimediaUrl,
                type: o.explanationMultimediaType || 'image',
              },
              fileId: o.explanationMultimediaFileId,
            }
          : null,
      })),
    };
    setError(null);
    setIsSaving(true);
    try {
      await Promise.resolve(onSave(request));
    } finally {
      setIsSaving(false);
    }
  };

  // --- Curriculum ---------------------------------------------------------

  const handleCreateTopic = async (data: {
    name: string;
    identifier?: string;
    organSystemId: string;
  }) => {
    try {
      const result = await testsService.upsertTopic(data.name, data.organSystemId);
      await refreshTopics();
      setSelectedTopicId(result.id);
      touch();
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleCreateSubTopic = async (data: { name: string; identifier?: string; topicId: string }) => {
    try {
      const result = await testsService.upsertSyndrome('', data.name, data.topicId);
      await refreshSyndromes();
      setSelectedSyndromeId(result.id);
      touch();
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleObjectiveSelected = async (id: string) => {
    if (!id) return;
    try {
      const fullObj = await testsService.getLearningObjective(id.split('/').pop() || '');
      if (fullObj) {
        if (fullObj.disciplines && fullObj.disciplines.length > 0) {
          setSelectedDisciplines(fullObj.disciplines.map((d) => d.id));
        }
      }
    } catch (e) {
      console.error('Failed to fetch full objective details:', e);
    }
  };

  // Find display names for selected items
  const selectedOrganSystem = organSystems.find((os) => os.id === selectedOrganSystemId);
  const selectedTopic = topics.find((t) => t.id === selectedTopicId);
  const selectedSyndrome = syndromes.find((s) => s.id === selectedSyndromeId);
  const selectedObjective = objectives.find((o) => o.id === selectedObjectiveId);

  // --- Derived UI state -----------------------------------------------------

  const isEditing = Boolean(initialQuestion?.identifier);
  const correctIndex = options.findIndex((o) => o.isCorrect);
  const validationIssue = !questionText
    ? 'Add a question stem'
    : options.length < 2
      ? 'Add at least two choices'
      : correctIndex === -1
        ? 'Mark the correct answer'
        : null;
  const hint: EditorHint | null = isSaving
    ? null
    : validationIssue
      ? { text: validationIssue }
      : isDirty
        ? { text: 'Unsaved changes', tone: 'amber' }
        : null;

  const missingForAi = [
    !selectedExam && 'an exam',
    !selectedOrganSystemId && 'an organ system',
    !selectedSkillId && 'a cognitive skill',
    !selectedObjectiveId && 'a learning objective',
  ].filter(Boolean) as string[];
  const canGenerate = missingForAi.length === 0;
  const userMessages = chatHistory.filter((msg) => msg.role === 'user');
  // Keys follow the choice (so reordering keeps focus) when ids are usable.
  const idsAreUnique =
    options.every((o) => o.id) && new Set(options.map((o) => o.id)).size === options.length;
  const choiceKey = (option: QuestionOption, idx: number) =>
    idsAreUnique ? option.id : `choice-${idx}`;

  const namesFor = (ids: string[], source: { id: string; title: string }[]) =>
    ids.map((id) => source.find((entry) => entry.id === id)?.title).filter(Boolean) as string[];
  const derivedMetadata = [
    { label: 'Disciplines', values: namesFor(selectedDisciplines, availableDisciplines) },
    { label: 'Competencies', values: namesFor(selectedCompetencies, availableCompetencies) },
    { label: 'Subject', values: selectedSubject ? [selectedSubject] : [] },
  ];

  const scrollToClassification = () => {
    document.getElementById(classificationId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- Preview --------------------------------------------------------------

  const revealAnswers = previewMode === 'answers';
  const preview = (
    <div className="rounded-xl border border-stone-200 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
          <Eye size={15} className="text-stone-500" aria-hidden="true" />
          Learner preview
        </p>
        <SegmentedControl<PreviewMode>
          label="Preview mode"
          size="sm"
          value={previewMode}
          onChange={setPreviewMode}
          options={[
            { value: 'question', label: 'Question' },
            { value: 'answers', label: 'With answers' },
          ]}
        />
      </div>
      <div className="space-y-4 p-4">
        {attachedImage &&
          (stemMultimediaType === 'hyperlink' ? (
            <a
              href={attachedImage}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 truncate text-[13px] text-sky-700 hover:underline"
            >
              <LinkIcon size={14} className="flex-shrink-0 text-stone-500" aria-hidden="true" />
              <span className="truncate">{attachedImage}</span>
            </a>
          ) : (
            <img
              src={attachedImage}
              alt="Question media"
              className="max-h-56 w-full rounded-lg border border-stone-200 object-cover"
            />
          ))}
        {questionText ? (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-stone-900">
            {questionText}
          </p>
        ) : (
          <p className="text-sm text-stone-400">The question stem appears here.</p>
        )}
        <ol className="space-y-2">
          {options.map((opt, idx) => {
            const showCorrect = revealAnswers && opt.isCorrect;
            return (
              <li
                key={choiceKey(opt, idx)}
                className={cn(
                  'rounded-lg border px-3.5 py-3',
                  showCorrect ? 'border-brand-300 bg-brand-50' : 'border-stone-200 bg-white',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium',
                      showCorrect ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600',
                    )}
                  >
                    {showCorrect ? <CheckCircle2 size={13} /> : choiceLetter(idx)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'whitespace-pre-wrap break-words text-sm leading-6',
                        showCorrect ? 'text-brand-900' : 'text-stone-700',
                      )}
                    >
                      {opt.text || <span className="text-stone-400">Empty choice</span>}
                    </p>
                    {opt.multimediaUrl && opt.multimediaType !== 'hyperlink' && (
                      <img
                        src={opt.multimediaUrl}
                        alt={`Choice ${choiceLetter(idx)} media`}
                        className="mt-2 h-20 w-auto rounded-md border border-stone-200 object-cover"
                      />
                    )}
                  </div>
                  {showCorrect && (
                    <span className="mt-0.5 flex-shrink-0 text-xs font-medium text-brand-700">
                      Correct
                    </span>
                  )}
                </div>
                {revealAnswers && (opt.explanation || opt.explanationMultimediaUrl) && (
                  <div
                    className={cn(
                      'ml-8 mt-2 space-y-2 border-t pt-2',
                      showCorrect ? 'border-brand-200' : 'border-stone-100',
                    )}
                  >
                    <RenderMarkdown content={opt.explanation || ''} />
                    {opt.explanationMultimediaUrl && opt.explanationMultimediaType !== 'hyperlink' && (
                      <img
                        src={opt.explanationMultimediaUrl}
                        alt={`Explanation ${choiceLetter(idx)} media`}
                        className="h-20 w-auto rounded-md border border-stone-200 object-cover"
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );

  // --- Render -----------------------------------------------------------------

  return (
    <>
      <EditorShell
        kind={{ label: 'MCQ', icon: ClipboardCheck }}
        title={isEditing ? 'Edit MCQ' : 'New MCQ'}
        identifier={initialQuestion?.identifier}
        status={
          <StatusControl
            value={selectedStatus}
            editable={isEditing}
            onChange={(status) => {
              setSelectedStatus(status);
              touch();
            }}
          />
        }
        onBack={requestLeave}
        hint={hint}
        actions={
          <EditorSaveActions
            isDirty={isDirty}
            saving={isSaving}
            saveLabel={isEditing ? 'Save changes' : 'Create MCQ'}
            onDiscard={requestLeave}
            onSave={() => void handleSave()}
          />
        }
        alert={error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
        aside={preview}
      >
        {/* AI drafting */}
        <section
          aria-labelledby={`${baseId}-ai`}
          className="rounded-xl border border-stone-200 bg-white p-5 shadow-card"
        >
          <div className="flex items-start gap-3">
            <span className="bg-ai-gradient flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white">
              <Sparkles size={15} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`${baseId}-ai`} className="text-[15px] font-semibold text-stone-900">
                Draft with AI
              </h2>
              <p className="mt-0.5 text-[13px] leading-5 text-stone-500">
                {chatHistory.length === 0
                  ? 'Writes a stem, choices and explanations for the chosen learning objective.'
                  : 'Ask for changes to the draft, or regenerate it from scratch.'}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {chatHistory.length === 0 ? (
              <>
                <Field label="Additional context" hint="Optional">
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={2}
                      value={additionalContext}
                      onChange={(e) => setAdditionalContext(e.target.value)}
                      placeholder="Focus areas, clinical scenario or patient demographics"
                    />
                  )}
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[13px] text-stone-500">
                    {canGenerate ? (
                      'The draft replaces the stem and choices below.'
                    ) : (
                      <>
                        Choose {formatList(missingForAi)} in{' '}
                        <button
                          type="button"
                          onClick={scrollToClassification}
                          className="font-medium text-stone-700 underline decoration-stone-300 underline-offset-2 hover:text-stone-900"
                        >
                          Classification
                        </button>{' '}
                        first.
                      </>
                    )}
                  </p>
                  <Button
                    variant="ai"
                    icon={Sparkles}
                    onClick={requestFreshDraft}
                    loading={isGenerating}
                    disabled={!canGenerate}
                  >
                    {isGenerating ? 'Drafting…' : 'Generate draft'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {(userMessages.length > 0 || isGenerating) && (
                  <ol
                    aria-label="Your requests"
                    className="custom-scrollbar max-h-60 space-y-2 overflow-y-auto rounded-lg bg-stone-50 p-3"
                  >
                    {userMessages.map((msg, idx) => (
                      <li
                        key={idx}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-[13px] leading-5 text-stone-700"
                      >
                        <span className="mb-0.5 block text-xs font-medium text-stone-500">You</span>
                        {msg.content}
                      </li>
                    ))}
                    {isGenerating && (
                      <li className="flex items-center gap-2 px-1 py-1 text-[13px] text-stone-500">
                        <Loader2 size={14} className="animate-spin text-brand-600" aria-hidden="true" />
                        Updating the draft…
                      </li>
                    )}
                  </ol>
                )}
                <Field label="Ask for changes">
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={2}
                      value={followUpPrompt}
                      onChange={(e) => setFollowUpPrompt(e.target.value)}
                      placeholder="e.g. Make choice C a more plausible distractor"
                    />
                  )}
                </Field>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" icon={RotateCcw} onClick={requestFreshDraft} disabled={isGenerating}>
                    Regenerate
                  </Button>
                  <Button
                    variant="ai"
                    icon={Sparkles}
                    onClick={() => void handleGenerate(true)}
                    loading={isGenerating}
                    disabled={!followUpPrompt.trim()}
                  >
                    Update draft
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Stem */}
        <EditorSection
          title="Question stem"
          labelFor={stemId}
          description="The clinical vignette and question learners read first."
        >
          <AutoGrowTextarea
            id={stemId}
            minRows={5}
            value={questionText}
            onChange={(e) => {
              setQuestionText(e.target.value);
              touch();
            }}
            placeholder="A 54-year-old man presents with…"
          />
          <div className="mt-3 flex flex-wrap items-start gap-2">
            {attachedImage && (
              <MediaAttachment
                url={attachedImage}
                type={stemMultimediaType}
                label="Stem media"
                onRemove={() => {
                  setAttachedImage(null);
                  setStemMultimediaFileId(undefined);
                  touch();
                }}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={stemMultimediaType === 'hyperlink' && attachedImage ? LinkIcon : ImageIcon}
              onClick={() => openImageModal('stem')}
            >
              {attachedImage ? 'Replace media' : 'Add image or link'}
            </Button>
          </div>
        </EditorSection>

        {/* Choices */}
        <EditorSection
          title="Answer choices"
          description="Mark the single best answer on the left. Each choice has its own explanation."
          meta={
            correctIndex === -1 ? (
              <Badge tone="amber" dot>
                No correct answer
              </Badge>
            ) : (
              <Badge tone="green" dot>
                Answer {choiceLetter(correctIndex)}
              </Badge>
            )
          }
          flush
        >
          <fieldset>
            <legend className="sr-only">Correct answer</legend>
            <ol className="divide-y divide-stone-100">
              {options.map((option, idx) => {
                const letter = choiceLetter(idx);
                const inputId = `${baseId}-choice-${idx}`;
                const explanationId = `${baseId}-explanation-${idx}`;
                return (
                  <li
                    key={choiceKey(option, idx)}
                    className={cn('px-4 py-4 sm:px-5', option.isCorrect && 'bg-brand-50/50')}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name={`${baseId}-correct`}
                        checked={option.isCorrect}
                        onChange={() => markCorrect(idx)}
                        aria-label={`Choice ${letter} is the correct answer`}
                        className="h-4 w-4 flex-shrink-0 cursor-pointer accent-brand-600"
                      />
                      <label
                        htmlFor={inputId}
                        className={cn(
                          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium',
                          option.isCorrect ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600',
                        )}
                      >
                        <span className="sr-only">Choice </span>
                        {letter}
                      </label>
                      <Input
                        id={inputId}
                        value={option.text}
                        onChange={(e) => updateOption(idx, { text: e.target.value })}
                        placeholder={`Choice ${letter}`}
                        className="min-w-0 flex-1"
                      />
                      <div className="flex flex-shrink-0 items-center">
                        <IconButton
                          size="sm"
                          icon={option.multimediaType === 'hyperlink' ? LinkIcon : ImageIcon}
                          label={option.multimediaUrl ? `Replace media on choice ${letter}` : `Add media to choice ${letter}`}
                          onClick={() => openImageModal(`choice-${idx}`)}
                        />
                        <IconButton
                          size="sm"
                          icon={ArrowUp}
                          label={`Move choice ${letter} up`}
                          disabled={idx === 0}
                          onClick={() => moveOption(idx, -1)}
                        />
                        <IconButton
                          size="sm"
                          icon={ArrowDown}
                          label={`Move choice ${letter} down`}
                          disabled={idx === options.length - 1}
                          onClick={() => moveOption(idx, 1)}
                        />
                        <IconButton
                          size="sm"
                          icon={Trash2}
                          tone="danger"
                          label={`Delete choice ${letter}`}
                          onClick={() => requestRemoveOption(idx)}
                        />
                      </div>
                    </div>

                    <div className="mt-3 space-y-3 sm:pl-[3.75rem]">
                      {option.multimediaUrl && (
                        <MediaAttachment
                          size="sm"
                          url={option.multimediaUrl}
                          type={option.multimediaType}
                          label={`Choice ${letter} media`}
                          onRemove={() =>
                            updateOption(idx, {
                              multimediaUrl: undefined,
                              multimediaFileId: undefined,
                              multimediaType: undefined,
                            })
                          }
                        />
                      )}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <label htmlFor={explanationId} className="text-[13px] font-medium text-stone-700">
                            {option.isCorrect ? `Why ${letter} is correct` : `Why ${letter} is incorrect`}
                          </label>
                          <IconButton
                            size="sm"
                            icon={option.explanationMultimediaType === 'hyperlink' ? LinkIcon : ImageIcon}
                            label={
                              option.explanationMultimediaUrl
                                ? `Replace media on explanation ${letter}`
                                : `Add media to explanation ${letter}`
                            }
                            onClick={() => openImageModal(`explanation-${idx}`)}
                          />
                        </div>
                        <AutoGrowTextarea
                          id={explanationId}
                          minRows={2}
                          value={option.explanation || ''}
                          onChange={(e) => updateOption(idx, { explanation: e.target.value })}
                          placeholder={`Why is choice ${letter} ${option.isCorrect ? 'correct' : 'incorrect'}?`}
                        />
                        {option.explanationMultimediaUrl && (
                          <div className="mt-2">
                            <MediaAttachment
                              size="sm"
                              url={option.explanationMultimediaUrl}
                              type={option.explanationMultimediaType}
                              label={`Explanation ${letter} media`}
                              onRemove={() =>
                                updateOption(idx, {
                                  explanationMultimediaUrl: undefined,
                                  explanationMultimediaFileId: undefined,
                                  explanationMultimediaType: undefined,
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </fieldset>
          <div className="border-t border-stone-100 px-4 py-2.5 sm:px-5">
            <Button variant="ghost" size="sm" icon={Plus} onClick={addOption}>
              Add choice
            </Button>
          </div>
        </EditorSection>

        {/* References */}
        <EditorSection
          title="References"
          meta={<span className="text-[13px] text-stone-400">Optional</span>}
          description="Sources learners can follow up on."
        >
          {references.length > 0 && (
            <ol className="mb-3 space-y-2">
              {references.map((ref, idx) => {
                const referenceId = `${baseId}-reference-${idx}`;
                return (
                  <li key={idx} className="flex items-center gap-2">
                    <label
                      htmlFor={referenceId}
                      className="w-5 flex-shrink-0 text-right text-xs tabular-nums text-stone-400"
                    >
                      <span className="sr-only">Reference </span>
                      {idx + 1}
                    </label>
                    <Input
                      id={referenceId}
                      value={ref}
                      onChange={(e) => {
                        const updated = [...references];
                        updated[idx] = e.target.value;
                        setReferences(updated);
                        touch();
                      }}
                      placeholder="Reference title or URL"
                      className="min-w-0 flex-1"
                    />
                    <IconButton
                      size="sm"
                      icon={Trash2}
                      tone="danger"
                      label={`Remove reference ${idx + 1}`}
                      onClick={() => {
                        setReferences(references.filter((_, i) => i !== idx));
                        touch();
                      }}
                    />
                  </li>
                );
              })}
            </ol>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => {
              setReferences([...references, '']);
              touch();
            }}
            className="-ml-2.5"
          >
            Add reference
          </Button>
        </EditorSection>

        {/* Classification */}
        <EditorSection
          id={classificationId}
          title="Classification"
          description="Where this question sits in the curriculum. AI drafting uses it too."
          meta={
            selectedObjectiveId ? (
              <Badge tone="green" dot>
                Objective set
              </Badge>
            ) : undefined
          }
        >
          <ObjectivePicker
            data={editorData}
            onEdit={touch}
            onSearchResultPicked={(fullObj) => {
              if (fullObj && fullObj.disciplines) {
                setSelectedDisciplines(fullObj.disciplines.map((d) => d.id));
              }
            }}
            onObjectiveSelected={(id) => void handleObjectiveSelected(id)}
            onAddTopic={() => setIsCreateTopicModalOpen(true)}
            onAddSubtopic={() => setIsCreateSubTopicModalOpen(true)}
            beforeObjective={
              <div role="group" aria-labelledby={`${baseId}-skill`}>
                <p id={`${baseId}-skill`} className="mb-1.5 text-[13px] font-medium text-stone-700">
                  Cognitive skill
                </p>
                {isLoadingSkills ? (
                  <p className="flex items-center gap-1.5 text-xs text-stone-500">
                    <Loader2 size={12} className="animate-spin text-brand-600" aria-hidden="true" />
                    Loading skills…
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cognitiveSkills.map((skill) => {
                      const active = selectedSkillId === skill.id;
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setSelectedSkillId(active ? '' : skill.id);
                            touch();
                          }}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                            active
                              ? 'border-brand-300 bg-brand-50 text-brand-800'
                              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50',
                          )}
                        >
                          {active && <Check size={13} aria-hidden="true" />}
                          {skill.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            }
          />

          <div className="mt-6 space-y-5 border-t border-stone-100 pt-5">
            <div role="group" aria-labelledby={`${baseId}-tags`}>
              <p id={`${baseId}-tags`} className="mb-1.5 text-[13px] font-medium text-stone-700">
                Tags
              </p>
              <MultiSearchableSelect
                options={tagOptions}
                values={selectedTags}
                onChange={(values) => {
                  setSelectedTags(values);
                  touch();
                }}
                disabled={isLoadingTags}
                placeholder="Select tags"
              />
            </div>

            <div>
              <p className="text-[13px] font-medium text-stone-700">From the learning objective</p>
              <p className="mt-0.5 text-xs text-stone-500">Read-only — these follow the objective.</p>
              <dl className="mt-3 grid gap-4 sm:grid-cols-3">
                {derivedMetadata.map((entry) => (
                  <div key={entry.label} className="min-w-0">
                    <dt className="text-xs text-stone-500">{entry.label}</dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {entry.values.length > 0 ? (
                        entry.values.map((value) => <Badge key={value}>{value}</Badge>)
                      ) : (
                        <span className="text-[13px] text-stone-400">None</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </EditorSection>
      </EditorShell>

      <CreateTopicModal
        isOpen={isCreateTopicModalOpen}
        onClose={() => setIsCreateTopicModalOpen(false)}
        onSubmit={handleCreateTopic}
        organSystems={organSystems}
        defaultSystemId={selectedOrganSystemId}
      />

      <CreateSubTopicModal
        isOpen={isCreateSubTopicModalOpen}
        onClose={() => setIsCreateSubTopicModalOpen(false)}
        onSubmit={handleCreateSubTopic}
        organSystems={organSystems}
        defaultOrganSystemId={selectedOrganSystemId}
        defaultTopicId={selectedTopicId}
      />

      <ImageSelectionModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onImageSelected={handleMultimediaSelected}
      />

      <ConfirmDialog
        open={deleteChoiceIdx !== null}
        title={`Delete choice ${choiceLetter(deleteChoiceIdx ?? 0)}?`}
        description="Its text, explanation and media will be removed from the question."
        confirmLabel="Delete choice"
        onConfirm={() => {
          if (deleteChoiceIdx !== null) {
            removeOption(deleteChoiceIdx);
            setDeleteChoiceIdx(null);
          }
        }}
        onCancel={() => setDeleteChoiceIdx(null)}
      />

      <ConfirmDialog
        open={isConfirmingGenerate}
        tone="default"
        title="Replace this question?"
        description="The AI draft replaces the current stem, choices, explanations and references."
        confirmLabel="Generate draft"
        onConfirm={() => {
          setIsConfirmingGenerate(false);
          void handleGenerate(false);
        }}
        onCancel={() => setIsConfirmingGenerate(false)}
      />

      {leaveDialog}
    </>
  );
};

export default QuestionEditor;
