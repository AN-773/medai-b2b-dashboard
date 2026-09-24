import React from 'react';
import { Loader2 } from 'lucide-react';
import type { CourseResource } from '@/types/CourseResourceTypes';
import { AGENT_MAX_UPLOAD_SIZE_LABEL } from '@/services/agentV2Service';
import { StatusDot, type BadgeTone } from '@/components/ui';
import { isTextReady, readProcessing, shouldPollResource } from '@/utils/documentProcessing';

interface Props {
  resource: CourseResource;
}

/** `working` draws a spinner in place of the dot. */
type StatusTone = BadgeTone | 'working';

const failureDetail = (message: string | undefined, errorCode: string | null) => {
  if (message) return `Sina couldn’t read this file: ${message}`;
  if (errorCode === 'agent_unreachable') {
    return 'Sina couldn’t be reached to read this file. Try Process files again in a moment.';
  }
  return 'Sina couldn’t read this file. Try Process files again, or upload a different copy.';
};

/**
 * Where a file stands with Sina, as one quiet status line. The label copy is
 * deliberately plain; the tooltip carries the explanation (and, for failures,
 * the reason).
 */
export const ResourceProcessingStatus: React.FC<Props> = ({ resource }) => {
  const knowledgeBase = resource.knowledgeBase;
  if (!knowledgeBase) return null;

  const processing = readProcessing(knowledgeBase.processing);
  const ready = isTextReady(knowledgeBase);
  let label = 'Processing';
  let tone: StatusTone = 'working';
  let detail = 'Sina is reading this file. Learners can ask about it once it’s ready.';

  if (ready) {
    if (shouldPollResource(resource)) {
      label = 'Still processing images and layout';
      detail =
        'Learners can already ask Sina about the text. Images and page layout are still being read.';
    } else {
      label = 'Ready';
      tone = 'green';
      detail = 'Sina can answer learners’ questions about this file.';
    }
  } else if (processing?.state === 'cancelled') {
    label = 'Processing stopped';
    tone = 'amber';
    detail = 'Processing was stopped before Sina could read this file.';
  } else if (
    processing?.state === 'failed' ||
    (!knowledgeBase.processing && knowledgeBase.status === 'failed')
  ) {
    label = 'Couldn’t process this file';
    tone = 'red';
    detail = failureDetail(processing?.error?.message, knowledgeBase.errorCode);
  } else if (!knowledgeBase.processing && knowledgeBase.status === 'ineligible') {
    const tooLarge = knowledgeBase.reason === 'size';
    label = tooLarge ? 'File too large' : 'Unsupported file type';
    tone = 'amber';
    detail = tooLarge
      ? `Sina can read files up to ${AGENT_MAX_UPLOAD_SIZE_LABEL}. Learners can still open this one.`
      : 'Sina can’t read this type of file. Learners can still open it.';
  } else if (!knowledgeBase.processing && knowledgeBase.status === 'not_synced') {
    label = 'Waiting to process';
    tone = 'neutral';
    detail = 'Sina hasn’t read this file yet — use Process files to start.';
  }

  return (
    <span
      role="status"
      aria-label={`Processing status for ${resource.fileName}`}
      title={detail}
      className="inline-flex max-w-full"
    >
      {tone === 'working' ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
          <Loader2 size={12} className="flex-shrink-0 animate-spin text-sky-500" aria-hidden="true" />
          {label}
        </span>
      ) : (
        <StatusDot tone={tone}>{label}</StatusDot>
      )}
    </span>
  );
};
