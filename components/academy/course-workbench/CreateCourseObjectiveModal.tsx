import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Layers,
  Loader2,
  PenLine,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
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
import MultiSearchableSelect from '@/components/MultiSearchableSelect';
import SearchableSelect from '@/components/SearchableSelect';
import { bloomStyle, getErrorMessage } from './shared';

type AuthoringMode = 'manual' | 'ai';

const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze'] as const;

interface CreateCourseObjectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: TeacherCourse;
  /** Called with the freshly created objective so the host can attach it. */
  onCreated: (objective: TeacherLearningObjective) => Promise<void>;
}

const selectClass =
  'w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#1BD183] focus:bg-white focus:ring-2 focus:ring-[#1BD183]/15 disabled:opacity-50';

const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean }> = ({
  children,
  required,
}) => (
  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
    {children}
    {required && <span className="ml-1 text-rose-400">*</span>}
  </label>
);

const NativeSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}> = ({ value, onChange, disabled, loading, children }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={selectClass}
    >
      {children}
    </select>
    {loading ? (
      <Loader2
        size={16}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
      />
    ) : (
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
    )}
  </div>
);

const CreateCourseObjectiveModal: React.FC<CreateCourseObjectiveModalProps> = ({
  isOpen,
  onClose,
  course,
  onCreated,
}) => {
  const { cognitiveSkills } = useGlobal();

  const [mode, setMode] = useState<AuthoringMode>('manual');
  const [error, setError] = useState<string | null>(null);

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

  const bloomToCognitiveSkillId = (bloomLevel: string) =>
    cognitiveSkills.find(
      (skill) => skill.title.toLowerCase() === bloomLevel.toLowerCase(),
    )?.id || '';

  const organSystemName =
    organSystems.find((os) => os.id === selectedOrganSystemId)?.title || '';
  const topicName = topics.find((t) => t.id === selectedTopicId)?.title || '';
  const syndromeName =
    syndromes.find((s) => s.id === selectedSyndromeId)?.title || '';

  const finalizeCreation = async (input: {
    title: string;
    cognitiveSkillId: string;
    disciplines: string[];
    source: 'manual' | 'ai';
  }) => {
    const created = await testsService.upsertLearningObjective(
      input.title,
      selectedSyndromeId,
      input.cognitiveSkillId,
      input.disciplines,
      undefined,
      undefined, // exam scope is not used for course objectives
      selectedSubjectId || undefined,
      course.curriculumId ?? undefined,
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
    if (!selectedSyndromeId) {
      setError('Pick a subtopic so the objective has a home in the curriculum.');
      return;
    }
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
    if (!organSystemName || !topicName || !syndromeName) {
      setError('Complete the placement (organ system → topic → subtopic) first.');
      return;
    }
    if (!selectedBloom || !selectedDisciplineId) return;

    const disciplineName =
      disciplines.find((d) => d.id === selectedDisciplineId)?.title || '';

    setIsGenerating(true);
    setError(null);
    setGenerated(null);
    try {
      const result = await testsService.generateLearningObjective(
        organSystemName,
        topicName,
        syndromeName,
        '',
        selectedBloom,
        disciplineName,
        additionalContext || undefined,
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
    if (!selectedSyndromeId) {
      setError('Pick a subtopic so the objective has a home in the curriculum.');
      return;
    }
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

  // ---- Live preview -------------------------------------------------------
  const previewTitle = mode === 'ai' ? generated?.title || '' : title.trim();
  const previewBloom =
    mode === 'ai'
      ? generated?.bloom_level || selectedBloom
      : cognitiveSkills.find((s) => s.id === selectedCognitiveSkillId)?.title;
  const previewDisciplines = useMemo(() => {
    const ids = mode === 'ai' ? (selectedDisciplineId ? [selectedDisciplineId] : []) : selectedDisciplines;
    return ids
      .map((id) => disciplines.find((d) => d.id === id)?.title)
      .filter((value): value is string => Boolean(value));
  }, [mode, selectedDisciplineId, selectedDisciplines, disciplines]);

  const checklist = [
    { label: 'Placement', done: Boolean(selectedSyndromeId) },
    { label: 'Objective text', done: Boolean(previewTitle) },
    {
      label: 'Cognitive skill',
      done: mode === 'ai' ? Boolean(previewBloom) : Boolean(selectedCognitiveSkillId),
    },
  ];

  if (!isOpen || typeof document === 'undefined') return null;

  const canGenerate = Boolean(
    selectedSyndromeId && selectedBloom && selectedDisciplineId,
  );
  const canSubmitManual = Boolean(
    selectedSyndromeId && title.trim() && selectedCognitiveSkillId,
  );

  const modalContent = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-7 py-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1BA6D1] to-[#1BD183] text-white shadow-lg shadow-[#1BD183]/25">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight text-slate-900">
                New learning objective
              </h2>
              <p className="truncate text-sm font-medium text-slate-500">
                Adding to{' '}
                <span className="font-bold text-slate-700">{course.title}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1.55fr_1fr]">
          {/* Form column */}
          <div className="overflow-y-auto px-7 py-6 custom-scrollbar">
            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-600 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            {/* Placement */}
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Layers size={13} /> Placement
            </div>
            <div className="mt-3 space-y-4">
              <div>
                <FieldLabel required>Organ system</FieldLabel>
                <NativeSelect
                  value={selectedOrganSystemId}
                  onChange={handleOrganSystemChange}
                  disabled={isBusy || isLoadingOrganSystems}
                  loading={isLoadingOrganSystems}
                >
                  <option value="" disabled>
                    {isLoadingOrganSystems ? 'Loading…' : 'Select an organ system'}
                  </option>
                  {organSystems.map((os) => (
                    <option key={os.id} value={os.id}>
                      {os.title}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {selectedOrganSystemId && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <FieldLabel required>Topic</FieldLabel>
                  <NativeSelect
                    value={selectedTopicId}
                    onChange={handleTopicChange}
                    disabled={isBusy || isLoadingTopics}
                    loading={isLoadingTopics}
                  >
                    <option value="" disabled>
                      {isLoadingTopics ? 'Loading…' : 'Select a topic'}
                    </option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.title}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}

              {selectedTopicId && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <FieldLabel required>Subtopic</FieldLabel>
                  <NativeSelect
                    value={selectedSyndromeId}
                    onChange={setSelectedSyndromeId}
                    disabled={isBusy || isLoadingSyndromes}
                    loading={isLoadingSyndromes}
                  >
                    <option value="" disabled>
                      {isLoadingSyndromes ? 'Loading…' : 'Select a subtopic'}
                    </option>
                    {syndromes.map((syndrome) => (
                      <option key={syndrome.id} value={syndrome.id}>
                        {syndrome.title}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </div>

            {/* Authoring mode toggle */}
            <div className="mt-7 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              <PenLine size={13} /> Author
            </div>
            <div className="mt-3 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {([
                { id: 'manual' as const, label: 'Write it', icon: PenLine },
                { id: 'ai' as const, label: 'Generate it', icon: Wand2 },
              ]).map((tab) => {
                const Icon = tab.icon;
                const active = mode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setMode(tab.id);
                      setError(null);
                    }}
                    disabled={isBusy}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition disabled:opacity-50 ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Icon size={14} /> {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Manual authoring */}
            {mode === 'manual' && (
              <form
                id="course-objective-form"
                onSubmit={handleManualSubmit}
                className="mt-4 space-y-4"
              >
                <div>
                  <FieldLabel required>Objective</FieldLabel>
                  <textarea
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g., Explain the pathophysiology of acute coronary syndrome…"
                    disabled={isSubmitting}
                    className="min-h-[110px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-relaxed text-slate-800 outline-none transition focus:border-[#1BD183] focus:bg-white focus:ring-2 focus:ring-[#1BD183]/15 placeholder:text-slate-400 disabled:opacity-50"
                  />
                </div>

                <div>
                  <FieldLabel required>Cognitive skill (Bloom's)</FieldLabel>
                  <NativeSelect
                    value={selectedCognitiveSkillId}
                    onChange={setSelectedCognitiveSkillId}
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
                  </NativeSelect>
                </div>

                <div>
                  <FieldLabel>Disciplines</FieldLabel>
                  <MultiSearchableSelect
                    options={disciplines.map((d) => ({ id: d.id, name: d.title }))}
                    values={selectedDisciplines}
                    onChange={setSelectedDisciplines}
                    placeholder={
                      disciplines.length === 0
                        ? 'Loading disciplines…'
                        : 'Search and select disciplines…'
                    }
                    disabled={isSubmitting || disciplines.length === 0}
                  />
                </div>

                <div>
                  <FieldLabel>Subject</FieldLabel>
                  <NativeSelect
                    value={selectedSubjectId}
                    onChange={setSelectedSubjectId}
                    disabled={isSubmitting}
                  >
                    <option value="">Optional — select a subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.title}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </form>
            )}

            {/* AI authoring */}
            {mode === 'ai' && (
              <div className="mt-4 space-y-4">
                {!generated && !isGenerating && (
                  <>
                    <div>
                      <FieldLabel required>Bloom level</FieldLabel>
                      <NativeSelect
                        value={selectedBloom}
                        onChange={setSelectedBloom}
                      >
                        <option value="" disabled>
                          Select a Bloom level
                        </option>
                        {BLOOM_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>

                    <div>
                      <FieldLabel required>Discipline</FieldLabel>
                      <SearchableSelect
                        options={disciplines.map((d) => ({ id: d.id, name: d.title }))}
                        value={selectedDisciplineId}
                        onChange={setSelectedDisciplineId}
                        placeholder="Search and select a discipline…"
                        allOption={{ id: '', name: 'Select a discipline…' }}
                      />
                    </div>

                    <div>
                      <FieldLabel>Additional context</FieldLabel>
                      <textarea
                        value={additionalContext}
                        onChange={(event) => setAdditionalContext(event.target.value)}
                        placeholder="Steer the generator — focus areas, clinical setting, emphasis…"
                        className="min-h-[80px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:bg-white focus:ring-2 focus:ring-[#1BD183]/15 placeholder:text-slate-400"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={!canGenerate}
                      className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-[#1BD183]/20 transition hover:shadow-xl hover:shadow-[#1BD183]/30 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
                    >
                      <Wand2 size={16} /> Generate objective
                    </button>
                    {!canGenerate && (
                      <p className="text-center text-[11px] font-medium text-slate-400">
                        Complete the placement above, then pick a Bloom level and
                        discipline.
                      </p>
                    )}
                  </>
                )}

                {isGenerating && (
                  <div className="flex flex-col items-center justify-center py-14">
                    <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-[#1BA6D1] to-[#1BD183] text-white shadow-lg shadow-[#1BD183]/25">
                      <Wand2 size={28} />
                    </div>
                    <p className="mt-5 text-sm font-bold text-slate-700">
                      Drafting your objective…
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      This can take a few seconds
                    </p>
                    <Loader2 size={22} className="mt-4 animate-spin text-[#1BD183]" />
                  </div>
                )}

                {generated && !isGenerating && (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${bloomStyle(generated.bloom_level)}`}
                        >
                          {generated.bloom_level}
                        </span>
                        {generated.competency && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {generated.competency}
                          </span>
                        )}
                      </div>
                      <textarea
                        value={generated.title}
                        onChange={(event) =>
                          setGenerated({ ...generated, title: event.target.value })
                        }
                        disabled={isSavingGenerated}
                        className="min-h-[96px] w-full resize-none border-0 px-4 py-4 text-sm font-medium leading-relaxed text-slate-800 outline-none focus:ring-0 disabled:opacity-60"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setGenerated(null);
                        setError(null);
                      }}
                      disabled={isSavingGenerated}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
                    >
                      <Wand2 size={13} /> Regenerate
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview column */}
          <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto border-l border-slate-100 bg-slate-50/60 px-6 py-6 custom-scrollbar md:flex">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              Live preview
            </p>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {previewTitle ? (
                <p className="text-sm font-bold leading-relaxed text-slate-900">
                  {previewTitle}
                </p>
              ) : (
                <p className="text-sm font-medium italic leading-relaxed text-slate-400">
                  Your objective will appear here as you build it.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {organSystemName && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {organSystemName}
                  </span>
                )}
                {previewBloom && (
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${bloomStyle(previewBloom)}`}
                  >
                    {previewBloom}
                  </span>
                )}
                {previewDisciplines.map((discipline) => (
                  <span
                    key={discipline}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500"
                  >
                    {discipline}
                  </span>
                ))}
              </div>
            </div>

            {(organSystemName || topicName || syndromeName) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Curriculum path
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
                  <span>{organSystemName || '—'}</span>
                  {topicName && <ChevronDown size={12} className="-rotate-90 text-slate-300" />}
                  {topicName && <span>{topicName}</span>}
                  {syndromeName && <ChevronDown size={12} className="-rotate-90 text-slate-300" />}
                  {syndromeName && <span className="text-[#0f9d63]">{syndromeName}</span>}
                </div>
              </div>
            )}

            <div className="mt-auto space-y-2">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full transition ${
                      item.done
                        ? 'bg-[#1BD183] text-white'
                        : 'border border-slate-300 bg-white text-transparent'
                    }`}
                  >
                    <Check size={12} />
                  </span>
                  <span
                    className={`text-xs font-bold ${item.done ? 'text-slate-700' : 'text-slate-400'}`}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-7 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="rounded-xl px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>

          {mode === 'manual' ? (
            <button
              type="submit"
              form="course-objective-form"
              disabled={isSubmitting || !canSubmitManual}
              className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#1BD183]/20 transition hover:shadow-xl hover:shadow-[#1BD183]/30 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Check size={16} /> Create &amp; attach
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveGenerated}
              disabled={!generated || isSavingGenerated}
              className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1BA6D1] to-[#1BD183] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#1BD183]/20 transition hover:shadow-xl hover:shadow-[#1BD183]/30 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
            >
              {isSavingGenerated ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check size={16} /> Create &amp; attach
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default CreateCourseObjectiveModal;
