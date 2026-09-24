import React, { createContext, useContext } from 'react';
import { Menu as MenuIcon } from 'lucide-react';
import { IconButton, cn } from '@/components/ui';

interface ShellContextValue {
  openMobileNav: () => void;
}

export const ShellContext = createContext<ShellContextValue>({ openMobileNav: () => {} });

interface TopBarProps {
  children: React.ReactNode;
  /** Right-aligned controls. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The slim bar at the top of the page sheet. The layout renders one with the
 * page title; pages that need breadcrumbs render their own instead.
 */
export const TopBar: React.FC<TopBarProps> = ({ children, actions, className }) => {
  const { openMobileNav } = useContext(ShellContext);
  return (
    <div
      className={cn(
        'flex h-14 flex-shrink-0 items-center gap-3 border-b border-stone-200 px-4 sm:px-6',
        className,
      )}
    >
      <IconButton
        icon={MenuIcon}
        label="Open navigation"
        onClick={openMobileNav}
        className="-ml-1.5 xl:hidden"
      />
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">{children}</div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
};
