import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoadmapsPage } from './RoadmapsPage';
import { clearCookies, jsonResponse, setCookie, stubFetch } from '../../test/helpers';
import type { Goal } from '../../types/goal';
import type { AIConfigStatus, RoadmapSummary } from '../../types/roadmap';

const CONFIGURED: AIConfigStatus = {
  configured: true,
  provider: 'openai',
  model: 'mock-model',
  message: 'AI roadmap generation is ready with openai (mock-model).',
};

const UNCONFIGURED: AIConfigStatus = {
  configured: false,
  provider: 'none',
  model: null,
  message: 'AI roadmap generation is not configured. Set AI_PROVIDER, AI_API_KEY, and AI_MODEL.',
};

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    name: 'Learn Python',
    description: 'Build a tool',
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
    status: 'active',
    created_at: '2026-10-15T10:00:00Z',
    updated_at: '2026-10-15T10:00:00Z',
    assessment: null,
    ...overrides,
  };
}

function summary(overrides: Partial<RoadmapSummary> = {}): RoadmapSummary {
  return {
    id: 'roadmap-1',
    goal_id: 'goal-1',
    goal_name: 'Learn Python',
    goal_category: 'custom',
    goal_category_label: 'Custom goal',
    title: 'Python foundations',
    status: 'draft',
    estimated_duration_weeks: 8,
    milestone_count: 2,
    provider: 'stub',
    model: 'stub-model',
    approved_at: null,
    created_at: '2026-10-20T10:00:00Z',
    ...overrides,
  };
}

interface StubOptions {
  config?: AIConfigStatus;
  goals?: Goal[];
  roadmaps?: RoadmapSummary[];
  failRoadmapsOnce?: boolean;
  generateFailure?: { status: number; detail: string } | null;
}

function stubRoadmapsApi(options: StubOptions = {}) {
  const roadmaps = [...(options.roadmaps ?? [])];
  let roadmapLoads = 0;
  let generateAttempts = 0;

  const result = stubFetch(({ url, init }) => {
    const method = init?.method ?? 'GET';
    if (url === '/api/roadmaps/config') {
      return jsonResponse(options.config ?? CONFIGURED);
    }
    if (url === '/api/roadmaps/generate' && method === 'POST') {
      generateAttempts += 1;
      if (options.generateFailure && generateAttempts === 1) {
        return jsonResponse({ detail: options.generateFailure.detail }, options.generateFailure.status);
      }
      return jsonResponse({ id: 'roadmap-new' }, 201);
    }
    if (url.startsWith('/api/roadmaps/') && method === 'POST' && url.endsWith('/approve')) {
      return jsonResponse({ id: url.split('/')[3] });
    }
    if (url === '/api/roadmaps') {
      roadmapLoads += 1;
      if (options.failRoadmapsOnce && roadmapLoads === 1) {
        return jsonResponse({ detail: 'Could not load roadmaps.' }, 500);
      }
      return jsonResponse(roadmaps);
    }
    if (url === '/api/goals') {
      return jsonResponse(options.goals ?? []);
    }
    return jsonResponse({ detail: 'Not found' }, 404);
  });

  return { ...result, getGenerateAttempts: () => generateAttempts };
}

function renderRoadmaps() {
  return render(
    <MemoryRouter initialEntries={['/roadmaps']}>
      <Routes>
        <Route path="/roadmaps" element={<RoadmapsPage />} />
        <Route path="/roadmaps/:roadmapId" element={<div>Detail target</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  clearCookies();
  vi.unstubAllGlobals();
});

describe('RoadmapsPage', () => {
  it('shows loading indicators before the API responds', () => {
    stubRoadmapsApi();

    renderRoadmaps();

    expect(screen.getByText('Checking AI configuration…')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Roadmaps' })).toBeInTheDocument();
  });

  it('is honest when the backend has no AI provider configured', async () => {
    stubRoadmapsApi({ config: UNCONFIGURED, goals: [goal()] });

    renderRoadmaps();

    expect(await screen.findByText('AI generation is not configured')).toBeInTheDocument();
    expect(screen.getByText(UNCONFIGURED.message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate roadmap/i })).not.toBeInTheDocument();
    expect(await screen.findByText('No roadmaps yet')).toBeInTheDocument();
  });

  it('shows an empty state and a goal selector when configured', async () => {
    stubRoadmapsApi({ goals: [goal()], roadmaps: [] });

    renderRoadmaps();

    expect(await screen.findByText('No roadmaps yet')).toBeInTheDocument();
    const select = screen.getByLabelText('Goal');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Learn Python/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate roadmap/i })).toBeDisabled();
  });

  it('generates a roadmap with CSRF and navigates to its detail page', async () => {
    const user = userEvent.setup();
    setCookie('maximus_csrf', 'csrf-token');
    const { requests } = stubRoadmapsApi({ goals: [goal()], roadmaps: [] });

    renderRoadmaps();

    const select = await screen.findByLabelText('Goal');
    await user.selectOptions(select, 'goal-1');
    await user.click(screen.getByRole('button', { name: /generate roadmap/i }));

    expect(await screen.findByText('Detail target')).toBeInTheDocument();

    const request = requests.find((entry) => entry.url === '/api/roadmaps/generate');
    expect(request).toBeDefined();
    expect(request?.init?.method).toBe('POST');
    expect(request?.init?.credentials).toBe('include');
    expect((request?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-token');
    const body = JSON.parse(String(request?.init?.body)) as {
      goal_id: string;
      idempotency_key: string;
    };
    expect(body.goal_id).toBe('goal-1');
    expect(body.idempotency_key).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('shows a real generation error and retries with the same idempotency key', async () => {
    const user = userEvent.setup();
    setCookie('maximus_csrf', 'csrf-token');
    const { requests } = stubRoadmapsApi({
      goals: [goal()],
      roadmaps: [],
      generateFailure: { status: 503, detail: 'The AI provider is rate limiting requests.' },
    });

    renderRoadmaps();

    const select = await screen.findByLabelText('Goal');
    await user.selectOptions(select, 'goal-1');
    await user.click(screen.getByRole('button', { name: /generate roadmap/i }));

    expect(await screen.findByText('The AI provider is rate limiting requests.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Detail target')).toBeInTheDocument();

    const keys = requests
      .filter((entry) => entry.url === '/api/roadmaps/generate')
      .map((entry) => (JSON.parse(String(entry.init?.body)) as { idempotency_key: string }).idempotency_key);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('shows a list error with a working retry', async () => {
    const user = userEvent.setup();
    stubRoadmapsApi({ goals: [goal()], roadmaps: [], failRoadmapsOnce: true });

    renderRoadmaps();

    expect(await screen.findByText('Could not load roadmaps.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('No roadmaps yet')).toBeInTheDocument();
  });

  it('renders persisted roadmap summaries and approves a draft', async () => {
    const user = userEvent.setup();
    setCookie('maximus_csrf', 'csrf-token');
    const { requests } = stubRoadmapsApi({
      goals: [goal()],
      roadmaps: [summary({ status: 'draft' })],
    });

    renderRoadmaps();

    expect(await screen.findByText('Python foundations')).toBeInTheDocument();
    expect(screen.getByText(/Goal:/)).toHaveTextContent('Learn Python');
    expect(screen.getByText(/8 weeks/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(requests.some((entry) => entry.url === '/api/roadmaps/roadmap-1/approve')).toBe(
        true,
      );
    });
  });
});
