import React from 'react';
import { AlertTriangle, Loader2, X, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';
import { Dialog } from './Overlay';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Compact variant for use inside cards and drawers. */
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'px-4 py-8' : 'px-6 py-16',
      className,
    )}
  >
    {Icon && (
      <div
        className={cn(
          'mb-3 flex items-center justify-center rounded-xl bg-stone-100 text-stone-500',
          compact ? 'h-9 w-9' : 'h-11 w-11',
        )}
      >
        <Icon size={compact ? 17 : 20} />
      </div>
    )}
    <p className={cn('font-semibold text-stone-900', compact ? 'text-sm' : 'text-[15px]')}>
      {title}
    </p>
    {description && (
      <p className="mt-1 max-w-sm text-[13px] leading-5 text-stone-500">{description}</p>
    )}
    {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);

export const Spinner: React.FC<{ label?: string; className?: string }> = ({
  label,
  className,
}) => (
  <div className={cn('flex items-center justify-center gap-2 text-sm text-stone-500', className)}>
    <Loader2 size={16} className="animate-spin text-brand-600" />
    {label}
  </div>
);

interface InlineAlertProps {
  tone?: 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

const ALERT_TONES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

export const InlineAlert: React.FC<InlineAlertProps> = ({
  tone = 'error',
  title,
  children,
  onDismiss,
  action,
  className,
}) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={cn('flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm', ALERT_TONES[tone], className)}
  >
    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 opacity-80" />
    <div className="min-w-0 flex-1">
      {title && <p className="font-medium">{title}</p>}
      <div className={title ? 'mt-0.5 opacity-90' : undefined}>{children}</div>
    </div>
    {action}
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-m-0.5 rounded p-0.5 opacity-60 transition hover:opacity-100"
      >
        <X size={15} />
      </button>
    )}
  </div>
);

interface ProgressBarProps {
  value: number;
  max: number;
  tone?: 'brand' | 'amber';
  className?: string;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  tone = 'brand',
  className,
  label,
}) => {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-stone-200/80', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width]', tone === 'brand' ? 'bg-brand-500' : 'bg-amber-500')}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'default';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) => (
  <Dialog
    open={open}
    onClose={onCancel}
    dismissible={!busy}
    title={title}
    footer={
      <>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger-solid' : 'primary'}
          onClick={onConfirm}
          loading={busy}
          data-autofocus
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-sm leading-6 text-stone-600">{description}</p>
  </Dialog>
);
