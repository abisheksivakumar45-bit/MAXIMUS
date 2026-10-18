interface LoadingStateProps {
  label?: string;
}

/** Accessible loading indicator with an explicit label. */
export function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  return (
    <div className="text-muted flex items-center gap-3 py-6 text-sm" role="status">
      <span
        aria-hidden="true"
        className="border-line-strong border-t-accent h-4 w-4 animate-spin rounded-full border-2"
      />
      {label}
    </div>
  );
}
