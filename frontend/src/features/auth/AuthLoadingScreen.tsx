/** Centered, full-page loading indicator shown while the session is resolved. */
export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status">
      <span
        aria-hidden="true"
        className="border-line-strong border-t-accent h-5 w-5 animate-spin rounded-full border-2"
      />
      <span className="sr-only">Checking your session…</span>
    </div>
  );
}
