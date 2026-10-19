import type { HealthResponse, LivenessResponse, ReadinessResponse } from '../types/api';
import type {
  AuthUser,
  LoginPayload,
  ProfileUpdatePayload,
  RegisterPayload,
} from '../types/auth';
import type {
  Goal,
  GoalCategory,
  GoalCreatePayload,
  GoalUpdatePayload,
} from '../types/goal';
import type { OnboardingSavePayload, OnboardingState } from '../types/onboarding';

/**
 * Base URL of the MAXIMUS API.
 * Empty by default so requests go to the same origin and are handled by the
 * Vite dev-server proxy (see vite.config.ts). Set VITE_API_BASE_URL to point
 * at a different backend.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Name of the readable cookie holding the CSRF token (double-submit). */
const CSRF_COOKIE_NAME = 'maximus_csrf';
/** Header the backend requires on every state-changing request. */
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/** Methods that must carry a CSRF token. */
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Error raised for failed API calls, carrying the HTTP status and a safe message. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  timeoutMs?: number;
}

/** Read a cookie value by name from `document.cookie`. */
function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Extract a human-readable message from a FastAPI error body (`{detail}`). */
async function extractErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    const { detail } = body;
    if (typeof detail === 'string') {
      return detail;
    }
    // FastAPI validation errors: { detail: [{ loc, msg, type }, ...] }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown };
      if (typeof first?.msg === 'string') {
        return first.msg;
      }
    }
  } catch {
    // Non-JSON error body: fall through to the generic message.
  }
  return `Request failed with status ${response.status}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (STATE_CHANGING_METHODS.has(method)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // Send the session and CSRF cookies on every request.
      credentials: 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(response.status, await extractErrorDetail(response));
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'The request timed out. Is the backend running?');
    }
    throw new ApiError(0, 'Could not reach the MAXIMUS backend.');
  } finally {
    clearTimeout(timer);
  }
}

/** Typed wrappers around the MAXIMUS HTTP API. */
export const api = {
  getHealth: () => request<HealthResponse>('/api/health'),
  getLiveness: () => request<LivenessResponse>('/api/health/live'),
  getReadiness: () => request<ReadinessResponse>('/api/health/ready'),

  auth: {
    /** Create an account and start a session. */
    register: (payload: RegisterPayload) =>
      request<AuthUser>('/api/auth/register', { method: 'POST', body: payload }),
    /** Authenticate and start a session. */
    login: (payload: LoginPayload) =>
      request<AuthUser>('/api/auth/login', { method: 'POST', body: payload }),
    /** Revoke the current session. */
    logout: () => request<{ detail: string }>('/api/auth/logout', { method: 'POST' }),
    /** Return the currently authenticated user, or throw a 401 ApiError. */
    me: () => request<AuthUser>('/api/auth/me'),
  },

  profile: {
    /** Fetch the current user's profile. */
    get: () => request<AuthUser>('/api/profile'),
    /** Update the current user's profile. */
    update: (payload: ProfileUpdatePayload) =>
      request<AuthUser>('/api/profile', { method: 'PATCH', body: payload }),
  },

  goals: {
    /** The canonical goal categories and their assessment questions (public). */
    categories: () => request<GoalCategory[]>('/api/goals/categories'),
    /** List the current user's goals. */
    list: () => request<Goal[]>('/api/goals'),
    /** Create a goal for the current user. */
    create: (payload: GoalCreatePayload) =>
      request<Goal>('/api/goals', { method: 'POST', body: payload }),
    /** Update one of the current user's goals (and/or its assessment). */
    update: (goalId: string, payload: GoalUpdatePayload) =>
      request<Goal>(`/api/goals/${goalId}`, { method: 'PATCH', body: payload }),
    /** Delete one of the current user's goals. */
    remove: (goalId: string) => request<void>(`/api/goals/${goalId}`, { method: 'DELETE' }),
  },

  onboarding: {
    /** Fetch the current user's onboarding state (resumable). */
    get: () => request<OnboardingState>('/api/onboarding'),
    /** Save onboarding progress; `completed: true` is validated server-side. */
    save: (payload: OnboardingSavePayload) =>
      request<OnboardingState>('/api/onboarding', { method: 'PUT', body: payload }),
  },
};
