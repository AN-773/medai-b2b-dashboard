import React from 'react';
import { Upload, UploadCloud } from 'lucide-react';
import { Button, EmptyState, cn } from '@/components/ui';

interface EmptyDropzoneProps {
  isDragging: boolean;
  isUploading: boolean;
  /** Accepted formats and size limit, e.g. "PDF, DOCX · up to 150 MB each". */
  formatsHint: string;
  onBrowse: () => void;
}

/**
 * The empty course: a large dashed target. Clicking anywhere opens the picker
 * for mouse users; the button inside is the keyboard route. Drops are handled
 * by the panel, which accepts files anywhere over it.
 */
export const EmptyDropzone: React.FC<EmptyDropzoneProps> = ({
  isDragging,
  isUploading,
  formatsHint,
  onBrowse,
}) => (
  <div
    onClick={onBrowse}
    className={cn(
      'rounded-xl border-2 border-dashed transition-colors',
      isUploading
        ? 'cursor-progress border-stone-200 bg-stone-50/60'
        : isDragging
          ? 'cursor-copy border-brand-500 bg-brand-50'
          : 'cursor-pointer border-stone-200 bg-stone-50/60 hover:border-stone-300 hover:bg-stone-50',
    )}
  >
    <EmptyState
      icon={UploadCloud}
      title="No resources yet"
      description={
        <>
          Drag slides, notes and readings here, or upload them from your computer. Learners
          can open them right away — there’s no publish step.
          <span className="mt-2 block text-stone-400">{formatsHint}</span>
        </>
      }
      action={
        <Button
          variant="primary"
          icon={Upload}
          disabled={isUploading}
          onClick={(event) => {
            event.stopPropagation();
            onBrowse();
          }}
        >
          Upload files
        </Button>
      }
    />
  </div>
);

/** Shown over the whole panel while files are dragged across it. */
export const DropOverlay: React.FC<{ formatsHint: string }> = ({ formatsHint }) => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute -inset-2 z-20 flex justify-center rounded-xl border-2 border-dashed border-brand-500 bg-brand-50/85 animate-fade-in"
  >
    <div className="sticky top-24 mt-16 flex h-fit flex-col items-center self-start rounded-xl bg-white px-6 py-5 text-center shadow-pop">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <UploadCloud size={20} />
      </div>
      <p className="text-sm font-medium text-stone-900">Drop files to upload</p>
      <p className="mt-0.5 max-w-xs text-[13px] text-stone-500">{formatsHint}</p>
    </div>
  </div>
);
