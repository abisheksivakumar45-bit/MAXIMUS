import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import type { NavItem } from '../../app/navigation';

/**
 * Honest stand-in for a feature that has not been built yet.
 *
 * It states plainly that the feature is unavailable, which phase delivers it,
 * and that nothing is being simulated in the meantime.
 */
export function PlaceholderPage({ item }: { item: NavItem }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={item.label} description={item.description} />
      <Card>
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="border-line-strong text-faint rounded-control flex h-10 w-10 shrink-0 items-center justify-center border text-sm font-semibold"
          >
            {item.phase}
          </span>
          <div>
            <h2 className="text-ink text-base font-semibold">Not implemented yet</h2>
            <p className="text-muted mt-1 text-sm">
              This section is planned for <strong>Phase {item.phase}</strong> of the MAXIMUS
              development plan. It is intentionally empty: no mock data, no simulated actions, and
              no placeholder results are shown.
            </p>
            <p className="text-faint mt-3 text-xs">
              See <code className="font-mono">docs/MASTER_SPEC.md</code> and{' '}
              <code className="font-mono">docs/IMPLEMENTATION_STATUS.md</code> for the current,
              verified scope.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
