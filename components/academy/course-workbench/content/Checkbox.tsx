import React, { useEffect, useRef } from 'react';
import { cn } from '@/components/ui';

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Shows the mixed state (e.g. some rows on the page are selected). */
  indeterminate?: boolean;
}

/** Native checkbox in the design-system accent, with an indeterminate state. */
export const Checkbox: React.FC<CheckboxProps> = ({
  indeterminate = false,
  className,
  ...rest
}) => {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'h-4 w-4 flex-shrink-0 cursor-pointer rounded border-stone-300 accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed',
        className,
      )}
      {...rest}
    />
  );
};
