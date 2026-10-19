import type { SelectHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

/** An option: a plain string (used as both value and label) or an explicit pair. */
export type SelectOption = string | { value: string; label: string };

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Unique id, required so the label is correctly associated. */
  id: string;
  label: string;
  /** Validation message; when present the field is marked invalid. */
  error?: string | null;
  /** Optional helper text shown when there is no error. */
  hint?: string;
  /** Always-included first option, e.g. "Choose an option…". */
  placeholder?: string;
  options: SelectOption[];
}

/** Labelled select with accessible error and hint wiring. */
export function SelectField({
  id,
  label,
  error,
  hint,
  placeholder,
  options,
  className,
  ...rest
}: SelectFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'bg-surface-raised border-line-strong text-ink rounded-control w-full border px-3 py-2 text-sm transition-colors focus:border-accent focus:outline-none',
          error && 'border-danger',
          className,
        )}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) =>
          typeof option === 'string' ? (
            <option key={option} value={option}>
              {option}
            </option>
          ) : (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ),
        )}
      </select>
      {error ? (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-faint text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
