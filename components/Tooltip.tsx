import React, { ReactNode, useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string; // Additional classes for the tooltip container (not the wrapper)
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(position);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Styles for different positions
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-t-transparent border-b-transparent border-l-transparent',
  };

  const handleMouseEnter = () => {
    if (wrapperRef.current && tooltipRef.current) {
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      // Calculate available space
      const spaceTop = wrapperRect.top;
      const spaceBottom = window.innerHeight - wrapperRect.bottom;
      const spaceLeft = wrapperRect.left;
      const spaceRight = window.innerWidth - wrapperRect.right;
      
      // Assume a minimum tooltip height/width for calculation if it hasn't fully rendered yet
      const tooltipHeight = tooltipRect.height || 40; 
      const tooltipWidth = tooltipRect.width || 150;
      const spacing = 10; // extra padding

      let bestPosition = position;

      // Try preferred position first, fallback if not enough space
      if (position === 'top' && spaceTop < tooltipHeight + spacing) {
        bestPosition = spaceBottom > spaceTop ? 'bottom' : 'top';
      } else if (position === 'bottom' && spaceBottom < tooltipHeight + spacing) {
        bestPosition = spaceTop > spaceBottom ? 'top' : 'bottom';
      } else if (position === 'left' && spaceLeft < tooltipWidth + spacing) {
        bestPosition = spaceRight > spaceLeft ? 'right' : 'left';
      } else if (position === 'right' && spaceRight < tooltipWidth + spacing) {
        bestPosition = spaceLeft > spaceRight ? 'left' : 'right';
      }

      // If we preferred top/bottom but there's no vertical space, try sides
      if ((bestPosition === 'top' || bestPosition === 'bottom') && 
          spaceTop < tooltipHeight + spacing && spaceBottom < tooltipHeight + spacing) {
        bestPosition = spaceRight > spaceLeft ? 'right' : 'left';
      }

      setCurrentPosition(bestPosition);
    }
    
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <div 
      className="relative inline-flex items-center justify-center"
      ref={wrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {/* Tooltip Content */}
      <div 
        ref={tooltipRef}
        className={`absolute z-50 transition-all duration-200 w-max max-w-[300px] px-3 py-2 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-lg pointer-events-none 
          ${isVisible ? 'visible opacity-100 scale-100' : 'invisible opacity-0 scale-95'} 
          ${positionClasses[currentPosition]} ${className}`}
      >
        {content}
        
        {/* Tooltip Arrow */}
        <div 
          className={`absolute border-4 ${arrowClasses[currentPosition]}`} 
        />
      </div>
    </div>
  );
};

export default Tooltip;
