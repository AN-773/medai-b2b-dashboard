import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MODULE_GENERATION_MOCK_ENABLED,
  moduleGenerationCourseData,
  moduleGenerationService,
} from '@/services/moduleGenerationService';
import { resourceIdentifier } from '@/utils/resourceId';
import type { TeacherCourse } from '@/types/AcademyStudioTypes';
import type { CourseGenerationJob } from '@/types/CourseAITypes';
import type { CourseUpload } from '@/types/CourseStudioTypes';
import { getCourseObjectiveCount } from '../shared';
import type { CreateWithAIButtonProps } from './CreateWithAIButton';
import type { ModuleGenerationBannerProps } from './ModuleGenerationBanner';
import type { ModuleGenerationWizardProps } from './ModuleGenerationWizard';
import { isJobOpen, isJobRunning } from './planUtils';

/** Banner poll interval while a job is queued or processing (contract: 15 s). */
export const BANNER_POLL_MS = 15000;

/**
 * Everything the Modules tab needs for "Create with AI", so the panel only
 * renders three components:
 *
 * - `buttonProps`: disabled with a reason until the course has completed
 *   uploads and accepted learning objectives (an open job always enables it).
 * - `bannerProps`: the open job from one `generation-jobs?kind=modules&open=true`
 *   call on mount, re-polled every 15 s only while it is queued or processing
 *   and the wizard is closed (the wizard polls on its own while open).
 * - `wizardProps`: opens at the step that fits the job.
 *
 * `onAccepted` is the panel's existing loader; it runs after an accept so the
 * new modules show up.
 */
export const useModuleGenerationLauncher = (
  course: TeacherCourse,
  onAccepted: () => void | Promise<void>,
) => {
  const courseIdentifier = course.backendIdentifier || resourceIdentifier(course.id);
  const [openJob, setOpenJob] = useState<CourseGenerationJob | null>(null);
  const [uploads, setUploads] = useState<CourseUpload[] | null>(null);
  const [uploadsFailed, setUploadsFailed] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardJob, setWizardJob] = useState<CourseGenerationJob | null>(null);
  const courseRef = useRef(courseIdentifier);
  courseRef.current = courseIdentifier;
  const onAcceptedRef = useRef(onAccepted);
  onAcceptedRef.current = onAccepted;

  const refreshOpenJob = useCallback(async () => {
    const requested = courseIdentifier;
    try {
      const job = await moduleGenerationService.getOpenJob(requested);
      if (courseRef.current === requested) setOpenJob(job && isJobOpen(job) ? job : null);
    } catch {
      // No banner is better than an error on a tab the teacher came to for
      // something else; the button still works.
    }
  }, [courseIdentifier]);

  const loadUploads = useCallback(async () => {
    const requested = courseIdentifier;
    try {
      const loaded = await moduleGenerationCourseData.listCompletedUploads(requested);
      if (courseRef.current !== requested) return;
      setUploads(loaded);
      setUploadsFailed(false);
    } catch {
      if (courseRef.current !== requested) return;
      setUploadsFailed(true);
    }
  }, [courseIdentifier]);

  useEffect(() => {
    setOpenJob(null);
    setUploads(null);
    setUploadsFailed(false);
    setWizardOpen(false);
    setWizardJob(null);
    void refreshOpenJob();
    void loadUploads();
  }, [loadUploads, refreshOpenJob]);

  const openJobRunning = isJobRunning(openJob);
  useEffect(() => {
    if (!openJobRunning || wizardOpen) return undefined;
    const timer = window.setInterval(() => void refreshOpenJob(), BANNER_POLL_MS);
    return () => window.clearInterval(timer);
  }, [openJobRunning, refreshOpenJob, wizardOpen]);

  const openWizard = useCallback(() => {
    setWizardJob(openJob);
    setWizardOpen(true);
    void loadUploads();
  }, [loadUploads, openJob]);

  const closeWizard = useCallback(() => {
    setWizardOpen(false);
    setWizardJob(null);
    void refreshOpenJob();
  }, [refreshOpenJob]);

  const handleJobChange = useCallback((job: CourseGenerationJob | null) => {
    setOpenJob(job && isJobOpen(job) ? job : null);
  }, []);

  const handleAccepted = useCallback(() => {
    void onAcceptedRef.current();
  }, []);

  const objectiveCount = getCourseObjectiveCount(course);
  const objectivesKnown =
    course.learningObjectivesLoaded !== false || typeof course.learningObjectivesTotal === 'number';

  let disabledReason: string | null = null;
  if (!openJob) {
    if (uploads === null && !uploadsFailed) {
      disabledReason = 'Checking the course files…';
    } else if (uploads !== null && uploads.length === 0) {
      disabledReason = 'Upload course files and wait for them to finish processing first.';
    } else if (objectivesKnown && objectiveCount === 0 && !MODULE_GENERATION_MOCK_ENABLED) {
      disabledReason = 'Accept at least one learning objective from the course files first.';
    }
  }

  const objectiveTitles = useMemo(
    () => new Map(course.learningObjectives.map((objective) => [objective.id, objective.title])),
    [course.learningObjectives],
  );

  const buttonProps: CreateWithAIButtonProps = {
    disabledReason,
    isChecking: uploads === null && !uploadsFailed && !openJob,
    onClick: openWizard,
  };

  const bannerProps: ModuleGenerationBannerProps = {
    job: wizardOpen ? null : openJob,
    onOpen: openWizard,
  };

  const wizardProps: ModuleGenerationWizardProps = {
    isOpen: wizardOpen,
    courseIdentifier,
    courseTitle: course.title,
    initialJob: wizardJob,
    uploads: uploads ?? [],
    uploadsLoading: uploads === null && !uploadsFailed,
    objectiveTitles,
    onClose: closeWizard,
    onJobChange: handleJobChange,
    onAccepted: handleAccepted,
  };

  return { buttonProps, bannerProps, wizardProps };
};
