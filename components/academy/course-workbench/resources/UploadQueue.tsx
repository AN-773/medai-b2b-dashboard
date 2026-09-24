import React from 'react';
import { AlertTriangle, Check, File as FileIcon, FileVideo, RotateCcw, X } from 'lucide-react';
import { IconButton, ProgressBar, cn } from '@/components/ui';
import { formatFileSize } from './fileDisplay';

export type UploadItemStatus = 'pending' | 'uploading' | 'done' | 'error' | 'canceled';

export interface UploadItem {
  key: string;
  fileName: string;
  fileSize: number;
  isVideo: boolean;
  status: UploadItemStatus;
  percent: number;
  error?: string;
  /** False for files refused before any transfer — sending them again can't help. */
  retryable: boolean;
}

interface UploadQueueProps {
  items: UploadItem[];
  isUploading: boolean;
  onCancel: () => void;
  onRetry: (key: string) => void;
  onDismiss: (key: string) => void;
}

const statusText = (item: UploadItem) => {
  switch (item.status) {
    case 'pending':
      return 'Queued';
    case 'uploading':
      return `Uploading · ${item.percent}%`;
    case 'done':
      return 'Uploaded';
    case 'canceled':
      return 'Canceled';
    case 'error':
      return 'Not uploaded';
  }
};

/** In-flight uploads plus the ones the teacher still has to deal with. */
export const UploadQueue: React.FC<UploadQueueProps> = ({
  items,
  isUploading,
  onCancel,
  onRetry,
  onDismiss,
}) => {
  const remaining = items.filter(
    (item) => item.status === 'pending' || item.status === 'uploading',
  ).length;

  return (
    <section
      aria-label="Uploads"
      className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card"
    >
      <ul className="divide-y divide-stone-100">
        {items.map((item) => {
          const Icon =
            item.status === 'done'
              ? Check
              : item.status === 'error'
                ? AlertTriangle
                : item.isVideo
                  ? FileVideo
                  : FileIcon;
          const settled = item.status === 'error' || item.status === 'canceled';
          return (
            <li key={item.key} className="flex items-start gap-3 px-4 py-3">
              <div
                className={cn(
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                  item.status === 'done'
                    ? 'bg-brand-50 text-brand-700'
                    : item.status === 'error'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-stone-100 text-stone-500',
                )}
              >
                <Icon size={16} aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <p title={item.fileName} className="truncate text-sm font-medium text-stone-900">
                  {item.fileName}
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-[13px] tabular-nums',
                    item.status === 'error' ? 'text-red-700' : 'text-stone-500',
                  )}
                >
                  {formatFileSize(item.fileSize)} · {statusText(item)}
                </p>
                {item.status === 'uploading' && (
                  <ProgressBar
                    value={item.percent}
                    max={100}
                    label={`Uploading ${item.fileName}`}
                    className="mt-2"
                  />
                )}
                {item.error && (
                  <p className="mt-1 text-[13px] leading-5 text-red-700">{item.error}</p>
                )}
              </div>

              <div className="-my-0.5 flex flex-shrink-0 items-center gap-0.5">
                {item.status === 'uploading' && (
                  <IconButton
                    icon={X}
                    size="sm"
                    label={remaining > 1 ? 'Cancel remaining uploads' : 'Cancel upload'}
                    onClick={onCancel}
                  />
                )}
                {!isUploading && settled && item.retryable && (
                  <IconButton
                    icon={RotateCcw}
                    size="sm"
                    label={`Retry upload of ${item.fileName}`}
                    onClick={() => onRetry(item.key)}
                  />
                )}
                {!isUploading && settled && (
                  <IconButton
                    icon={X}
                    size="sm"
                    label={`Dismiss ${item.fileName}`}
                    onClick={() => onDismiss(item.key)}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
