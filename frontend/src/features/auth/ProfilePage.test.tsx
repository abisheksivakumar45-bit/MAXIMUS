import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from './AuthContext';
import { ProfilePage } from './ProfilePage';
import { ProtectedRoute } from './ProtectedRoute';
import { clearCookies, jsonResponse, setCookie, stubFetch } from '../../test/helpers';

const USER = {
  id: 'u1',
  email: 'ada@example.com',
  display_name: 'Ada',
  created_at: '2026-01-01T00:00:00Z',
};

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <AuthProvider>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfilePage />} />
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

describe('ProfilePage', () => {
  it('shows the account email and current display name', async () => {
    stubFetch(() => jsonResponse(USER));

    renderProfile();

    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Display name')).toHaveValue('Ada');
    // The email is presented as read-only text, not an editable field.
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('saves a new display name with a CSRF token', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubFetch(({ url, init }) => {
      if (url === '/api/profile' && init?.method === 'PATCH') {
        return jsonResponse({ ...USER, display_name: 'Ada Lovelace' });
      }
      return jsonResponse(USER);
    });

    renderProfile();
    const input = await screen.findByLabelText('Display name');

    await userEvent.clear(input);
    await userEvent.type(input, 'Ada Lovelace');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Profile updated.')).toBeInTheDocument();

    const patch = requests.find((request) => request.url === '/api/profile');
    expect(patch?.init?.method).toBe('PATCH');
    expect(patch?.init?.body).toBe(JSON.stringify({ display_name: 'Ada Lovelace' }));
    expect((patch?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
      'csrf-token-123',
    );
  });

  it('rejects a blank display name without calling the API', async () => {
    const { requests } = stubFetch(() => jsonResponse(USER));

    renderProfile();
    const input = await screen.findByLabelText('Display name');

    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Display name is required.')).toBeInTheDocument();
    await waitFor(() =>
      expect(requests.some((request) => request.init?.method === 'PATCH')).toBe(false),
    );
  });
});
