import { useCallback } from 'react';

import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusPill } from '../../components/ui/StatusPill';
import { useApiResource } from '../../hooks/useApiResource';
import { useServiceHealth } from '../../hooks/useServiceHealth';
import { api } from '../../lib/api';
import type { AIConfigStatus } from '../../types/roadmap';

/** Settings. Shows real environment/service information and AI provider status. */
export function SettingsPage() {
  const { health, readiness } = useServiceHealth();
  const loadAiConfig = useCallback(() => api.roadmaps.config(), []);
  const aiConfig = useApiResource<AIConfigStatus>(loadAiConfig);

  const retry = () => {
    health.reload();
    readiness.reload();
    aiConfig.reload();
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
        <CardHeader
          title="AI provider"
          description="Whether the backend can generate validated roadmaps."
        />
        {aiConfig.status === 'loading' ? <LoadingState /> : null}
        {aiConfig.status === 'error' ? (
          <ErrorState message={aiConfig.error.message} onRetry={aiConfig.reload} />
        ) : null}
        {aiConfig.status === 'success' ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              <StatusPill
                tone={aiConfig.data.configured ? 'positive' : 'warning'}
                label={aiConfig.data.configured ? 'Configured' : 'Not configured'}
                withDot
              />
            </p>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-faint text-xs uppercase">Provider</dt>
                <dd className="text-ink mt-0.5">{aiConfig.data.provider}</dd>
              </div>
              <div>
                <dt className="text-faint text-xs uppercase">Model</dt>
                <dd className="text-ink mt-0.5">{aiConfig.data.model ?? 'None selected'}</dd>
              </div>
            </dl>
            <p className="text-muted">{aiConfig.data.message}</p>
            <p className="text-faint text-xs">
              The API key is stored on the backend only. It is never sent to the browser, logged,
              or included in API responses.
            </p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
