/** Shapes returned by the MAXIMUS goal and goal-category endpoints. */

export type AssessmentFieldKind = 'text' | 'textarea' | 'choice' | 'multiselect';

/** One category-specific onboarding question, served by the backend. */
export interface AssessmentField {
  key: string;
  label: string;
  kind: AssessmentFieldKind;
  help_text: string;
  required: boolean;
  options: string[];
  /** Longest accepted answer — mirrors the server's own limit. */
  max_length: number;
}

/** A supported goal category and the questions asked for it. */
export interface GoalCategory {
  slug: string;
  label: string;
  description: string;
  assessment: AssessmentField[];
}

/** Persisted category-specific answers for a goal. */
export interface GoalAssessment {
  answers: Record<string, string | string[]>;
  updated_at: string;
}

export type GoalStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type GoalPriority = 'low' | 'medium' | 'high';

/** Public representation of a goal. Never includes other users' data. */
export interface Goal {
  id: string;
  name: string;
  description: string | null;
  category: string;
  category_label: string;
  motivation: string | null;
  current_situation: string | null;
  desired_outcome: string | null;
  priority: GoalPriority;
  target_date: string | null;
  available_time: string | null;
  constraints: string | null;
  preferences: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
  assessment: GoalAssessment | null;
}

/** Client-side answer values; empty strings/arrays mean "not answered". */
export type AssessmentAnswers = Record<string, string | string[]>;

export interface GoalCreatePayload {
  name: string;
  category: string;
  description?: string | null;
  motivation?: string | null;
  current_situation?: string | null;
  desired_outcome?: string | null;
  priority?: GoalPriority;
  target_date?: string | null;
  available_time?: string | null;
  constraints?: string | null;
  preferences?: string | null;
  status?: GoalStatus;
  assessment?: AssessmentAnswers;
}

export interface GoalUpdatePayload {
  name?: string;
  category?: string;
  description?: string | null;
  motivation?: string | null;
  current_situation?: string | null;
  desired_outcome?: string | null;
  priority?: GoalPriority;
  target_date?: string | null;
  available_time?: string | null;
  constraints?: string | null;
  preferences?: string | null;
  status?: GoalStatus;
  assessment?: AssessmentAnswers;
}
