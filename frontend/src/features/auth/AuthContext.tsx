import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ApiError, api } from '../../lib/api';
import type {
  AuthUser,
  LoginPayload,
  ProfileUpdatePayload,
  RegisterPayload,
} from '../../types/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the authenticated user and exposes auth actions.
 *
 * On mount it calls `GET /api/auth/me`, which both restores the session state
 * after a page refresh and triggers issuance of the CSRF cookie (the backend
 * sets it on any safe request). Nothing is stored in localStorage: the session
 * lives in an HttpOnly cookie managed by the server.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const refresh = useCallback(async () => {
    try {
      const profile = await api.auth.me();
      setUser(profile);
      setStatus('authenticated');
    } catch (error) {
      // A 401 simply means "not logged in". Any other failure (for example the
      // backend being unreachable) also leaves the user anonymous rather than
      // crashing the shell.
      if (!(error instanceof ApiError)) {
        throw error;
      }
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (payload: LoginPayload) => {
    const profile = await api.auth.login(payload);
    setUser(profile);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const profile = await api.auth.register(payload);
    setUser(profile);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      // Regardless of the network outcome, the user is signed out locally.
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const updateProfile = useCallback(async (payload: ProfileUpdatePayload) => {
    const profile = await api.profile.update(payload);
    setUser(profile);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, updateProfile, refresh }),
    [user, status, login, register, logout, updateProfile, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws when used outside an `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
