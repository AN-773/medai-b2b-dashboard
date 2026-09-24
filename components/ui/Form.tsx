import React, { useId } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from './cn';

/** Base control styling shared by inputs, selects and textareas. */
export const controlClass =
  'w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 shadow-card outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400';

interface FieldProps {
  label: string;
  /** Muted text after the label, e.g. "Optional". */
  hint?: string;
  /** Helper text under the control. */
  description?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: (id: string) => React.ReactNode;
}

/** Label + control + helper text. Children receive the generated control id. */
export const Field: React.FC<FieldProps> = ({
  label,
  hint,
  description,
  error,
  className,
  children,
}) => {
  const id = useId();
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium text-stone-700">
        {label}
        {hint && <span className="font-normal text-stone-400">{hint}</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : description ? (
        <p className="mt-1.5 text-xs text-stone-500">{description}</p>
      ) : null}
    </div>
  );
};

export const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }
> = ({ className, ...rest }) => <input className={cn(controlClass, 'h-9', className)} {...rest} />;

export const Textarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }
> = ({ className, ...rest }) => (
  <textarea className={cn(controlClass, 'resize-none py-2 leading-6', className)} {...rest} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className,
  children,
  ...rest
}) => (
  <select className={cn(controlClass, 'h-9 pr-8', className)} {...rest}>
    {children}
  </select>
);

interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  className,
  placeholder = 'Search',
  ...rest
}) => (
  <label className={cn('relative block', className)}>
    <Search
      size={15}
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
    />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={rest['aria-label'] ?? placeholder}
      className={cn(controlClass, 'h-9 pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden')}
      {...rest}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
      >
        <X size={14} />
      </button>
    )}
  </label>
);

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
}

/** A full-width setting row: text on the left, toggle on the right. */
export const SwitchRow: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled,
}) => {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p id={id} className="text-sm font-medium text-stone-900">
          {label}
        </p>
        {description && <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-stone-300',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
};
