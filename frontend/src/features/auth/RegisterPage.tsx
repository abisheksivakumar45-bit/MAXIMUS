import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api';
import { useAuth } from './AuthContext';
import {
  PASSWORD_MIN_LENGTH,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from './validation';

/** Account creation screen. */
export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const [errors, setErrors] = useState<{
    displayName?: string | null;
    email?: string | null;
    password?: string | null;
    confirmation?: string | null;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = {
      displayName: validateDisplayName(displayName),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmation: validatePasswordConfirmation(password, confirmation),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some((value) => value != null)) {
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await register({ display_name: displayName.trim(), email: email.trim(), password });
      // A brand-new account always needs onboarding before it has any goals.
      navigate('/onboarding', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Unable to create your account.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-ink text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted mt-1 text-sm">Start turning ambitions into a plan.</p>
      </div>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <TextField
          id="register-name"
          label="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          error={errors.displayName}
          autoComplete="name"
          required
        />
        <TextField
          id="register-email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          autoComplete="email"
          required
        />
        <PasswordField
          id="register-password"
          label="Password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`}
          autoComplete="new-password"
        />
        <PasswordField
          id="register-confirm"
          label="Confirm password"
          value={confirmation}
          onChange={setConfirmation}
          error={errors.confirmation}
          autoComplete="new-password"
        />
        <Button type="submit" loading={submitting} className="mt-1 w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-muted text-center text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-accent underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}
