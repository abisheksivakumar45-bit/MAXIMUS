import { NavLink } from 'react-router-dom';

import { NAV_SECTIONS, SETTINGS_NAV_ITEM } from '../../app/navigation';
import { cn } from '../../lib/cn';
import type { AuthUser } from '../../types/auth';

interface SidebarProps {
  /** Called after a navigation link is activated (used to close mobile drawers). */
  onNavigate?: () => void;
  /** The signed-in user, when known. */
  user?: AuthUser | null;
  /** Sign-out handler; the account block is only rendered when provided. */
  onLogout?: () => void;
  /** Disables the sign-out button while the request is in flight. */
  loggingOut?: boolean;
}

function navLinkClasses({ isActive }: { isActive: boolean }): string {
  return cn(
    'block rounded-control px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-surface-raised text-ink border-line-strong border'
      : 'text-muted hover:text-ink hover:bg-surface-raised/60 border border-transparent',
  );
}

/** Primary desktop navigation. */
export function Sidebar({ onNavigate, user, onLogout, loggingOut = false }: SidebarProps) {
  return (
    <nav aria-label="Primary" className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="px-2">
        <p className="text-ink text-lg font-semibold tracking-[0.18em]">MAXIMUS</p>
        <p className="text-faint mt-0.5 text-xs">Personal growth system</p>
      </div>

      <div className="flex flex-1 flex-col gap-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="text-faint mb-2 px-3 text-xs font-medium tracking-wider uppercase">
              {section.title}
            </p>
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onNavigate}
                    className={navLinkClasses}
                  >
                    <span className="flex items-center justify-between gap-2">
                      {item.label}
                      {!item.implemented ? (
                        <span className="text-faint text-[10px] tracking-wide uppercase">
                          soon
                        </span>
                      ) : null}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {user && onLogout ? (
        <div className="border-line border-t pt-4">
          <p className="text-ink truncate px-3 text-sm font-medium">
            {user.display_name ?? 'Your account'}
          </p>
          <p className="text-faint truncate px-3 text-xs">{user.email}</p>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className={cn(
              'rounded-control text-muted hover:text-ink hover:bg-surface-raised/60 mt-2 w-full px-3 py-2 text-left text-sm transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {loggingOut ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      ) : null}

      <div className="border-line border-t pt-4">
        <NavLink to={SETTINGS_NAV_ITEM.path} onClick={onNavigate} className={navLinkClasses}>
          {SETTINGS_NAV_ITEM.label}
        </NavLink>
      </div>
    </nav>
  );
}
