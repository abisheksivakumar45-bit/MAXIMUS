import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SelectField } from '../../components/ui/SelectField';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { TextField } from '../../components/ui/TextField';
import { ApiError, api } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { validateDisplayName } from '../auth/validation';
import { AssessmentFields } from '../goals/AssessmentFields';
import {
  answersToFormState,
  buildAssessmentPayload,
  validateAssessment,
} from '../goals/assessmentValidation';
import type { AssessmentAnswers, Goal, GoalCategory } from '../../types/goal';
import type {
  OnboardingLifestyle,
  OnboardingOptions,
  OnboardingProfile,
} from '../../types/onboarding';

/**
 * Onboarding wizard (master-spec §4, screens 1–6).
 *
 * Progress is persisted server-side at every step transition, so a refresh or
 * crash resumes exactly where the user stopped. Goal selections become real
 * draft goals; completing onboarding is validated and recorded by the server,
 * which also promotes the drafts to active goals in one transaction.
 */

type Step = 'welcome' | 'profile' | 'lifestyle' | 'goals' | 'assessment' | 'review';

const STEPS: Step[] = ['welcome', 'profile', 'lifestyle', 'goals', 'assessment', 'review'];

const STEP_LABELS: Record<Step, string> = {
  welcome: 'Welcome',
  profile: 'About you',
  lifestyle: 'Lifestyle',
  goals: 'Your goals',
  assessment: 'Assessment',
  review: 'Review & save',
};

/** `HH:MM` on a 24-hour clock — mirrors the backend's TIME_PATTERN. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isStep(value: string | null): value is Step {
  return value !== null && (STEPS as string[]).includes(value);
}

interface ProfileErrors {
  [key: string]: string | undefined;
}

export function OnboardingPage() {
  const { user, status: authStatus, updateProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);

  const [categories, setCategories] = useState<GoalCategory[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [options, setOptions] = useState<OnboardingOptions>({
    age_range: [],
    daily_availability: [],
    schedule: [],
    study_hours_per_day: [],
    food_budget: [],
    exercise_experience: [],
    equipment: [],
    planning_style: [],
  });

  const [step, setStep] = useState<Step>('welcome');
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile>({
    age_range: null,
    timezone: null,
    preferred_language: null,
    wake_time: null,
    bedtime: null,
    daily_availability: null,
  });
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [lifestyle, setLifestyle] = useState<OnboardingLifestyle>({
    schedule: null,
    study_hours_per_day: null,
    food_budget: null,
    food_preferences: null,
    exercise_experience: null,
    equipment: null,
    existing_routines: null,
    planning_style: null,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [goalNames, setGoalNames] = useState<Record<string, string>>({});
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswers>>({});
  const [assessmentErrors, setAssessmentErrors] = useState<
    Record<string, Record<string, string | undefined>>
  >({});

  const [completed, setCompleted] = useState(false);

  const categoriesBySlug = useMemo(
    () => new Map(categories.map((category) => [category.slug, category])),
    [categories],
  );

  /** Categories whose goals were created outside onboarding and stay put. */
  const lockedCategories = useMemo(
    () => new Set(goals.filter((goal) => goal.status !== 'draft').map((goal) => goal.category)),
    [goals],
  );

  const selectedGoals = useMemo(
    () => goals.filter((goal) => selected.has(goal.category)),
    [goals, selected],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [state, existingGoals, categoryList] = await Promise.all([
        api.onboarding.get(),
        api.goals.list(),
        api.goals.categories(),
      ]);

      setCategories(categoryList);
      setGoals(existingGoals);
      setMissing(state.missing);
      setOptions(state.options);
      setProfile({
        age_range: state.profile.age_range,
        timezone: state.profile.timezone,
        preferred_language: state.profile.preferred_language,
        wake_time: state.profile.wake_time,
        bedtime: state.profile.bedtime,
        daily_availability: state.profile.daily_availability,
      });
      setLifestyle({
        schedule: state.lifestyle.schedule,
        study_hours_per_day: state.lifestyle.study_hours_per_day,
        food_budget: state.lifestyle.food_budget,
        food_preferences: state.lifestyle.food_preferences,
        exercise_experience: state.lifestyle.exercise_experience,
        equipment: state.lifestyle.equipment,
        existing_routines: state.lifestyle.existing_routines,
        planning_style: state.lifestyle.planning_style,
      });
      setSelected(new Set(existingGoals.map((goal) => goal.category)));
      setGoalNames(
        Object.fromEntries(existingGoals.map((goal) => [goal.category, goal.name])),
      );
      setAnswers(
        Object.fromEntries(
          existingGoals.map((goal) => [
            goal.id,
            answersToFormState(
              categoryList.find((category) => category.slug === goal.category)?.assessment ?? [],
              goal.assessment?.answers,
            ),
          ]),
        ),
      );

      if (state.completed_at !== null) {
        // Already finished: land on review so answers stay editable.
        setCompleted(true);
        setStep('review');
      } else if (isStep(state.current_step)) {
        setStep(state.current_step);
      } else {
        setStep('welcome');
      }
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error
          : new ApiError(0, 'Could not load your onboarding progress.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Seed the display name from the resolved session user once, without
  // re-running the wizard load (which would discard in-progress edits).
  useEffect(() => {
    if (user?.display_name != null) {
      setDisplayName(user.display_name);
    }
  }, [user]);

  useEffect(() => {
    // Wait for the session to resolve so a refresh keeps the signed-in user's
    // data; anonymous visitors are redirected by ProtectedRoute anyway.
    if (authStatus === 'loading') {
      return;
    }
    void loadInitial();
  }, [authStatus, loadInitial]);

  function goTo(next: Step) {
    setStep(next);
    setStepError(null);
  }

  /** Persist the current step marker so a refresh resumes in the right place. */
  async function persistStep(next: Step) {
    await api.onboarding.save({ current_step: next });
  }

  // -- step handlers ---------------------------------------------------------

  async function handleProfileContinue(event: FormEvent) {
    event.preventDefault();
    if (saving) {
      return;
    }

    const errors: ProfileErrors = {};
    const nameError = validateDisplayName(displayName);
    if (nameError) {
      errors.displayName = nameError;
    }
    const timezone = profile.timezone?.trim() ?? '';
    if (!timezone) {
      errors.timezone = 'Time zone is required.';
    } else if (timezone.length > 64) {
      errors.timezone = 'Time zone must be 64 characters or fewer.';
    }
    if (!profile.daily_availability) {
      errors.daily_availability = 'Please choose how much time you have most days.';
    }
    for (const key of ['wake_time', 'bedtime'] as const) {
      const value = profile[key]?.trim();
      if (value && !TIME_PATTERN.test(value)) {
        errors[key] = 'Use a 24-hour time such as 07:30.';
      }
    }
    if ((profile.preferred_language?.trim().length ?? 0) > 32) {
      errors.preferred_language = 'Language must be 32 characters or fewer.';
    }
    setProfileErrors(errors);
    setDisplayNameError(errors.displayName ?? null);
    if (Object.values(errors).some(Boolean)) {
      return;
    }

    setSaving(true);
    setStepError(null);
    try {
      if (displayName.trim() !== (user?.display_name ?? '')) {
        await updateProfile({ display_name: displayName.trim() });
      }
      const state = await api.onboarding.save({
        current_step: 'lifestyle',
        profile: {
          age_range: profile.age_range,
          timezone,
          preferred_language: profile.preferred_language?.trim() || null,
          wake_time: profile.wake_time?.trim() || null,
          bedtime: profile.bedtime?.trim() || null,
          daily_availability: profile.daily_availability,
        },
      });
      setMissing(state.missing);
      goTo('lifestyle');
    } catch (error) {
      setStepError(
        error instanceof ApiError ? error.message : 'Could not save your answers. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLifestyleContinue() {
    if (saving) {
      return;
    }
    setSaving(true);
    setStepError(null);
    try {
      await api.onboarding.save({
        current_step: 'goals',
        lifestyle: {
          schedule: lifestyle.schedule,
          study_hours_per_day: lifestyle.study_hours_per_day,
          food_budget: lifestyle.food_budget,
          food_preferences: lifestyle.food_preferences?.trim() || null,
          exercise_experience: lifestyle.exercise_experience,
          equipment: lifestyle.equipment,
          existing_routines: lifestyle.existing_routines?.trim() || null,
          planning_style: lifestyle.planning_style,
        },
      });
      goTo('goals');
    } catch (error) {
      setStepError(
        error instanceof ApiError ? error.message : 'Could not save your answers. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(slug: string) {
    if (lockedCategories.has(slug)) {
      return; // Goals created elsewhere are managed on the Goals page.
    }
    setSelectionError(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
    // Seed the default name so Continue always has something to submit.
    setGoalNames((current) => ({
      ...current,
      [slug]: current[slug] ?? categoriesBySlug.get(slug)?.label ?? slug,
    }));
  }

  async function handleGoalsContinue() {
    if (saving) {
      return;
    }
    if (selected.size === 0) {
      setSelectionError('Choose at least one goal to continue.');
      return;
    }
    for (const slug of selected) {
      if (!goalNames[slug]?.trim()) {
        setSelectionError('Every goal needs a name.');
        return;
      }
    }

    setSaving(true);
    setStepError(null);
    try {
      // Remove draft goals the user deselected. Non-draft goals are locked in
      // the UI and are never deleted from here.
      for (const goal of goals) {
        if (!selected.has(goal.category) && goal.status === 'draft') {
          await api.goals.remove(goal.id);
        }
      }

      const synced: Goal[] = [];
      for (const slug of selected) {
        const existing = goals.find((goal) => goal.category === slug);
        const name = goalNames[slug].trim();
        if (!existing) {
          synced.push(
            await api.goals.create({ name, category: slug, status: 'draft' }),
          );
        } else if (existing.name !== name) {
          synced.push(await api.goals.update(existing.id, { name }));
        } else {
          synced.push(existing);
        }
      }
      setGoals(synced);

      // Seed empty answer forms for any newly created goals.
      setAnswers((current) => {
        const next = { ...current };
        for (const goal of synced) {
          if (!next[goal.id]) {
            next[goal.id] = answersToFormState(
              categoriesBySlug.get(goal.category)?.assessment ?? [],
              undefined,
            );
          }
        }
        return next;
      });

      await persistStep('assessment');
      goTo('assessment');
    } catch (error) {
      setStepError(
        error instanceof ApiError ? error.message : 'Could not save your goals. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  function updateAnswer(goalId: string, key: string, value: string | string[]) {
    setAssessmentErrors((current) => ({
      ...current,
      [goalId]: { ...current[goalId], [key]: undefined },
    }));
    setAnswers((current) => ({
      ...current,
      [goalId]: { ...current[goalId], [key]: value },
    }));
  }

  async function handleAssessmentContinue() {
    if (saving) {
      return;
    }

    const nextErrors: Record<string, Record<string, string>> = {};
    for (const goal of selectedGoals) {
      const category = categoriesBySlug.get(goal.category);
      if (!category) {
        continue;
      }
      const errors = validateAssessment(category, answers[goal.id] ?? {});
      if (Object.keys(errors).length > 0) {
        nextErrors[goal.id] = errors;
      }
    }
    setAssessmentErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStepError('Please answer the required questions before continuing.');
      return;
    }

    setSaving(true);
    setStepError(null);
    try {
      for (const goal of selectedGoals) {
        const category = categoriesBySlug.get(goal.category);
        if (!category) {
          continue;
        }
        const payload = buildAssessmentPayload(
          category.assessment,
          answers[goal.id] ?? {},
        );
        await api.goals.update(goal.id, { assessment: payload });
      }
      await persistStep('review');
      goTo('review');
    } catch (error) {
      setStepError(
        error instanceof ApiError
          ? error.message
          : 'Could not save your assessment. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (saving) {
      return;
    }
    setSaving(true);
    setStepError(null);
    try {
      const state = await api.onboarding.save({
        current_step: 'review',
        completed: true,
      });
      setMissing(state.missing);
      setCompleted(true);
      goTo('review');
    } catch (error) {
      setStepError(
        error instanceof ApiError
          ? error.message
          : 'Could not finish onboarding. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleBack(next: Step) {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await persistStep(next);
      goTo(next);
    } catch (error) {
      setStepError(
        error instanceof ApiError ? error.message : 'Could not move back. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  // -- render ----------------------------------------------------------------

  if (loading) {
    return <LoadingState label="Loading your onboarding progress…" />;
  }

  if (loadError) {
    return (
      <ErrorState message={loadError.message} onRetry={() => void loadInitial()} />
    );
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <p className="text-accent text-sm font-medium">Setup</p>
        <h1 className="text-ink text-2xl font-semibold tracking-tight">
          {completed && step === 'review' ? 'Your MAXIMUS setup' : STEP_LABELS[step]}
        </h1>
        {!completed ? (
          <div className="mt-3 flex items-center gap-3">
            <div
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={stepIndex + 1}
              aria-label={`Step ${stepIndex + 1} of ${STEPS.length}: ${STEP_LABELS[step]}`}
              className="bg-surface-raised border-line h-2 flex-1 overflow-hidden rounded-full border"
            >
              <div
                className="bg-accent h-full rounded-full transition-all"
                style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <span className="text-muted text-xs whitespace-nowrap">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
          </div>
        ) : null}
      </header>

      {stepError ? <Alert tone="danger">{stepError}</Alert> : null}

      {step === 'welcome' ? (
        <Card>
          <CardHeader
            title="Welcome to MAXIMUS"
            description="A few short steps turn your ambitions into goals MAXIMUS can help you plan."
          />
          <ul className="text-muted flex flex-col gap-2 text-sm">
            <li>• Tell us a little about your situation.</li>
            <li>• Pick the areas you want to work on.</li>
            <li>• Answer a few questions so plans fit your real life.</li>
            <li>• Review everything, then save. You can change it all later.</li>
          </ul>
          <div className="mt-6">
            <Button onClick={() => void handleBack('profile')} disabled={saving}>
              Get started
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'profile' ? (
        <form onSubmit={(event) => void handleProfileContinue(event)}>
          <Card>
            <CardHeader
              title="About you"
              description="Your display name comes from your account. Time zone and daily availability are required to finish setup."
            />
            <div className="flex flex-col gap-4">
              <TextField
                id="onboarding-display-name"
                label="Display name *"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                error={displayNameError}
                autoComplete="name"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="onboarding-timezone"
                  label="Time zone *"
                  value={profile.timezone ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, timezone: event.target.value }))
                  }
                  error={profileErrors.timezone}
                  placeholder="e.g. Europe/London"
                  hint="Used to schedule your days."
                />
                <SelectField
                  id="onboarding-availability"
                  label="Time available most days *"
                  options={options.daily_availability}
                  placeholder="Choose an option…"
                  value={profile.daily_availability ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      daily_availability: event.target.value,
                    }))
                  }
                  error={profileErrors.daily_availability}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  id="onboarding-age-range"
                  label="Age range"
                  options={options.age_range}
                  placeholder="Optional…"
                  value={profile.age_range ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, age_range: event.target.value }))
                  }
                />
                <TextField
                  id="onboarding-language"
                  label="Preferred language"
                  value={profile.preferred_language ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      preferred_language: event.target.value,
                    }))
                  }
                  error={profileErrors.preferred_language}
                  placeholder="e.g. English"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="onboarding-wake-time"
                  label="Usual wake-up time"
                  value={profile.wake_time ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, wake_time: event.target.value }))
                  }
                  error={profileErrors.wake_time}
                  placeholder="07:00"
                  hint="24-hour clock."
                />
                <TextField
                  id="onboarding-bedtime"
                  label="Usual bedtime"
                  value={profile.bedtime ?? ''}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, bedtime: event.target.value }))
                  }
                  error={profileErrors.bedtime}
                  placeholder="23:00"
                  hint="24-hour clock."
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Button variant="secondary" onClick={() => void handleBack('welcome')} disabled={saving}>
                Back
              </Button>
              <Button type="submit" loading={saving}>
                Continue
              </Button>
            </div>
          </Card>
        </form>
      ) : null}

      {step === 'lifestyle' ? (
        <Card>
          <CardHeader
            title="Lifestyle and routines"
            description="All optional — but honest answers here make future plans realistic."
          />
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="onboarding-schedule"
                label="Work or study schedule"
                options={options.schedule}
                placeholder="Optional…"
                value={lifestyle.schedule ?? ''}
                onChange={(event) =>
                  setLifestyle((current) => ({ ...current, schedule: event.target.value }))
                }
              />
              <SelectField
                id="onboarding-study-hours"
                label="Study hours per day"
                options={options.study_hours_per_day}
                placeholder="Optional…"
                value={lifestyle.study_hours_per_day ?? ''}
                onChange={(event) =>
                  setLifestyle((current) => ({
                    ...current,
                    study_hours_per_day: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="onboarding-food-budget"
                label="Weekly food budget"
                options={options.food_budget}
                placeholder="Optional…"
                value={lifestyle.food_budget ?? ''}
                onChange={(event) =>
                  setLifestyle((current) => ({ ...current, food_budget: event.target.value }))
                }
              />
              <SelectField
                id="onboarding-exercise-experience"
                label="Training experience"
                options={options.exercise_experience}
                placeholder="Optional…"
                value={lifestyle.exercise_experience ?? ''}
                onChange={(event) =>
                  setLifestyle((current) => ({
                    ...current,
                    exercise_experience: event.target.value,
                  }))
                }
              />
            </div>
            <TextAreaField
              id="onboarding-food-preferences"
              label="Foods you like or avoid"
              value={lifestyle.food_preferences ?? ''}
              onChange={(event) =>
                setLifestyle((current) => ({
                  ...current,
                  food_preferences: event.target.value,
                }))
              }
              maxLength={255}
            />
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-ink text-sm font-medium">Equipment you can use</legend>
              <div className="bg-surface-raised border-line rounded-control grid gap-2 border p-3 sm:grid-cols-2">
                {options.equipment.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(lifestyle.equipment ?? []).includes(option)}
                      onChange={(event) => {
                        const current = lifestyle.equipment ?? [];
                        const next = event.target.checked
                          ? [...current, option]
                          : current.filter((item) => item !== option);
                        setLifestyle((state) => ({ ...state, equipment: next }));
                      }}
                      className="accent-accent size-4"
                    />
                    <span className="text-ink">{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <TextAreaField
              id="onboarding-routines"
              label="Existing routines"
              value={lifestyle.existing_routines ?? ''}
              onChange={(event) =>
                setLifestyle((current) => ({
                  ...current,
                  existing_routines: event.target.value,
                }))
              }
              maxLength={255}
            />
            <SelectField
              id="onboarding-planning-style"
              label="Planning style"
              options={options.planning_style}
              placeholder="Optional…"
              value={lifestyle.planning_style ?? ''}
              onChange={(event) =>
                setLifestyle((current) => ({ ...current, planning_style: event.target.value }))
              }
            />
          </div>
          <div className="mt-6 flex items-center justify-between">
            <Button variant="secondary" onClick={() => void handleBack('profile')} disabled={saving}>
              Back
            </Button>
            <Button onClick={() => void handleLifestyleContinue()} loading={saving}>
              Continue
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'goals' ? (
        <Card>
          <CardHeader
            title="Which areas do you want to work on?"
            description="Pick one or more. You can rename them, add more, or remove them later on the Goals page."
          />
          {selectionError ? <Alert tone="danger">{selectionError}</Alert> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {categories.map((category) => {
              const isSelected = selected.has(category.slug);
              const locked = lockedCategories.has(category.slug);
              return (
                <div
                  key={category.slug}
                  className={`rounded-card border p-4 ${
                    isSelected ? 'border-accent bg-accent/5' : 'border-line bg-surface-raised'
                  }`}
                >
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={locked}
                      onChange={() => toggleCategory(category.slug)}
                      className="accent-accent mt-1 size-4"
                      aria-label={`Select ${category.label}`}
                    />
                    <span>
                      <span className="text-ink block text-sm font-medium">
                        {category.label}
                      </span>
                      <span className="text-muted block text-xs">{category.description}</span>
                      {locked ? (
                        <span className="text-faint mt-1 block text-xs">
                          Already active — manage it on the Goals page.
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {isSelected && !locked ? (
                    <div className="mt-3">
                      <TextField
                        id={`goal-name-${category.slug}`}
                        label="Goal name"
                        value={goalNames[category.slug] ?? category.label}
                        onChange={(event) =>
                          setGoalNames((current) => ({
                            ...current,
                            [category.slug]: event.target.value,
                          }))
                        }
                        maxLength={120}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <Button variant="secondary" onClick={() => void handleBack('lifestyle')} disabled={saving}>
              Back
            </Button>
            <Button onClick={() => void handleGoalsContinue()} loading={saving}>
              Continue
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'assessment' ? (
        <div className="flex flex-col gap-6">
          {selectedGoals.map((goal) => {
            const category = categoriesBySlug.get(goal.category);
            if (!category) {
              return null;
            }
            return (
              <Card key={goal.id}>
                <CardHeader
                  title={goal.name}
                  description={`${category.label} — answer what you can; required questions are marked.`}
                />
                <AssessmentFields
                  category={category}
                  values={answers[goal.id] ?? {}}
                  onChange={(key, value) => updateAnswer(goal.id, key, value)}
                  errors={assessmentErrors[goal.id] ?? {}}
                  idPrefix={`assessment-${goal.id}`}
                />
              </Card>
            );
          })}
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => void handleBack('goals')} disabled={saving}>
              Back
            </Button>
            <Button onClick={() => void handleAssessmentContinue()} loading={saving}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'review' ? (
        <div className="flex flex-col gap-6">
          {missing.length > 0 && !completed ? (
            <Alert tone="info">
              Still needed before you can finish: {missing.join(', ')}.
            </Alert>
          ) : null}

          <Card>
            <CardHeader
              title="About you"
              action={
                <Button variant="secondary" onClick={() => void handleBack('profile')}>
                  Edit
                </Button>
              }
            />
            <dl className="text-sm">
              <SummaryRow label="Display name" value={displayName} />
              <SummaryRow label="Time zone" value={profile.timezone} />
              <SummaryRow label="Available most days" value={profile.daily_availability} />
              <SummaryRow label="Wake-up time" value={profile.wake_time} />
              <SummaryRow label="Bedtime" value={profile.bedtime} />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Your goals"
              action={
                <Button variant="secondary" onClick={() => void handleBack('goals')}>
                  Edit
                </Button>
              }
            />
            {selectedGoals.length === 0 ? (
              <p className="text-muted text-sm">No goals selected.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {selectedGoals.map((goal) => {
                  const category = categoriesBySlug.get(goal.category);
                  return (
                    <li key={goal.id}>
                      <p className="text-ink text-sm font-medium">
                        {goal.name}
                        <span className="text-muted ml-2 text-xs font-normal">
                          {category?.label ?? goal.category}
                        </span>
                      </p>
                      {category && category.assessment.length > 0 ? (
                        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                          {category.assessment.map((field) => {
                            const value = answers[goal.id]?.[field.key];
                            const display = Array.isArray(value)
                              ? value.join(', ')
                              : (value ?? '').trim();
                            if (!display) {
                              return null;
                            }
                            return (
                              <div key={field.key} className="text-xs">
                                <dt className="text-faint">{field.label}</dt>
                                <dd className="text-ink">{display}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      ) : (
                        <p className="text-muted mt-1 text-xs">No assessment answered yet.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {completed ? (
            <Card>
              <Alert tone="positive">
                Onboarding complete. Your goals are active — the next phases turn them into
                roadmaps and weekly plans.
              </Alert>
              <div className="mt-4 flex gap-3">
                <Link to="/">
                  <Button>Go to dashboard</Button>
                </Link>
                <Link to="/goals">
                  <Button variant="secondary">Manage goals</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={() => void handleBack('assessment')} disabled={saving}>
                Back
              </Button>
              <Button onClick={() => void handleSave()} loading={saving}>
                Save and finish
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <div className="border-line border-b py-1.5 last:border-b-0">
      <dt className="text-faint text-xs">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
