/** Shapes returned by the MAXIMUS onboarding endpoints. */

/** Answers to onboarding screen 2 (basic profile). */
export interface OnboardingProfile {
  age_range: string | null;
  timezone: string | null;
  preferred_language: string | null;
  wake_time: string | null;
  bedtime: string | null;
  daily_availability: string | null;
}

/** Answers to onboarding screen 3 (lifestyle and routines). */
export interface OnboardingLifestyle {
  schedule: string | null;
  study_hours_per_day: string | null;
  food_budget: string | null;
  food_preferences: string | null;
  exercise_experience: string | null;
  equipment: string[] | null;
  existing_routines: string | null;
  planning_style: string | null;
}

/** Accepted values for the choice-like onboarding fields. */
export interface OnboardingOptions {
  age_range: string[];
  daily_availability: string[];
  schedule: string[];
  study_hours_per_day: string[];
  food_budget: string[];
  exercise_experience: string[];
  equipment: string[];
  planning_style: string[];
}

/** Current onboarding state for the authenticated user. */
export interface OnboardingState {
  completed_at: string | null;
  current_step: string | null;
  profile: OnboardingProfile;
  lifestyle: OnboardingLifestyle;
  options: OnboardingOptions;
  /** Everything still required before onboarding can be marked complete. */
  missing: string[];
}

/** Partial save payload — only the keys present are merged server-side. */
export interface OnboardingSavePayload {
  current_step?: string;
  profile?: Partial<OnboardingProfile>;
  lifestyle?: Partial<OnboardingLifestyle>;
  completed?: boolean;
}
