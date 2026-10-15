import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { cn, controlClass } from '@/components/ui';
import { SelectPopover, filterOptions, isTypeaheadKey } from '@/components/select/SelectPopover';

export interface SelectOption {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  allOption?: { id: string; name: string };
  className?: string;
  onAddClick?: () => void;
  addLabel?: string;
}

/**
 * Single-value combobox with a searchable, portaled listbox. `allOption` is
 * always the first option and doubles as the "nothing selected" value that
 * the clear button resets to.
 */
const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  label,
  disabled = false,
  allOption = { id: 'ALL', name: 'All' },
  className = '',
  onAddClick,
  addLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const labelId = `${baseId}-label`;
  const listboxId = `${baseId}-listbox`;

  const allOptions = [allOption, ...options];
  const filteredOptions = filterOptions(allOptions, searchQuery);
  const selectedOption = allOptions.find((option) => option.id === value);
  const displayValue = selectedOption?.name || placeholder;
  const isAllSelected = value === allOption.id;
  const canClear = !isAllSelected && !disabled;

  const close = (restoreFocus: boolean) => {
    setIsOpen(false);
    setSearchQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  };

  // A control that becomes disabled while open (e.g. a parent reloading) closes.
  useEffect(() => {
    if (disabled && isOpen) close(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    close(true);
  };

  const handleClear = () => {
    onChange(allOption.id);
    setSearchQuery('');
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || isOpen) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
    } else if (isTypeaheadKey(event)) {
      // Typing on the closed control opens it with the search pre-filled.
      event.preventDefault();
      setSearchQuery(event.key);
      setIsOpen(true);
    }
  };

  return (
    <div className={cn('min-w-0', className)} ref={rootRef}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label
            id={labelId}
            htmlFor={triggerId}
            className="text-[13px] font-medium text-stone-700"
          >
            {label}
          </label>
          {onAddClick && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onAddClick();
              }}
              className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-stone-500 transition-colors hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Plus size={13} aria-hidden="true" />
              {addLabel || 'Add'}
            </button>
          )}
        </div>
      )}

      <div ref={anchorRef} className="relative">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : placeholder}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            if (isOpen) close(false);
            else setIsOpen(true);
          }}
          onKeyDown={handleTriggerKeyDown}
          title={selectedOption && !isAllSelected ? selectedOption.name : undefined}
          className={cn(
            controlClass,
            'flex h-9 cursor-pointer items-center text-left',
            canClear ? 'pr-14' : 'pr-8',
            isOpen && 'border-brand-500 ring-[3px] ring-brand-500/15',
          )}
        >
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              !selectedOption
                ? 'text-stone-400'
                : disabled || isAllSelected
                  ? 'text-stone-500'
                  : 'text-stone-900',
            )}
          >
            {displayValue}
          </span>
        </button>

        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-0.5">
          {canClear && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={label ? `Clear ${label}` : 'Clear selection'}
              title="Clear"
              className="pointer-events-auto rounded p-0.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={cn(
              'text-stone-400 transition-transform duration-150',
              isOpen && 'rotate-180',
            )}
          />
        </div>
      </div>

      <SelectPopover
        open={isOpen}
        anchorRef={anchorRef}
        insideRef={rootRef}
        listboxId={listboxId}
        label={label || placeholder}
        options={filteredOptions}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        isSelected={(id) => id === value}
        onPick={handleSelect}
        onDismiss={close}
      />
    </div>
  );
};

export default SearchableSelect;
