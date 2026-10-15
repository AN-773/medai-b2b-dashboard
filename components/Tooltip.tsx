import React, { ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Side = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: Side;
  className?: string; // Additional classes for the tooltip container (not the wrapper)
}

const GAP = 8;
const EDGE = 8;

/**
 * Hover/focus tooltip. Rendered in a portal with fixed positioning so tables
 * and scroll containers never clip it; flips to the opposite side when the
 * preferred side has no room.
 */
const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useLayoutEffect(() => {
    if (!isVisible || !wrapperRef.current) {
      setCoords(null);
      return;
    }
    const anchor = wrapperRef.current.getBoundingClientRect();
    const tip = tooltipRef.current?.getBoundingClientRect();
    const height = tip?.height || 40;
    const width = tip?.width || 150;

    const spaceTop = anchor.top;
    const spaceBottom = window.innerHeight - anchor.bottom;
    const spaceLeft = anchor.left;
    const spaceRight = window.innerWidth - anchor.right;

    // Try the preferred side first, fall back to the roomier opposite side.
    let side: Side = position;
    if (position === 'top' && spaceTop < height + GAP) side = spaceBottom > spaceTop ? 'bottom' : 'top';
    else if (position === 'bottom' && spaceBottom < height + GAP) side = spaceTop > spaceBottom ? 'top' : 'bottom';
    else if (position === 'left' && spaceLeft < width + GAP) side = spaceRight > spaceLeft ? 'right' : 'left';
    else if (position === 'right' && spaceRight < width + GAP) side = spaceLeft > spaceRight ? 'left' : 'right';

    const centerX = anchor.left + anchor.width / 2 - width / 2;
    const centerY = anchor.top + anchor.height / 2 - height / 2;
    const next =
      side === 'top'
        ? { top: anchor.top - height - GAP, left: centerX }
        : side === 'bottom'
          ? { top: anchor.bottom + GAP, left: centerX }
          : side === 'left'
            ? { top: centerY, left: anchor.left - width - GAP }
            : { top: centerY, left: anchor.right + GAP };

    setCoords({
      top: Math.max(EDGE, Math.min(next.top, window.innerHeight - height - EDGE)),
      left: Math.max(EDGE, Math.min(next.left, window.innerWidth - width - EDGE)),
    });
  }, [isVisible, position, content]);

  // A fixed tooltip would drift away from its anchor on scroll — hide it instead.
  useEffect(() => {
    if (!isVisible) return;
    const hide = () => setIsVisible(false);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [isVisible]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex max-w-full items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsVisible(false);
      }}
      aria-describedby={isVisible ? tooltipId : undefined}
    >
      {children}
      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            style={{
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className={`pointer-events-none fixed z-[140] w-max max-w-[300px] rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-medium leading-5 text-white shadow-pop animate-fade-in ${className}`}
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
};

export default Tooltip;
