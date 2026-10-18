import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusPill } from '../../components/ui/StatusPill';
import { useServiceHealth } from '../../hooks/useServiceHealth';

/** Settings. Phase 1 exposes real environment/service information only. */
export function SettingsPage() {
  const { health, readiness } = useServiceHealth();

  const retry = () => {
    health.reload();
    readiness.reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Application and environment information reported by the backend."
      />

      <Card>
        <CardHeader title="Application" description="Values reported by GET /api/health." />
        {health.status === 'loading' ? <LoadingState /> : null}
        {health.status === 'error' ? (
          <ErrorState message={health.error.message} onRetry={retry} />
        ) : null}
        {health.status === 'success' ? (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-faint text-xs uppercase">Application</dt>
              <dd className="text-ink mt-0.5">{health.data.service}</dd>
            </div>
            <div>
              <dt className="text-faint text-xs uppercase">Version</dt>
              <dd className="text-ink mt-0.5">{health.data.version}</dd>
            </div>
            <div>
              <dt className="text-faint text-xs uppercase">Environment</dt>
              <dd className="text-ink mt-0.5">{health.data.environment}</dd>
            </div>
            <div>
              <dt className="text-faint text-xs uppercase">Status</dt>
              <dd className="mt-0.5">
                <StatusPill
                  tone={readiness.status === 'success' ? 'positive' : 'warning'}
                  label={readiness.status === 'success' ? 'Ready' : 'Checking dependencies'}
                  withDot
                />
              </dd>
            </div>
          </dl>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Database"
          description="PostgreSQL connectivity, reported by GET /api/health/ready."
        />
        {readiness.status === 'loading' ? <LoadingState /> : null}
        {readiness.status === 'error' ? (
          <ErrorState message={readiness.error.message} onRetry={retry} />
        ) : null}
        {readiness.status === 'success' ? (
          <p className="text-sm">
            <StatusPill
              tone={readiness.data.database.connected ? 'positive' : 'danger'}
              label={readiness.data.database.connected ? 'Connected' : 'Unavailable'}
              withDot
            />
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="AI provider" description="Roadmaps, coaching, and personalisation." />
        <EmptyState
          title="Not configured"
          description="MAXIMUS has no AI provider wired up yet. The provider abstraction, structured-output validation, and honest failure handling are introduced in Phase 4."
          hint="No AI-generated content is produced or displayed anywhere in Phase 1."
        />
      </Card>
    </div>
  );
}
