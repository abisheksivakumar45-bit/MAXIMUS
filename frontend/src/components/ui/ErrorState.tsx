interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** Honest error surface: shows the real failure and offers a retry. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="border-danger/30 bg-danger/5 rounded-control border px-4 py-3 text-sm"
      role="alert"
    >
      <p className="text-ink font-medium">Something went wrong</p>
      <p className="text-muted mt-1">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="border-line-strong text-ink hover:bg-surface-raised mt-3 rounded-control border px-3 py-1.5 text-sm font-medium transition-colors"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
