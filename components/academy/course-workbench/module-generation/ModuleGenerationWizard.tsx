import React, { useCallback, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Sparkles } from 'lucide-react';
import { Button, Drawer, EmptyState, InlineAlert, Spinner, cn } from '@/components/ui';
import type { CourseGenerationJob } from '@/types/CourseAITypes';
import type { CourseUpload } from '@/types/CourseStudioTypes';
import type { AcceptModulePlanResponse } from '@/types/ModuleGenerationTypes';
import OptionsStep from './OptionsStep';
import ProgressStep from './ProgressStep';
import ReviewStep from './ReviewStep';
import { WizardFooter, WizardFooterSlot } from './WizardFooter';
import { jobIdentifierOf, wizardStepForJob, type WizardStep } from './planUtils';
import { useModuleGenerationJob } from './useModuleGenerationJob';

export interface ModuleGenerationWizardProps {
  isOpen: boolean;
  courseIdentifier: string;
  courseTitle: string;
  /** Job to resume, or `null` to start at Options. */
  initialJob: CourseGenerationJob | null;
  uploads: CourseUpload[];
  uploadsLoading: boolean;
  /** Absolute learning objective id → title, for the review tree. */
  objectiveTitles: Map<string, string>;
  onClose: () => void;
  onJobChange: (job: CourseGenerationJob | null) => void;
  onAccepted: (response: AcceptModulePlanResponse) => void;
}

const STEPS: { key: Exclude<WizardStep, 'done'>; label: string }[] = [
  { key: 'options', label: 'Options' },
  { key: 'progress', label: 'Drafting' },
  { key: 'review', label: 'Review' },
];

const StepIndicator: React.FC<{ step: WizardStep }> = ({ step }) => {
  const current = step === 'done' ? STEPS.length : STEPS.findIndex((entry) => entry.key === step);
  return (
    <ol aria-label="Steps" className="flex items-center gap-2 border-b border-stone-200 px-6 py-2.5">
      {STEPS.map((entry, index) => {
        const done = current > index;
        const active = current === index;
        return (
          <li
            key={entry.key}
            aria-current={active ? 'step' : undefined}
            className="flex items-center gap-2"
          >
            {index > 0 && <span aria-hidden="true" className="h-px w-6 bg-stone-200" />}
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
              {done ? <Check size={12} strokeWidth={3} aria-label="Done" /> : index + 1}
            </span>
            <span
              className={cn(
                'text-[13px]',
                active ? 'font-medium text-stone-900' : done ? 'text-stone-600' : 'text-stone-500',
              )}
            >
              {entry.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

/**
 * True when a confirmation, item preview or menu is open above the wizard.
 * The Drawer and those overlays all listen for Escape on `document`, so the
 * wizard must not close underneath them.
 */
const hasOverlayAbove = (element: HTMLElement) => {
  const root = element.closest('body > *');
  let next = root?.nextElementSibling ?? null;
  while (next) {
    if (
      next.matches('[role="dialog"], [role="menu"]') ||
      next.querySelector('[role="dialog"], [role="menu"]')
    ) {
      return true;
    }
    next = next.nextElementSibling;
  }
  return false;
};

const CenteredState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">{children}</div>
);

const WizardDrawer: React.FC<Omit<ModuleGenerationWizardProps, 'isOpen'>> = ({
  courseIdentifier,
  courseTitle,
  initialJob,
  uploads,
  uploadsLoading,
  objectiveTitles,
  onClose,
  onJobChange,
  onAccepted,
}) => {
  const jobState = useModuleGenerationJob({ courseIdentifier, initialJob, onJobChange });
  const [accepted, setAccepted] = useState<AcceptModulePlanResponse | null>(null);
  const [footerSlot, setFooterSlot] = useState<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { job } = jobState;

  const step: WizardStep = accepted ? 'done' : wizardStepForJob(job);
  const loadFailed = !job && Boolean(initialJob) && !jobState.isLoading && Boolean(jobState.error);
  const showLoading = jobState.isLoading || (!accepted && jobState.awaitingDraft);

  const handleDrawerClose = useCallback(() => {
    if (bodyRef.current && hasOverlayAbove(bodyRef.current)) return;
    onClose();
  }, [onClose]);

  /** Escape inside a text field (e.g. an inline rename) must not close the wizard. */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select')) event.stopPropagation();
  };

  const handleAccepted = (response: AcceptModulePlanResponse) => {
    setAccepted(response);
    onJobChange(response.job);
    onAccepted(response);
  };

  const handleDiscarded = (discarded: CourseGenerationJob) => {
    onJobChange(discarded);
    onClose();
  };

  const closeFooter = (
    <WizardFooter>
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </WizardFooter>
  );

  let body: React.ReactNode;
  if (!accepted && jobState.draftUnavailable) {
    body = (
      <>
        <CenteredState>
          <EmptyState
            icon={AlertTriangle}
            title="The draft isn’t available yet"
            description="The AI finished, but its draft hasn’t arrived. Try again in a moment."
          />
        </CenteredState>
        <WizardFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={() => void jobState.refetch()}>
            Try again
          </Button>
        </WizardFooter>
      </>
    );
  } else if (loadFailed) {
    body = (
      <>
        <div className="px-6 py-6">
          <InlineAlert tone="error" title="Couldn’t load this draft">
            {jobState.error}
          </InlineAlert>
        </div>
        {closeFooter}
      </>
    );
  } else if (showLoading) {
    body = (
      <>
        <CenteredState>
          <Spinner label="Loading…" />
        </CenteredState>
        {closeFooter}
      </>
    );
  } else if (step === 'done' && accepted) {
    const moduleCount = accepted.modules.length;
    const sessionCount = accepted.modules.reduce((sum, module) => sum + module.sessions.length, 0);
    const itemCount = accepted.createdItemIds.length;
    body = (
      <>
        <CenteredState>
          <div className="flex max-w-md flex-col items-center text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <CheckCircle2 size={22} aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold text-stone-900">Modules created</p>
            <p className="mt-1 text-[13px] leading-5 text-stone-500">
              Added {moduleCount} module{moduleCount === 1 ? '' : 's'} with {sessionCount} session
              {sessionCount === 1 ? '' : 's'} after your existing modules
              {itemCount > 0
                ? `, and ${itemCount} new item${itemCount === 1 ? '' : 's'} to the course.`
                : '.'}
            </p>
          </div>
        </CenteredState>
        <WizardFooter>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </WizardFooter>
      </>
    );
  } else if (step === 'done' && job) {
    body = (
      <>
        <CenteredState>
          <EmptyState
            icon={CheckCircle2}
            title="This draft was already accepted"
            description="Its modules are already in the course."
          />
        </CenteredState>
        {closeFooter}
      </>
    );
  } else if (step === 'progress' && job) {
    body = (
      <ProgressStep
        job={job}
        events={jobState.events}
        isCancelling={jobState.isCancelling}
        error={jobState.error}
        onCancel={() => void jobState.cancel()}
        onStartOver={jobState.reset}
        onClose={onClose}
      />
    );
  } else if (step === 'review' && job) {
    body = (
      <ReviewStep
        key={jobIdentifierOf(job)}
        job={job}
        uploads={uploads}
        objectiveTitles={objectiveTitles}
        onJobReloaded={jobState.applyJob}
        onAccepted={handleAccepted}
        onDiscarded={handleDiscarded}
        onClose={onClose}
      />
    );
  } else {
    body = (
      <OptionsStep
        uploads={uploads}
        uploadsLoading={uploadsLoading}
        isStarting={jobState.isStarting}
        error={jobState.error}
        onStart={(options) => void jobState.start(options)}
        onClose={onClose}
      />
    );
  }

  return (
    <Drawer
      open
      onClose={handleDrawerClose}
      width="max-w-3xl"
      title={
        <span className="flex items-center gap-2.5">
          <span className="bg-ai-gradient flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-white">
            <Sparkles size={13} aria-hidden="true" />
          </span>
          Create modules with AI
        </span>
      }
      description={courseTitle}
      toolbar={
        <>
          <StepIndicator step={step} />
          {jobState.notice && (
            <div className="border-b border-stone-200 px-6 py-3">
              <InlineAlert tone="info" onDismiss={() => jobState.setNotice(null)}>
                {jobState.notice}
              </InlineAlert>
            </div>
          )}
        </>
      }
      footer={<div ref={setFooterSlot} className="flex min-w-0 flex-1 flex-wrap items-center gap-2" />}
    >
      <WizardFooterSlot.Provider value={footerSlot}>
        <div ref={bodyRef} onKeyDown={handleKeyDown} className="flex min-h-full flex-col">
          {body}
        </div>
      </WizardFooterSlot.Provider>
    </Drawer>
  );
};

/**
 * "Create with AI" wizard: Options → Drafting → Review, in a right-hand
 * drawer. Everything inside, including polling, is unmounted when it closes;
 * the job keeps running on the server and the Modules tab banner leads back
 * to it.
 */
const ModuleGenerationWizard: React.FC<ModuleGenerationWizardProps> = ({ isOpen, ...props }) => {
  if (!isOpen || typeof document === 'undefined') return null;
  return <WizardDrawer {...props} />;
};

export default ModuleGenerationWizard;
