import { vi } from 'vitest';

/** Build a JSON `Response` for a stubbed fetch. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build an empty `Response` (for 204/empty bodies). */
export function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

export interface CapturedRequest {
  url: string;
  init?: RequestInit;
}

/**
 * Stub the global `fetch` with a handler and capture each request.
 *
 * Returns the recorded requests so tests can assert on method, headers
 * (including the CSRF token) and credentials.
 */
export function stubFetch(handler: (request: CapturedRequest) => Response) {
  const requests: CapturedRequest[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    requests.push({ url, init });
    return Promise.resolve(handler({ url, init }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests };
}

/** Set a cookie on the jsdom document. */
export function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`;
}

/** Clear all cookies from the jsdom document. */
export function clearCookies(): void {
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}
