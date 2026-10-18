import type { InputHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Unique id, required so the label is correctly associated. */
  id: string;
  label: string;
  /** Validation message; when present the field is marked invalid. */
  error?: string | null;
  /** Optional helper text shown when there is no error. */
  hint?: string;
}

/** Labelled text input with accessible error and hint wiring. */
export function TextField({ id, label, error, hint, className, ...rest }: TextFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'bg-surface-raised text-ink placeholder:text-faint rounded-control border px-3 py-2 text-sm',
          'focus:ring-accent focus:ring-1 focus:outline-none',
          error ? 'border-danger' : 'border-line-strong focus:border-accent',
          className,
        )}
        {...rest}
      />
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
