import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from './AuthContext';
import { LoginPage } from './LoginPage';
import { clearCookies, jsonResponse, setCookie, stubFetch } from '../../test/helpers';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Dashboard home</div>} />
          <Route path="/onboarding" element={<div>Onboarding destination</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  clearCookies();
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('shows accessible validation errors and does not submit', async () => {
    const { requests } = stubFetch(() => jsonResponse({ detail: 'Not authenticated' }, 401));

    renderLogin();
    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(requests.some((request) => request.url === '/api/auth/login')).toBe(false);
  });

  it('signs in, sends the CSRF token, and navigates home', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    const { requests } = stubFetch(({ url }) => {
      if (url === '/api/auth/login') {
        return jsonResponse({
          id: 'u1',
          email: 'ada@example.com',
          display_name: 'Ada',
          created_at: '2026-01-01T00:00:00Z',
        });
      }
      return jsonResponse({ detail: 'Not authenticated' }, 401);
    });

    renderLogin();
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'TestPassword123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('Dashboard home')).toBeInTheDocument());

    const loginRequest = requests.find((request) => request.url === '/api/auth/login');
    expect(loginRequest?.init?.method).toBe('POST');
    expect((loginRequest?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
      'csrf-token-123',
    );
  });

  it('sends the user to onboarding when setup is unfinished', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    stubFetch(({ url }) => {
      if (url === '/api/auth/login') {
        return jsonResponse({
          id: 'u1',
          email: 'ada@example.com',
          display_name: 'Ada',
          created_at: '2026-01-01T00:00:00Z',
        });
      }
      if (url === '/api/onboarding') {
        return jsonResponse({ completed_at: null, missing: ['your time zone'] });
      }
      return jsonResponse({ detail: 'Not found' }, 404);
    });

    renderLogin();
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'TestPassword123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Onboarding destination')).toBeInTheDocument();
  });

  it('keeps the requested destination when onboarding is already complete', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    stubFetch(({ url }) => {
      if (url === '/api/auth/login') {
        return jsonResponse({
          id: 'u1',
          email: 'ada@example.com',
          display_name: 'Ada',
          created_at: '2026-01-01T00:00:00Z',
        });
      }
      if (url === '/api/onboarding') {
        return jsonResponse({ completed_at: '2026-10-16T09:00:00Z', missing: [] });
      }
      return jsonResponse({ detail: 'Not found' }, 404);
    });

    renderLogin();
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'TestPassword123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
  });

  it('surfaces a backend error such as invalid credentials', async () => {
    setCookie('maximus_csrf', 'csrf-token-123');
    stubFetch(({ url }) => {
      if (url === '/api/auth/login') {
        return jsonResponse({ detail: 'Invalid email or password.' }, 401);
      }
      return jsonResponse({ detail: 'Not authenticated' }, 401);
    });

    renderLogin();
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPassword123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    stubFetch(() => jsonResponse({ detail: 'Not authenticated' }, 401));
    renderLogin();
    await waitFor(() => expect(screen.getByLabelText('Password')).toBeInTheDocument());

    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(password).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(password).toHaveAttribute('type', 'password');
  });
});
