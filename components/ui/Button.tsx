import React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-solid'
  | 'ai';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-stone-900 text-white shadow-card hover:bg-stone-800 active:bg-stone-950 disabled:bg-stone-300 disabled:text-stone-50 disabled:shadow-none',
  secondary:
    'border border-stone-200 bg-white text-stone-800 shadow-card hover:border-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:text-stone-300',
  danger: 'text-red-600 hover:bg-red-50 disabled:text-red-300 disabled:hover:bg-transparent',
  'danger-solid':
    'bg-red-600 text-white shadow-card hover:bg-red-700 disabled:bg-red-300',
  ai: 'border-ai-gradient text-stone-800 shadow-card hover:bg-stone-50 disabled:opacity-50',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-[13px]',
  md: 'h-9 gap-2 rounded-lg px-3.5 text-sm',
};

/**
 * The one button. Primary is ink (not brand green) so green can stay a pure
 * state colour; `ai` carries the brand gradient for anything Sina generates.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}) => {
  const iconSize = size === 'sm' ? 14 : 16;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : Icon ? (
        <Icon
          size={iconSize}
          className={variant === 'ai' ? 'text-violet-brand' : undefined}
          aria-hidden="true"
        />
      ) : null}
      {children}
      {IconRight && <IconRight size={iconSize} aria-hidden="true" />}
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  size?: ButtonSize;
  tone?: 'default' | 'danger';
  ref?: React.Ref<HTMLButtonElement>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  label,
  size = 'md',
  tone = 'default',
  className,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={cn(
      'inline-flex flex-shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40',
      size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
      tone === 'danger'
        ? 'text-stone-400 hover:bg-red-50 hover:text-red-600'
        : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900',
      className,
    )}
    {...rest}
  >
    <Icon size={size === 'sm' ? 15 : 17} aria-hidden="true" />
  </button>
);
