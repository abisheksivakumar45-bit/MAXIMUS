import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { TextField } from '../../components/ui/TextField';
import { ApiError, api } from '../../lib/api';
import { useAuth } from './AuthContext';
import { validateEmail } from './validation';

interface LocationState {
  from?: string;
}

/** Email + password sign-in screen. */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as LocationState | null)?.from ?? '/';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextEmailError = validateEmail(email);
    const nextPasswordError = password ? null : 'Password is required.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) {
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      // Continue onboarding when it is unfinished (the spec journey starts
      // with it); otherwise honour the requested destination. A failure while
      // checking is non-fatal — the dashboard offers a resume path too.
      let destination = redirectTo;
      try {
        const onboarding = await api.onboarding.get();
        if (onboarding.completed_at === null) {
          destination = '/onboarding';
        }
      } catch {
        // Keep the default destination; the dashboard reports the error state.
      }
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Unable to sign in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-ink text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted mt-1 text-sm">Welcome back. Pick up where you left off.</p>
      </div>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <TextField
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
          autoComplete="email"
          required
        />
        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={setPassword}
          error={passwordError}
          autoComplete="current-password"
        />
        <Button type="submit" loading={submitting} className="mt-1 w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="text-muted text-center text-sm">
        New to MAXIMUS?{' '}
        <Link to="/register" className="text-accent underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </div>
  );
}
