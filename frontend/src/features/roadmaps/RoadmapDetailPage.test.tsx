import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoadmapDetailPage } from './RoadmapDetailPage';
import { clearCookies, jsonResponse, setCookie, stubFetch } from '../../test/helpers';
import type { Roadmap } from '../../types/roadmap';

function roadmap(overrides: Partial<Roadmap> = {}): Roadmap {
  return {
    id: 'roadmap-1',
    goal_id: 'goal-1',
    goal_name: 'Learn Python',
    goal_category: 'custom',
    goal_category_label: 'Custom goal',
    title: 'Python foundations',
    description: 'A practical path from syntax to a small project.',
    objective: 'Build and test a small Python program.',
    starting_level: 'Beginner',
    target_level: 'Confident beginner',
    estimated_duration_weeks: 8,
    status: 'draft',
    provider: 'openai',
    model: 'mock-model',
    approved_at: null,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    milestones: [
      {
        id: 'milestone-1',
        position: 0,
        title: 'Core syntax',
        description: 'Learn variables, control flow, functions, and files.',
        estimated_duration_weeks: 3,
        completion_criteria: 'Solve ten small exercises without help.',
        status: 'pending',
        tasks: [
          {
            id: 'task-1',
            position: 0,
            title: 'Work through syntax exercises',
            description: 'Complete the first five exercises.',
            estimated_minutes: 45,
            completion_criteria: 'All five pass.',
            status: 'pending',
          },
        ],
        resources: [
          {
            id: 'resource-1',
            position: 0,
            title: 'Official Python tutorial',
            resource_type: 'course',
            url: 'https://docs.python.org/3/tutorial/',
            note: 'Free and maintained.',
          },
        ],
      },
      {
        id: 'milestone-2',
        position: 1,
        title: 'First project',
        description: 'Build a small command-line tool.',
        estimated_duration_weeks: 5,
        completion_criteria: 'The tool works and has tests.',
        status: 'pending',
        tasks: [],
        resources: [],
      },
    ],
    ...overrides,
  };
}

interface StubOptions {
  detail?: Roadmap;
  failOnce?: boolean;
  notFound?: boolean;
}

function stubDetailApi(options: StubOptions = {}) {
  let approved = false;
  let loads = 0;

  const result = stubFetch(({ url, init }) => {
    const method = init?.method ?? 'GET';
    if (url === '/api/roadmaps/roadmap-1/approve' && method === 'POST') {
      approved = true;
      return jsonResponse({ ...(options.detail ?? roadmap()), status: 'active' });
    }
    if (url === '/api/roadmaps/roadmap-1') {
      loads += 1;
      if (options.failOnce && loads === 1) {
        return jsonResponse({ detail: 'Could not load the roadmap.' }, 500);
      }
      if (options.notFound) {
        return jsonResponse({ detail: 'Roadmap not found.' }, 404);
      }
      const base = options.detail ?? roadmap();
      return jsonResponse(
        approved
          ? {
              ...base,
              status: 'active',
              approved_at: '2026-10-21T10:00:00Z',
            }
          : base,
      );
    }
    return jsonResponse({ detail: 'Not found' }, 404);
  });

  return { ...result, getLoads: () => loads };
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/roadmaps/roadmap-1']}>
      <Routes>
        <Route path="/roadmaps/:roadmapId" element={<RoadmapDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  clearCookies();
  vi.unstubAllGlobals();
});

describe('RoadmapDetailPage', () => {
  it('shows a loading state before the roadmap arrives', () => {
    stubDetailApi();

    renderDetail();

    expect(screen.getByText('Loading the saved plan…')).toBeInTheDocument();
  });

  it('renders the persisted overview, milestones, tasks, and resources', async () => {
    stubDetailApi();

    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Python foundations' })).toBeInTheDocument();
    expect(screen.getByText(/Plan for Learn Python/)).toBeInTheDocument();
    expect(screen.getByText('8 weeks')).toBeInTheDocument();
    expect(screen.getByText('Beginner → Confident beginner')).toBeInTheDocument();
    expect(screen.getByText('Build and test a small Python program.')).toBeInTheDocument();
    expect(screen.getByText(/Core syntax/)).toBeInTheDocument();
    expect(screen.getByText(/First project/)).toBeInTheDocument();
    expect(screen.getByText('Solve ten small exercises without help.')).toBeInTheDocument();
    expect(screen.getByText('Work through syntax exercises')).toBeInTheDocument();
    expect(screen.getByText(/~45 min/)).toBeInTheDocument();
    expect(screen.getByText(/All five pass\./)).toBeInTheDocument();
    expect(screen.getAllByText(/Not started/).length).toBeGreaterThan(0);

    const link = screen.getByRole('link', { name: 'Official Python tutorial' });
    expect(link).toHaveAttribute('href', 'https://docs.python.org/3/tutorial/');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('approves a draft and re-renders the active state from the server', async () => {
    const user = userEvent.setup();
    setCookie('maximus_csrf', 'csrf-token');
    const { requests } = stubDetailApi();

    renderDetail();

    expect(await screen.findByRole('button', { name: 'Approve plan' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve plan' }));

    expect(await screen.findByText('Active plan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve plan' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(requests.some((entry) => entry.url.endsWith('/approve'))).toBe(true);
    });
  });

  it('shows a load error with a working retry', async () => {
    const user = userEvent.setup();
    stubDetailApi({ failOnce: true });

    renderDetail();

    expect(await screen.findByText('Could not load the roadmap.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('heading', { name: 'Python foundations' })).toBeInTheDocument();
  });

  it('shows the backend 404 message for a missing or foreign roadmap', async () => {
    stubDetailApi({ notFound: true });

    renderDetail();

    expect(await screen.findByText('Roadmap not found.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to roadmaps' })).toHaveAttribute(
      'href',
      '/roadmaps',
    );
  });
});
