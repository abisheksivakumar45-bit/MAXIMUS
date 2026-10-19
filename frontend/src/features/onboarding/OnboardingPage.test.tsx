import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OnboardingPage } from './OnboardingPage';
import { AuthProvider } from '../auth/AuthContext';
import { clearCookies, jsonResponse, setCookie } from '../../test/helpers';
import type { CapturedRequest } from '../../test/helpers';
import type { Goal, GoalCategory } from '../../types/goal';
import type { OnboardingLifestyle, OnboardingProfile, OnboardingState } from '../../types/onboarding';

/**
 * The stub below mirrors the real backend contract: PUT /api/onboarding merges
 * the partial payload into stored state, completion is validated server-side
 * (the client's `completed` flag is only a request), and goal drafts are
 * created/deleted through the goals endpoints.
 */

const USER = {
  id: 'u1',
  email: 'ada@example.com',
  display_name: 'Ada Lovelace',
  created_at: '2026-01-01T00:00:00Z',
};

const OPTIONS = {
  age_range: ['18-24', '25-34', '35-44'],
  daily_availability: ['Under 1 hour', '1-2 hours', '3-4 hours'],
  schedule: ['Standard', 'Shift work'],
  study_hours_per_day: ['Under 1 hour', '1-2 hours'],
  food_budget: ['Low', 'Medium'],
  exercise_experience: ['None', 'Some'],
  equipment: ['None', 'Full gym'],
  planning_style: ['Detailed', 'Flexible'],
};

const CATEGORIES: GoalCategory[] = [
  {
    slug: 'custom',
    label: 'Custom goal',
    description: 'Define a goal in your own words.',
    assessment: [
      {
        key: 'why_it_matters',
        label: 'Why this goal matters to you',
        kind: 'textarea',
        help_text: '',
        required: true,
        options: [],
        max_length: 2000,
      },
      {
        key: 'known_constraints',
        label: 'Constraints or limitations to plan around',
        kind: 'text',
        help_text: '',
        required: false,
        options: [],
        max_length: 200,
      },
    ],
  },
  {
    slug: 'sleep-consistency',
    label: 'Sleep consistency',
    description: 'Sleep and wake up at times you choose.',
    assessment: [],
  },
];

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: 'goal-1',
    name: 'Custom goal',
    description: null,
    category: 'custom',
    category_label: 'Custom goal',
    motivation: null,
    current_situation: null,
    desired_outcome: null,
    priority: 'medium',
    target_date: null,
    available_time: null,
    constraints: null,
    preferences: null,
    status: 'draft',
    created_at: '2026-10-15T10:00:00Z',
    updated_at: '2026-10-15T10:00:00Z',
    assessment: null,
    ...overrides,
  };
}

function makeOnboarding(overrides?: {
  currentStep?: string | null;
  profile?: Partial<OnboardingProfile>;
  lifestyle?: Partial<OnboardingLifestyle>;
  completedAt?: string | null;
}): OnboardingState {
  return {
    completed_at: overrides?.completedAt ?? null,
    current_step: overrides?.currentStep ?? null,
    profile: {
      age_range: null,
      timezone: null,
      preferred_language: null,
      wake_time: null,
      bedtime: null,
      daily_availability: null,
      ...overrides?.profile,
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
      ...overrides?.lifestyle,
    },
    options: OPTIONS,
    missing: [],
  };
}

interface ServerOptions {
  currentStep?: string | null;
  profile?: Partial<OnboardingProfile>;
  completedAt?: string | null;
  goals?: Goal[];
  /** Number of onboarding GETs that should fail with a 500. */
  onboardingFailures?: number;
  /** Hold PUT /api/onboarding responses until the test releases them. */
  deferPuts?: boolean;
}

interface Server {
  requests: CapturedRequest[];
  state: { onboarding: OnboardingState; goals: Goal[] };
  pendingPuts: Array<(response: Response) => void>;
}

function stubServer(options: ServerOptions = {}): Server {
  const state = {
    onboarding: makeOnboarding({
      currentStep: options.currentStep ?? null,
      profile: options.profile,
      completedAt: options.completedAt ?? null,
    }),
    goals: [...(options.goals ?? [])],
  };
  const requests: CapturedRequest[] = [];
  const pendingPuts: Array<(response: Response) => void> = [];
  let onboardingFailures = options.onboardingFailures ?? 0;
  let goalCounter = 0;

  function computeMissing(): string[] {
    const missing: string[] = [];
    if (!state.onboarding.profile.timezone) missing.push('your time zone');
    if (!state.onboarding.profile.daily_availability) missing.push('your daily availability');
    if (state.goals.length === 0) missing.push('at least one goal');
    return missing;
  }
  state.onboarding.missing = computeMissing();

  function handlePut(body: Record<string, unknown>): Response | null {
    if (body.current_step != null) {
      state.onboarding.current_step = String(body.current_step);
    }
    if (body.profile != null) {
      Object.assign(state.onboarding.profile, body.profile);
    }
    if (body.lifestyle != null) {
      Object.assign(state.onboarding.lifestyle, body.lifestyle);
    }
    if (body.completed === true) {
      const missing = computeMissing();
      if (missing.length > 0) {
        return jsonResponse({ detail: `Onboarding still needs ${missing[0]}.` }, 400);
      }
      state.onboarding.completed_at = '2026-10-18T12:00:00Z';
    }
    state.onboarding.missing = computeMissing();
    return null;
  }

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    requests.push({ url, init });
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;

    if (url === '/api/auth/me') {
      return Promise.resolve(jsonResponse(USER));
    }
    if (url === '/api/goals/categories') {
      return Promise.resolve(jsonResponse(CATEGORIES));
    }
    if (url === '/api/onboarding') {
      if (method === 'PUT') {
        if (options.deferPuts) {
          return new Promise<Response>((resolve) => {
            pendingPuts.push((response) => {
              handlePut(body ?? {});
              resolve(response);
            });
          });
        }
        const error = handlePut(body ?? {});
        return Promise.resolve(error ?? jsonResponse(state.onboarding));
      }
      if (onboardingFailures > 0) {
        onboardingFailures -= 1;
        return Promise.resolve(jsonResponse({ detail: 'Internal server error' }, 500));
      }
      return Promise.resolve(jsonResponse(state.onboarding));
    }
    if (url === '/api/goals' && method === 'GET') {
      return Promise.resolve(jsonResponse(state.goals));
    }
    if (url === '/api/goals' && method === 'POST' && body !== null) {
      goalCounter += 1;
      const category = String(body.category ?? 'custom');
      const goal = makeGoal({
        id: `goal-${goalCounter}`,
        name: String(body.name ?? 'Goal'),
        category,
        category_label: CATEGORIES.find((entry) => entry.slug === category)?.label ?? category,
        status: (body.status as Goal['status']) ?? 'draft',
      });
      state.goals.push(goal);
      return Promise.resolve(jsonResponse(goal, 201));
    }
    if (url.startsWith('/api/goals/') && method === 'PATCH' && body !== null) {
      const goalId = url.split('/').pop() ?? '';
      const goal = state.goals.find((entry) => entry.id === goalId);
      if (goal === undefined) {
        return Promise.resolve(jsonResponse({ detail: 'Goal not found.' }, 404));
      }
      if (typeof body.name === 'string') goal.name = body.name;
      if (typeof body.status === 'string') goal.status = body.status as Goal['status'];
      if (body.assessment != null) {
        goal.assessment = {
          answers: {
            ...(goal.assessment?.answers ?? {}),
            ...(body.assessment as Record<string, string | string[]>),
          },
          updated_at: '2026-10-18T12:00:00Z',
        };
      }
      return Promise.resolve(jsonResponse(goal));
    }
    if (url.startsWith('/api/goals/') && method === 'DELETE') {
      const goalId = url.split('/').pop() ?? '';
      state.goals = state.goals.filter((entry) => entry.id !== goalId);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url === '/api/profile' && method === 'PATCH') {
      return Promise.resolve(jsonResponse({ ...USER, ...body }));
    }
    return Promise.resolve(jsonResponse({ detail: 'Not found' }, 404));
  });

  vi.stubGlobal('fetch', fetchMock);
  return { requests, state, pendingPuts };
}

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <AuthProvider>
        <OnboardingPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** PUTs whose JSON body carries the given top-level key. */
function putsWith(requests: CapturedRequest[], key: string): CapturedRequest[] {
  return requests.filter((request) => {
    if (request.init?.method !== 'PUT') return false;
    return Object.hasOwn(JSON.parse(String(request.init.body)) as object, key);
  });
}

afterEach(() => {
  clearCookies();
  vi.unstubAllGlobals();
});

describe('OnboardingPage', () => {
  it('resumes at the step the server has stored', async () => {
    stubServer({ currentStep: 'lifestyle' });

    renderWizard();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lifestyle' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('Step 3 of 6')).toBeInTheDocument();
  });

  it('blocks advancing from the profile step until required answers are valid', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const server = stubServer();

    renderWizard();
    await userEvent.click(await screen.findByRole('button', { name: 'Get started' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Time zone is required.')).toBeInTheDocument();
    expect(screen.getByText('Please choose how much time you have most days.')).toBeInTheDocument();
    // Still on the profile step — nothing was persisted.
    expect(screen.getByRole('heading', { level: 1, name: 'About you' })).toBeInTheDocument();
    expect(putsWith(server.requests, 'profile')).toHaveLength(0);
  });

  it('preserves entered answers when moving forward and back', async () => {
    stubServer();

    renderWizard();
    await userEvent.click(await screen.findByRole('button', { name: 'Get started' }));
    await userEvent.type(await screen.findByLabelText(/time zone/i), 'Europe/London');
    await userEvent.selectOptions(screen.getByLabelText(/time available most days/i), '1-2 hours');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Lifestyle' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByLabelText(/time zone/i)).toHaveValue('Europe/London');
    expect(screen.getByLabelText(/time available most days/i)).toHaveValue('1-2 hours');
  });

  it('validates wake-up and bedtime as 24-hour times', async () => {
    stubServer();

    renderWizard();
    await userEvent.click(await screen.findByRole('button', { name: 'Get started' }));
    await userEvent.type(await screen.findByLabelText(/time zone/i), 'Europe/London');
    await userEvent.selectOptions(screen.getByLabelText(/time available most days/i), '1-2 hours');
    await userEvent.type(screen.getByLabelText(/usual wake-up time/i), '25:99');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Use a 24-hour time such as 07:30.')).toBeInTheDocument();
  });

  it('creates draft goals for selected categories and deletes deselected drafts', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const server = stubServer({ currentStep: 'goals' });

    renderWizard();
    await userEvent.click(await screen.findByRole('checkbox', { name: /select custom goal/i }));

    // The goal name defaults to the category label and can be edited.
    expect(screen.getByLabelText(/goal name/i)).toHaveValue('Custom goal');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // A real draft goal was created and the wizard moved on.
    expect(await screen.findByRole('heading', { level: 1, name: 'Assessment' })).toBeInTheDocument();
    const [post] = server.requests.filter((request) => request.init?.method === 'POST');
    expect(post.url).toBe('/api/goals');
    expect(JSON.parse(String(post.init?.body))).toMatchObject({
      category: 'custom',
      status: 'draft',
    });

    // Go back, swap the selection: the deselected draft is removed.
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('checkbox', { name: /select custom goal/i });
    await userEvent.click(screen.getByRole('checkbox', { name: /select sleep consistency/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /select custom goal/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(server.state.goals.map((goal) => goal.category)).toEqual(['sleep-consistency']);
    });
    const [del] = server.requests.filter((request) => request.init?.method === 'DELETE');
    expect(del.url).toMatch(/^\/api\/goals\//);
  });

  it('requires at least one goal selection before continuing', async () => {
    const server = stubServer({ currentStep: 'goals' });

    renderWizard();
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Choose at least one goal to continue.')).toBeInTheDocument();
    expect(server.requests.filter((request) => request.init?.method === 'POST')).toHaveLength(0);
  });

  it('blocks the assessment step until required questions are answered', async () => {
    const server = stubServer({
      currentStep: 'assessment',
      goals: [makeGoal({ id: 'goal-1', status: 'draft' })],
    });

    renderWizard();
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('This answer is required.')).toBeInTheDocument();
    expect(
      screen.getByText('Please answer the required questions before continuing.'),
    ).toBeInTheDocument();
    expect(server.requests.some((request) => request.init?.method === 'PATCH')).toBe(false);
  });

  it('saves assessment answers and moves on to review', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const server = stubServer({
      currentStep: 'assessment',
      goals: [makeGoal({ id: 'goal-1', status: 'draft' })],
    });

    renderWizard();
    await userEvent.type(
      await screen.findByLabelText(/why this goal matters to you/i),
      'I want clear priorities.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Review & save' })).toBeInTheDocument();
    expect(screen.getByText('I want clear priorities.')).toBeInTheDocument();
    const [patch] = server.requests.filter((request) => request.init?.method === 'PATCH');
    expect(patch.url).toBe('/api/goals/goal-1');
    expect(JSON.parse(String(patch.init?.body)).assessment.why_it_matters).toBe(
      'I want clear priorities.',
    );
  });

  it('completes onboarding only after the server confirms it', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const server = stubServer({
      currentStep: 'review',
      profile: { timezone: 'Europe/London', daily_availability: '1-2 hours' },
      goals: [makeGoal({ id: 'goal-1', status: 'active' })],
    });

    renderWizard();
    await userEvent.click(await screen.findByRole('button', { name: 'Save and finish' }));

    expect(await screen.findByText(/Onboarding complete/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to dashboard/i })).toHaveAttribute('href', '/');
    const puts = server.requests.filter((request) => request.init?.method === 'PUT');
    expect(JSON.parse(String(puts.at(-1)?.init?.body)).completed).toBe(true);
    expect(server.state.onboarding.completed_at).not.toBeNull();
  });

  it('shows the server completion gate instead of faking success', async () => {
    stubServer({ currentStep: 'review' }); // no timezone, no goals

    renderWizard();
    await userEvent.click(await screen.findByRole('button', { name: 'Save and finish' }));

    expect(await screen.findByText('Onboarding still needs your time zone.')).toBeInTheDocument();
    expect(screen.queryByText(/Onboarding complete/)).not.toBeInTheDocument();
    // The wizard stays on the save step so the user can fix what is missing.
    expect(screen.getByRole('button', { name: 'Save and finish' })).toBeInTheDocument();
  });

  it('surfaces a real error state when loading fails, then recovers on retry', async () => {
    stubServer({ onboardingFailures: 1 });

    renderWizard();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('button', { name: 'Get started' })).toBeInTheDocument();
  });

  it('disables the continue button while a save is in flight', async () => {
    const server = stubServer({ currentStep: 'lifestyle', deferPuts: true });

    renderWizard();
    await screen.findByRole('heading', { level: 1, name: 'Lifestyle' });
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const continueButton = await screen.findByRole('button', { name: 'Continue' });
    await waitFor(() => expect(continueButton).toBeDisabled());
    // A second click while saving is ignored — no duplicate submission.
    await userEvent.click(continueButton);
    expect(
      server.requests.filter(
        (request) => request.init?.method === 'PUT' && String(request.init.body).includes('goals'),
      ),
    ).toHaveLength(1);

    server.pendingPuts[0](jsonResponse(server.state.onboarding));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your goals' })).toBeInTheDocument();
  });

  it('lands a finished user on the editable review step', async () => {
    stubServer({
      currentStep: 'review',
      completedAt: '2026-10-16T09:00:00Z',
      profile: { timezone: 'Europe/London', daily_availability: '1-2 hours' },
      goals: [makeGoal({ id: 'goal-1', status: 'active' })],
    });

    renderWizard();

    expect(await screen.findByText(/Onboarding complete/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save and finish' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage goals/i })).toHaveAttribute('href', '/goals');
  });
});
