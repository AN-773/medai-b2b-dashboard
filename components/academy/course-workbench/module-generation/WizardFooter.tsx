import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * The wizard's Drawer owns one sticky footer, but each step owns its actions
 * (they depend on the step's local state). Steps render `<WizardFooter>` and
 * their buttons are portaled into the Drawer footer.
 */
export const WizardFooterSlot = createContext<HTMLElement | null>(null);

interface WizardFooterProps {
  /** Short status line on the left ("Unsaved changes", a validation hint). */
  hint?: React.ReactNode;
  /** Destructive or secondary action pinned to the far left. */
  start?: React.ReactNode;
  children?: React.ReactNode;
}

export const WizardFooter: React.FC<WizardFooterProps> = ({ hint, start, children }) => {
  const slot = useContext(WizardFooterSlot);
  if (!slot) return null;
  return createPortal(
    <>
      {start}
      <div className="min-w-0 flex-1 text-[13px] leading-5 text-stone-500">{hint}</div>
      {children}
    </>,
    slot,
  );
};
