import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';

import { DashboardPage } from './DashboardPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(handler: (url: string) => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    return Promise.resolve(handler(url));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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
    stubFetch((url) => {
      if (url.includes('/api/health/ready')) {
        return jsonResponse({ status: 'ready', database: { connected: true } });
      }
      return jsonResponse({
        service: 'MAXIMUS',
        version: '0.1.0',
        environment: 'test',
        status: 'ok',
        timestamp: '2026-10-15T10:00:00Z',
      });
    });

    renderDashboard();

    expect(await screen.findByText('MAXIMUS')).toBeInTheDocument();
    expect(await screen.findByText('Database connected')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
  });

  it('surfaces a real error state when the backend fails', async () => {
    stubFetch(() => jsonResponse({ detail: 'Internal server error' }, 500));

    renderDashboard();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders honest empty states for unimplemented modules', async () => {
    stubFetch((url) =>
      url.includes('/api/health/ready')
        ? jsonResponse({ status: 'ready', database: { connected: true } })
        : jsonResponse({
            service: 'MAXIMUS',
            version: '0.1.0',
            environment: 'test',
            status: 'ok',
            timestamp: '2026-10-15T10:00:00Z',
          }),
    );

    renderDashboard();

    expect(await screen.findByText('No daily tasks yet')).toBeInTheDocument();
    expect(screen.getByText('No goals yet')).toBeInTheDocument();
  });
});
