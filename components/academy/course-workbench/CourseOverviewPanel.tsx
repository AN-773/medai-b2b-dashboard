import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Layers,
  Library,
  Lock,
  Pencil,
  Sparkles,
  Target,
  Unlock,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import { Badge, Button, ProgressBar, cn } from '@/components/ui';
import type { WorkbenchTab } from '@/components/academy/courses/CourseStepNav';
import { getCourseObjectiveCount } from './shared';

interface CourseOverviewPanelProps {
  course: TeacherCourse;
  cohortsUsingCourse: TeacherCohort[];
  learnerCount: number;
  pendingSuggestions: number;
  onNavigate: (tab: WorkbenchTab) => void;
  onReviewSuggestions: () => void;
  onEditDetails: () => void;
}

interface OutlineStats {
  modules: number;
  sessions: number;
}

const plural = (count: number, word: string) =>
  `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

interface StepCardProps {
  step: number;
  title: string;
  icon: LucideIcon;
  done: boolean;
  figure: React.ReactNode;
  detail: React.ReactNode;
  children?: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
}

const StepCard: React.FC<StepCardProps> = ({
  step,
  title,
  icon: Icon,
  done,
  figure,
  detail,
  children,
  actionLabel,
  onAction,
}) => (
  <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-card">
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
          done ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-500 ring-1 ring-inset ring-stone-200',
        )}
      >
        {done ? <Check size={13} strokeWidth={3} /> : step}
      </span>
      <span className="text-sm font-medium text-stone-700">{title}</span>
      <Icon size={16} className="ml-auto text-stone-300" />
    </div>
    <div className="mt-4 text-[28px] font-semibold leading-none tracking-[-0.02em] text-stone-900 tabular-nums">
      {figure}
    </div>
    <div className="mt-2 min-h-[20px] text-[13px] text-stone-500">{detail}</div>
    {children}
    <button
      type="button"
      onClick={onAction}
      className="group mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-stone-700 transition hover:text-stone-950"
    >
      {actionLabel}
      <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
    </button>
  </div>
);

/** The course home: where the course stands and the single next thing to do. */
const CourseOverviewPanel: React.FC<CourseOverviewPanelProps> = ({
  course,
  cohortsUsingCourse,
  learnerCount,
  pendingSuggestions,
  onNavigate,
  onReviewSuggestions,
  onEditDetails,
}) => {
  const navigate = useNavigate();
  const [outline, setOutline] = useState<OutlineStats | null>(null);
  const [outlineFailed, setOutlineFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setOutline(null);
    setOutlineFailed(false);
    void Promise.all([
      academyStudioBackend.listCourseModules(course),
      academyStudioBackend.listCourseSessions(course),
    ])
      .then(([modules, sessions]) => {
        if (active) setOutline({ modules: modules.length, sessions: sessions.length });
      })
      .catch((error) => {
        console.error('Failed to load the course outline summary:', error);
        if (active) setOutlineFailed(true);
      });
    return () => {
      active = false;
    };
    // Only refetch when the course itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id]);

  const objectiveCount = getCourseObjectiveCount(course);
  // Coverage is only trustworthy once the objectives (with item totals) are loaded.
  const coverage = useMemo(() => {
    if (!course.learningObjectivesLoaded) return null;
    const total = course.learningObjectives.length;
    const covered = course.learningObjectives.filter(
      (objective) => (objective.itemTotals?.total ?? 0) > 0,
    ).length;
    return { total, covered, missing: total - covered };
  }, [course.learningObjectives, course.learningObjectivesLoaded]);

  const objectivesDone = objectiveCount > 0 && pendingSuggestions === 0;
  const contentDone = Boolean(coverage && coverage.total > 0 && coverage.missing === 0);
  const modulesDone = Boolean(outline && outline.sessions > 0);

  const nextStep: {
    title: string;
    description: string;
    action?: { label: string; onClick: () => void; ai?: boolean };
  } = (() => {
    if (objectiveCount === 0) {
      return {
        title: 'Start with learning objectives',
        description:
          'Objectives define what this course teaches. Add them from the curriculum catalog, or let AI propose them from your slides and notes.',
        action: { label: 'Add objectives', onClick: () => onNavigate('objectives') },
      };
    }
    if (pendingSuggestions > 0) {
      return {
        title: `Review ${plural(pendingSuggestions, 'suggested objective')}`,
        description: 'AI proposed these from your uploaded sources. Nothing is added to the course until you accept it.',
        action: { label: 'Review suggestions', onClick: onReviewSuggestions, ai: true },
      };
    }
    if (coverage && coverage.missing > 0) {
      return {
        title: `${plural(coverage.missing, 'objective')} ${coverage.missing === 1 ? 'has' : 'have'} no practice content`,
        description: 'Author MCQs, SAQs, flashcards or lectures for them — by hand, or drafted by AI for you to review.',
        action: { label: 'Build content', onClick: () => onNavigate('content') },
      };
    }
    if (outline && outline.sessions === 0) {
      return {
        title: 'Organize content into modules',
        description: 'Modules and sessions are the outline learners follow. Group your items into sessions, or let AI draft the outline.',
        action: { label: 'Open modules', onClick: () => onNavigate('sessions') },
      };
    }
    if (outline && cohortsUsingCourse.length === 0) {
      return {
        title: 'Assign this course to a cohort',
        description: 'The course is built. Attach it to a cohort so learners can start.',
        action: { label: 'Go to cohorts', onClick: () => navigate('/cohorts') },
      };
    }
    return {
      title: 'This course is ready',
      description: 'Objectives, content and modules are in place. Keep refining as you go.',
    };
  })();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-stone-200 bg-stone-50/70 px-5 py-4">
        <span
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
            nextStep.action ? 'bg-white text-stone-700 shadow-card ring-1 ring-stone-200' : 'bg-brand-500 text-white',
          )}
        >
          {nextStep.action ? <ArrowRight size={17} /> : <Check size={17} strokeWidth={2.5} />}
        </span>
        <div className="min-w-[min(100%,16rem)] flex-1">
          <p className="text-xs font-medium text-stone-500">{nextStep.action ? 'Next step' : 'All set'}</p>
          <p className="text-[15px] font-semibold text-stone-900">{nextStep.title}</p>
          <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-stone-500">{nextStep.description}</p>
        </div>
        {nextStep.action && (
          <Button
            variant={nextStep.action.ai ? 'ai' : 'primary'}
            icon={nextStep.action.ai ? Sparkles : undefined}
            onClick={nextStep.action.onClick}
          >
            {nextStep.action.label}
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StepCard
          step={1}
          title="Objectives"
          icon={Target}
          done={objectivesDone}
          figure={objectiveCount.toLocaleString()}
          detail={
            pendingSuggestions > 0 ? (
              <Badge tone="amber" dot>
                {plural(pendingSuggestions, 'suggestion')} to review
              </Badge>
            ) : objectiveCount > 0 ? (
              'learning objectives'
            ) : (
              'None yet'
            )
          }
          actionLabel="Manage objectives"
          onAction={() => onNavigate('objectives')}
        />
        <StepCard
          step={2}
          title="Content"
          icon={Library}
          done={contentDone}
          figure={
            coverage && coverage.total > 0
              ? `${Math.round((coverage.covered / coverage.total) * 100)}%`
              : '—'
          }
          detail={
            !coverage
              ? 'Loading coverage…'
              : coverage.total === 0
                ? 'Add objectives first'
                : `${coverage.covered.toLocaleString()} of ${plural(coverage.total, 'objective')} have items`
          }
          actionLabel="Build content"
          onAction={() => onNavigate('content')}
        >
          {coverage && coverage.total > 0 && (
            <ProgressBar
              value={coverage.covered}
              max={coverage.total}
              className="mt-3"
              label="Objectives with content"
            />
          )}
        </StepCard>
        <StepCard
          step={3}
          title="Modules"
          icon={Layers}
          done={modulesDone}
          figure={outline ? outline.modules.toLocaleString() : '—'}
          detail={
            outlineFailed
              ? "Couldn't load the outline"
              : outline
                ? `${plural(outline.modules, 'module')} · ${plural(outline.sessions, 'session')}`
                : 'Loading outline…'
          }
          actionLabel="Open outline"
          onAction={() => onNavigate('sessions')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-stone-900">About this course</h2>
            <Button variant="ghost" size="sm" icon={Pencil} onClick={onEditDetails}>
              Edit
            </Button>
          </div>
          <p className={cn('mt-2 text-sm leading-6', course.summary ? 'text-stone-700' : 'text-stone-400')}>
            {course.summary || 'No summary yet.'}
          </p>
          <div className="mt-4 flex items-start gap-3 border-t border-stone-100 pt-4">
            <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
              {course.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </span>
            <div>
              <p className="text-sm font-medium text-stone-900">
                {course.locked ? 'Content is locked' : 'Content is unlocked'}
              </p>
              <p className="text-[13px] text-stone-500">
                {course.locked
                  ? 'Learners only get items linked to this course’s objectives.'
                  : 'Study plan sessions can fall back to AI-generated content.'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-stone-900">Cohorts</h2>
            {learnerCount > 0 && (
              <span className="text-[13px] text-stone-500">{plural(learnerCount, 'learner')}</span>
            )}
          </div>
          {cohortsUsingCourse.length === 0 ? (
            <div className="mt-3 flex flex-col items-start gap-2">
              <p className="text-sm text-stone-500">Not assigned to a cohort yet.</p>
              <Button variant="secondary" size="sm" icon={UsersRound} onClick={() => navigate('/cohorts')}>
                Go to cohorts
              </Button>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-stone-100">
              {cohortsUsingCourse.map((cohort) => (
                <li key={cohort.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900">{cohort.title}</p>
                    <p className="text-xs text-stone-500">{cohort.term || 'No term'}</p>
                  </div>
                  <span className="flex-shrink-0 text-[13px] tabular-nums text-stone-500">
                    {plural(cohort.studentIds.length, 'student')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default CourseOverviewPanel;
