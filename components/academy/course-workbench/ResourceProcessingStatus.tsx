import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import type { CourseResource, CourseResourceKnowledgeProcessingResponse } from '@/types/CourseResourceTypes';
import type { CourseResourceProcessingAction } from '@/types/DocumentProcessing';
import { courseResourceService } from '@/services/courseResourceService';
import { resourceIdentifier } from '@/utils/resourceId';
import {
  canCancelProcessing, canRetryProcessing, hasStaleHeartbeat, isProcessingTerminal,
  isTextReady, processingStageLabel, processingUnitsLabel, readProcessing,
} from '@/utils/documentProcessing';

const timestamp = (value: string | null): string | null => {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toLocaleString();
};

interface Props {
  courseIdentifier: string;
  resource: CourseResource;
  onAccepted: (resource: CourseResource, response: CourseResourceKnowledgeProcessingResponse) => Promise<void>;
  onActionError: (resource: CourseResource, uncertain: boolean) => Promise<void>;
  disabled?: boolean;
}

export const ResourceProcessingStatus: React.FC<Props> = ({
  courseIdentifier, resource, onAccepted, onActionError, disabled,
}) => {
  const p = readProcessing(resource.knowledgeBase?.processing);
  const ready = isTextReady(resource.knowledgeBase);
  const [pending, setPending] = useState<CourseResourceProcessingAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), [courseIdentifier, resource.identifier, p?.runId]);
  useEffect(() => {
    setNotice(null);
    setError(null);
  }, [p?.runId, p?.sequence]);

  const request = async (action: CourseResourceProcessingAction) => {
    if (controllerRef.current || disabled) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(action);
    setError(null);
    setNotice(null);
    try {
      const response = await courseResourceService.requestTeacherCourseResourceProcessing(
        courseIdentifier, resource.identifier || resourceIdentifier(resource.id), action,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setNotice(`${action === 'retry' ? 'Retry' : 'Cancellation'} requested. Waiting for the server’s updated status.`);
      await onAccepted(resource, response);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const status = typeof cause === 'object' && cause !== null && 'status' in cause ? cause.status : null;
      setError(status === 404 || status === 501
        ? 'This processing action is unavailable on this server. Refresh to check the file’s current status.'
        : status === 409
          ? 'Processing changed or this action is no longer available. Refresh to check the current status.'
        : status === 403
          ? 'You do not have permission to change processing for this course.'
          : `Could not confirm the ${action} request. Refresh before trying again. ${cause instanceof Error ? cause.message : ''}`);
      // A lost POST response can still mean the backend accepted the action.
      // Recover its snapshot even if our last-known row was terminal.
      await onActionError(resource, status == null ||
        (typeof status === 'number' && status >= 500 && status !== 501));
    } finally {
      if (!controller.signal.aborted) {
        controllerRef.current = null;
        setPending(null);
      }
    }
  };

  if (!p) return (
    <div className="text-xs leading-5 text-slate-600">
      Processing details unavailable. Refreshing automatically; completion has not been confirmed.
    </div>
  );
  const terminal = isProcessingTerminal(p);
  const knownState = ['queued', 'running', 'retrying', 'completed', 'completed_with_warnings', 'failed', 'cancelled'].includes(p.state);
  const units = processingUnitsLabel(p);
  const total = p.totalUnits;
  const determinate = p.unit && p.completedUnits !== null && total !== null && total > 0 && p.completedUnits <= total;
  const failed = p.state === 'failed';
  const cancelled = p.state === 'cancelled';
  const lastProgress = timestamp(p.lastProgressAt);
  const nextRetry = timestamp(p.nextRetryAt);
  const actionClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="min-w-0 space-y-2 text-xs leading-5" aria-label={`Tutor processing for ${resource.fileName}`}>
      <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-bold ${ready ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
        {ready && <Check size={13} aria-hidden="true" />}
        {ready ? 'Text ready to chat' : 'Text not ready to chat'}
      </div>
      <div className={failed ? 'text-rose-700' : 'text-slate-700'}>
        <p role="status" className="flex items-start gap-1.5 font-semibold">
          {!terminal && knownState && <Loader2 size={13} className="mt-1 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {failed && <AlertTriangle size={13} className="mt-1 shrink-0" aria-hidden="true" />}
          {!knownState ? 'Processing status unavailable' : failed
            ? ready ? 'Enrichment failed' : 'Processing failed'
            : cancelled ? ready ? 'Remaining enrichment cancelled' : 'Processing cancelled'
              : p.state === 'completed_with_warnings' ? 'Completed with warnings'
                : p.state === 'completed' ? 'Processing complete'
                  : p.state === 'retrying' ? 'Retry scheduled' : processingStageLabel(p)}
        </p>
        {(failed || cancelled || p.state === 'retrying' || p.state === 'completed_with_warnings') &&
          <p>Stage: {processingStageLabel(p)}</p>}
        {!knownState && <p>Checking for updates; completion has not been confirmed.</p>}
        {units && <p className="tabular-nums">{units}</p>}
        {determinate && <progress className="mt-1 h-1.5 w-full accent-sky-600" value={p.completedUnits!} max={total!}
          aria-label={`${processingStageLabel(p)} for ${resource.fileName}`} aria-valuetext={units ?? undefined} />}
      </div>
      {ready && (!terminal || failed || cancelled || p.state === 'completed_with_warnings') && (
        <p className="text-slate-600">Full extracted text is indexed and usable now. Structure, images, or visual-only content may still be incomplete.</p>
      )}
      {!ready && !terminal && <p className="text-slate-600">Chat becomes available after full text is indexed. Scanned pages need OCR first.</p>}
      <p className="text-slate-500">
        Available: {([
          p.capabilities.text && 'text', p.capabilities.structure && 'structure',
          p.capabilities.images && 'images', p.capabilities.ocr && 'OCR',
        ].filter(Boolean).join(', ')) || 'none confirmed'}
      </p>
      {p.error && <p className="break-words text-rose-700">{p.error.message}{p.error.code ? ` (${p.error.code})` : ''}</p>}
      {p.warnings.length > 0 && <ul className="list-disc space-y-1 break-words pl-4 text-amber-800">
        {p.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
      </ul>}
      {p.state === 'retrying' && nextRetry && <p className="text-slate-600">Next retry: {nextRetry}</p>}
      {lastProgress && <p className="text-slate-500">Last progress: {lastProgress}</p>}
      {hasStaleHeartbeat(p, Date.now()) && <p className="text-amber-800">No recent worker update. Work may still be running; this is not a reported failure.</p>}
      {(canRetryProcessing(p) || canCancelProcessing(p)) && <div className="flex flex-wrap gap-2">
        {canRetryProcessing(p) && <button type="button" className={actionClass}
          disabled={!!pending || disabled} onClick={() => void request('retry')}
          aria-label={`Retry processing for ${resource.fileName}`}>
          {pending === 'retry' ? 'Requesting retry…' : ready ? 'Retry enrichment' : 'Retry processing'}
        </button>}
        {canCancelProcessing(p) && <button type="button" className={actionClass}
          disabled={!!pending || disabled} onClick={() => void request('cancel')}
          aria-label={`Cancel ${ready ? 'remaining enrichment' : 'processing'} for ${resource.fileName}`}>
          {pending === 'cancel' ? 'Requesting cancellation…' : ready ? 'Cancel enrichment' : 'Cancel processing'}
        </button>}
      </div>}
      {canCancelProcessing(p) && ready && <p className="text-slate-500">Cancelling keeps indexed text available to chat.</p>}
      <div role="status" aria-live="polite">{notice && <p className="text-slate-600">{notice}</p>}</div>
      {error && <p role="alert" className="text-rose-700">{error}</p>}
    </div>
  );
};
