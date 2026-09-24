import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './Button';

const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Shared overlay behaviour: Escape closes, focus moves inside on open (first
 * field, else the panel) and returns to the trigger on close, Tab is trapped.
 */
const useOverlay = (
  open: boolean,
  onClose: () => void,
  panelRef: React.RefObject<HTMLDivElement | null>,
  dismissible: boolean,
) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Read through a ref so toggling `dismissible` (e.g. while saving) doesn't
  // re-run the effect and yank focus back to the first field.
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>(
      '[data-autofocus], input:not([disabled]):not([type="hidden"]):not([type="checkbox"]), textarea:not([disabled])',
    );
    (firstField ?? panel)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      // A nested overlay (e.g. a confirm over a drawer) owns the keyboard.
      const activeDialog = (document.activeElement as HTMLElement | null)?.closest(
        '[role="dialog"]',
      );
      if (activeDialog && activeDialog !== panel) return;
      // An open menu closes itself on Escape; don't also close the overlay.
      if (event.key === 'Escape' && document.querySelector('[role="menu"]')) return;
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, panelRef]);
};

interface OverlayBaseProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Sticky footer, usually the action buttons. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Set false while saving so Escape / backdrop clicks can't lose work. */
  dismissible?: boolean;
}

interface DrawerProps extends OverlayBaseProps {
  /** Tailwind max-width class for the panel. */
  width?: string;
  /** Content between the header and the scrolling body (e.g. tabs). */
  toolbar?: React.ReactNode;
}

/** Right-hand slide-over for editing one thing without leaving the page. */
export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  description,
  footer,
  toolbar,
  children,
  width = 'max-w-2xl',
  dismissible = true,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useOverlay(open, onClose, panelRef, dismissible);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div
        className="absolute inset-0 bg-stone-900/25 animate-fade-in"
        onClick={() => dismissible && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-full flex-col bg-white shadow-overlay outline-none animate-drawer-in sm:m-2 sm:h-[calc(100%-1rem)] sm:rounded-xl',
          width,
        )}
      >
        <div className="flex items-start gap-4 border-b border-stone-200 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold text-stone-900">
              {title}
            </h2>
            {description && (
              <div className="mt-0.5 truncate text-[13px] text-stone-500">{description}</div>
            )}
          </div>
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} disabled={!dismissible} />
        </div>
        {toolbar}
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">{children}</div>
        {footer && (
          <div className="flex items-center gap-2 border-t border-stone-200 px-6 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};

interface DialogProps extends OverlayBaseProps {
  width?: string;
}

/** Centred modal for short, focused tasks (create, rename, confirm). */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  width = 'max-w-md',
  dismissible = true,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useOverlay(open, onClose, panelRef, dismissible);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-stone-900/30 animate-fade-in"
        onClick={() => dismissible && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-xl bg-white shadow-overlay outline-none animate-dialog-in',
          width,
        )}
      >
        <div className="px-6 pt-5">
          <h2 id={titleId} className="text-base font-semibold text-stone-900">
            {title}
          </h2>
          {description && <div className="mt-1 text-sm text-stone-500">{description}</div>}
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-stone-100 bg-stone-50/60 px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
