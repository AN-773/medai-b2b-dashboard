import React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import type { CourseResource } from '@/types/CourseResourceTypes';
import { Menu, cn } from '@/components/ui';
import { isTextReady } from '@/utils/documentProcessing';
import { ResourceProcessingStatus } from '../ResourceProcessingStatus';
import { fileTypeLabel, formatFileSize, formatTimestamp, iconForResource } from './fileDisplay';

interface ResourceRowProps {
  resource: CourseResource;
  /** Whether any file on the page reports a Sina status (keeps the column aligned). */
  showStatus: boolean;
  isDeleting: boolean;
  /** Another removal is in flight. */
  removeDisabled: boolean;
  onRemove: (resource: CourseResource) => void;
}

export const ResourceRow: React.FC<ResourceRowProps> = ({
  resource,
  showStatus,
  isDeleting,
  removeDisabled,
  onRemove,
}) => {
  const Icon = iconForResource(resource);
  // Until Sina has its text, the file is listed but greyed out: learners can't
  // ask about it yet.
  const textUnavailable =
    resource.knowledgeBase != null && !isTextReady(resource.knowledgeBase);

  return (
    <li className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-stone-50 lg:items-center">
      <div
        className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100',
          textUnavailable ? 'text-stone-300' : 'text-stone-500',
        )}
      >
        <Icon size={16} aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-y-1 lg:flex-row lg:items-center lg:gap-x-6">
        <div className="min-w-0 flex-1">
          <p
            title={resource.fileName}
            className={cn(
              'truncate text-sm font-medium',
              textUnavailable
                ? 'text-stone-400 line-through decoration-stone-300'
                : 'text-stone-900',
            )}
          >
            {resource.fileName}
          </p>
          <p className="mt-0.5 text-[13px] text-stone-500">
            <span title={resource.fileType}>
              {fileTypeLabel(resource.fileType, resource.fileName)}
            </span>
            {' · '}
            <span className="tabular-nums">{formatFileSize(resource.fileSize)}</span>
            {' · '}
            Added {formatTimestamp(resource.createdAt)}
          </p>
        </div>
        {showStatus && (
          <div className="min-w-0 empty:hidden lg:w-60 lg:flex-shrink-0 lg:empty:block">
            <ResourceProcessingStatus resource={resource} />
          </div>
        )}
      </div>

      <div className="flex h-9 flex-shrink-0 items-center">
        {isDeleting ? (
          <span className="flex h-9 w-9 items-center justify-center text-stone-400">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            <span className="sr-only">Removing {resource.fileName}</span>
          </span>
        ) : (
          <Menu
            label={`Actions for ${resource.fileName}`}
            items={[
              {
                label: 'Remove file',
                icon: Trash2,
                tone: 'danger',
                disabled: removeDisabled,
                hint: removeDisabled ? 'Wait for the current removal to finish' : undefined,
                onSelect: () => onRemove(resource),
              },
            ]}
          />
        )}
      </div>
    </li>
  );
};
