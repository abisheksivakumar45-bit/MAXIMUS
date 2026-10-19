import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';

import { jsonResponse, stubFetch } from '../../test/helpers';
import { DashboardPage } from './DashboardPage';
import type { Goal } from '../../types/goal';
import type { OnboardingState } from '../../types/onboarding';

const HEALTH_RESPONSE = {
  service: 'MAXIMUS',
  version: '0.1.0',
  environment: 'test',
  status: 'ok',
  timestamp: '2026-10-15T10:00:00Z',
};

const READY_RESPONSE = { status: 'ready', database: { connected: true } };

const COMPLETED_ONBOARDING: OnboardingState = {
  completed_at: '2026-10-15T10:00:00Z',
  current_step: 'review',
  profile: {
    age_range: '25-34',
    timezone: 'UTC',
    preferred_language: null,
    wake_time: null,
    bedtime: null,
    daily_availability: '1-2 hours',
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
  missing: [],
};

const ACTIVE_GOAL: Goal = {
  id: 'goal-1',
  name: 'Build a study routine',
  description: null,
  category: 'academics',
  category_label: 'Academics',
  motivation: null,
  current_situation: null,
  desired_outcome: null,
  priority: 'high',
  target_date: null,
  available_time: null,
  constraints: null,
  preferences: null,
  status: 'active',
  created_at: '2026-10-15T10:00:00Z',
  updated_at: '2026-10-15T10:00:00Z',
  assessment: {
    answers: { main_challenge: 'Consistency' },
    updated_at: '2026-10-15T10:00:00Z',
  },
};

/** URL-aware stub covering every endpoint the dashboard queries. */
function stubDashboard(
  options?: {
    goals?: Goal[];
    onboarding?: OnboardingState;
    fail?: boolean;
  },
) {
  const fail = options?.fail ?? false;
  return stubFetch(({ url }) => {
    if (fail) {
      return jsonResponse({ detail: 'Internal server error' }, 500);
    }
    if (url.includes('/api/health/ready')) {
      return jsonResponse(READY_RESPONSE);
    }
    if (url.includes('/api/health')) {
      return jsonResponse(HEALTH_RESPONSE);
    }
    if (url.includes('/api/onboarding')) {
      return jsonResponse(options?.onboarding ?? COMPLETED_ONBOARDING);
    }
    if (url.includes('/api/goals')) {
      return jsonResponse(options?.goals ?? []);
    }
    return jsonResponse({ detail: 'Not found' }, 404);
  });
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DashboardPage', () => {
  it('shows real service data returned by the backend', async () => {
    stubDashboard();

    renderDashboard();

    expect(await screen.findByText('MAXIMUS')).toBeInTheDocument();
    expect(await screen.findByText('Database connected')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
  });

  it('surfaces a real error state when the backend fails', async () => {
    stubDashboard({ fail: true });

    renderDashboard();

    const errorStates = await screen.findAllByText('Something went wrong');
    expect(errorStates.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /try again/i }).length).toBeGreaterThan(0);
  });

  it('renders honest empty states when there are no goals', async () => {
    stubDashboard({ goals: [] });

    renderDashboard();

    expect(await screen.findByText('No daily tasks yet')).toBeInTheDocument();
    expect(await screen.findByText('No goals yet')).toBeInTheDocument();
  });

  it('lists real goals with category and assessment status', async () => {
    stubDashboard({ goals: [ACTIVE_GOAL] });

    renderDashboard();

    expect(await screen.findByText('Build a study routine')).toBeInTheDocument();
    expect(screen.getByText(/Academics/)).toBeInTheDocument();
    expect(screen.getByText(/1 active · 1 total/)).toBeInTheDocument();
    expect(screen.getByText(/Assessment answered/)).toBeInTheDocument();
  });

  it('offers a resume-onboarding path while setup is incomplete', async () => {
    stubDashboard({
      goals: [],
      onboarding: { ...COMPLETED_ONBOARDING, completed_at: null, missing: ['Daily availability'] },
    });

    renderDashboard();

    expect(await screen.findByText('Finish setting up MAXIMUS')).toBeInTheDocument();
    expect(screen.getByText(/Still needed: Daily availability\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /resume setup/i })).toHaveAttribute(
      'href',
      '/onboarding',
    );
  });

  it('does not show the resume path once onboarding is complete', async () => {
    stubDashboard({ goals: [ACTIVE_GOAL] });

    renderDashboard();

    expect(await screen.findByText('Build a study routine')).toBeInTheDocument();
    expect(screen.queryByText('Finish setting up MAXIMUS')).not.toBeInTheDocument();
  });
});
