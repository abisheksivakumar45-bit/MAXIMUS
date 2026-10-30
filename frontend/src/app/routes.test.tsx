import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from './routes';
import { AuthProvider } from '../features/auth/AuthContext';
import { clearCookies, jsonResponse, stubFetch } from '../test/helpers';

/**
 * Route-level protection checks for the Phase 3 pages. These render the real
 * route table so a page cannot be reachable without a resolved session.
 */

const USER = {
  id: 'u1',
  email: 'ada@example.com',
  display_name: 'Ada Lovelace',
  created_at: '2026-01-01T00:00:00Z',
};

const ONBOARDING_STATE = {
  completed_at: null,
  current_step: null,
  profile: {
    age_range: null,
    timezone: null,
    preferred_language: null,
    wake_time: null,
    bedtime: null,
    daily_availability: null,
  },
  lifestyle: {
    schedule: null,
    study_hours_per_day: null,
    food_budget: null,
    food_preferences: null,
    exercise_experience: null,
    equipment: null,
    existing_routines: null,
    planning_style: null,
  },
  options: {
    age_range: [],
    daily_availability: [],
    schedule: [],
    study_hours_per_day: [],
    food_budget: [],
    exercise_experience: [],
    equipment: [],
    planning_style: [],
  },
  missing: ['your time zone'],
};

/** Anonymous session: every API call is rejected like the real backend. */
function stubAnonymous() {
  stubFetch(() => jsonResponse({ detail: 'Not authenticated' }, 401));
}

/** Authenticated session with empty goals and unfinished onboarding. */
function stubAuthenticated() {
  stubFetch(({ url }) => {
    if (url.includes('/api/auth/me')) return jsonResponse(USER);
    if (url.includes('/api/onboarding')) return jsonResponse(ONBOARDING_STATE);
    if (url.includes('/api/roadmaps/config')) {
      return jsonResponse({
        configured: false,
        provider: 'none',
        model: null,
        message: 'AI roadmap generation is not configured.',
      });
    }
    if (url.endsWith('/api/roadmaps')) return jsonResponse([]);
    if (url.includes('/api/goals/categories')) return jsonResponse([]);
    if (url.includes('/api/goals')) return jsonResponse([]);
    return jsonResponse({ detail: 'Not found' }, 404);
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  clearCookies();
  vi.unstubAllGlobals();
});

describe('Phase 3 routes', () => {
  it('redirects anonymous visitors away from /goals', async () => {
    stubAnonymous();

    renderAt('/goals');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('redirects anonymous visitors away from /onboarding', async () => {
    stubAnonymous();

    renderAt('/onboarding');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('renders the real goals page for a signed-in user', async () => {
    stubAuthenticated();

    renderAt('/goals');

    expect(await screen.findByRole('heading', { level: 1, name: 'Goals' })).toBeInTheDocument();
    expect(await screen.findByText('No goals yet')).toBeInTheDocument();
    // Not the planned placeholder.
    expect(screen.queryByText('Not implemented yet')).not.toBeInTheDocument();
  });

  it('renders the onboarding wizard for a signed-in user', async () => {
    stubAuthenticated();

    renderAt('/onboarding');

    expect(await screen.findByRole('button', { name: 'Get started' })).toBeInTheDocument();
  });
});

describe('Phase 4 routes', () => {
  it('redirects anonymous visitors away from /roadmaps', async () => {
    stubAnonymous();

    renderAt('/roadmaps');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('redirects anonymous visitors away from a roadmap detail URL', async () => {
    stubAnonymous();

    renderAt('/roadmaps/roadmap-1');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('renders the real roadmaps page for a signed-in user', async () => {
    stubAuthenticated();

    renderAt('/roadmaps');

    expect(await screen.findByRole('heading', { level: 1, name: 'Roadmaps' })).toBeInTheDocument();
    expect(await screen.findByText('AI generation is not configured')).toBeInTheDocument();
    expect(await screen.findByText('No roadmaps yet')).toBeInTheDocument();
    // Not the planned placeholder.
    expect(screen.queryByText('Not implemented yet')).not.toBeInTheDocument();
  });
});
