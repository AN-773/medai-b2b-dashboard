import React from 'react';
import type { CourseResource } from '@/types/CourseResourceTypes';
import { isTextReady, readProcessing, shouldPollResource } from '@/utils/documentProcessing';

interface Props {
  resource: CourseResource;
}

export const ResourceProcessingStatus: React.FC<Props> = ({ resource }) => {
  const knowledgeBase = resource.knowledgeBase;
  if (!knowledgeBase) return null;

  const processing = readProcessing(knowledgeBase.processing);
  const ready = isTextReady(knowledgeBase);
  let label = 'Processing';

  if (ready) {
    label = shouldPollResource(resource) ? 'Still processing images and layout' : 'Ready';
  } else if (processing?.state === 'cancelled') {
    label = 'Processing stopped';
  } else if (processing?.state === 'failed' || (!knowledgeBase.processing && knowledgeBase.status === 'failed')) {
    label = 'Couldn’t process this file';
  } else if (!knowledgeBase.processing && knowledgeBase.status === 'ineligible') {
    label = knowledgeBase.reason === 'size' ? 'File too large' : 'Unsupported file type';
  } else if (!knowledgeBase.processing && knowledgeBase.status === 'not_synced') {
    label = 'Waiting to process';
  }

  return (
    <p role="status" aria-label={`Processing status for ${resource.fileName}`}
      className="text-xs leading-5 text-slate-500">
      {label}
    </p>
  );
};
