import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './AuthContext';
import { clearCookies, jsonResponse, setCookie, stubFetch } from '../../test/helpers';

function Probe() {
  const { status, user, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
    </div>
  );
}

afterEach(() => {
  clearCookies();
  vi.unstubAllGlobals();
});

describe('AuthProvider', () => {
  it('restores an existing session from GET /api/auth/me', async () => {
    stubFetch(() =>
      jsonResponse({
        id: 'u1',
        email: 'ada@example.com',
        display_name: 'Ada',
        created_at: '2026-01-01T00:00:00Z',
      }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('email')).toHaveTextContent('ada@example.com');
  });

  it('settles to anonymous when there is no session (401)', async () => {
    stubFetch(() => jsonResponse({ detail: 'Not authenticated' }, 401));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('email')).toBeEmptyDOMElement();
  });

  it('clears the user after logout and calls the API with CSRF', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubFetch(({ url }) => {
      if (url === '/api/auth/me') {
        return jsonResponse({
          id: 'u1',
          email: 'ada@example.com',
          display_name: 'Ada',
          created_at: '2026-01-01T00:00:00Z',
        });
      }
      return jsonResponse({ detail: 'Logged out' });
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await userEvent.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));

    const logoutRequest = requests.find((request) => request.url === '/api/auth/logout');
    expect(logoutRequest?.init?.method).toBe('POST');
    expect((logoutRequest?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
      'csrf-token-123',
    );
  });
});
