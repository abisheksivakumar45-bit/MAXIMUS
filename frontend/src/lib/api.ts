import type { HealthResponse, LivenessResponse, ReadinessResponse } from '../types/api';

/**
 * Base URL of the MAXIMUS API.
 * Empty by default so requests go to the same origin and are handled by the
 * Vite dev-server proxy (see vite.config.ts). Set VITE_API_BASE_URL to point
 * at a different backend.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Error raised for failed API calls, carrying the HTTP status and a safe message. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `Request failed with status ${response.status}`;
      try {
        const body = (await response.json()) as { detail?: unknown };
        if (typeof body.detail === 'string') {
          detail = body.detail;
        }
      } catch {
        // Non-JSON error body: keep the generic message.
      }
      throw new ApiError(response.status, detail);
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
};
