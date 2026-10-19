import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GoalsPage } from './GoalsPage';
import { clearCookies, jsonResponse, setCookie, stubFetch } from '../../test/helpers';
import type { Goal, GoalCategory } from '../../types/goal';

const CUSTOM_CATEGORY: GoalCategory = {
  slug: 'custom',
  label: 'Custom Goal',
  description: 'A goal that does not fit the standard categories.',
  assessment: [
    {
      key: 'primary_reason',
      label: 'Primary reason',
      kind: 'textarea',
      help_text: 'Why now?',
      required: true,
      options: [],
      max_length: 2000,
    },
    {
      key: 'focus_area',
      label: 'Focus area',
      kind: 'choice',
      help_text: '',
      required: false,
      options: ['Morning', 'Evening'],
      max_length: 200,
    },
  ],
};

const ACADEMICS_CATEGORY: GoalCategory = {
  slug: 'academics',
  label: 'Academics',
  description: 'Study and academic performance.',
  assessment: [],
};

const EXISTING_GOAL: Goal = {
  id: 'goal-1',
  name: 'Learn Spanish',
  description: 'Daily practice',
  category: 'custom',
  category_label: 'Custom Goal',
  motivation: null,
  current_situation: null,
  desired_outcome: null,
  priority: 'medium',
  target_date: null,
  available_time: null,
  constraints: null,
  preferences: null,
  status: 'active',
  created_at: '2026-10-15T10:00:00Z',
  updated_at: '2026-10-15T10:00:00Z',
  assessment: {
    answers: { primary_reason: 'Travel plans' },
    updated_at: '2026-10-15T10:00:00Z',
  },
};

interface StubOptions {
  goals?: Goal[];
  failGoals?: boolean;
}

function stubGoalsApi(options: StubOptions = {}) {
  // Mutable so POSTed goals appear in the subsequent GET after a reload.
  const goals = [...(options.goals ?? [])];
  return stubFetch(({ url, init }) => {
    if (options.failGoals && url.includes('/api/goals')) {
      return jsonResponse({ detail: 'Could not load goals.' }, 500);
    }
    if (url.includes('/api/goals/categories')) {
      return jsonResponse([CUSTOM_CATEGORY, ACADEMICS_CATEGORY]);
    }
    if (init?.method === 'POST' && url === '/api/goals') {
      const body = JSON.parse(String(init.body)) as { name: string; category: string };
      const created: Goal = {
        ...EXISTING_GOAL,
        id: `goal-${goals.length + 1}`,
        name: body.name,
        category: body.category,
        category_label: body.category === 'academics' ? 'Academics' : 'Custom Goal',
        status: 'active',
        assessment: null,
      };
      goals.push(created);
      return jsonResponse(created, 201);
    }
    if (init?.method === 'DELETE') {
      const id = url.split('/').pop();
      const index = goals.findIndex((goal) => goal.id === id);
      if (index >= 0) {
        goals.splice(index, 1);
      }
      return new Response(null, { status: 204 });
    }
    if (url === '/api/goals' || url.startsWith('/api/goals?')) {
      return jsonResponse(goals);
    }
    if (init?.method === 'PATCH') {
      return jsonResponse({ ...EXISTING_GOAL, name: 'Renamed goal' });
    }
    return jsonResponse({ detail: 'Not found' }, 404);
  });
}

function renderGoals() {
  return render(
    <MemoryRouter>
      <GoalsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  clearCookies();
  vi.unstubAllGlobals();
});

describe('GoalsPage', () => {
  it('shows an honest empty state when the account has no goals', async () => {
    stubGoalsApi({ goals: [] });

    renderGoals();

    expect(await screen.findByText('No goals yet')).toBeInTheDocument();
    expect(screen.getByText(/Add a goal to start/)).toBeInTheDocument();
  });

  it('lists persisted goals with category and assessment status', async () => {
    stubGoalsApi({ goals: [EXISTING_GOAL] });

    renderGoals();

    expect(await screen.findByText('Learn Spanish')).toBeInTheDocument();
    expect(screen.getByText(/Custom Goal/)).toBeInTheDocument();
    expect(screen.getByText(/Assessment: 1 of 2 questions answered/)).toBeInTheDocument();
    expect(screen.getByText(/1 active · 1 total/)).toBeInTheDocument();
  });

  it('surfaces an error state with retry when loading fails', async () => {
    stubGoalsApi({ failGoals: true });

    renderGoals();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('blocks creation until the goal name is provided', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubGoalsApi({ goals: [] });

    renderGoals();
    await userEvent.click(await screen.findByRole('button', { name: /add goal/i }));

    // Category defaults to the first offered; name is still required.
    await userEvent.click(screen.getByRole('button', { name: /create goal/i }));

    expect(await screen.findByText('A goal name is required.')).toBeInTheDocument();
    expect(requests.some((request) => request.init?.method === 'POST')).toBe(false);
  });

  it('creates a goal and shows the server response in the list', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubGoalsApi({ goals: [] });

    renderGoals();
    await userEvent.click(await screen.findByRole('button', { name: /add goal/i }));

    // Pick a category whose assessment has no required questions.
    await userEvent.selectOptions(screen.getByLabelText(/category/i), 'academics');
    await userEvent.type(screen.getByLabelText(/goal name/i), 'Run a 10k');
    await userEvent.click(screen.getByRole('button', { name: /create goal/i }));

    expect(await screen.findByText('Run a 10k')).toBeInTheDocument();

    const post = requests.find((request) => request.init?.method === 'POST');
    expect(post?.url).toBe('/api/goals');
    expect(post?.init?.credentials).toBe('include');
    const headers = post?.init?.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('csrf-token-123');
    const body = JSON.parse(String(post?.init?.body)) as { name: string; status: string };
    expect(body.name).toBe('Run a 10k');
    expect(body.status).toBe('active');
  });

  it('requires assessment questions that are required before saving', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubGoalsApi({ goals: [] });

    renderGoals();
    await userEvent.click(await screen.findByRole('button', { name: /add goal/i }));
    await userEvent.type(screen.getByLabelText(/^goal name/i), 'Custom goal');

    await userEvent.click(screen.getByRole('button', { name: /create goal/i }));

    expect(await screen.findByText('This answer is required.')).toBeInTheDocument();
    expect(
      screen.getByText('Please fix the highlighted assessment answers.'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.init?.method === 'POST')).toBe(false);
  });

  it('deletes a goal only after explicit confirmation', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubGoalsApi({ goals: [EXISTING_GOAL] });

    renderGoals();
    await screen.findByText('Learn Spanish');

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    // First click only arms the confirmation; no request yet.
    expect(requests.some((request) => request.init?.method === 'DELETE')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      const del = requests.find((request) => request.init?.method === 'DELETE');
      expect(del?.url).toBe('/api/goals/goal-1');
    });
  });

  it('pauses an active goal through a status update', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubGoalsApi({ goals: [{ ...EXISTING_GOAL, status: 'active' }] });

    renderGoals();
    await screen.findByText('Learn Spanish');

    await userEvent.click(screen.getByRole('button', { name: /pause/i }));

    await waitFor(() => {
      const patch = requests.find((request) => request.init?.method === 'PATCH');
      expect(patch?.url).toBe('/api/goals/goal-1');
      const body = JSON.parse(String(patch?.init?.body)) as { status: string };
      expect(body.status).toBe('paused');
    });
  });

  it('keeps the edit form data when validation fails', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    stubGoalsApi({ goals: [EXISTING_GOAL] });

    renderGoals();
    await screen.findByText('Learn Spanish');
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    const nameInput = screen.getByLabelText(/goal name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, '   ');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('A goal name is required.')).toBeInTheDocument();
    // The form stays open with the typed (invalid) value preserved.
    expect(screen.getByLabelText(/goal name/i)).toHaveValue('   ');
  });
});
