import React, { useState, useEffect } from 'react';
import { Check, CheckCircle2, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';
import { OrganSystem, Discipline, Topic, Syndrome, GeneratedObjective, Subject } from '@/types/TestsServiceTypes';
import { useGlobal } from '@/contexts/GlobalContext';
import { testsService } from '@/services/testsService';
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  Field,
  InlineAlert,
  SegmentedControl,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui';
import MultiSelectList from '@/components/academy/course-workbench/objectives/MultiSelectList';

interface CreateObjectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    syndromeId: string;
    cognitiveSkillId: string;
    disciplines: string[];
    exam?: string;
    subjectId?: string;
  }) => Promise<void>;
  topic: Topic;
  subTopic?: Syndrome | null;
  initialData?: {
    title: string;
    syndromeId?: string;
    cognitiveSkillId?: string;
    disciplines?: string[];
    exam?: string;
    organSystemId?: string;
    topicId?: string;
    subjectId?: string;
  } | null;
  initialMode?: 'manual' | 'generate';
  organSystemName?: string;
  curriculumMode?: 'STEP 1' | 'STEP 2';
}

const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze'] as const;

const FORM_ID = 'curriculum-objective-form';

const sameIds = (left: string[], right: string[]) =>
  [...left].sort().join('|') === [...right].sort().join('|');

/**
 * Create or edit a curriculum learning objective — written by hand or drafted
 * with AI. A drawer, since the form is long and the list behind stays useful.
 */
const CreateObjectiveModal: React.FC<CreateObjectiveModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  topic,
  subTopic,
  initialData,
  initialMode = 'manual',
  organSystemName = '',
  curriculumMode = 'STEP 2',
}) => {
  const { cognitiveSkills } = useGlobal();
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [isLoadingDisciplines, setIsLoadingDisciplines] = useState(false);
  const [title, setTitle] = useState(initialData?.title || '');
  const [selectedSyndromeId, setSelectedSyndromeId] = useState(
    initialData?.syndromeId || subTopic?.id || '',
  );
  const [selectedCognitiveSkillId, setSelectedCognitiveSkillId] = useState(
    initialData?.cognitiveSkillId || '',
  );
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>(
    initialData?.disciplines || [],
  );

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    initialData?.subjectId || '',
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  // Cascade hierarchy state (for edit mode)
  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [selectedOrganSystemId, setSelectedOrganSystemId] = useState(initialData?.organSystemId || '');
  const [cascadeTopics, setCascadeTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState(initialData?.topicId || '');
  const [cascadeSyndromes, setCascadeSyndromes] = useState<Syndrome[]>([]);
  const [isLoadingOrganSystems, setIsLoadingOrganSystems] = useState(false);
  const [isLoadingCascadeTopics, setIsLoadingCascadeTopics] = useState(false);
  const [isLoadingCascadeSyndromes, setIsLoadingCascadeSyndromes] = useState(false);

  // Generation State
  const [activeTab, setActiveTab] = useState<'manual' | 'generate'>(initialMode);
  const [selectedBloom, setSelectedBloom] = useState('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedObjective, setGeneratedObjective] = useState<GeneratedObjective | null>(null);
  const [isSavingGen, setIsSavingGen] = useState(false);
  const [isSavedGen, setIsSavedGen] = useState(false);

  const availableSyndromes = topic.syndromes || [];


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Objective title is required');
      return;
    }
    if (!selectedSyndromeId) {
      setError('Subtopic is required');
      return;
    }
    if (!selectedCognitiveSkillId) {
      setError('Cognitive Skill is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title: title.trim(),
        syndromeId: selectedSyndromeId,
        cognitiveSkillId: selectedCognitiveSkillId,
        disciplines: selectedDisciplines,
        exam: curriculumMode,
        subjectId: selectedSubjectId || undefined,
      });
      // Reset form and close
      handleReset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create objective');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrganSystemChange = async (osId: string) => {
    setSelectedOrganSystemId(osId);
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setCascadeTopics([]);
    setCascadeSyndromes([]);
    if (osId) {
      setIsLoadingCascadeTopics(true);
      try {
        const res = await testsService.getTopics(osId, 1, 200);
        setCascadeTopics(res.items || []);
      } catch (err) {
        console.error('Failed to fetch topics:', err);
      } finally {
        setIsLoadingCascadeTopics(false);
      }
    }
  };

  const handleTopicChange = async (topicId: string) => {
    setSelectedTopicId(topicId);
    setSelectedSyndromeId('');
    setCascadeSyndromes([]);
    if (topicId) {
      setIsLoadingCascadeSyndromes(true);
      try {
        const res = await testsService.getSyndromes(topicId, 1, 200);
        setCascadeSyndromes(res.items || []);
      } catch (err) {
        console.error('Failed to fetch syndromes:', err);
      } finally {
        setIsLoadingCascadeSyndromes(false);
      }
    }
  };

  const handleReset = () => {
    setTitle('');
    setSelectedSyndromeId(subTopic?.id || '');
    setSelectedCognitiveSkillId('');
    setSelectedDisciplines([]);
    setSelectedSubjectId('');
    setError(null);
    setIsDiscardOpen(false);
    // Reset cascade state
    setSelectedOrganSystemId('');
    setSelectedTopicId('');
    setCascadeTopics([]);
    setCascadeSyndromes([]);

    // Reset generate states
    setSelectedBloom('');
    setSelectedDisciplineId('');
    setAdditionalContext('');
    setGeneratedObjective(null);
    setIsSavedGen(false);
  }

  const handleClose = () => {
    if (!isSubmitting && !isSavingGen && !isGenerating) {
      handleReset();
      onClose();
    }
  };

  const bloomToCognitiveSkillId = (bloomLevel: string): string => {
    const skill = cognitiveSkills.find(
      (s) => s.title.toLowerCase() === bloomLevel.toLowerCase()
    );
    return skill?.id || '';
  };

  const handleGenerate = async () => {
    const topicName = subTopic?.title || topic.title;
    if (!topicName || !selectedBloom || !selectedDisciplineId || !organSystemName) return;

    const disciplineName = disciplines.find((d) => d.id === selectedDisciplineId)?.title || '';

    setIsGenerating(true);
    setError(null);
    setGeneratedObjective(null);
    setIsSavedGen(false);

    try {
      const result = await testsService.generateLearningObjective(
        organSystemName,
        topic.title,
        subTopic?.title || '',
        curriculumMode,
        selectedBloom,
        disciplineName,
        additionalContext || undefined,
      );

      if (result && result.title) {
        setGeneratedObjective(result);
      } else {
        setError('No learning objective was generated. Try different parameters.');
      }
    } catch (e: any) {
      console.error('LO Generation error:', e);
      setError('Failed to generate learning objective.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!generatedObjective) return;

    const syndromeId = subTopic?.id || '';
    if (!syndromeId) {
      setError('A subtopic must be selected to save the objective.');
      return;
    }

    const cognitiveSkillId = bloomToCognitiveSkillId(generatedObjective.bloom_level);
    if (!cognitiveSkillId) {
      setError(`No matching cognitive skill found for "${generatedObjective.bloom_level}".`);
      return;
    }

    setIsSavingGen(true);
    setError(null);

    try {
      await onSubmit({
        title: generatedObjective.title,
        syndromeId,
        cognitiveSkillId,
        disciplines: [selectedDisciplineId],
        exam: curriculumMode,
      });
      setIsSavedGen(true);
    } catch (e: any) {
      console.error('Failed to save objective:', e);
      setError('Failed to save the objective. ' + (e.message || ''));
    } finally {
      setIsSavingGen(false);
    }
  };

  const handleRegenerate = () => {
    setGeneratedObjective(null);
    setError(null);
    setIsSavedGen(false);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setTitle(initialData?.title || '');
      setSelectedSyndromeId(initialData?.syndromeId || subTopic?.id || '');
      setSelectedCognitiveSkillId(initialData?.cognitiveSkillId || '');
      setSelectedDisciplines(initialData?.disciplines || []);
      setSelectedSubjectId(initialData?.subjectId || '');
      setError(null);

      const fetchDisciplines = async () => {
        setIsLoadingDisciplines(true);
        try {
          const res = await testsService.getDisciplines(1, 200);
          setDisciplines(res.items || []);
        } catch (error) {
          console.error('Failed to fetch disciplines:', error);
        } finally {
          setIsLoadingDisciplines(false);
        }
      };

      if (disciplines.length === 0) {
        fetchDisciplines();
      }

      const fetchSubjects = async () => {
        setIsLoadingSubjects(true);
        try {
          const res = await testsService.getSubjects(1, 200);
          setSubjects(res.items.filter((s) => s.title) || []);
        } catch (error) {
          console.error('Failed to fetch subjects:', error);
        } finally {
          setIsLoadingSubjects(false);
        }
      };

      if (subjects.length === 0) {
        fetchSubjects();
      }

      // Load cascade hierarchy when editing
      if (initialData) {
        const fetchHierarchy = async () => {
          // Fetch organ systems
          setIsLoadingOrganSystems(true);
          try {
            const res = await testsService.getOrganSystems(1, 200);
            setOrganSystems(res.items || []);
          } catch (err) {
            console.error('Failed to fetch organ systems:', err);
          } finally {
            setIsLoadingOrganSystems(false);
          }

          // Pre-load topics for the initial organ system
          if (initialData.organSystemId) {
            setSelectedOrganSystemId(initialData.organSystemId);
            setIsLoadingCascadeTopics(true);
            try {
              const res = await testsService.getTopics(initialData.organSystemId, 1, 200);
              setCascadeTopics(res.items || []);
            } catch (err) {
              console.error('Failed to fetch topics:', err);
            } finally {
              setIsLoadingCascadeTopics(false);
            }
          }

          // Pre-load syndromes for the initial topic
          if (initialData.topicId) {
            setSelectedTopicId(initialData.topicId);
            setIsLoadingCascadeSyndromes(true);
            try {
              const res = await testsService.getSyndromes(initialData.topicId, 1, 200);
              setCascadeSyndromes(res.items || []);
            } catch (err) {
              console.error('Failed to fetch syndromes:', err);
            } finally {
              setIsLoadingCascadeSyndromes(false);
            }
          }
        };

        fetchHierarchy();
      } else {
        // Reset cascade when switching to create mode
        setSelectedOrganSystemId('');
        setSelectedTopicId('');
        setCascadeTopics([]);
        setCascadeSyndromes([]);
      }
    }
  }, [isOpen, initialData, subTopic, initialMode]);

  if (!isOpen) return null;

  const topicName = subTopic?.title || topic.title;
  const canGenerate = selectedBloom && selectedDisciplineId;
  const isEdit = Boolean(initialData);
  const isBusy = isSubmitting || isGenerating || isSavingGen;

  const isEditDirty = initialData
    ? title !== (initialData.title || '') ||
      selectedSyndromeId !== (initialData.syndromeId || subTopic?.id || '') ||
      selectedCognitiveSkillId !== (initialData.cognitiveSkillId || '') ||
      selectedSubjectId !== (initialData.subjectId || '') ||
      !sameIds(selectedDisciplines, initialData.disciplines || [])
    : false;

  // Anything typed or generated that closing would throw away.
  const hasUnsavedWork = isEdit
    ? isEditDirty
    : Boolean(
        title.trim() || additionalContext.trim() || (generatedObjective && !isSavedGen),
      );

  const requestClose = () => {
    if (isBusy) return;
    if (hasUnsavedWork) {
      setIsDiscardOpen(true);
      return;
    }
    handleClose();
  };

  const placementPath = [organSystemName, topic.title, subTopic?.title]
    .filter((part): part is string => Boolean(part))
    .join(' › ');

  const canSubmitManual = Boolean(
    title.trim() && selectedSyndromeId && selectedCognitiveSkillId && (!isEdit || isEditDirty),
  );

  const footerHint =
    activeTab === 'manual'
      ? !title.trim()
        ? 'Write the objective to continue'
        : !selectedSyndromeId
          ? 'Choose a subtopic to continue'
          : !selectedCognitiveSkillId
            ? 'Choose a cognitive skill to continue'
            : isEdit
              ? isEditDirty
                ? 'Unsaved changes'
                : 'No changes'
              : 'Ready to create'
      : isSavedGen
        ? `Saved to ${topicName}`
        : generatedObjective
          ? 'Review and edit the draft before saving'
          : 'Generate a draft, then review it';

  const renderPlacement = () => {
    if (initialData) {
      return (
        <section className="space-y-4 border-t border-stone-100 pt-5">
          <div>
            <h3 className="text-sm font-medium text-stone-900">Placement</h3>
            <p className="mt-0.5 text-[13px] text-stone-500">
              Move the objective by choosing another subtopic.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Organ system">
              {(id) => (
                <Select
                  id={id}
                  value={selectedOrganSystemId}
                  onChange={(e) => handleOrganSystemChange(e.target.value)}
                  disabled={isSubmitting || isLoadingOrganSystems}
                >
                  <option value="" disabled>
                    {isLoadingOrganSystems ? 'Loading…' : 'Select an organ system'}
                  </option>
                  {organSystems.map((os) => (
                    <option key={os.id} value={os.id}>{os.title}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Topic">
              {(id) => (
                <Select
                  id={id}
                  value={selectedTopicId}
                  onChange={(e) => handleTopicChange(e.target.value)}
                  disabled={isSubmitting || !selectedOrganSystemId || isLoadingCascadeTopics}
                >
                  <option value="" disabled>
                    {isLoadingCascadeTopics ? 'Loading…' : 'Select a topic'}
                  </option>
                  {cascadeTopics.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Subtopic">
              {(id) => (
                <Select
                  id={id}
                  value={selectedSyndromeId}
                  onChange={(e) => setSelectedSyndromeId(e.target.value)}
                  disabled={isSubmitting || !selectedTopicId || isLoadingCascadeSyndromes}
                >
                  <option value="" disabled>
                    {isLoadingCascadeSyndromes ? 'Loading…' : 'Select a subtopic'}
                  </option>
                  {cascadeSyndromes.map((syn) => (
                    <option key={syn.id} value={syn.id}>{syn.title}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </section>
      );
    }

    // Creating inside a subtopic: the placement is fixed (shown in the header).
    if (subTopic) return null;

    return (
      <Field label="Subtopic">
        {(id) => (
          <Select
            id={id}
            value={selectedSyndromeId}
            onChange={(e) => setSelectedSyndromeId(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="" disabled>
              Select a subtopic
            </option>
            {availableSyndromes.map((syn) => (
              <option key={syn.id} value={syn.id}>
                {syn.title}
              </option>
            ))}
          </Select>
        )}
      </Field>
    );
  };

  const renderManual = () => (
    <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
      <Field label="Objective">
        {(id) => (
          <Textarea
            id={id}
            rows={4}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Explain the pathophysiology of acute coronary syndrome"
            disabled={isSubmitting}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cognitive skill" description="Bloom’s taxonomy level.">
          {(id) => (
            <Select
              id={id}
              value={selectedCognitiveSkillId}
              onChange={(e) => setSelectedCognitiveSkillId(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="" disabled>
                Select a cognitive skill
              </option>
              {cognitiveSkills?.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.title}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Subject" hint="Optional">
          {(id) => (
            <Select
              id={id}
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={isSubmitting || isLoadingSubjects}
            >
              <option value="">{isLoadingSubjects ? 'Loading subjects…' : 'No subject'}</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Disciplines" hint="Optional">
        {(id) => (
          <MultiSelectList
            id={id}
            options={disciplines.map((d) => ({ id: d.id, name: d.title }))}
            values={selectedDisciplines}
            onChange={setSelectedDisciplines}
            placeholder="Search disciplines"
            emptyLabel={isLoadingDisciplines ? 'Loading disciplines…' : 'No disciplines available'}
            disabled={isSubmitting || isLoadingDisciplines}
          />
        )}
      </Field>

      {renderPlacement()}
    </form>
  );

  const renderGenerate = () => {
    if (isGenerating) {
      return (
        <Spinner
          label="Drafting your objective… this can take up to 30 seconds."
          className="py-14"
        />
      );
    }

    if (generatedObjective) {
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-stone-200 shadow-card transition focus-within:border-brand-500 focus-within:ring-[3px] focus-within:ring-brand-500/15">
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50 px-4 py-2">
              <Badge tone="violet">AI draft</Badge>
              <Badge>{generatedObjective.bloom_level}</Badge>
              {generatedObjective.competency && (
                <span className="text-xs text-stone-500">{generatedObjective.competency}</span>
              )}
              {generatedObjective.usmle_subtopic && (
                <span className="text-xs text-stone-500">· {generatedObjective.usmle_subtopic}</span>
              )}
            </div>
            <textarea
              aria-label="Generated objective"
              value={generatedObjective.title}
              onChange={(e) => setGeneratedObjective({ ...generatedObjective, title: e.target.value })}
              disabled={isSavingGen || isSavedGen}
              rows={4}
              className="block w-full resize-none border-0 bg-white px-4 py-3 text-sm leading-6 text-stone-900 outline-none focus:ring-0 disabled:text-stone-500"
            />
          </div>

          {isSavedGen ? (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800"
            >
              <CheckCircle2 size={16} className="flex-shrink-0" aria-hidden="true" />
              Objective saved to {topicName}.
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ai"
                size="sm"
                icon={RefreshCw}
                onClick={() => void handleGenerate()}
                disabled={isSavingGen || !canGenerate}
              >
                Regenerate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={SlidersHorizontal}
                onClick={handleRegenerate}
                disabled={isSavingGen}
              >
                Change inputs
              </Button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bloom level">
            {(id) => (
              <Select
                id={id}
                value={selectedBloom}
                onChange={(e) => setSelectedBloom(e.target.value)}
              >
                <option value="" disabled>
                  Select a Bloom level
                </option>
                {BLOOM_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Discipline">
            {(id) => (
              <Select
                id={id}
                value={selectedDisciplineId}
                onChange={(e) => setSelectedDisciplineId(e.target.value)}
                disabled={isLoadingDisciplines}
              >
                <option value="" disabled>
                  {isLoadingDisciplines ? 'Loading disciplines…' : 'Select a discipline'}
                </option>
                {disciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Additional context" hint="Optional">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Steer the generator: focus areas, clinical setting, emphasis…"
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ai"
            icon={Sparkles}
            onClick={() => void handleGenerate()}
            disabled={!canGenerate || isGenerating}
          >
            Generate objective
          </Button>
          {!canGenerate && (
            <p className="text-[13px] text-stone-500">Pick a Bloom level and a discipline first.</p>
          )}
        </div>
      </div>
    );
  };

  const renderPrimaryAction = () => {
    if (activeTab === 'manual') {
      return (
        <Button
          type="submit"
          form={FORM_ID}
          variant="primary"
          icon={Check}
          loading={isSubmitting}
          disabled={!canSubmitManual}
        >
          {isEdit ? 'Save changes' : 'Create objective'}
        </Button>
      );
    }
    if (isSavedGen) {
      return (
        <Button variant="primary" onClick={handleClose}>
          Done
        </Button>
      );
    }
    if (generatedObjective && !isGenerating) {
      return (
        <Button
          variant="primary"
          icon={Check}
          loading={isSavingGen}
          disabled={!generatedObjective.title.trim()}
          onClick={() => void handleSaveGenerated()}
        >
          Save objective
        </Button>
      );
    }
    return null;
  };

  return (
    <>
      <Drawer
        open={isOpen}
        onClose={requestClose}
        dismissible={!isBusy && !isDiscardOpen}
        width="max-w-2xl"
        title={isEdit ? 'Edit objective' : 'New learning objective'}
        description={
          placementPath ? (
            <>
              In <span className="font-medium text-stone-700">{placementPath}</span>
            </>
          ) : undefined
        }
        footer={
          <>
            <p className="min-w-0 flex-1 truncate text-[13px] text-stone-500">{footerHint}</p>
            {activeTab === 'generate' && isSavedGen ? (
              <Button variant="ghost" icon={RefreshCw} onClick={handleRegenerate}>
                Generate another
              </Button>
            ) : (
              <Button variant="ghost" onClick={requestClose} disabled={isBusy}>
                Cancel
              </Button>
            )}
            {renderPrimaryAction()}
          </>
        }
      >
        <div className="space-y-6 px-6 py-5">
          {!initialData && (
            <SegmentedControl<'manual' | 'generate'>
              label="How to author the objective"
              value={activeTab}
              onChange={(next) => {
                if (isBusy) return;
                setActiveTab(next);
                setError(null);
              }}
              options={[
                { value: 'manual', label: 'Write it' },
                { value: 'generate', label: 'Generate with AI' },
              ]}
            />
          )}

          {error && (
            <InlineAlert tone="error" onDismiss={() => setError(null)}>
              {error}
            </InlineAlert>
          )}

          {activeTab === 'manual' ? renderManual() : renderGenerate()}
        </div>
      </Drawer>

      <ConfirmDialog
        open={isDiscardOpen}
        title={isEdit ? 'Discard your changes?' : 'Discard this objective?'}
        description={
          isEdit
            ? 'Your edits to this objective will be lost.'
            : 'What you’ve written or generated here will be lost.'
        }
        confirmLabel="Discard"
        onCancel={() => setIsDiscardOpen(false)}
        onConfirm={handleClose}
      />
    </>
  );
};

export default CreateObjectiveModal;
