import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, api } from './api';
import { clearCookies, jsonResponse, setCookie, stubFetch } from '../test/helpers';

afterEach(() => {
  clearCookies();
  vi.unstubAllGlobals();
});

describe('api request behaviour', () => {
  it('sends the CSRF header and cookies on state-changing requests', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubFetch(() => jsonResponse({ id: 'u1', email: 'a@b.com' }));

    await api.auth.login({ email: 'a@b.com', password: 'TestPassword123' });

    const [request] = requests;
    expect(request.url).toBe('/api/auth/login');
    expect(request.init?.method).toBe('POST');
    expect(request.init?.credentials).toBe('include');
    const headers = request.init?.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('csrf-token-123');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('does not send a CSRF header on safe GET requests', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubFetch(() => jsonResponse({ id: 'u1', email: 'a@b.com' }));

    await api.auth.me();

    const headers = requests[0].init?.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBeUndefined();
    expect(requests[0].init?.credentials).toBe('include');
  });

  it('returns the parsed user on success', async () => {
    stubFetch(() =>
      jsonResponse({ id: 'u1', email: 'a@b.com', display_name: 'Ada', created_at: '2026-01-01' }),
    );

    const user = await api.auth.me();

    expect(user.email).toBe('a@b.com');
    expect(user.display_name).toBe('Ada');
  });

  it('throws an ApiError carrying the backend detail string', async () => {
    stubFetch(() => jsonResponse({ detail: 'Invalid email or password.' }, 401));

    await expect(api.auth.login({ email: 'a@b.com', password: 'nope' })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password.',
    });
  });

  it('extracts the first message from a FastAPI validation error array', async () => {
    stubFetch(() =>
      jsonResponse(
        { detail: [{ loc: ['body', 'password'], msg: 'Password is too short.', type: 'value_error' }] },
        422,
      ),
    );

    const error = await api.auth
      .register({ display_name: 'A', email: 'a@b.com', password: 'x' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).message).toBe('Password is too short.');
  });
});

describe('api goals and onboarding', () => {
  it('fetches the category catalogue with a plain GET', async () => {
    const { requests } = stubFetch(() =>
      jsonResponse([{ slug: 'custom', label: 'Custom goal', description: '', assessment: [] }]),
    );

    const categories = await api.goals.categories();

    expect(requests[0].url).toBe('/api/goals/categories');
    expect(requests[0].init?.method).toBe('GET');
    expect(categories[0].slug).toBe('custom');
  });

  it('creates a goal with method, CSRF header and payload', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubFetch(() =>
      jsonResponse({ id: 'g1', name: 'Sleep earlier', category: 'sleep-consistency' }),
    );

    await api.goals.create({ name: 'Sleep earlier', category: 'sleep-consistency', status: 'draft' });

    const [request] = requests;
    expect(request.url).toBe('/api/goals');
    expect(request.init?.method).toBe('POST');
    expect(request.init?.credentials).toBe('include');
    const headers = request.init?.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('csrf-token-123');
    const body = JSON.parse(String(request.init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ name: 'Sleep earlier', category: 'sleep-consistency', status: 'draft' });
  });

  it('patches and deletes a goal by id', async () => {
    const { requests } = stubFetch(({ init }) =>
      init?.method === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse({ id: 'g1' }),
    );

    await api.goals.update('g1', { status: 'paused' });
    await api.goals.remove('g1');

    expect(requests[0].url).toBe('/api/goals/g1');
    expect(requests[0].init?.method).toBe('PATCH');
    expect(requests[1].url).toBe('/api/goals/g1');
    expect(requests[1].init?.method).toBe('DELETE');
  });

  it('surfaces the server completion gate for onboarding saves', async () => {
    stubFetch(() =>
      jsonResponse({ detail: 'Onboarding still needs your time zone.' }, 400),
    );

    await expect(api.onboarding.save({ completed: true })).rejects.toMatchObject({
      status: 400,
      message: 'Onboarding still needs your time zone.',
    });
  });

  it('saves onboarding progress with a PUT carrying the CSRF header', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubFetch(() => jsonResponse({ completed_at: null, missing: [] }));

    await api.onboarding.save({ current_step: 'lifestyle' });

    const [request] = requests;
    expect(request.url).toBe('/api/onboarding');
    expect(request.init?.method).toBe('PUT');
    const headers = request.init?.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('csrf-token-123');
    const body = JSON.parse(String(request.init?.body)) as Record<string, unknown>;
    expect(body).toEqual({ current_step: 'lifestyle' });
  });
});
