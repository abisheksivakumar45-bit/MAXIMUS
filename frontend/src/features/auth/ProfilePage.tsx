import { useState } from 'react';
import type { FormEvent } from 'react';

import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api';
import { useAuth } from './AuthContext';
import { validateDisplayName } from './validation';

function formatCreatedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
}

/**
 * Profile screen: shows the signed-in user's account details and lets them
 * update their display name. The email address is read-only — changing it
 * requires a verified-email flow that is out of scope for Phase 2.
 */
export function ProfilePage() {
  const { user, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ProtectedRoute guarantees a user, but keep the component total.
  if (!user) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nameError = validateDisplayName(displayName);
    if (nameError) {
      setError(nameError);
      setStatusMessage(null);
      return;
    }

    setError(null);
    setStatusMessage(null);
    setSubmitting(true);
    try {
      await updateProfile({ display_name: displayName.trim() });
      setStatusMessage('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update your profile.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profile" description="Manage your account details." />

      <Card>
        <CardHeader title="Account" description="Your email address is read-only." />
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-faint text-xs font-medium tracking-wider uppercase">Email</dt>
            <dd className="text-ink mt-1 text-sm break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-faint text-xs font-medium tracking-wider uppercase">Member since</dt>
            <dd className="text-ink mt-1 text-sm">{formatCreatedAt(user.created_at)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Display name" description="This is how MAXIMUS addresses you." />
        <form className="flex max-w-md flex-col gap-4" onSubmit={handleSubmit} noValidate>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {statusMessage ? <Alert tone="positive">{statusMessage}</Alert> : null}
          <TextField
            id="profile-display-name"
            label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
          />
          <div>
            <Button type="submit" loading={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
