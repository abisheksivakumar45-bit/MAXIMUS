import { cn } from '../../lib/cn';

export type StatusTone = 'positive' | 'warning' | 'danger' | 'neutral' | 'info';

interface StatusPillProps {
  tone: StatusTone;
  label: string;
  /** Adds a live indicator dot. Purely visual. */
  withDot?: boolean;
}

const toneClasses: Record<StatusTone, string> = {
  positive: 'border-positive/40 text-positive',
  warning: 'border-accent/40 text-accent',
  danger: 'border-danger/40 text-danger',
  neutral: 'border-line-strong text-muted',
  info: 'border-info/40 text-info',
};

/** Small labelled status badge used to report real backend state. */
export function StatusPill({ tone, label, withDot = false }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
      )}
    >
      {withDot ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      ) : null}
      {label}
    </span>
  );
}
