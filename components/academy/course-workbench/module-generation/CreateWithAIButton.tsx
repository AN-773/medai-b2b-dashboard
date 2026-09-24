import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button, cn } from '@/components/ui';
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
    <Button
      variant="ai"
      icon={Sparkles}
      size={compact ? 'sm' : 'md'}
      loading={isChecking}
      onClick={onClick}
      disabled={disabled}
      aria-label="Create with AI"
      // A disabled button swallows pointer events; let the tooltip wrapper get them.
      className={cn('disabled:pointer-events-none', !tooltip && className)}
    >
      {compact ? 'AI' : 'Create with AI'}
    </Button>
  );

  if (tooltip) {
    return (
      <HoverTooltip
        label={tooltip}
        className={cn('inline-flex flex-shrink-0', className)}
        delay={disabledReason ? 150 : 500}
      >
        {button}
      </HoverTooltip>
    );
  }
  return button;
};

export default CreateWithAIButton;
