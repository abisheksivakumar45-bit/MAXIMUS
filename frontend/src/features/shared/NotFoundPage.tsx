import { Link } from 'react-router-dom';

import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';

export function NotFoundPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Page not found" description="This route does not exist." />
      <Card>
        <p className="text-muted text-sm">
          The page you requested is not part of MAXIMUS. Return to the{' '}
          <Link to="/" className="text-accent underline underline-offset-2">
            dashboard
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
