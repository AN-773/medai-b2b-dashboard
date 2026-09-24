import React, { useEffect, useState } from 'react';
import { Check, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';
import { testsService } from '@/services/testsService';
import { useGlobal } from '@/contexts/GlobalContext';
import type {
  Discipline,
  GeneratedObjective,
  OrganSystem,
  Subject,
  Syndrome,
  Topic,
} from '@/types/TestsServiceTypes';
import type {
  TeacherCourse,
  TeacherLearningObjective,
} from '@/types/AcademyStudioTypes';
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  Field,
  InlineAlert,
  Select,
  SegmentedControl,
  Spinner,
  Textarea,
} from '@/components/ui';
import { getErrorMessage } from './shared';
import MultiSelectList from './objectives/MultiSelectList';

type AuthoringMode = 'manual' | 'ai';

interface CreateCourseObjectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: TeacherCourse;
  /** Called with the freshly created objective so the host can attach it. */
  onCreated: (objective: TeacherLearningObjective) => Promise<void>;
}

const FORM_ID = 'course-objective-form';

const CreateCourseObjectiveModal: React.FC<CreateCourseObjectiveModalProps> = ({
  isOpen,
  onClose,
  course,
  onCreated,
}) => {
  const { cognitiveSkills } = useGlobal();

  const [mode, setMode] = useState<AuthoringMode>('manual');
  const [error, setError] = useState<string | null>(null);
  const [isDiscardOpen, setDiscardOpen] = useState(false);

  // Reference data
  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoadingOrganSystems, setIsLoadingOrganSystems] = useState(false);

  // Cascade placement
  const [selectedOrganSystemId, setSelectedOrganSystemId] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [syndromes, setSyndromes] = useState<Syndrome[]>([]);
  const [selectedSyndromeId, setSelectedSyndromeId] = useState('');
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingSyndromes, setIsLoadingSyndromes] = useState(false);

  // Manual authoring
  const [title, setTitle] = useState('');
  const [selectedCognitiveSkillId, setSelectedCognitiveSkillId] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI authoring
  const [selectedBloom, setSelectedBloom] = useState('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedObjective | null>(null);
  const [isSavingGenerated, setIsSavingGenerated] = useState(false);

  const isBusy = isSubmitting || isGenerating || isSavingGenerated;

  const resetForm = () => {
    setMode('manual');
    setError(null);
    setDiscardOpen(false);
    setSelectedOrganSystemId('');
    setTopics([]);
    setSelectedTopicId('');
    setSyndromes([]);
    setSelectedSyndromeId('');
    setTitle('');
    setSelectedCognitiveSkillId('');
    setSelectedDisciplines([]);
    setSelectedSubjectId('');
    setSelectedBloom('');
    setSelectedDisciplineId('');
    setAdditionalContext('');
    setGenerated(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    resetForm();

    if (organSystems.length === 0) {
      setIsLoadingOrganSystems(true);
      void testsService
        .getOrganSystems(1, 200)
        .then((res) => setOrganSystems(res.items || []))
        .catch((err) => console.error('Failed to load organ systems:', err))
        .finally(() => setIsLoadingOrganSystems(false));
    }
    if (disciplines.length === 0) {
      void testsService
        .getDisciplines(1, 200)
        .then((res) => setDisciplines(res.items || []))
        .catch((err) => console.error('Failed to load disciplines:', err));
    }
    if (subjects.length === 0) {
      void testsService
        .getSubjects(1, 200)
        .then((res) => setSubjects((res.items || []).filter((s) => s.title)))
        .catch((err) => console.error('Failed to load subjects:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleOrganSystemChange = async (organSystemId: string) => {
    setSelectedOrganSystemId(organSystemId);
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setTopics([]);
    setSyndromes([]);
    if (!organSystemId) return;
    setIsLoadingTopics(true);
    try {
      const res = await testsService.getTopics(organSystemId, 1, 200);
      setTopics(res.items || []);
    } catch (err) {
      console.error('Failed to load topics:', err);
    } finally {
      setIsLoadingTopics(false);
    }
  };

  const handleTopicChange = async (topicId: string) => {
    setSelectedTopicId(topicId);
    setSelectedSyndromeId('');
    setSyndromes([]);
    if (!topicId) return;
    setIsLoadingSyndromes(true);
    try {
      const res = await testsService.getSyndromes(topicId, 1, 200);
      setSyndromes(res.items || []);
    } catch (err) {
      console.error('Failed to load subtopics:', err);
    } finally {
      setIsLoadingSyndromes(false);
    }
  };

  const handleClose = () => {
    if (isBusy) return;
    resetForm();
    onClose();
  };

  // Anything the educator typed or generated that closing would throw away.
  const hasUnsavedWork = Boolean(
    title.trim() || additionalContext.trim() || generated,
  );

  const requestClose = () => {
    if (isBusy) return;
    if (hasUnsavedWork) {
      setDiscardOpen(true);
      return;
    }
    handleClose();
  };

  const bloomToCognitiveSkillId = (bloomLevel: string) =>
    cognitiveSkills.find(
      (skill) => skill.title.toLowerCase() === bloomLevel.toLowerCase(),
    )?.id || '';

  const organSystemName =
    organSystems.find((os) => os.id === selectedOrganSystemId)?.title || '';

  const finalizeCreation = async (input: {
    title: string;
    cognitiveSkillId: string;
    disciplines: string[];
    source: 'manual' | 'ai';
  }) => {
    const createCourseScoped = !selectedSyndromeId;
    const created = await testsService.upsertLearningObjective(
      input.title,
      createCourseScoped ? undefined : selectedSyndromeId || undefined,
      input.cognitiveSkillId,
      input.disciplines,
      undefined,
      undefined, // exam scope is not used for course objectives
      selectedSubjectId || undefined,
      course.curriculumId ?? undefined,
      createCourseScoped ? course.id : undefined,
    );

    const skillTitle = cognitiveSkills.find(
      (skill) => skill.id === input.cognitiveSkillId,
    )?.title;

    const objective: TeacherLearningObjective = {
      id: created.id,
      title: created.title,
      organSystem:
        created.syndrome?.topic?.organSystem?.title || organSystemName || undefined,
      cognitiveSkill: created.cognitiveSkill?.title || skillTitle || undefined,
      source: input.source,
      createdAt: created.createdAt || new Date().toISOString(),
    };

    await onCreated(objective);
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Write the objective before creating it.');
      return;
    }
    if (!selectedCognitiveSkillId) {
      setError('Choose a cognitive skill (Bloom level).');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await finalizeCreation({
        title: title.trim(),
        cognitiveSkillId: selectedCognitiveSkillId,
        disciplines: selectedDisciplines,
        source: 'manual',
      });
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create this objective.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedBloom || !selectedDisciplineId) return;

    const disciplineName =
      disciplines.find((d) => d.id === selectedDisciplineId)?.title || '';

    setIsGenerating(true);
    setError(null);
    setGenerated(null);
    try {
      const result = await testsService.generateLearningObjective(
        '',
        '',
        '',
        '',
        selectedBloom,
        disciplineName,
        additionalContext || undefined,
        undefined,
        {
          curriculumId: course.curriculumId ?? undefined,
          courseId: course.id,
        },
      );
      if (result?.title) {
        setGenerated(result);
      } else {
        setError('No objective came back. Try a different Bloom level or context.');
      }
    } catch (err) {
      console.error('LO generation failed:', err);
      setError('The generator could not produce an objective. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!generated) return;
    const cognitiveSkillId = bloomToCognitiveSkillId(generated.bloom_level);
    if (!cognitiveSkillId) {
      setError(`No cognitive skill matches "${generated.bloom_level}".`);
      return;
    }

    setIsSavingGenerated(true);
    setError(null);
    try {
      await finalizeCreation({
        title: generated.title,
        cognitiveSkillId,
        disciplines: selectedDisciplineId ? [selectedDisciplineId] : [],
        source: 'ai',
      });
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save the generated objective.'));
    } finally {
      setIsSavingGenerated(false);
    }
  };

  const canGenerate = Boolean(selectedBloom && selectedDisciplineId);
  const canSubmitManual = Boolean(title.trim() && selectedCognitiveSkillId);

  const footerHint =
    mode === 'manual'
      ? !title.trim()
        ? 'Write the objective to continue'
        : !selectedCognitiveSkillId
          ? 'Choose a cognitive skill to continue'
          : 'Ready to create'
      : generated
        ? 'Review and edit the draft before adding it'
        : 'Generate a draft, then review it';

  const disciplineOptions = disciplines.map((d) => ({ id: d.id, name: d.title }));

  const renderManual = () => (
    <form id={FORM_ID} onSubmit={handleManualSubmit} className="space-y-4">
      <Field label="Objective">
        {(id) => (
          <Textarea
            id={id}
            rows={4}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
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
              onChange={(event) => setSelectedCognitiveSkillId(event.target.value)}
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
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              disabled={isSubmitting}
            >
              <option value="">No subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
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
            options={disciplineOptions}
            values={selectedDisciplines}
            onChange={setSelectedDisciplines}
            placeholder="Search disciplines"
            emptyLabel="Loading disciplines…"
            disabled={isSubmitting}
          />
        )}
      </Field>
    </form>
  );

  const renderAi = () => {
    if (isGenerating) {
      return <Spinner label="Drafting your objective… this can take a few seconds." className="py-14" />;
    }

    if (generated) {
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-stone-200 shadow-card transition focus-within:border-brand-500 focus-within:ring-[3px] focus-within:ring-brand-500/15">
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50 px-4 py-2">
              <Badge tone="violet">AI draft</Badge>
              <Badge>{generated.bloom_level}</Badge>
              {generated.competency && (
                <span className="text-xs text-stone-500">{generated.competency}</span>
              )}
            </div>
            <textarea
              aria-label="Generated objective"
              value={generated.title}
              onChange={(event) => setGenerated({ ...generated, title: event.target.value })}
              disabled={isSavingGenerated}
              rows={4}
              className="block w-full resize-none border-0 bg-white px-4 py-3 text-sm leading-6 text-stone-900 outline-none focus:ring-0 disabled:text-stone-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ai"
              size="sm"
              icon={RefreshCw}
              onClick={() => void handleGenerate()}
              disabled={isSavingGenerated || !canGenerate}
            >
              Regenerate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={SlidersHorizontal}
              onClick={() => {
                setGenerated(null);
                setError(null);
              }}
              disabled={isSavingGenerated}
            >
              Change inputs
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cognitive skill" description="Bloom’s taxonomy level.">
            {(id) => (
              <Select
                id={id}
                value={selectedBloom}
                onChange={(event) => setSelectedBloom(event.target.value)}
              >
                <option value="" disabled>
                  Select a cognitive skill
                </option>
                {cognitiveSkills?.map((skill) => (
                  <option key={skill.id} value={skill.title}>
                    {skill.title}
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
                onChange={(event) => setSelectedDisciplineId(event.target.value)}
                disabled={disciplines.length === 0}
              >
                <option value="" disabled>
                  {disciplines.length === 0 ? 'Loading disciplines…' : 'Select a discipline'}
                </option>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.title}
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
              onChange={(event) => setAdditionalContext(event.target.value)}
              placeholder="Steer the generator: focus areas, clinical setting, emphasis…"
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ai"
            icon={Sparkles}
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
          >
            Generate objective
          </Button>
          {!canGenerate && (
            <p className="text-[13px] text-stone-500">
              Pick a Bloom level and a discipline first.
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Drawer
        open={isOpen}
        onClose={requestClose}
        dismissible={!isBusy && !isDiscardOpen}
        width="max-w-2xl"
        title="New learning objective"
        description={
          <>
            Adding to <span className="font-medium text-stone-700">{course.title}</span>
          </>
        }
        footer={
          <>
            <p className="min-w-0 flex-1 truncate text-[13px] text-stone-500">{footerHint}</p>
            <Button variant="ghost" onClick={requestClose} disabled={isBusy}>
              Cancel
            </Button>
            {mode === 'manual' ? (
              <Button
                type="submit"
                form={FORM_ID}
                variant="primary"
                icon={Check}
                loading={isSubmitting}
                disabled={!canSubmitManual}
              >
                Create and attach
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={Check}
                loading={isSavingGenerated}
                disabled={!generated || !generated.title.trim() || isGenerating}
                onClick={() => void handleSaveGenerated()}
              >
                Create and attach
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-6 px-6 py-5">
          <SegmentedControl<AuthoringMode>
            label="How to author the objective"
            value={mode}
            onChange={(next) => {
              if (isBusy) return;
              setMode(next);
              setError(null);
            }}
            options={[
              { value: 'manual', label: 'Write it' },
              { value: 'ai', label: 'Generate with AI' },
            ]}
          />

          {error && (
            <InlineAlert tone="error" onDismiss={() => setError(null)}>
              {error}
            </InlineAlert>
          )}

          {mode === 'manual' ? renderManual() : renderAi()}

          <section className="space-y-4 border-t border-stone-100 pt-5">
            <div>
              <h3 className="text-sm font-medium text-stone-900">Placement</h3>
              <p className="mt-0.5 text-[13px] text-stone-500">
                Optional. Without a subtopic, the objective belongs to this course only.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Organ system">
                {(id) => (
                  <Select
                    id={id}
                    value={selectedOrganSystemId}
                    onChange={(event) => void handleOrganSystemChange(event.target.value)}
                    disabled={isBusy || isLoadingOrganSystems}
                  >
                    <option value="">{isLoadingOrganSystems ? 'Loading…' : 'None'}</option>
                    {organSystems.map((os) => (
                      <option key={os.id} value={os.id}>
                        {os.title}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Topic">
                {(id) => (
                  <Select
                    id={id}
                    value={selectedTopicId}
                    onChange={(event) => void handleTopicChange(event.target.value)}
                    disabled={isBusy || !selectedOrganSystemId || isLoadingTopics}
                  >
                    <option value="">{isLoadingTopics ? 'Loading…' : 'None'}</option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.title}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Subtopic">
                {(id) => (
                  <Select
                    id={id}
                    value={selectedSyndromeId}
                    onChange={(event) => setSelectedSyndromeId(event.target.value)}
                    disabled={isBusy || !selectedTopicId || isLoadingSyndromes}
                  >
                    <option value="">{isLoadingSyndromes ? 'Loading…' : 'None'}</option>
                    {syndromes.map((syndrome) => (
                      <option key={syndrome.id} value={syndrome.id}>
                        {syndrome.title}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </section>
        </div>
      </Drawer>

      <ConfirmDialog
        open={isDiscardOpen}
        title="Discard this objective?"
        description="What you’ve written or generated here will be lost."
        confirmLabel="Discard"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={handleClose}
      />
    </>
  );
};

export default CreateCourseObjectiveModal;
