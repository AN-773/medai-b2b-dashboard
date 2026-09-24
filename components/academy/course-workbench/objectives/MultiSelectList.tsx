import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SearchInput } from '@/components/ui';

export interface MultiSelectOption {
  id: string;
  name: string;
}

interface MultiSelectListProps {
  /** Id for the search box, so a `Field` label points at it. */
  id?: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Shown instead of the list when there are no options (e.g. still loading). */
  emptyLabel?: string;
}

/**
 * Inline multi-select: selected values as removable chips, a filter box and a
 * short scrolling checkbox list. Stays inside the form (no popover to clip).
 */
const MultiSelectList: React.FC<MultiSelectListProps> = ({
  id,
  options,
  values,
  onChange,
  disabled = false,
  placeholder = 'Search',
  emptyLabel = 'Nothing to choose from',
}) => {
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () =>
      values
        .map((value) => options.find((option) => option.id === value))
        .filter((option): option is MultiSelectOption => Boolean(option)),
    [options, values],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? options.filter((option) => option.name.toLowerCase().includes(needle))
      : options;
  }, [options, query]);

  const toggle = (optionId: string) =>
    onChange(
      values.includes(optionId)
        ? values.filter((value) => value !== optionId)
        : [...values, optionId],
    );

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <span
              key={option.id}
              className="inline-flex items-center gap-1 rounded-md bg-stone-100 py-0.5 pl-2 pr-1 text-xs font-medium text-stone-700 ring-1 ring-inset ring-stone-200/70"
            >
              {option.name}
              <button
                type="button"
                onClick={() => toggle(option.id)}
                disabled={disabled}
                aria-label={`Remove ${option.name}`}
                className="rounded p-0.5 text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-700 disabled:opacity-40"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <SearchInput
        id={id}
        value={query}
        onChange={setQuery}
        placeholder={placeholder}
        disabled={disabled || options.length === 0}
      />
      <div className="max-h-44 overflow-y-auto rounded-lg border border-stone-200 py-1 custom-scrollbar">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-[13px] text-stone-500">{emptyLabel}</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-[13px] text-stone-500">No matches</p>
        ) : (
          filtered.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-50"
            >
              <input
                type="checkbox"
                checked={values.includes(option.id)}
                onChange={() => toggle(option.id)}
                disabled={disabled}
                className="h-4 w-4 flex-shrink-0 rounded border-stone-300 accent-brand-600"
              />
              <span className="min-w-0">{option.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
};

export default MultiSelectList;
