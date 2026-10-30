import type { StatusTone } from '../../components/ui/StatusPill';
import type { RoadmapItemStatus, RoadmapStatus } from '../../types/roadmap';

/** Honest labels for persisted roadmap states. */
export const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
  draft: 'Draft',
  active: 'Active plan',
  archived: 'Archived',
};

export const ROADMAP_STATUS_TONES: Record<RoadmapStatus, StatusTone> = {
  draft: 'neutral',
  active: 'positive',
  archived: 'neutral',
};

export const ITEM_STATUS_LABELS: Record<RoadmapItemStatus, string> = {
  pending: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  book: 'Book',
  course: 'Course',
  video: 'Video',
  article: 'Article',
  practice: 'Practice',
  tool: 'Tool',
  other: 'Resource',
};

export function formatDuration(weeks: number): string {
  return weeks === 1 ? '1 week' : `${weeks} weeks`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
