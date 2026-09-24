import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Check,
  Loader2,
  Pencil,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type {
  CohortStudyPlanJob,
  TeacherCohort,
  TeacherCourse,
} from '@/types/AcademyStudioTypes';
import { Badge, Button, ProgressBar, cn } from '@/components/ui';
import {
  PUBLISH_STATE_META,
  formatDate,
  formatDateRange,
  plural,
  relativeTime,
  type CohortPublishReadiness,
  type CohortPublishState,
} from './cohortModel';
import type { CohortTab } from './CohortTabs';

interface CohortOverviewPanelProps {
  cohort: TeacherCohort;
  assignedCourses: TeacherCourse[];
  readiness: CohortPublishReadiness;
  publishState: CohortPublishState;
  publishJob: CohortStudyPlanJob | null;
  onNavigate: (tab: CohortTab) => void;
  onAttachCourses: () => void;
  onPublish: () => void;
  onEditDetails: () => void;
}

interface NextStep {
  title: string;
  description: string;
  kind: 'todo' | 'busy' | 'done' | 'error';
  action?: { label: string; onClick: () => void };
}

const StatCard: React.FC<{
  title: string;
  icon: LucideIcon;
  figure: React.ReactNode;
  detail: React.ReactNode;
  children?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, icon: Icon, figure, detail, children, actionLabel, onAction }) => (
  <div className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-card">
    <div className="flex items-center gap-2.5">
      <span className="text-sm font-medium text-stone-700">{title}</span>
      <Icon size={16} className="ml-auto text-stone-300" aria-hidden="true" />
    </div>
    <div className="mt-4 text-[28px] font-semibold leading-none tracking-[-0.02em] text-stone-900 tabular-nums">
      {figure}
    </div>
    <div className="mt-2 min-h-[20px] text-[13px] text-stone-500">{detail}</div>
    {children}
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="group mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-stone-700 transition hover:text-stone-950"
      >
        {actionLabel}
        <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
      </button>
    )}
  </div>
);

/** The cohort home: what's missing before publishing, and the cohort at a glance. */
const CohortOverviewPanel: React.FC<CohortOverviewPanelProps> = ({
  cohort,
  assignedCourses,
  readiness,
  publishState,
  publishJob,
  onNavigate,
  onAttachCourses,
  onPublish,
  onEditDetails,
}) => {
  const curatedCount = cohort.courseSelections.filter((selection) =>
    cohort.courseIds.includes(selection.courseId),
  ).length;
  const fullCount = Math.max(0, assignedCourses.length - curatedCount);
  const courseIssues =
    readiness.missingObjectiveCourseCount + readiness.lockedCoursesMissingItemsCount;

  const nextStep: NextStep = (() => {
    if (publishState === 'publishing') {
      return {
        kind: 'busy',
        title: 'Generating study plans',
        description:
          'Study plans are being created for every learner in this cohort. The status refreshes automatically.',
      };
    }
    if (publishState === 'published') {
      return {
        kind: 'done',
        title: 'Study plans are published',
        description: 'Study plans were already generated for this cohort.',
      };
    }
    if (!readiness.hasStudents) {
      return {
        kind: 'todo',
        title: 'Add learners',
        description: 'Choose who belongs to this cohort from your learner registry.',
        action: { label: 'Add learners', onClick: () => onNavigate('learners') },
      };
    }
    if (!readiness.hasCourses) {
      return {
        kind: 'todo',
        title: 'Attach a course',
        description:
          'Pick the courses this cohort should study. You can narrow each one to specific objectives afterwards.',
        action: { label: 'Attach courses', onClick: onAttachCourses },
      };
    }
    if (!readiness.allCoursesHaveObjectives) {
      const count = readiness.missingObjectiveCourseCount;
      return {
        kind: 'todo',
        title: `${plural(count, 'attached course')} ${count === 1 ? 'has' : 'have'} no learning objectives`,
        description:
          'Learners would get nothing from them. Add objectives on the course page, or remove the course from this cohort.',
        action: { label: 'Review courses', onClick: () => onNavigate('courses') },
      };
    }
    if (readiness.lockedCoursesMissingItemsCount > 0) {
      const count = readiness.lockedCoursesMissingItemsCount;
      return {
        kind: 'todo',
        title: `${plural(count, 'locked course')} ${count === 1 ? 'needs' : 'need'} item coverage`,
        description:
          'Locked courses only deliver objectives that have practice items. Add content on the course page, or curate objectives that already have items.',
        action: { label: 'Review courses', onClick: () => onNavigate('courses') },
      };
    }
    if (publishState === 'failed') {
      return {
        kind: 'error',
        title: 'The last publish failed',
        description: 'The last publish job failed. You can retry publishing.',
        action: { label: 'Publish again', onClick: onPublish },
      };
    }
    return {
      kind: 'todo',
      title: 'Ready to publish study plans',
      description:
        'Publishing generates a study plan for every learner in this cohort from the attached courses.',
      action: { label: 'Publish study plans', onClick: onPublish },
    };
  })();

  const jobTotal = publishJob
    ? publishJob.queuedCount +
      publishJob.processingCount +
      publishJob.completedCount +
      publishJob.failedCount +
      publishJob.skippedCount
    : 0;
  const jobUpdated = publishJob ? relativeTime(publishJob.updatedAt) : null;
  const status = PUBLISH_STATE_META[publishState];
  const dateRange = formatDateRange(cohort.startDate, cohort.endDate);

  return (
    <div className="space-y-8">
      <div
        className={cn(
          'flex flex-wrap items-center gap-4 rounded-xl border px-5 py-4',
          nextStep.kind === 'error'
            ? 'border-red-200 bg-red-50/60'
            : 'border-stone-200 bg-stone-50/70',
        )}
      >
        <span
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
            nextStep.kind === 'done'
              ? 'bg-brand-500 text-white'
              : nextStep.kind === 'error'
                ? 'bg-white text-red-600 shadow-card ring-1 ring-red-200'
                : 'bg-white text-stone-700 shadow-card ring-1 ring-stone-200',
          )}
        >
          {nextStep.kind === 'done' ? (
            <Check size={17} strokeWidth={2.5} />
          ) : nextStep.kind === 'busy' ? (
            <Loader2 size={17} className="animate-spin text-brand-600" />
          ) : nextStep.kind === 'error' ? (
            <AlertTriangle size={17} />
          ) : (
            <ArrowRight size={17} />
          )}
        </span>
        <div className="min-w-[min(100%,16rem)] flex-1">
          <p className="text-xs font-medium text-stone-500">
            {nextStep.kind === 'done'
              ? 'All set'
              : nextStep.kind === 'busy'
                ? 'In progress'
                : 'Next step'}
          </p>
          <p className="text-[15px] font-semibold text-stone-900">{nextStep.title}</p>
          <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-stone-500">
            {nextStep.description}
          </p>
        </div>
        {nextStep.action && (
          <Button variant="primary" onClick={nextStep.action.onClick}>
            {nextStep.action.label}
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard
          title="Learners"
          icon={UsersRound}
          figure={cohort.studentIds.length.toLocaleString()}
          detail={cohort.studentIds.length > 0 ? 'in this cohort' : 'None yet'}
          actionLabel={cohort.studentIds.length > 0 ? 'Manage learners' : 'Add learners'}
          onAction={() => onNavigate('learners')}
        />
        <StatCard
          title="Courses"
          icon={BookOpen}
          figure={assignedCourses.length.toLocaleString()}
          detail={
            courseIssues > 0 ? (
              <Badge tone="amber" dot>
                {plural(courseIssues, 'course')} to fix
              </Badge>
            ) : assignedCourses.length > 0 ? (
              [
                fullCount > 0 ? `${fullCount} full` : null,
                curatedCount > 0 ? `${curatedCount} curated` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            ) : (
              'None attached'
            )
          }
          actionLabel={assignedCourses.length > 0 ? 'Manage courses' : 'Attach courses'}
          onAction={
            assignedCourses.length > 0 ? () => onNavigate('courses') : onAttachCourses
          }
        />
        <StatCard
          title="Study plans"
          icon={CalendarCheck}
          figure={publishJob ? publishJob.completedCount.toLocaleString() : '—'}
          detail={
            publishJob ? (
              <>
                of {plural(jobTotal, 'plan')} generated
                {publishJob.failedCount > 0 && (
                  <span className="text-red-600"> · {publishJob.failedCount} failed</span>
                )}
                {publishJob.skippedCount > 0 && ` · ${publishJob.skippedCount} skipped`}
              </>
            ) : (
              'Not published yet'
            )
          }
        >
          {publishJob && jobTotal > 0 && (
            <ProgressBar
              value={publishJob.completedCount}
              max={jobTotal}
              className="mt-3"
              label="Study plans generated"
            />
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            {jobUpdated && <span className="text-xs text-stone-400">Last run {jobUpdated}</span>}
          </div>
        </StatCard>
      </div>

      <section className="rounded-xl border border-stone-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-stone-900">About this cohort</h2>
          <Button variant="ghost" size="sm" icon={Pencil} onClick={onEditDetails}>
            Edit
          </Button>
        </div>
        <p
          className={cn(
            'mt-2 max-w-3xl text-sm leading-6',
            cohort.description ? 'text-stone-700' : 'text-stone-400',
          )}
        >
          {cohort.description || 'No description yet.'}
        </p>
        <dl className="mt-4 grid gap-x-8 gap-y-3 border-t border-stone-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[13px] text-stone-500">Term</dt>
            <dd className={cohort.term ? 'text-stone-900' : 'text-stone-400'}>
              {cohort.term || 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-stone-500">Dates</dt>
            <dd className={dateRange ? 'text-stone-900' : 'text-stone-400'}>
              {dateRange || 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-stone-500">Created</dt>
            <dd className="text-stone-900">{formatDate(cohort.createdAt) || '—'}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-stone-500">Last updated</dt>
            <dd className="text-stone-900">{formatDate(cohort.updatedAt) || '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
};

export default CohortOverviewPanel;
