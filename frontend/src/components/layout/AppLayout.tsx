import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../features/auth/AuthContext';
import { Sidebar } from './Sidebar';

/**
 * Application shell: fixed desktop sidebar, mobile drawer, and the routed
 * page content. Phase 1 delivered the shell; Phase 2 adds the signed-in
 * account area and sign-out.
 */
export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Close the mobile drawer with Escape.
  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      // ProtectedRoute redirects to /login once the status becomes anonymous.
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="border-line bg-surface hidden border-r lg:sticky lg:top-0 lg:block lg:h-dvh">
        <Sidebar user={user} onLogout={handleLogout} loggingOut={loggingOut} />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="border-line bg-canvas/95 sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur lg:hidden">
          <p className="text-ink text-sm font-semibold tracking-[0.18em]">MAXIMUS</p>
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-navigation"
            className="border-line-strong text-ink rounded-control border px-3 py-1.5 text-sm font-medium"
          >
            {mobileNavOpen ? 'Close' : 'Menu'}
          </button>
        </header>

        {mobileNavOpen ? (
          <div
            id="mobile-navigation"
            className="border-line bg-surface fixed inset-x-0 top-[57px] bottom-0 z-30 overflow-y-auto border-t lg:hidden"
          >
            <Sidebar
              onNavigate={() => setMobileNavOpen(false)}
              user={user}
              onLogout={handleLogout}
              loggingOut={loggingOut}
            />
          </div>
        ) : null}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>

        <footer className="border-line text-faint border-t px-4 py-4 text-xs sm:px-6 lg:px-8">
          MAXIMUS v0.1.0 — Personal growth system. Features in development are labelled
          honestly in the UI.
        </footer>
      </div>
    </div>
  );
}
