import { useCallback } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { StatusPill } from '../../components/ui/StatusPill';
import { api } from '../../lib/api';
import { useApiResource } from '../../hooks/useApiResource';
import type { Goal, GoalStatus } from '../../types/goal';
import type { OnboardingState } from '../../types/onboarding';

const STATUS_TONES: Record<GoalStatus, 'neutral' | 'positive' | 'warning' | 'info'> = {
  draft: 'neutral',
  active: 'positive',
  paused: 'warning',
  completed: 'info',
  archived: 'neutral',
};

/**
 * Dashboard goal summary backed by real API data.
 *
 * Shows the active goal count, each goal's category and assessment status, the
 * resume-onboarding path while setup is unfinished, and honest notes about
 * what later phases will add. No percentages or recommendations are invented.
 */
export function GoalsSummaryCard() {
  const loadGoals = useCallback(() => api.goals.list(), []);
  const loadOnboarding = useCallback(() => api.onboarding.get(), []);
  const goalsState = useApiResource<Goal[]>(loadGoals);
  const onboardingState = useApiResource<OnboardingState>(loadOnboarding);

  if (goalsState.status === 'loading' || onboardingState.status === 'loading') {
    return (
      <Card>
        <CardHeader title="Your goals" description="Loading your goals…" />
        <LoadingState label="Loading your goals…" />
      </Card>
    );
  }

  if (goalsState.status === 'error') {
    return (
      <Card>
        <CardHeader title="Your goals" />
        <ErrorState message={goalsState.error.message} onRetry={goalsState.reload} />
      </Card>
    );
  }

  const goals = goalsState.data ?? [];
  const onboarding = onboardingState.data;
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const onboardingIncomplete = onboarding?.completed_at === null;

  return (
    <Card>
      <CardHeader
        title="Your goals"
        description={
          goals.length === 0
            ? 'Nothing here yet'
            : `${activeGoals.length} active · ${goals.length} total`
        }
        action={
          goals.length > 0 ? (
            <Link to="/goals">
              <Button variant="secondary">Manage goals</Button>
            </Link>
          ) : null
        }
      />

      {onboardingIncomplete ? (
        <div className="border-line bg-surface-raised/40 rounded-control mb-4 border border-dashed p-4">
          <p className="text-ink text-sm font-medium">Finish setting up MAXIMUS</p>
          <p className="text-muted mt-1 text-sm">
            {onboarding && onboarding.missing.length > 0
              ? `Still needed: ${onboarding.missing.join(', ')}.`
              : 'A few short questions remain before your plan can be built.'}
          </p>
          <Link to="/onboarding" className="mt-3 inline-block">
            <Button>Resume setup</Button>
          </Link>
        </div>
      ) : null}

      {goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Goals you create are stored on your account and drive everything MAXIMUS plans. Add one from the Goals page."
          hint="Roadmaps, weekly plans, and daily tasks build on these goals in later phases."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-[color:var(--color-line)]">
          {goals.map((goal) => (
            <li key={goal.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-ink text-sm font-medium">{goal.name}</p>
                <p className="text-muted text-xs">
                  {goal.category_label}
                  {goal.assessment && Object.keys(goal.assessment.answers).length > 0
                    ? ' · Assessment answered'
                    : ' · Assessment not answered'}
                </p>
              </div>
              <StatusPill tone={STATUS_TONES[goal.status]} label={goal.status} />
            </li>
          ))}
        </ul>
      )}

      <p className="text-faint mt-4 text-xs">
        Levels, streaks, and XP are computed by the backend in Phase 6 — none are shown until
        they are real.
      </p>
    </Card>
  );
}
