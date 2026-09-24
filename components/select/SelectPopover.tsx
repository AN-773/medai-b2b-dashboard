import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search } from 'lucide-react';
import { cn } from '@/components/ui';

/**
 * The searchable listbox popover shared by `SearchableSelect` and
 * `MultiSearchableSelect`. It is portaled (like `Menu`) so scroll containers
 * and drawers never clip it, and it owns the ARIA combobox/listbox wiring of
 * its search field: arrows move the active option, Enter picks it, Escape and
 * Tab close it and hand focus back to the trigger.
 */

export interface PopoverOption {
  id: string;
  name: string;
}

/** Case-insensitive substring match; options without a name never match. */
export const filterOptions = <T extends PopoverOption>(options: T[], query: string): T[] => {
  const needle = query.toLowerCase();
  return options.filter((option) => Boolean(option?.name?.toLowerCase().includes(needle)));
};

/** True for a single printable key press (used to "type to open and filter"). */
export const isTypeaheadKey = (event: React.KeyboardEvent) =>
  event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey;

interface Position {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  listMaxHeight: number;
}

const GAP = 4;
const EDGE = 8;
const MIN_WIDTH = 240;
const LIST_MAX = 272;
const LIST_MIN = 112;
const SEARCH_ROW = 41;
const FOOTER_ROW = 45;

/** Positions the popover under the anchor, flipping above it when there's more room there. */
const measure = (anchor: HTMLElement, hasFooter: boolean): Position | null => {
  const rect = anchor.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  // The anchor scrolled out of view: close rather than float over other content.
  if (rect.bottom < 0 || rect.top > viewportHeight) return null;

  const chrome = SEARCH_ROW + (hasFooter ? FOOTER_ROW : 0) + 2;
  const spaceBelow = viewportHeight - rect.bottom - GAP - EDGE;
  const spaceAbove = rect.top - GAP - EDGE;
  const placeAbove = spaceBelow < Math.min(LIST_MAX + chrome, 280) && spaceAbove > spaceBelow;
  const space = placeAbove ? spaceAbove : spaceBelow;
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), viewportWidth - EDGE * 2);

  return {
    left: Math.max(EDGE, Math.min(rect.left, viewportWidth - width - EDGE)),
    width,
    top: placeAbove ? undefined : rect.bottom + GAP,
    bottom: placeAbove ? viewportHeight - rect.top + GAP : undefined,
    listMaxHeight: Math.max(LIST_MIN, Math.min(LIST_MAX, space - chrome)),
  };
};

interface SelectPopoverProps {
  open: boolean;
  /** Element the popover is aligned to (the visible control). */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Pointer-downs inside this element don't count as "outside" (label, trigger, chips). */
  insideRef: React.RefObject<HTMLElement | null>;
  listboxId: string;
  /** Accessible name for the search field and listbox, e.g. "Organ system". */
  label: string;
  /** Options to show, already filtered by `query`. */
  options: PopoverOption[];
  query: string;
  onQueryChange: (query: string) => void;
  isSelected: (id: string) => boolean;
  onPick: (id: string) => void;
  /** Close request. `restoreFocus` is true for keyboard closes (Escape, Tab). */
  onDismiss: (restoreFocus: boolean) => void;
  multiple?: boolean;
  /** Sticky footer (e.g. "3 selected · Clear"). */
  footer?: React.ReactNode;
}

export const SelectPopover: React.FC<SelectPopoverProps> = ({
  open,
  anchorRef,
  insideRef,
  listboxId,
  label,
  options,
  query,
  onQueryChange,
  isSelected,
  onPick,
  onDismiss,
  multiple = false,
  footer,
}) => {
  const hasFooter = Boolean(footer);
  const [position, setPosition] = useState<Position | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  // Only keyboard moves scroll the active option into view; hovering must not.
  const scrollToActive = useRef(true);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const count = options.length;
  const active = count === 0 ? -1 : Math.min(activeIndex, count - 1);
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const hasPosition = position !== null;

  // Place the popover before paint, and start on the selected option.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;
    const next = measure(anchor, hasFooter);
    if (!next) {
      onDismissRef.current(false);
      return;
    }
    setPosition(next);
    scrollToActive.current = true;
    const selectedIndex = options.findIndex((option) => isSelected(option.id));
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    // Only on open: later option/selection changes keep the user's place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Follow the anchor while the page scrolls; close on outside pointer-downs.
  useEffect(() => {
    if (!open) return;
    const reposition = (event?: Event) => {
      const target = event?.target;
      if (target instanceof Node && popoverRef.current?.contains(target)) return;
      const anchor = anchorRef.current;
      if (!anchor) return;
      const next = measure(anchor, hasFooter);
      if (next) setPosition(next);
      else onDismissRef.current(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || insideRef.current?.contains(target)) return;
      onDismissRef.current(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [anchorRef, hasFooter, insideRef, open]);

  // Move focus into the search field once the popover is on screen.
  useEffect(() => {
    if (!open || !hasPosition) return;
    const input = inputRef.current;
    if (!input || document.activeElement === input) return;
    input.focus({ preventScroll: true });
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, [hasPosition, open]);

  useEffect(() => {
    if (!open || !hasPosition || active < 0 || !scrollToActive.current) return;
    optionRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, hasPosition, open]);

  if (!open || !position) return null;

  const move = (delta: number) => {
    if (count === 0) return;
    setActiveIndex((Math.max(active, 0) + delta + count) % count);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    scrollToActive.current = true;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (event.altKey) onDismiss(true);
        else move(-1);
        break;
      case 'PageDown':
        event.preventDefault();
        if (count) setActiveIndex(Math.min(count - 1, Math.max(active, 0) + 8));
        break;
      case 'PageUp':
        event.preventDefault();
        if (count) setActiveIndex(Math.max(0, active - 8));
        break;
      case 'Enter':
        // Never let Enter submit a surrounding form.
        event.preventDefault();
        if (active >= 0) onPick(options[active].id);
        break;
      case 'Escape':
        // Stop here so an enclosing Drawer / Dialog doesn't close too.
        event.preventDefault();
        event.stopPropagation();
        onDismiss(true);
        break;
      case 'Tab':
        // Focus returns to the trigger synchronously, so the browser's Tab
        // then moves on from there instead of from the portaled popover.
        onDismiss(true);
        break;
      default:
        break;
    }
  };

  optionRefs.current.length = count;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        left: position.left,
        width: position.width,
        top: position.top,
        bottom: position.bottom,
      }}
      // Keep focus in the search field when clicking options or footer buttons.
      onMouseDown={(event) => {
        if (event.target !== inputRef.current) event.preventDefault();
      }}
      className="fixed z-[130] flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-pop animate-fade-in"
    >
      <div className="flex items-center gap-2 border-b border-stone-100 px-3">
        <Search size={15} className="flex-shrink-0 text-stone-400" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          aria-label={`Search ${label}`}
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            scrollToActive.current = true;
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search…"
          autoComplete="off"
          spellCheck={false}
          className="h-10 w-full min-w-0 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
        />
      </div>

      <div
        id={listboxId}
        role="listbox"
        aria-label={label}
        aria-multiselectable={multiple || undefined}
        style={{ maxHeight: position.listMaxHeight }}
        className={cn('overflow-y-auto overscroll-contain p-1 custom-scrollbar', count === 0 && 'hidden')}
      >
        {options.map((option, index) => {
          const selected = isSelected(option.id);
          const isActive = index === active;
          return (
            <div
              key={`${option.id}-${index}`}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              id={optionId(index)}
              role="option"
              aria-selected={selected}
              title={option.name}
              onMouseMove={() => {
                if (isActive) return;
                scrollToActive.current = false;
                setActiveIndex(index);
              }}
              onClick={() => onPick(option.id)}
              className={cn(
                'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                isActive ? 'bg-stone-100 text-stone-900' : 'text-stone-700',
                selected && 'font-medium text-stone-900',
              )}
            >
              {multiple && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
                    selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white',
                  )}
                >
                  {selected && <Check size={12} strokeWidth={3} />}
                </span>
              )}
              <span className="line-clamp-2 min-w-0 flex-1 break-words">{option.name}</span>
              {!multiple && selected && (
                <Check size={15} className="flex-shrink-0 text-brand-600" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      {count === 0 && (
        <p className="px-3 py-6 text-center text-[13px] text-stone-500">
          {query ? `No matches for “${query}”` : 'No options available'}
        </p>
      )}
      <span className="sr-only" aria-live="polite">
        {count === 0 ? 'No results' : `${count} ${count === 1 ? 'result' : 'results'}`}
      </span>

      {footer && (
        <div className="flex items-center justify-between gap-3 border-t border-stone-100 py-1.5 pl-3 pr-1.5">
          {footer}
        </div>
      )}
    </div>,
    document.body,
  );
};
