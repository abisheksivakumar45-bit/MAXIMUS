import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusPill } from '../../components/ui/StatusPill';
import { useServiceHealth } from '../../hooks/useServiceHealth';

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

/**
 * Shows real status reported by the MAXIMUS backend:
 * service metadata from /api/health and database connectivity from
 * /api/health/ready. Nothing here is hardcoded.
 */
export function ServiceStatusCard() {
  const { health, readiness } = useServiceHealth();

  const retry = () => {
    health.reload();
    readiness.reload();
  };

  return (
    <Card>
      <CardHeader
        title="Service status"
        description="Live data fetched from the backend health endpoints."
        action={
          readiness.status === 'success' ? (
            <StatusPill tone="positive" label="Database connected" withDot />
          ) : readiness.status === 'error' ? (
            <StatusPill tone="danger" label="Database unavailable" withDot />
          ) : null
        }
      />

      {health.status === 'loading' ? <LoadingState label="Contacting MAXIMUS backend…" /> : null}

      {health.status === 'error' ? (
        <ErrorState message={health.error.message} onRetry={retry} />
      ) : null}

      {health.status === 'success' ? (
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-faint text-xs uppercase">Service</dt>
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
            <dt className="text-faint text-xs uppercase">Server time</dt>
            <dd className="text-ink mt-0.5">{formatTimestamp(health.data.timestamp)}</dd>
          </div>
        </dl>
      ) : null}

      {health.status === 'success' && readiness.status === 'error' ? (
        <div className="mt-4">
          <ErrorState message={readiness.error.message} onRetry={retry} />
        </div>
      ) : null}
    </Card>
  );
}
