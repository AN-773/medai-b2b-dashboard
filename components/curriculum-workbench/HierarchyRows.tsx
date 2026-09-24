import React from 'react';
import { ChevronRight, Plus, type LucideIcon } from 'lucide-react';
import { Menu, cn, type MenuItem } from '@/components/ui';

/** "1 topic" / "12 topics". */
export const plural = (count: number, word: string, pluralWord = `${word}s`) =>
  `${count.toLocaleString()} ${count === 1 ? word : pluralWord}`;

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

/** One bordered card holding a divided list (the page's list pattern). */
export const ListCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('overflow-hidden rounded-xl border border-stone-200 bg-white', className)}>
    {children}
  </div>
);

/** Dashed frame for "nothing here yet" empty states. */
export const EmptyFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl border border-dashed border-stone-300">{children}</div>
);

interface NodeRowProps {
  icon: LucideIcon;
  title: string;
  /** One quiet line under the title. */
  meta?: React.ReactNode;
  onOpen: () => void;
  menuItems?: MenuItem[];
  menuLabel?: string;
}

/** A child node in the hierarchy: opens on click, `⋯` for edit / delete. */
export const NodeRow: React.FC<NodeRowProps> = ({
  icon: Icon,
  title,
  meta,
  onOpen,
  menuItems,
  menuLabel,
}) => (
  <li className="group flex items-center gap-1 pr-2 transition-colors hover:bg-stone-50">
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
    >
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500"
        aria-hidden="true"
      >
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium text-stone-900">{title}</span>
        {meta && <span className="block text-[13px] text-stone-500">{meta}</span>}
      </span>
      <ChevronRight
        size={16}
        className="flex-shrink-0 text-stone-300 transition-colors group-hover:text-stone-500"
        aria-hidden="true"
      />
    </button>
    {menuItems && menuItems.length > 0 && (
      <Menu size="sm" label={menuLabel ?? `Actions for ${title}`} items={menuItems} />
    )}
  </li>
);

/** Quiet trailing "+ Add …" row at the end of a list card. */
export const AddRow: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
    >
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-stone-300"
        aria-hidden="true"
      >
        <Plus size={14} />
      </span>
      {label}
    </button>
  </li>
);
