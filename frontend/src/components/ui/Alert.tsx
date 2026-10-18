import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export type AlertTone = 'danger' | 'positive' | 'info';

interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
}

const toneClasses: Record<AlertTone, string> = {
  danger: 'border-danger/30 bg-danger/5 text-ink',
  positive: 'border-positive/30 bg-positive/5 text-ink',
  info: 'border-info/30 bg-info/5 text-ink',
};

/** Inline message used for form-level errors and confirmations. */
export function Alert({ tone = 'danger', children }: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-control border px-3 py-2 text-sm', toneClasses[tone])}
    >
      {children}
    </div>
  );
}
