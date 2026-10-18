import { Link, Outlet } from 'react-router-dom';

/**
 * Centered shell used by the login and registration screens.
 *
 * Keeps the Phase 1 visual identity (charcoal canvas, restrained gold accent)
 * while giving unauthenticated users a focused, distraction-free form.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block">
            <p className="text-ink text-2xl font-semibold tracking-[0.2em]">MAXIMUS</p>
          </Link>
          <p className="text-faint mt-1 text-sm">Your personal growth system</p>
        </div>

        <div className="bg-surface border-line rounded-card border p-6">
          <Outlet />
        </div>

        <p className="text-faint mt-6 text-center text-xs">
          Sessions are kept in secure, server-managed cookies.
        </p>
      </div>
    </div>
  );
}
