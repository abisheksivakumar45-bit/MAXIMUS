import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { clearCookies, jsonResponse, stubFetch } from '../../test/helpers';

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <AuthProvider>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/secret" element={<div>Secret content</div>} />
          </Route>
          <Route path="/login" element={<div>Login screen</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  clearCookies();
  vi.unstubAllGlobals();
});

describe('ProtectedRoute', () => {
  it('renders the route for an authenticated user', async () => {
    stubFetch(() =>
      jsonResponse({
        id: 'u1',
        email: 'ada@example.com',
        display_name: 'Ada',
        created_at: '2026-01-01T00:00:00Z',
      }),
    );

    renderGuarded();

    await waitFor(() => expect(screen.getByText('Secret content')).toBeInTheDocument());
  });

  it('redirects an anonymous user to the login screen', async () => {
    stubFetch(() => jsonResponse({ detail: 'Not authenticated' }, 401));

    renderGuarded();

    await waitFor(() => expect(screen.getByText('Login screen')).toBeInTheDocument());
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });
});
