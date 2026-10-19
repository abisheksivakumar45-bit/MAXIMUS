import type { TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Unique id, required so the label is correctly associated. */
  id: string;
  label: string;
  /** Validation message; when present the field is marked invalid. */
  error?: string | null;
  /** Optional helper text shown when there is no error. */
  hint?: string;
}

/** Labelled textarea with accessible error and hint wiring. */
export function TextAreaField({
  id,
  label,
  error,
  hint,
  className,
  rows = 3,
  ...rest
}: TextAreaFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'bg-surface-raised border-line-strong text-ink rounded-control w-full border px-3 py-2 text-sm transition-colors focus:border-accent focus:outline-none',
          error && 'border-danger',
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
