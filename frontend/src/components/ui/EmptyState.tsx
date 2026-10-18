import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  /** Optional footer, e.g. a note about when the feature arrives. */
  hint?: ReactNode;
}

/** Neutral empty state. Used to describe features not yet implemented honestly. */
export function EmptyState({ title, description, hint }: EmptyStateProps) {
  return (
    <div className="border-line bg-surface-raised/40 rounded-control border border-dashed px-4 py-6 text-center">
      <p className="text-ink text-sm font-medium">{title}</p>
      <p className="text-muted mx-auto mt-1 max-w-md text-sm">{description}</p>
      {hint ? <p className="text-faint mt-3 text-xs">{hint}</p> : null}
    </div>
  );
}
