import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ServiceStatusCard } from './ServiceStatusCard';

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
}

/** Dashboard / Today. Phase 1 renders the shell and real service status. */
export function DashboardPage() {
  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`${greetingForHour(now.getHours())}`} description={dateLabel} />

      <ServiceStatusCard />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Today’s mission"
            description="Tasks generated from approved weekly objectives."
          />
          <EmptyState
            title="No daily tasks yet"
            description="The daily planning engine — which turns approved weekly objectives into scheduled tasks with XP rewards — is scheduled for Phase 5."
            hint="Nothing is simulated here: this section stays empty until real tasks exist."
          />
        </Card>

        <Card>
          <CardHeader
            title="Goals & progress"
            description="Active goals, levels, streaks, and earned XP."
          />
          <EmptyState
            title="No goals yet"
            description="Goal creation arrives in Phase 3 and XP, levels, and streaks in Phase 6. These values will be computed by the backend from persisted records."
            hint="No placeholder statistics are shown."
          />
        </Card>
      </div>
    </div>
  );
}
