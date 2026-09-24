import React, { useId, useMemo, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { SearchInput, Spinner, cn } from '@/components/ui';

export interface FilterOption {
  id: string;
  name: string;
}

interface FilterChecklistProps {
  label: string;
  options: FilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  /** Shown instead of the list while disabled, e.g. "Choose an organ system first." */
  disabledHint?: string;
  loading?: boolean;
  defaultOpen?: boolean;
}

const CHIP_LIMIT = 6;

/**
 * A collapsible multi-select for filter drawers: header with the selection
 * count, removable chips when collapsed, and a searchable checkbox list when open.
 */
export const FilterChecklist: React.FC<FilterChecklistProps> = ({
  label,
  options,
  values,
  onChange,
  disabled = false,
  disabledHint,
  loading = false,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const panelId = useId();

  const selected = useMemo(
    () => options.filter((option) => values.includes(option.id)),
    [options, values],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((option) => option.name?.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  const toggle = (id: string) =>
    onChange(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);

  return (
    <section className="py-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <span className="flex-1 text-sm font-medium text-stone-900">{label}</span>
        <span className={cn('text-[13px] tabular-nums', values.length ? 'text-stone-900' : 'text-stone-400')}>
          {values.length ? `${values.length} selected` : 'Any'}
        </span>
        <ChevronDown
          size={16}
          className={cn('flex-shrink-0 text-stone-400 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {!open && selected.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Selected ${label.toLowerCase()}`}>
          {selected.slice(0, CHIP_LIMIT).map((option) => (
            <li
              key={option.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-stone-100 py-0.5 pl-2 pr-1 text-xs text-stone-700"
            >
              <span className="truncate">{option.name}</span>
              <button
                type="button"
                onClick={() => toggle(option.id)}
                aria-label={`Remove ${option.name}`}
                className="rounded p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-800"
              >
                <X size={12} />
              </button>
            </li>
          ))}
          {selected.length > CHIP_LIMIT && (
            <li className="py-0.5 text-xs text-stone-500">+{selected.length - CHIP_LIMIT} more</li>
          )}
        </ul>
      )}

      {open && (
        <div id={panelId} className="mt-2 space-y-2">
          {disabled ? (
            <p className="text-[13px] text-stone-500">{disabledHint ?? 'Not available.'}</p>
          ) : loading ? (
            <Spinner label="Loading options…" className="justify-start py-2" />
          ) : options.length === 0 ? (
            <p className="text-[13px] text-stone-500">No options available.</p>
          ) : (
            <>
              {options.length > 8 && (
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder={`Search ${label.toLowerCase()}`}
                />
              )}
              <div
                role="group"
                aria-label={label}
                className="max-h-56 overflow-y-auto rounded-lg border border-stone-200 custom-scrollbar"
              >
                {visible.length === 0 ? (
                  <p className="px-3 py-3 text-[13px] text-stone-500">No matches.</p>
                ) : (
                  visible.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center gap-2.5 border-b border-stone-100 px-3 py-2 text-sm text-stone-700 transition last:border-b-0 hover:bg-stone-50"
                    >
                      <input
                        type="checkbox"
                        checked={values.includes(option.id)}
                        onChange={() => toggle(option.id)}
                        className="h-4 w-4 flex-shrink-0 rounded border-stone-300 accent-brand-600"
                      />
                      <span className="min-w-0 flex-1">{option.name}</span>
                    </label>
                  ))
                )}
              </div>
              {values.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[13px] text-stone-500 transition hover:text-stone-900"
                >
                  Clear {label.toLowerCase()}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default FilterChecklist;
