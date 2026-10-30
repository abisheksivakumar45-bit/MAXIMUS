/** Shapes returned by the MAXIMUS roadmap endpoints. */

export type RoadmapStatus = 'draft' | 'active' | 'archived';
export type RoadmapItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type ResourceType =
  | 'book'
  | 'course'
  | 'video'
  | 'article'
  | 'practice'
  | 'tool'
  | 'other';

export interface RoadmapTask {
  id: string;
  position: number;
  title: string;
  description: string;
  estimated_minutes: number | null;
  completion_criteria: string | null;
  status: RoadmapItemStatus;
}

export interface RoadmapResource {
  id: string;
  position: number;
  title: string;
  resource_type: ResourceType;
  url: string | null;
  note: string | null;
}

export interface RoadmapMilestone {
  id: string;
  position: number;
  title: string;
  description: string;
  estimated_duration_weeks: number;
  completion_criteria: string;
  status: RoadmapItemStatus;
  tasks: RoadmapTask[];
  resources: RoadmapResource[];
}

/** Full roadmap detail, including every milestone, task, and resource. */
export interface Roadmap {
  id: string;
  goal_id: string;
  goal_name: string;
  goal_category: string;
  goal_category_label: string;
  title: string;
  description: string;
  objective: string;
  starting_level: string;
  target_level: string;
  estimated_duration_weeks: number;
  status: RoadmapStatus;
  provider: string;
  model: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  milestones: RoadmapMilestone[];
}

/** List-view representation (no nested tasks or resources). */
export interface RoadmapSummary {
  id: string;
  goal_id: string;
  goal_name: string;
  goal_category: string;
  goal_category_label: string;
  title: string;
  status: RoadmapStatus;
  estimated_duration_weeks: number;
  milestone_count: number;
  provider: string;
  model: string;
  approved_at: string | null;
  created_at: string;
}

/** Whether the backend can actually generate roadmaps (no secrets included). */
export interface AIConfigStatus {
  configured: boolean;
  provider: string;
  model: string | null;
  message: string;
}

export interface RoadmapGeneratePayload {
  goal_id: string;
  /**
   * Reused across retries of the same attempt so a request that succeeded but
   * whose response was lost cannot create (or pay for) a second roadmap.
   */
  idempotency_key?: string;
}
