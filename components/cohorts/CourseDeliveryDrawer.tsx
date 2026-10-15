import React, { useState } from 'react';
import { ArrowUpRight, Lock, Target } from 'lucide-react';
import type { TeacherCohort, TeacherCourse } from '@/types/AcademyStudioTypes';
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  InlineAlert,
  SegmentedControl,
  Spinner,
  StatusDot,
  cn,
} from '@/components/ui';
import { formatDeliveryLabel, getCourseObjectiveCount, plural } from './cohortModel';

type DeliveryMode = 'full' | 'curated';

interface CourseDeliveryDrawerProps {
  open: boolean;
  onClose: () => void;
  cohort: TeacherCohort;
  course: TeacherCourse | null;
  isCustomMode: boolean;
  selectedObjectiveIds: ReadonlySet<string>;
  /** Objectives are still being fetched (or failed to). */
  needsObjectives: boolean;
  objectiveError: string | null;
  isRetrying: boolean;
  onRetry: () => void;
  onEnableCurated: () => void;
  onRestoreFullCourse: () => void;
  onToggleObjective: (objectiveId: string) => void;
  onOpenCourse: (courseId: string) => void;
}

/**
 * How one course is delivered to the cohort: the whole course, or a curated
 * set of its objectives. Every change is saved as it's made.
 */
const CourseDeliveryDrawer: React.FC<CourseDeliveryDrawerProps> = ({
  open,
  onClose,
  cohort,
  course,
  isCustomMode,
  selectedObjectiveIds,
  needsObjectives,
  objectiveError,
  isRetrying,
  onRetry,
  onEnableCurated,
  onRestoreFullCourse,
  onToggleObjective,
  onOpenCourse,
}) => {
  const [isConfirmingFull, setIsConfirmingFull] = useState(false);

  if (!course) return null;

  const objectiveCount = getCourseObjectiveCount(course);
  const hasNoObjectives = !needsObjectives && course.learningObjectives.length === 0;
  const mode: DeliveryMode = isCustomMode ? 'curated' : 'full';

  const handleModeChange = (next: DeliveryMode) => {
    if (next === mode) return;
    if (next === 'curated') {
      onEnableCurated();
    } else {
      setIsConfirmingFull(true);
    }
  };

  const renderObjectives = () => {
    if (needsObjectives) {
      return objectiveError ? (
        <div className="px-6 py-5">
          <InlineAlert
            title="Couldn't load this course's objectives"
            action={
              <Button size="sm" variant="secondary" loading={isRetrying} onClick={onRetry}>
                Retry
              </Button>
            }
          >
            {objectiveError}
          </InlineAlert>
        </div>
      ) : (
        <Spinner label="Loading course objectives…" className="py-20" />
      );
    }

    if (hasNoObjectives) {
      return (
        <EmptyState
          icon={Target}
          title="This course has no objectives yet"
          description="Add learning objectives on the course page first. Until then, learners in this cohort get nothing from it."
          action={
            <Button variant="secondary" icon={ArrowUpRight} onClick={() => onOpenCourse(course.id)}>
              Open course page
            </Button>
          }
        />
      );
    }

    return (
      <ul className="divide-y divide-stone-100">
        {course.learningObjectives.map((objective) => {
          const hasNoItems = (objective.itemTotals?.total ?? 0) === 0;
          const isSelected = selectedObjectiveIds.has(objective.id);
          const isDisabled = course.locked && hasNoItems && !isSelected;
          const tags = [objective.organSystem, objective.cognitiveSkill].filter(Boolean);
          const itemBadge = course.locked && hasNoItems && (
            <Badge tone="amber" title="Locked courses only deliver objectives with linked items">
              0 items
            </Badge>
          );

          if (!isCustomMode) {
            return (
              <li key={objective.id} className="flex items-start gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-stone-900">{objective.title}</p>
                  {tags.length > 0 && (
                    <p className="mt-0.5 text-xs text-stone-500">{tags.join(' · ')}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 pt-0.5">
                  {itemBadge}
                  <StatusDot tone="neutral">Included</StatusDot>
                </div>
              </li>
            );
          }

          return (
            <li key={objective.id}>
              <label
                title={
                  isDisabled
                    ? 'Locked course delivery can only include objectives with linked items.'
                    : undefined
                }
                className={cn(
                  'flex items-start gap-3 px-6 py-3 transition-colors',
                  isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-stone-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => onToggleObjective(objective.id)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-stone-300 accent-brand-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm text-stone-900">{objective.title}</span>
                  {tags.length > 0 && (
                    <span className="mt-0.5 block text-xs text-stone-500">{tags.join(' · ')}</span>
                  )}
                </span>
                {itemBadge}
              </label>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        dismissible={!isConfirmingFull}
        title={course.title}
        description={formatDeliveryLabel(cohort, course)}
        toolbar={
          <div className="space-y-3 border-b border-stone-200 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl<DeliveryMode>
                label="Delivery mode"
                value={mode}
                onChange={handleModeChange}
                options={[
                  { value: 'full', label: 'Full course' },
                  { value: 'curated', label: 'Curated objectives' },
                ]}
              />
              {course.locked && (
                <Badge icon={Lock} title="Only items linked to this course's objectives are delivered">
                  Locked
                </Badge>
              )}
            </div>
            <p className="text-[13px] leading-5 text-stone-500">
              {isCustomMode
                ? `Learners only get the objectives you tick — ${selectedObjectiveIds.size} of ${plural(
                    objectiveCount,
                    'objective',
                  )} selected. Unticking the last one returns the cohort to the full course.`
                : `Learners get all ${plural(objectiveCount, 'objective')} in this course, including ones added later.`}
            </p>
          </div>
        }
        footer={
          <>
            <Button
              variant="ghost"
              icon={ArrowUpRight}
              onClick={() => onOpenCourse(course.id)}
              className="-ml-2"
            >
              Edit on course page
            </Button>
            <span className="ml-auto hidden text-[13px] text-stone-500 sm:inline">
              Changes save straight away
            </span>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        {renderObjectives()}
      </Drawer>

      <ConfirmDialog
        open={isConfirmingFull}
        title="Deliver the full course?"
        description={`The curated selection of ${plural(
          selectedObjectiveIds.size,
          'objective',
        )} will be cleared and learners will get every objective in “${course.title}”.`}
        confirmLabel="Use full course"
        tone="default"
        onConfirm={() => {
          setIsConfirmingFull(false);
          onRestoreFullCourse();
        }}
        onCancel={() => setIsConfirmingFull(false)}
      />
    </>
  );
};

export default CourseDeliveryDrawer;
