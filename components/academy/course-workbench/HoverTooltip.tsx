import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipState {
  top: number;
  left: number;
  placement: 'above' | 'below';
}

interface HoverTooltipProps {
  /** Full text shown in the tooltip bubble. */
  label: string;
  /** Trigger content (typically the truncated text). */
  children: React.ReactNode;
  /** Classes applied to the inline trigger wrapper. */
  className?: string;
  /** Delay before the tooltip appears, in ms. */
  delay?: number;
}

/**
 * Lightweight hover tooltip that appears after a short, configurable delay —
 * unlike the native `title` attribute, whose ~1.5s delay the browser controls.
 * The bubble is portaled to <body> so it is never clipped by scroll containers.
 */
const HoverTooltip: React.FC<HoverTooltipProps> = ({
  label,
  children,
  className,
  delay = 500,
}) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<number>();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const show = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      const element = triggerRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const placement: TooltipState['placement'] =
        rect.top < 56 ? 'below' : 'above';
      setTooltip({
        top: placement === 'below' ? rect.bottom + 8 : rect.top - 8,
        left: rect.left + rect.width / 2,
        placement,
      });
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    setTooltip(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  return (
    <span
      ref={triggerRef}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {tooltip &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: 'fixed',
              top: tooltip.top,
              left: tooltip.left,
              transform:
                tooltip.placement === 'below'
                  ? 'translateX(-50%)'
                  : 'translate(-50%, -100%)',
            }}
            className="pointer-events-none z-[200] max-w-xs whitespace-normal break-words rounded-lg bg-slate-900 px-2.5 py-1.5 text-left text-xs font-semibold leading-snug text-white shadow-lg shadow-slate-900/20"
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
};

export default HoverTooltip;
