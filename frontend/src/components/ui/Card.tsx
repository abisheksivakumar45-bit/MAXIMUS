import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}

/** Surface container used across the UI for consistent spacing and borders. */
export function Card({ children, className, as: Element = 'section' }: CardProps) {
  return (
    <Element className={cn('bg-surface border-line rounded-card border p-5', className)}>
      {children}
    </Element>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  /** Optional trailing content (actions, badges). */
  action?: ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-muted mt-1 text-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
