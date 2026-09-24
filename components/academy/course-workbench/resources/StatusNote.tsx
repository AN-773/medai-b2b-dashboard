import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { IconButton } from '@/components/ui';

/** Dismissible success line — the positive counterpart of `InlineAlert`. */
export const StatusNote: React.FC<{ children: React.ReactNode; onDismiss?: () => void }> = ({
  children,
  onDismiss,
}) => (
  <div
    role="status"
    className="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-900"
  >
    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-brand-700" aria-hidden="true" />
    <p className="min-w-0 flex-1">{children}</p>
    {onDismiss && (
      <IconButton
        icon={X}
        size="sm"
        label="Dismiss"
        onClick={onDismiss}
        className="-my-1 -mr-1.5"
      />
    )}
  </div>
);
