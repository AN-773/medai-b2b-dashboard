import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  FileText,
  Layers3,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import AICoursePreviewModal from '@/components/academy/AICoursePreviewModal';
import { academyStudioService } from '@/services/academyStudioService';
import {
  TeacherCohort,
  TeacherCourse,
  TeacherLearningObjective,
  TeacherStudent,
} from '@/types/AcademyStudioTypes';
import { BloomsLevel, OrganSystem } from '@/types';

type SetupStep = 1 | 2 | 3 | 4 | 5;

interface StudioStep {
  number: SetupStep;
  label: string;
  track: 'Cohort' | 'Course';
  icon: LucideIcon;
  description: string;
}

interface StepFooterProps {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  hint?: string;
  completeLabel?: string;
}

const panelClass =
  'rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm';
const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10';
const textareaClass = `${inputClass} min-h-[120px] resize-none`;

const emptyCohortForm = {
  title: '',
  term: '',
  description: '',
};

const emptyCourseForm = {
  title: '',
  code: '',
  summary: '',
};

const emptyObjectiveForm = {
  title: '',
  organSystem: '',
  cognitiveSkill: '',
};

const studioSteps: StudioStep[] = [
  {
    number: 1,
    label: 'Cohort Basics',
    track: 'Cohort',
    icon: Layers3,
    description: 'Create or select the teaching group first.',
  },
  {
    number: 2,
    label: 'Students',
    track: 'Cohort',
    icon: Users,
    description: 'Pull learners in from the teacher registry.',
  },
  {
    number: 3,
    label: 'Courses',
    track: 'Cohort',
    icon: BookOpen,
    description: 'Create reusable course shells and assign them.',
  },
  {
    number: 4,
    label: 'Objectives',
    track: 'Course',
    icon: Target,
    description: 'Work inside one selected course at a time.',
  },
  {
    number: 5,
    label: 'AI Content',
    track: 'Course',
    icon: Upload,
    description: 'Upload a PDF and save AI-generated module shells.',
  },
];

const StepFooter: React.FC<StepFooterProps> = ({
  onBack,
  onNext,
  backLabel = 'Back',
  nextLabel = 'Next',
  nextDisabled,
  hint,
  completeLabel = 'This step is ready',
}) => (
  <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm font-medium text-slate-500">
      {hint || 'Follow the steps in order for the cleanest setup flow.'}
    </p>

    <div className="flex items-center gap-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <ArrowLeft size={15} />
          {backLabel}
        </button>
      ) : (
        <div />
      )}

      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#16324F] px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {nextLabel}
          <ArrowRight size={15} />
        </button>
      ) : (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">
          {completeLabel}
        </div>
      )}
    </div>
  </div>
);

const formatSelectionLabel = (
  cohort: TeacherCohort | null,
  course: TeacherCourse | null,
) => {
  if (!cohort || !course) return 'No course selected yet';

  const selection = cohort.courseSelections.find(
    (entry) => entry.courseId === course.id,
  );

  if (!selection) return 'Full course mode';
  return `${selection.learningObjectiveIds.length}/${course.learningObjectives.length} selected`;
};

const CohortStudioView: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<SetupStep>(1);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [cohortForm, setCohortForm] = useState(emptyCohortForm);
  const [newCohortForm, setNewCohortForm] = useState(emptyCohortForm);
  const [newCourseForm, setNewCourseForm] = useState(emptyCourseForm);
  const [courseDraft, setCourseDraft] = useState(emptyCourseForm);
  const [objectiveForm, setObjectiveForm] = useState(emptyObjectiveForm);
  const [studentSearch, setStudentSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const loadStudio = () => {
    setStudents(academyStudioService.getStudents());
    setCourses(academyStudioService.getCourses());
    setCohorts(academyStudioService.getCohorts());
  };

  useEffect(() => {
    loadStudio();
  }, []);

  useEffect(() => {
    if (!cohorts.length) {
      setSelectedCohortId(null);
      return;
    }

    if (
      !selectedCohortId ||
      !cohorts.some((cohort) => cohort.id === selectedCohortId)
    ) {
      setSelectedCohortId(cohorts[0].id);
    }
  }, [cohorts, selectedCohortId]);

  const selectedCohort =
    cohorts.find((cohort) => cohort.id === selectedCohortId) || null;

  useEffect(() => {
    if (!selectedCohort) {
      setCohortForm(emptyCohortForm);
      return;
    }

    setCohortForm({
      title: selectedCohort.title,
      term: selectedCohort.term,
      description: selectedCohort.description,
    });
  }, [selectedCohort]);

  useEffect(() => {
    if (!selectedCohort || selectedCohort.courseIds.length === 0) {
      setSelectedCourseId(null);
      return;
    }

    if (
      !selectedCourseId ||
      !selectedCohort.courseIds.includes(selectedCourseId)
    ) {
      setSelectedCourseId(selectedCohort.courseIds[0]);
    }
  }, [selectedCohort, selectedCourseId]);

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) || null;
  const selectedCourseAssigned = Boolean(
    selectedCourse && selectedCohort?.courseIds.includes(selectedCourse.id),
  );

  useEffect(() => {
    if (!selectedCourseAssigned && step > 3) {
      setStep(3);
      return;
    }

    if (!selectedCohort && step > 1) {
      setStep(1);
    }
  }, [selectedCohort, selectedCourseAssigned, step]);

  useEffect(() => {
    if (!selectedCourse) {
      setCourseDraft(emptyCourseForm);
      setObjectiveForm(emptyObjectiveForm);
      return;
    }

    setCourseDraft({
      title: selectedCourse.title,
      code: selectedCourse.code,
      summary: selectedCourse.summary,
    });
    setObjectiveForm(emptyObjectiveForm);
  }, [selectedCourse]);

  const assignedCourseIds = selectedCohort?.courseIds || [];
  const assignedCourses = courses.filter((course) =>
    assignedCourseIds.includes(course.id),
  );
  const selectedCourseSelection = selectedCohort?.courseSelections.find(
    (selection) => selection.courseId === selectedCourse?.id,
  );
  const selectedObjectiveIds = new Set(
    selectedCourseSelection?.learningObjectiveIds || [],
  );
  const isCustomMode = Boolean(selectedCourseSelection);

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) =>
      [student.name, student.email, student.program, student.learnerCode]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [studentSearch, students]);

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    if (!query) return courses;

    return courses.filter((course) =>
      [course.title, course.code, course.summary]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [courseSearch, courses]);

  const currentStep = studioSteps.find((entry) => entry.number === step)!;

  const canOpenStep = (nextStep: SetupStep) => {
    if (nextStep === 1) return true;
    if (nextStep === 2 || nextStep === 3) return Boolean(selectedCohort);
    return selectedCourseAssigned;
  };

  const saveCohortRecord = (cohort: TeacherCohort) => {
    academyStudioService.saveCohort(cohort);
    loadStudio();
    setSelectedCohortId(cohort.id);
  };

  const saveCourseRecord = (course: TeacherCourse) => {
    academyStudioService.saveCourse(course);
    loadStudio();
    setSelectedCourseId(course.id);
  };

  const updateCourseSelection = (
    courseId: string,
    learningObjectiveIds: string[],
  ) => {
    if (!selectedCohort) return;

    const uniqueIds = Array.from(new Set(learningObjectiveIds));
    const remainingSelections = selectedCohort.courseSelections.filter(
      (selection) => selection.courseId !== courseId,
    );
    const nextSelections =
      uniqueIds.length === 0
        ? remainingSelections
        : [...remainingSelections, { courseId, learningObjectiveIds: uniqueIds }];

    saveCohortRecord({
      ...selectedCohort,
      courseSelections: nextSelections,
    });
  };

  const handleCreateCohort = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newCohortForm.title.trim()) return;

    const nextId = academyStudioService.makeId('cohort');
    academyStudioService.saveCohort({
      id: nextId,
      title: newCohortForm.title.trim(),
      term: newCohortForm.term.trim(),
      description: newCohortForm.description.trim(),
      studentIds: [],
      courseIds: [],
      courseSelections: [],
    });

    setNewCohortForm(emptyCohortForm);
    setSelectedCohortId(nextId);
    setStep(2);
    setWorkspaceMessage(
      'Cohort created. Step 2 is ready, so you can attach students next.',
    );
    loadStudio();
  };

  const handleSaveCohortDetails = () => {
    if (!selectedCohort || !cohortForm.title.trim()) return;

    saveCohortRecord({
      ...selectedCohort,
      title: cohortForm.title.trim(),
      term: cohortForm.term.trim(),
      description: cohortForm.description.trim(),
    });
    setWorkspaceMessage('Cohort details saved.');
  };

  const handleDeleteCohort = () => {
    if (!selectedCohort) return;
    if (!window.confirm(`Delete cohort "${selectedCohort.title}"?`)) return;

    academyStudioService.removeCohort(selectedCohort.id);
    setWorkspaceMessage(null);
    setStep(1);
    loadStudio();
  };

  const handleToggleStudent = (studentId: string) => {
    if (!selectedCohort) return;

    const isAssigned = selectedCohort.studentIds.includes(studentId);
    const nextStudentIds = isAssigned
      ? selectedCohort.studentIds.filter((id) => id !== studentId)
      : [...selectedCohort.studentIds, studentId];

    saveCohortRecord({
      ...selectedCohort,
      studentIds: nextStudentIds,
    });
  };

  const handleCreateCourse = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newCourseForm.title.trim()) return;

    const nextId = academyStudioService.makeId('course');
    academyStudioService.saveCourse({
      id: nextId,
      title: newCourseForm.title.trim(),
      code: newCourseForm.code.trim(),
      summary: newCourseForm.summary.trim(),
      learningObjectives: [],
      sourceFiles: [],
      modules: [],
    });

    if (selectedCohort) {
      saveCohortRecord({
        ...selectedCohort,
        courseIds: Array.from(new Set([...selectedCohort.courseIds, nextId])),
      });
    } else {
      loadStudio();
    }

    setNewCourseForm(emptyCourseForm);
    setSelectedCourseId(nextId);
    setStep(4);
    setWorkspaceMessage(
      'Course created and attached. You are now in the course objective step.',
    );
  };

  const handleToggleCourse = (courseId: string) => {
    if (!selectedCohort) return;

    const isAssigned = selectedCohort.courseIds.includes(courseId);
    const nextCourseIds = isAssigned
      ? selectedCohort.courseIds.filter((id) => id !== courseId)
      : [...selectedCohort.courseIds, courseId];
    const nextSelections = selectedCohort.courseSelections.filter(
      (selection) => nextCourseIds.includes(selection.courseId),
    );

    saveCohortRecord({
      ...selectedCohort,
      courseIds: nextCourseIds,
      courseSelections: nextSelections,
    });

    if (!isAssigned) {
      setSelectedCourseId(courseId);
    }
  };

  const handleOpenCourseBuilder = (courseId: string) => {
    setSelectedCourseId(courseId);
    setStep(4);
  };

  const handleSaveCourseDetails = () => {
    if (!selectedCourse || !courseDraft.title.trim()) return;

    saveCourseRecord({
      ...selectedCourse,
      title: courseDraft.title.trim(),
      code: courseDraft.code.trim(),
      summary: courseDraft.summary.trim(),
    });
    setWorkspaceMessage(
      'Course shell updated. These changes follow the course anywhere it is reused.',
    );
  };

  const handleAddObjective = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourse || !objectiveForm.title.trim()) return;

    const objectiveId = academyStudioService.makeId('lo');
    academyStudioService.appendCourseLearningObjective(selectedCourse.id, {
      id: objectiveId,
      title: objectiveForm.title.trim(),
      organSystem: objectiveForm.organSystem || undefined,
      cognitiveSkill: objectiveForm.cognitiveSkill || undefined,
      source: 'manual',
    });

    if (selectedCohort && isCustomMode) {
      updateCourseSelection(selectedCourse.id, [
        ...selectedObjectiveIds,
        objectiveId,
      ]);
    } else {
      loadStudio();
    }

    setObjectiveForm(emptyObjectiveForm);
    setWorkspaceMessage('Learning objective added to the course.');
  };

  const handleRemoveObjective = (objective: TeacherLearningObjective) => {
    if (!selectedCourse) return;
    if (
      !window.confirm(`Delete "${objective.title}" from ${selectedCourse.title}?`)
    ) {
      return;
    }

    academyStudioService.removeCourseLearningObjective(
      selectedCourse.id,
      objective.id,
    );
    loadStudio();
    setWorkspaceMessage('Learning objective removed from the course.');
  };

  const handleEnableCustomMode = () => {
    if (!selectedCourse || !selectedCohort) return;
    if (selectedCourse.learningObjectives.length === 0) {
      setWorkspaceMessage(
        'Add at least one learning objective before curating a cohort-specific subset.',
      );
      return;
    }

    updateCourseSelection(
      selectedCourse.id,
      selectedCourse.learningObjectives.map((objective) => objective.id),
    );
    setWorkspaceMessage('Custom cohort selection enabled for this course.');
  };

  const handleDisableCustomMode = () => {
    if (!selectedCourse) return;
    updateCourseSelection(selectedCourse.id, []);
    setWorkspaceMessage('This cohort is back on full course mode.');
  };

  const handleToggleObjectiveSelection = (objectiveId: string) => {
    if (!selectedCourse || !isCustomMode) return;

    const nextIds = new Set(selectedObjectiveIds);
    if (nextIds.has(objectiveId)) {
      nextIds.delete(objectiveId);
    } else {
      nextIds.add(objectiveId);
    }

    if (nextIds.size === 0) {
      handleDisableCustomMode();
      return;
    }

    updateCourseSelection(selectedCourse.id, Array.from(nextIds));
  };

  const handleSaveAiDraft = (
    sourceFile: TeacherCourse['sourceFiles'][number],
    modules: TeacherCourse['modules'],
  ) => {
    if (!selectedCourse) return;

    academyStudioService.saveCourseContentDraft(
      selectedCourse.id,
      sourceFile,
      modules,
    );
    setAiModalOpen(false);
    loadStudio();
    setWorkspaceMessage(
      'AI course preview saved. The PDF and module shells are now attached to the course.',
    );
  };

  return (
    <>
      <div className="teacher-readable space-y-6">
        <div className="rounded-[2.5rem] border border-slate-900 bg-[#101311] p-6 text-white shadow-xl xl:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.95fr] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                Guided setup
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white xl:text-4xl">
                Build cohorts in simple steps
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-medium text-slate-300 xl:text-base">
                Steps 1 to 3 are the cohort setup track. Steps 4 and 5 are the
                course-building track, so teachers only work on one course at a
                time after the cohort is ready.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Active cohort
                </p>
                <p className="mt-3 text-lg font-black text-white">
                  {selectedCohort?.title || 'Choose in step 1'}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Course builder
                </p>
                <p className="mt-3 text-lg font-black text-white">
                  {selectedCourseAssigned ? selectedCourse?.title : 'Pick in step 3'}
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                  Current step
                </p>
                <p className="mt-3 text-lg font-black text-white">
                  {currentStep.label}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 overflow-x-auto rounded-[2rem] border border-slate-200 bg-white px-4 py-6 shadow-sm xl:px-10">
          {studioSteps.map((entry, index) => {
            const Icon = entry.icon;
            const isCompleted = step > entry.number;
            const isActive = step === entry.number;
            const isEnabled = canOpenStep(entry.number);

            return (
              <React.Fragment key={entry.number}>
                <button
                  type="button"
                  onClick={() => {
                    if (isEnabled) {
                      setStep(entry.number);
                    }
                  }}
                  disabled={!isEnabled}
                  className="group flex min-w-[100px] flex-col items-center gap-3 disabled:cursor-not-allowed"
                >
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100'
                        : isActive
                          ? 'bg-[#16324F] text-white shadow-xl shadow-slate-200'
                          : isEnabled
                            ? 'border border-slate-200 bg-slate-50 text-slate-400'
                            : 'border border-slate-200 bg-slate-50 text-slate-300 opacity-60'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={22} /> : <Icon size={22} />}
                  </div>

                  <div className="text-center">
                    <p
                      className={`text-[9px] font-black uppercase tracking-[0.24em] ${
                        isActive ? 'text-[#1BD183]' : 'text-slate-400'
                      }`}
                    >
                      {entry.track}
                    </p>
                    <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
                      {entry.label}
                    </p>
                  </div>
                </button>
                {index < studioSteps.length - 1 && (
                  <div
                    className={`h-px min-w-[24px] flex-1 ${
                      step > entry.number ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                {currentStep.track} track
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                Step {currentStep.number}: {currentStep.label}
              </h3>
              <p className="mt-2 text-sm font-medium text-slate-500">
                {currentStep.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                {cohorts.length} cohorts
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                {selectedCohort?.studentIds.length || 0} students in active cohort
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                {assignedCourses.length} cohort courses
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                {formatSelectionLabel(selectedCohort, selectedCourse)}
              </span>
            </div>
          </div>

          {workspaceMessage && (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {workspaceMessage}
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
            <div className={panelClass}>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                Existing cohorts
              </p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                Start from a saved cohort or create a new one
              </h3>

              <div className="mt-5 space-y-3">
                {cohorts.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    No cohorts yet. Create the first cohort on the right.
                  </div>
                ) : (
                  cohorts.map((cohort) => (
                    <button
                      key={cohort.id}
                      type="button"
                      onClick={() => setSelectedCohortId(cohort.id)}
                      className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                        cohort.id === selectedCohortId
                          ? 'border-[#1BD183] bg-emerald-50 ring-2 ring-[#1BD183]/10'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-black text-slate-900">{cohort.title}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {cohort.term || 'No term'}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-500">
                        {cohort.studentIds.length} students · {cohort.courseIds.length} courses
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6">
              <form onSubmit={handleCreateCohort} className={panelClass}>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-900 p-3 text-white">
                    <Plus size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Create cohort
                    </p>
                    <h3 className="text-xl font-black tracking-tight text-slate-900">
                      Step 1 starts with a simple cohort shell
                    </h3>
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <input
                    value={newCohortForm.title}
                    onChange={(event) =>
                      setNewCohortForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Cohort title"
                    className={inputClass}
                  />
                  <input
                    value={newCohortForm.term}
                    onChange={(event) =>
                      setNewCohortForm((current) => ({
                        ...current,
                        term: event.target.value,
                      }))
                    }
                    placeholder="Term or intake"
                    className={inputClass}
                  />
                  <textarea
                    value={newCohortForm.description}
                    onChange={(event) =>
                      setNewCohortForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Short description"
                    className={textareaClass}
                  />
                </div>

                <button
                  type="submit"
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-slate-800"
                >
                  <Plus size={15} />
                  Create cohort and continue
                </button>
              </form>

              {selectedCohort && (
                <div className={panelClass}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                        Edit selected cohort
                      </p>
                      <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                        {selectedCohort.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={handleDeleteCohort}
                      className="rounded-2xl border border-rose-200 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-rose-600 transition hover:bg-rose-50"
                    >
                      Delete cohort
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4">
                    <input
                      value={cohortForm.title}
                      onChange={(event) =>
                        setCohortForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Cohort title"
                      className={inputClass}
                    />
                    <input
                      value={cohortForm.term}
                      onChange={(event) =>
                        setCohortForm((current) => ({
                          ...current,
                          term: event.target.value,
                        }))
                      }
                      placeholder="Term or intake"
                      className={inputClass}
                    />
                    <textarea
                      value={cohortForm.description}
                      onChange={(event) =>
                        setCohortForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Description"
                      className={textareaClass}
                    />
                  </div>

                  <StepFooter
                    onNext={() => setStep(2)}
                    onBack={undefined}
                    nextDisabled={!selectedCohort}
                    nextLabel="Next: Students"
                    hint="Once the cohort shell exists, you can start pulling in students."
                  />

                  <button
                    type="button"
                    onClick={handleSaveCohortDetails}
                    className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[#16324F] px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:-translate-y-0.5"
                  >
                    <Check size={15} />
                    Save details
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && selectedCohort && (
          <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
            <div className="space-y-6">
              <div className={panelClass}>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-900 p-3 text-white">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Active cohort
                    </p>
                    <h3 className="text-xl font-black tracking-tight text-slate-900">
                      {selectedCohort.title}
                    </h3>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Students assigned
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                      {selectedCohort.studentIds.length}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Available in registry
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                      {students.length}
                    </p>
                  </div>
                </div>

                {students.length === 0 && (
                  <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-800">
                      No students are available yet.
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      Add them from the separate Student Registry page first, then return here.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/students')}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-slate-800"
                    >
                      Open Student Registry
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-[#101311] p-6 text-white shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Why this step is separate
                </p>
                <h3 className="mt-2 text-lg font-black tracking-tight text-white">
                  Student intake happens before course planning
                </h3>
                <p className="mt-3 text-sm font-medium text-slate-300">
                  Teachers first build a clean registry, then choose exactly
                  which learners belong to each cohort.
                </p>
              </div>
            </div>

            <div className={panelClass}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Student picker
                  </p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                    Add students to the selected cohort
                  </h3>
                </div>

                <div className="relative w-full max-w-md">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Search registry students"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10"
                  />
                </div>
              </div>

              <div className="mt-6 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {students.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    Student selection becomes available after the registry is populated.
                  </div>
                ) : (
                  filteredStudents.map((student) => {
                    const isAssigned = selectedCohort.studentIds.includes(
                      student.id,
                    );
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleToggleStudent(student.id)}
                        className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                          isAssigned
                            ? 'border-[#1BD183] bg-emerald-50 ring-2 ring-[#1BD183]/10'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-900">
                              {student.name}
                            </p>
                            <p className="mt-1 text-xs font-medium text-slate-500">
                              {student.email}
                            </p>
                            <p className="mt-3 text-sm font-medium text-slate-500">
                              {student.program || 'No program'} · {student.learnerCode}
                            </p>
                          </div>

                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              isAssigned
                                ? 'bg-[#1BD183] text-white'
                                : 'bg-white text-slate-300'
                            }`}
                          >
                            <Check size={15} />
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <StepFooter
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                backLabel="Back: Cohort"
                nextLabel="Next: Courses"
                hint="You can move on even if the cohort is still empty, but this is the place to build the student list."
              />
            </div>
          </div>
        )}

        {step === 3 && selectedCohort && (
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <div className="space-y-6">
              <form onSubmit={handleCreateCourse} className={panelClass}>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-900 p-3 text-white">
                    <Plus size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Create course
                    </p>
                    <h3 className="text-xl font-black tracking-tight text-slate-900">
                      New reusable course shell
                    </h3>
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <input
                    value={newCourseForm.title}
                    onChange={(event) =>
                      setNewCourseForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Course title"
                    className={inputClass}
                  />
                  <input
                    value={newCourseForm.code}
                    onChange={(event) =>
                      setNewCourseForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder="Course code"
                    className={inputClass}
                  />
                  <textarea
                    value={newCourseForm.summary}
                    onChange={(event) =>
                      setNewCourseForm((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                    placeholder="Short summary"
                    className={textareaClass}
                  />
                </div>

                <button
                  type="submit"
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-slate-800"
                >
                  <Plus size={15} />
                  Create course and open builder
                </button>
              </form>

              <div className={panelClass}>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Cohort courses
                </p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                  Courses already attached
                </h3>

                <div className="mt-5 flex flex-wrap gap-2">
                  {assignedCourses.length === 0 ? (
                    <span className="rounded-full bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-500">
                      No courses attached yet
                    </span>
                  ) : (
                    assignedCourses.map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => handleOpenCourseBuilder(course.id)}
                        className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] transition ${
                          selectedCourseId === course.id
                            ? 'bg-[#16324F] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {course.title}
                      </button>
                    ))
                  )}
                </div>

                <StepFooter
                  onBack={() => setStep(2)}
                  onNext={() => setStep(4)}
                  backLabel="Back: Students"
                  nextLabel="Next: Objectives"
                  nextDisabled={!selectedCourseAssigned}
                  hint="Attach at least one course before moving into the course builder."
                />
              </div>
            </div>

            <div className={panelClass}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Course library
                  </p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                    Attach reusable courses to this cohort
                  </h3>
                </div>

                <div className="relative w-full max-w-md">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={courseSearch}
                    onChange={(event) => setCourseSearch(event.target.value)}
                    placeholder="Search courses"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10"
                  />
                </div>
              </div>

              <div className="mt-6 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {courses.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    No courses exist yet. Create one from the form on the left.
                  </div>
                ) : (
                  filteredCourses.map((course) => {
                    const isAssigned = selectedCohort.courseIds.includes(
                      course.id,
                    );

                    return (
                      <div
                        key={course.id}
                        className={`rounded-[1.5rem] border px-4 py-4 transition ${
                          isAssigned
                            ? 'border-[#1BD183] bg-emerald-50'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="font-black text-slate-900">
                              {course.title}
                            </p>
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                              {course.code || 'No code'}
                            </p>
                            <p className="mt-2 text-sm font-medium text-slate-500">
                              {course.summary || 'No summary yet'}
                            </p>
                            <p className="mt-3 text-sm font-medium text-slate-500">
                              {course.learningObjectives.length} objectives ·{' '}
                              {course.modules.length} modules
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCourse(course.id)}
                              className={`rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] transition ${
                                isAssigned
                                  ? 'border border-slate-200 bg-white text-slate-700'
                                  : 'bg-slate-900 text-white'
                              }`}
                            >
                              {isAssigned ? 'Remove' : 'Add'}
                            </button>

                            {isAssigned && (
                              <button
                                type="button"
                                onClick={() => handleOpenCourseBuilder(course.id)}
                                className="rounded-2xl bg-[#16324F] px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white transition hover:-translate-y-0.5"
                              >
                                Build
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {step === 4 && selectedCohort && selectedCourse && selectedCourseAssigned && (
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <div className={panelClass}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Course builder
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                      Work inside one cohort course at a time
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCourseDetails}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-slate-800"
                  >
                    Save course
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {assignedCourses.map((course) => (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => setSelectedCourseId(course.id)}
                      className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] transition ${
                        selectedCourseId === course.id
                          ? 'bg-[#16324F] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {course.title}
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-4">
                  <input
                    value={courseDraft.title}
                    onChange={(event) =>
                      setCourseDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Course title"
                    className={inputClass}
                  />
                  <input
                    value={courseDraft.code}
                    onChange={(event) =>
                      setCourseDraft((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    placeholder="Course code"
                    className={inputClass}
                  />
                  <textarea
                    value={courseDraft.summary}
                    onChange={(event) =>
                      setCourseDraft((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                    placeholder="Course summary"
                    className={textareaClass}
                  />
                </div>
              </div>

              <div className={panelClass}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Cohort delivery mode
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                      Full course or curated subset
                    </h3>
                  </div>

                  <div className="flex gap-2 rounded-[1.5rem] bg-slate-100 p-1.5">
                    <button
                      type="button"
                      onClick={handleDisableCustomMode}
                      className={`rounded-[1.25rem] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] transition ${
                        !isCustomMode
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      Full course
                    </button>
                    <button
                      type="button"
                      onClick={handleEnableCustomMode}
                      className={`rounded-[1.25rem] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] transition ${
                        isCustomMode
                          ? 'bg-[#16324F] text-white shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      Curate objectives
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-sm font-medium text-slate-500">
                  {isCustomMode
                    ? 'This cohort is using a selected subset for the active course.'
                    : 'This cohort currently inherits every objective attached to the active course.'}
                </p>
              </div>

              <div className={panelClass}>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-900 p-3 text-white">
                    <Target size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Learning objectives
                    </p>
                    <h3 className="text-xl font-black tracking-tight text-slate-900">
                      Add objectives, then curate if needed
                    </h3>
                  </div>
                </div>

                <form onSubmit={handleAddObjective} className="mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3">
                    <input
                      value={objectiveForm.title}
                      onChange={(event) =>
                        setObjectiveForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Learning objective title"
                      className={inputClass}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        value={objectiveForm.organSystem}
                        onChange={(event) =>
                          setObjectiveForm((current) => ({
                            ...current,
                            organSystem: event.target.value,
                          }))
                        }
                        className={inputClass}
                      >
                        <option value="">Organ system</option>
                        {Object.values(OrganSystem).map((organSystem) => (
                          <option key={organSystem} value={organSystem}>
                            {organSystem}
                          </option>
                        ))}
                      </select>

                      <select
                        value={objectiveForm.cognitiveSkill}
                        onChange={(event) =>
                          setObjectiveForm((current) => ({
                            ...current,
                            cognitiveSkill: event.target.value,
                          }))
                        }
                        className={inputClass}
                      >
                        <option value="">Bloom level</option>
                        {Object.values(BloomsLevel).map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-slate-800"
                  >
                    <Plus size={15} />
                    Add objective
                  </button>
                </form>

                <div className="mt-5 space-y-3">
                  {selectedCourse.learningObjectives.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                      No objectives yet. Add the first objective above.
                    </div>
                  ) : (
                    selectedCourse.learningObjectives.map((objective) => (
                      <div
                        key={objective.id}
                        className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {isCustomMode ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleObjectiveSelection(objective.id)
                                }
                                className={`mt-1 flex h-6 w-6 items-center justify-center rounded-md border transition ${
                                  selectedObjectiveIds.has(objective.id)
                                    ? 'border-[#1BD183] bg-[#1BD183] text-white'
                                    : 'border-slate-300 bg-white text-transparent'
                                }`}
                              >
                                <Check size={14} />
                              </button>
                            ) : (
                              <div className="mt-2 h-2.5 w-2.5 rounded-full bg-[#1BD183]" />
                            )}

                            <div>
                              <p className="font-black text-slate-900">
                                {objective.title}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {objective.organSystem && (
                                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    {objective.organSystem}
                                  </span>
                                )}
                                {objective.cognitiveSkill && (
                                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    {objective.cognitiveSkill}
                                  </span>
                                )}
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                                  {objective.source}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveObjective(objective)}
                            className="rounded-2xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <StepFooter
                onBack={() => setStep(3)}
                onNext={() => setStep(5)}
                backLabel="Back: Courses"
                nextLabel="Next: AI Content"
                hint="Once the objective set looks right, move to PDF upload and AI-generated modules."
              />
            </div>

            <div className="space-y-6">
              <div className={panelClass}>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Course snapshot
                </p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                  {selectedCourse.title}
                </h3>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Total objectives
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                      {selectedCourse.learningObjectives.length}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Cohort view
                    </p>
                    <p className="mt-2 text-lg font-black tracking-tight text-slate-900">
                      {formatSelectionLabel(selectedCohort, selectedCourse)}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      AI content
                    </p>
                    <p className="mt-2 text-lg font-black tracking-tight text-slate-900">
                      {selectedCourse.modules.length} modules ·{' '}
                      {selectedCourse.sourceFiles.length} PDFs
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-[#101311] p-6 text-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/10 p-3 text-[#1BD183]">
                    <BrainCircuit size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                      Shared course logic
                    </p>
                    <h3 className="text-lg font-black tracking-tight text-white">
                      Course edits are shared, cohort selections are not
                    </h3>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm font-medium text-slate-300">
                  <p>
                    Changing the course shell, objectives, or AI module drafts
                    updates the shared course record.
                  </p>
                  <p>
                    The objective selection mode only changes what this cohort
                    uses from the active course.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 5 && selectedCohort && selectedCourse && selectedCourseAssigned && (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <div className={panelClass}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      AI content builder
                    </p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                      Upload a PDF for the selected course
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAiModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#16324F] px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:-translate-y-0.5"
                  >
                    <Sparkles size={15} />
                    Open AI preview
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {assignedCourses.map((course) => (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => setSelectedCourseId(course.id)}
                      className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] transition ${
                        selectedCourseId === course.id
                          ? 'bg-[#16324F] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {course.title}
                    </button>
                  ))}
                </div>

                <div className="mt-6 rounded-[1.75rem] border border-dashed border-emerald-200 bg-emerald-50/50 p-5">
                  <p className="text-sm font-bold text-slate-800">
                    The PDF step comes after the objectives step on purpose.
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    The AI draft uses the course title and current learning
                    objectives to create editable module shells, similar to the
                    preview you shared.
                  </p>
                </div>
              </div>

              <div className={panelClass}>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-900 p-3 text-white">
                    <FileText size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Attached sources
                    </p>
                    <h3 className="text-xl font-black tracking-tight text-slate-900">
                      Uploaded PDFs for this course
                    </h3>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {selectedCourse.sourceFiles.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
                      No PDF uploaded yet for this course.
                    </div>
                  ) : (
                    selectedCourse.sourceFiles.map((file) => (
                      <div
                        key={file.id}
                        className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <p className="font-black text-slate-900">{file.name}</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {file.uploadedFileId
                            ? 'Uploaded to file service'
                            : 'Stored locally for this prototype'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <StepFooter
                onBack={() => setStep(4)}
                backLabel="Back: Objectives"
                hint="You can reopen this step at any time to upload a new source or refresh the generated outline."
                completeLabel="AI content step ready"
              />
            </div>

            <div className={panelClass}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-900 p-3 text-white">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Module preview
                  </p>
                  <h3 className="text-xl font-black tracking-tight text-slate-900">
                    Saved AI-generated structure
                  </h3>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {selectedCourse.modules.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
                    <p className="text-lg font-black text-slate-800">
                      No AI modules saved yet
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      Upload a PDF to generate the first editable module preview.
                    </p>
                  </div>
                ) : (
                  selectedCourse.modules.map((module, index) => (
                    <div
                      key={module.id}
                      className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-slate-900">
                          Module {index + 1}: {module.title}
                        </p>
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                          {module.objectives.length} objectives
                        </span>
                      </div>

                      <div className="mt-4 space-y-2 text-sm font-medium text-slate-600">
                        {module.objectives.map((objective) => (
                          <p key={`${module.id}-${objective}`}>{objective}</p>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <AICoursePreviewModal
        isOpen={aiModalOpen}
        course={selectedCourse}
        onClose={() => setAiModalOpen(false)}
        onSave={handleSaveAiDraft}
      />
    </>
  );
};

export default CohortStudioView;
