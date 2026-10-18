import { useId, useState } from 'react';

import { cn } from '../../lib/cn';

export interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Validation message; when present the field is marked invalid. */
  error?: string | null;
  /** Optional helper text shown when there is no error. */
  hint?: string;
  autoComplete?: string;
}

/**
 * Password input with an accessible show/hide toggle.
 *
 * The toggle is a real button (keyboard reachable) that announces its state
 * via `aria-pressed` and swaps its label between "Show" and "Hide".
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const toggleId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'bg-surface-raised text-ink placeholder:text-faint rounded-control w-full border px-3 py-2 pr-16 text-sm',
            'focus:ring-accent focus:ring-1 focus:outline-none',
            error ? 'border-danger' : 'border-line-strong focus:border-accent',
          )}
        />
        <button
          id={toggleId}
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="text-muted hover:text-ink absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
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
