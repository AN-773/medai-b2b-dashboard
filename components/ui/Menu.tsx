import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Shown as a tooltip, e.g. why an item is disabled. */
  hint?: string;
}

interface MenuProps {
  items: MenuItem[];
  label?: string;
  /** Custom trigger; defaults to a "⋯" icon button. */
  trigger?: (props: {
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
    ref: React.Ref<HTMLButtonElement>;
  }) => React.ReactNode;
  align?: 'start' | 'end';
  size?: 'sm' | 'md';
}

/** Small action menu, portaled so scroll containers never clip it. */
export const Menu: React.FC<MenuProps> = ({
  items,
  label = 'More actions',
  trigger,
  align = 'end',
  size = 'md',
}) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 200;
    const left = align === 'end' ? rect.right - width : rect.left;
    setPosition({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    });
  }, [align, open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    const close = () => setOpen(false);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const options = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
        );
        const index = options.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
        options[(next + options.length) % options.length]?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const toggle = () => setOpen((current) => !current);

  return (
    <>
      {trigger ? (
        trigger({ onClick: toggle, 'aria-expanded': open, 'aria-haspopup': 'menu', ref: triggerRef })
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          aria-label={label}
          title={label}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            'inline-flex flex-shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
            open && 'bg-stone-100 text-stone-900',
            size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
          )}
        >
          <MoreHorizontal size={size === 'sm' ? 16 : 18} />
        </button>
      )}
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={{ top: position.top, left: position.left, width: 200 }}
            className="fixed z-[130] rounded-xl border border-stone-200 bg-white p-1 shadow-pop animate-fade-in"
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  title={item.hint}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    item.tone === 'danger'
                      ? 'text-red-600 hover:bg-red-50 focus:bg-red-50'
                      : 'text-stone-700 hover:bg-stone-100 focus:bg-stone-100',
                  )}
                >
                  {Icon && <Icon size={15} className="flex-shrink-0" />}
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
};
