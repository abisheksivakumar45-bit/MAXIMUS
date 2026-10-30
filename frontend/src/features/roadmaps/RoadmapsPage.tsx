import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SelectField } from '../../components/ui/SelectField';
import { StatusPill } from '../../components/ui/StatusPill';
import { useApiResource } from '../../hooks/useApiResource';
import { ApiError, api } from '../../lib/api';
import type { Goal } from '../../types/goal';
import type { AIConfigStatus, RoadmapSummary } from '../../types/roadmap';
import {
  ROADMAP_STATUS_LABELS,
  ROADMAP_STATUS_TONES,
  formatDate,
  formatDuration,
} from './roadmapMeta';

/**
 * Roadmaps (master-spec §4).
 *
 * Generation is only offered when the backend reports a configured provider.
 * There is no fake plan, no fabricated progress, and no local-only success:
 * every card below comes from PostgreSQL through `GET /api/roadmaps`.
 */

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `roadmap-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}

export function RoadmapsPage() {
  const navigate = useNavigate();
  const loadConfig = useCallback(() => api.roadmaps.config(), []);
  const loadRoadmaps = useCallback(() => api.roadmaps.list(), []);
  const loadGoals = useCallback(() => api.goals.list(), []);
  const configState = useApiResource<AIConfigStatus>(loadConfig);
  const roadmapState = useApiResource<RoadmapSummary[]>(loadRoadmaps);
  const goalsState = useApiResource<Goal[]>(loadGoals);

  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [attemptKey, setAttemptKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const roadmaps = roadmapState.data ?? [];
  const eligibleGoals = useMemo(
    () => (goalsState.data ?? []).filter((goal) => goal.status === 'active' || goal.status === 'paused'),
    [goalsState.data],
  );
  const config = configState.data;
  const canGenerate = config?.configured === true && eligibleGoals.length > 0;

  function selectGoal(value: string) {
    setSelectedGoalId(value);
    // A new goal must never reuse the previous goal's idempotency key.
    setAttemptKey(null);
    setGenerationError(null);
  }

  async function generate() {
    if (generating || !canGenerate || !selectedGoalId) {
      return;
    }
    const key = attemptKey ?? newIdempotencyKey();
    setAttemptKey(key);
    setGenerating(true);
    setGenerationError(null);
    try {
      const roadmap = await api.roadmaps.generate({
        goal_id: selectedGoalId,
        idempotency_key: key,
      });
      setAttemptKey(null);
      roadmapState.reload();
      navigate(`/roadmaps/${roadmap.id}`);
    } catch (error) {
      setGenerationError(errorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  async function approve(roadmapId: string) {
    if (approvingId !== null) {
      return;
    }
    setApprovingId(roadmapId);
    setApprovalError(null);
    try {
      await api.roadmaps.approve(roadmapId);
      roadmapState.reload();
    } catch (error) {
      setApprovalError(errorMessage(error));
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roadmaps"
        description="Turn one of your goals into an ordered plan of milestones, tasks, and resources."
      />

      <Card>
        <CardHeader
          title="Generate a roadmap"
          description="The backend builds a structured plan from your goal and onboarding answers, validates it, then saves it. Nothing is generated in the browser."
        />

        {configState.status === 'loading' ? <LoadingState label="Checking AI configuration…" /> : null}
        {configState.status === 'error' ? (
          <ErrorState message={configState.error.message} onRetry={configState.reload} />
        ) : null}
        {configState.status === 'success' && !configState.data.configured ? (
          <Alert tone="info">
            <p className="font-medium">AI generation is not configured</p>
            <p className="mt-1">{configState.data.message}</p>
            <p className="text-muted mt-2 text-xs">
              Ask the backend administrator to set <code>AI_PROVIDER</code>,{' '}
              <code>AI_API_KEY</code>, and <code>AI_MODEL</code>. Existing roadmaps remain
              readable, and approval still works.
            </p>
          </Alert>
        ) : null}

        {configState.status === 'success' && configState.data.configured ? (
          <div className="flex flex-col gap-4">
            {goalsState.status === 'loading' ? <LoadingState label="Loading your goals…" /> : null}
            {goalsState.status === 'error' ? (
              <ErrorState message={goalsState.error.message} onRetry={goalsState.reload} />
            ) : null}
            {goalsState.status === 'success' && eligibleGoals.length === 0 ? (
              <EmptyState
                title="No goals ready for planning"
                description="Only active or paused goals can become roadmaps. Create or activate a goal first."
                hint={
                  <Link to="/goals" className="text-accent underline">
                    Go to Goals
                  </Link>
                }
              />
            ) : null}
            {goalsState.status === 'success' && eligibleGoals.length > 0 ? (
              <>
                <SelectField
                  id="roadmap-goal"
                  label="Goal"
                  placeholder="Choose a goal…"
                  options={eligibleGoals.map((goal) => ({
                    value: goal.id,
                    label: `${goal.name} · ${goal.category_label}`,
                  }))}
                  value={selectedGoalId}
                  onChange={(event) => selectGoal(event.target.value)}
                  hint="Draft, completed, and archived goals cannot be planned."
                />
                {generationError ? (
                  <Alert tone="danger">
                    <p>{generationError}</p>
                    <p className="text-muted mt-1 text-xs">
                      Retrying is safe: this attempt reuses the same idempotency key, so a
                      roadmap cannot be created twice.
                    </p>
                  </Alert>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-faint text-xs">
                    Generation can take up to a minute and may call a paid provider. The plan is
                    saved only after it passes strict validation.
                  </p>
                  <Button
                    onClick={() => void generate()}
                    loading={generating}
                    disabled={!selectedGoalId}
                  >
                    {generationError ? 'Try again' : 'Generate roadmap'}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </Card>

      <section aria-labelledby="roadmap-list-heading" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="roadmap-list-heading" className="text-lg font-semibold tracking-tight">
              Your roadmaps
            </h2>
            <p className="text-muted mt-1 text-sm">
              {roadmapState.status === 'success'
                ? `${roadmaps.length} saved ${roadmaps.length === 1 ? 'roadmap' : 'roadmaps'}.`
                : 'Plans stored on the server.'}
            </p>
          </div>
        </div>

        {approvalError ? <Alert tone="danger">{approvalError}</Alert> : null}

        {roadmapState.status === 'loading' ? <LoadingState /> : null}
        {roadmapState.status === 'error' ? (
          <ErrorState message={roadmapState.error.message} onRetry={roadmapState.reload} />
        ) : null}
        {roadmapState.status === 'success' && roadmaps.length === 0 ? (
          <EmptyState
            title="No roadmaps yet"
            description="Generate a plan for an active goal and it will appear here after it has been validated and saved."
            hint="No placeholder roadmaps are shown."
          />
        ) : null}
        {roadmapState.status === 'success' && roadmaps.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {roadmaps.map((roadmap) => (
              <li key={roadmap.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-ink text-base font-semibold">{roadmap.title}</h3>
                        <StatusPill
                          tone={ROADMAP_STATUS_TONES[roadmap.status]}
                          label={ROADMAP_STATUS_LABELS[roadmap.status]}
                        />
                      </div>
                      <p className="text-muted mt-1 text-sm">
                        Goal: <span className="text-ink">{roadmap.goal_name}</span> ·{' '}
                        {roadmap.goal_category_label}
                      </p>
                      <p className="text-faint mt-2 text-xs">
                        {formatDuration(roadmap.estimated_duration_weeks)} ·{' '}
                        {roadmap.milestone_count}{' '}
                        {roadmap.milestone_count === 1 ? 'milestone' : 'milestones'} · created{' '}
                        {formatDate(roadmap.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {roadmap.status !== 'active' ? (
                        <Button
                          variant="secondary"
                          onClick={() => void approve(roadmap.id)}
                          loading={approvingId === roadmap.id}
                          disabled={approvingId !== null && approvingId !== roadmap.id}
                        >
                          Approve
                        </Button>
                      ) : null}
                      <Button variant="secondary" onClick={() => navigate(`/roadmaps/${roadmap.id}`)}>
                        View roadmap
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
