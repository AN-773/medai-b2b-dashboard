import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  ListTree,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { CourseGenerationJob } from '@/types/CourseAITypes';
import type { CourseUpload } from '@/types/CourseStudioTypes';
import type { AcceptModulePlanResponse } from '@/types/ModuleGenerationTypes';
import OptionsStep from './OptionsStep';
import ProgressStep from './ProgressStep';
import ReviewStep from './ReviewStep';
import { wizardStepForJob, type WizardStep } from './planUtils';
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

const STEPS: { key: Exclude<WizardStep, 'done'>; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'options', label: 'Options', icon: SlidersHorizontal },
  { key: 'progress', label: 'Progress', icon: Activity },
  { key: 'review', label: 'Review', icon: ListTree },
];

const Stepper: React.FC<{ step: WizardStep }> = ({ step }) => {
  const current = step === 'done' ? STEPS.length : STEPS.findIndex((entry) => entry.key === step);
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-4">
      {STEPS.map((entry, index) => {
        const Icon = entry.icon;
        const done = current > index;
        const active = current === index;
        return (
          <React.Fragment key={entry.key}>
            <div className="flex min-w-[60px] flex-col items-center gap-1.5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-all ${
                  done
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100'
                    : active
                      ? 'bg-primary-gradient text-white shadow-xl shadow-emerald-100'
                      : 'border border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {done ? <CheckCircle2 size={18} /> : <Icon size={18} />}
              </div>
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-[#1BD183]' : 'text-slate-400'}`}
              >
                {entry.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`-mt-5 h-px min-w-[20px] max-w-[80px] flex-1 transition-colors duration-500 ${
                  done ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const WizardDialog: React.FC<Omit<ModuleGenerationWizardProps, 'isOpen'>> = ({
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
  const { job } = jobState;

  const step: WizardStep = accepted ? 'done' : wizardStepForJob(job);
  const loadFailed = !job && Boolean(initialJob) && !jobState.isLoading && Boolean(jobState.error);

  const handleAccepted = (response: AcceptModulePlanResponse) => {
    setAccepted(response);
    onJobChange(response.job);
    onAccepted(response);
  };

  const handleDiscarded = (discarded: CourseGenerationJob) => {
    onJobChange(discarded);
    onClose();
  };

  let body: React.ReactNode;
  if (jobState.isLoading || loadFailed) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-sm font-semibold text-slate-500">
        {loadFailed ? (
          <>
            <AlertTriangle size={20} className="text-rose-500" />
            <span className="text-rose-700">{jobState.error}</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <Loader2 size={20} className="animate-spin" /> Loading…
          </>
        )}
      </div>
    );
  } else if (step === 'done' && accepted) {
    const sessionCount = accepted.modules.reduce((sum, module) => sum + module.sessions.length, 0);
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-100">
          <CheckCircle2 size={26} />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-900">Modules created</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Added {accepted.modules.length} module{accepted.modules.length === 1 ? '' : 's'} with {sessionCount}{' '}
            session{sessionCount === 1 ? '' : 's'} after your existing modules
            {accepted.createdItemIds.length > 0
              ? `, and ${accepted.createdItemIds.length} new item${accepted.createdItemIds.length === 1 ? '' : 's'} to the course.`
              : '.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-[#16324F] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#1B3E62]"
        >
          Done
        </button>
      </div>
    );
  } else if (step === 'done' && job) {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-sm font-semibold text-slate-500">
        <CheckCircle2 size={22} className="text-emerald-500" />
        This draft was already accepted.
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
      </div>
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
        key={job.identifier}
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-generation-title"
        className="relative flex h-full max-h-[920px] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-slate-50 shadow-2xl animate-in zoom-in-95 fade-in duration-300"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#16324F] text-white">
              <Sparkles size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="module-generation-title" className="text-lg font-black tracking-tight text-slate-900">
                Create modules with AI
              </h2>
              <p className="truncate text-xs font-semibold text-slate-500">{courseTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex-shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-white">
          <Stepper step={step} />
        </div>

        {jobState.notice && (
          <div className="flex items-start gap-2 border-b border-sky-200 bg-sky-50 px-6 py-2.5 text-sm font-semibold text-sky-800">
            <Info size={15} className="mt-0.5 flex-shrink-0" />
            <span className="min-w-0 flex-1">{jobState.notice}</span>
            <button
              type="button"
              onClick={() => jobState.setNotice(null)}
              title="Dismiss"
              className="flex-shrink-0 opacity-60 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col bg-white">{body}</div>
      </div>
    </div>
  );
};

/**
 * "Create with AI" wizard: Options → Progress → Review. Everything inside,
 * including polling, is unmounted when it closes; the job keeps running on the
 * server and the Modules tab banner leads back to it.
 */
const ModuleGenerationWizard: React.FC<ModuleGenerationWizardProps> = ({ isOpen, ...props }) => {
  if (!isOpen || typeof document === 'undefined') return null;
  return createPortal(<WizardDialog {...props} />, document.body);
};

export default ModuleGenerationWizard;
