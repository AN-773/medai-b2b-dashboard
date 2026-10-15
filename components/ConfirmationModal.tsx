import React from 'react';
import { Button, Dialog } from '@/components/ui';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Legacy confirmation API, rendered exactly like `ConfirmDialog` from
 * `@/components/ui` (prefer that in new code). It is composed from the same
 * `Dialog` + `Button` primitives rather than wrapping `ConfirmDialog` because
 * callers can rename the cancel action (`cancelLabel`), which `ConfirmDialog`
 * doesn't support. `danger` confirms with the red button; `warning` and `info`
 * use the ink primary button (ConfirmDialog's `default` tone).
 */
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => (
  <Dialog
    open={isOpen}
    onClose={onCancel}
    title={title}
    footer={
      <>
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger-solid' : 'primary'}
          onClick={onConfirm}
          data-autofocus
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-sm leading-6 text-stone-600">{message}</p>
  </Dialog>
);

export default ConfirmationModal;
