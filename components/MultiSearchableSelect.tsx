import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Badge, Button, cn } from '@/components/ui';
import { SelectPopover, filterOptions, isTypeaheadKey } from '@/components/select/SelectPopover';

export interface SelectOption {
  id: string;
  name: string;
}

interface MultiSearchableSelectProps {
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Multi-value combobox: selected values sit in the control as removable chips,
 * the portaled listbox toggles options and stays open, and "Clear" empties it.
 */
const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  options,
  values,
  onChange,
  placeholder = 'Select options...',
  label,
  disabled = false,
  className = '',
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

  const filteredOptions = filterOptions(options, searchQuery);
  const selectedOptions = options.filter((option) => values.includes(option.id));
  const hasValues = values.length > 0;
  const canClear = hasValues && !disabled;

  const close = (restoreFocus: boolean) => {
    setIsOpen(false);
    setSearchQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (disabled && isOpen) close(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const handleSelect = (optionId: string) => {
    if (values.includes(optionId)) {
      onChange(values.filter((v) => v !== optionId));
    } else {
      onChange([...values, optionId]);
    }
  };

  const removeValue = (optionId: string) => {
    onChange(values.filter((v) => v !== optionId));
  };

  const clearAll = () => onChange([]);

  const toggle = () => {
    if (disabled) return;
    if (isOpen) close(true);
    else setIsOpen(true);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || isOpen) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
    } else if (event.key === 'Backspace' && hasValues) {
      // Like a tag input: Backspace on the closed control drops the last chip.
      event.preventDefault();
      onChange(values.slice(0, -1));
    } else if (isTypeaheadKey(event)) {
      event.preventDefault();
      setSearchQuery(event.key);
      setIsOpen(true);
    }
  };

  const summary = selectedOptions.map((option) => option.name).join(', ');

  return (
    <div className={cn('min-w-0', className)} ref={rootRef}>
      {label && (
        <label
          id={labelId}
          htmlFor={triggerId}
          className="mb-1.5 block text-[13px] font-medium text-stone-700"
        >
          {label}
        </label>
      )}

      {/* The whole control opens the list; chips and the clear button stop the click. */}
      <div
        ref={anchorRef}
        onClick={toggle}
        className={cn(
          'relative flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border bg-white py-1 pl-1.5 text-sm shadow-card transition',
          canClear ? 'pr-14' : 'pr-8',
          disabled
            ? 'cursor-not-allowed border-stone-200 bg-stone-50'
            : 'cursor-pointer border-stone-200 hover:border-stone-300',
          isOpen
            ? 'border-brand-500 ring-[3px] ring-brand-500/15'
            : 'focus-within:border-brand-500 focus-within:ring-[3px] focus-within:ring-brand-500/15',
        )}
      >
        {selectedOptions.map((option) => (
          <Badge
            key={option.id}
            className={cn('max-w-full', disabled ? 'text-stone-500' : 'pr-0.5')}
            title={option.name}
          >
            <span className="max-w-[12rem] truncate">{option.name}</span>
            {!disabled && (
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Remove ${option.name}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  removeValue(option.id);
                }}
                className="rounded p-px text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-700"
              >
                <X size={12} />
              </button>
            )}
          </Badge>
        ))}

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
          onKeyDown={handleTriggerKeyDown}
          className="h-6 min-w-[3rem] flex-1 truncate bg-transparent px-1.5 text-left outline-none disabled:cursor-not-allowed"
        >
          {selectedOptions.length > 0 ? (
            <span className="sr-only">
              {selectedOptions.length} selected: {summary}
            </span>
          ) : (
            <span className="text-stone-400">{placeholder}</span>
          )}
        </button>

        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-0.5">
          {canClear && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                clearAll();
                triggerRef.current?.focus();
              }}
              aria-label={label ? `Clear ${label}` : 'Clear all'}
              title="Clear all"
              className="pointer-events-auto rounded p-0.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={cn('text-stone-400 transition-transform duration-150', isOpen && 'rotate-180')}
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
        isSelected={(id) => values.includes(id)}
        onPick={handleSelect}
        onDismiss={close}
        multiple
        footer={
          <>
            <span className="text-[13px] tabular-nums text-stone-500">
              {hasValues ? `${values.length} selected` : 'None selected'}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" tabIndex={-1} onClick={clearAll} disabled={!hasValues}>
                Clear
              </Button>
              <Button variant="secondary" size="sm" tabIndex={-1} onClick={() => close(true)}>
                Done
              </Button>
            </div>
          </>
        }
      />
    </div>
  );
};

export default MultiSearchableSelect;
