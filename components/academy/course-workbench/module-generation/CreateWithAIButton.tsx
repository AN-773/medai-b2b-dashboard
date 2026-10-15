import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import HoverTooltip from '@/components/academy/course-workbench/HoverTooltip';

export interface CreateWithAIButtonProps {
  /** Why the button is disabled, shown as a tooltip; `null` when enabled. */
  disabledReason: string | null;
  isChecking: boolean;
  onClick: () => void;
  /** Icon plus "AI" only, for the narrow outline rail. */
  compact?: boolean;
  className?: string;
}

const CreateWithAIButton: React.FC<CreateWithAIButtonProps> = ({
  disabledReason,
  isChecking,
  onClick,
  compact = false,
  className = '',
}) => {
  const disabled = Boolean(disabledReason);
  const tooltip = disabledReason ?? (compact ? 'Create modules and sessions with AI' : null);
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Create with AI"
      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-50 ${tooltip ? '' : className}`}
    >
      {isChecking ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      {compact ? 'AI' : 'Create with AI'}
    </button>
  );

  if (tooltip) {
    return (
      <HoverTooltip label={tooltip} className={`inline-flex flex-shrink-0 ${className}`} delay={disabledReason ? 150 : 500}>
        {button}
      </HoverTooltip>
    );
  }
  return button;
};

export default CreateWithAIButton;
