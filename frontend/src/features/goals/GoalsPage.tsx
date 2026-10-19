import { useCallback, useMemo, useState } from 'react';

import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SelectField } from '../../components/ui/SelectField';
import { StatusPill } from '../../components/ui/StatusPill';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { TextField } from '../../components/ui/TextField';
import { ApiError, api } from '../../lib/api';
import { useApiResource } from '../../hooks/useApiResource';
import { AssessmentFields } from './AssessmentFields';
import {
  answersToFormState,
  buildAssessmentPayload,
  validateAssessment,
} from './assessmentValidation';
import type {
  AssessmentAnswers,
  Goal,
  GoalCategory,
  GoalPriority,
  GoalStatus,
} from '../../types/goal';

/**
 * Goals management (master-spec §3).
 *
 * Everything here talks to the real API: create, edit (including the
 * category-specific assessment), pause/resume/complete/archive, and delete.
 * Goal categories and their questions come from `GET /api/goals/categories`,
 * so the forms are always exactly what the backend accepts.
 */

const PRIORITIES: GoalPriority[] = ['low', 'medium', 'high'];
const STATUSES: GoalStatus[] = ['draft', 'active', 'paused', 'completed', 'archived'];

const STATUS_TONES: Record<GoalStatus, 'neutral' | 'positive' | 'warning' | 'info'> = {
  draft: 'neutral',
  active: 'positive',
  paused: 'warning',
  completed: 'info',
  archived: 'neutral',
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

interface GoalFormState {
  name: string;
  category: string;
  description: string;
  motivation: string;
  priority: GoalPriority;
  target_date: string;
  available_time: string;
  constraints: string;
  preferences: string;
  status: GoalStatus;
}

const EMPTY_FORM: GoalFormState = {
  name: '',
  category: '',
  description: '',
  motivation: '',
  priority: 'medium',
  target_date: '',
  available_time: '',
  constraints: '',
  preferences: '',
  status: 'active',
};

function goalToForm(goal: Goal): GoalFormState {
  return {
    name: goal.name,
    category: goal.category,
    description: goal.description ?? '',
    motivation: goal.motivation ?? '',
    priority: goal.priority,
    target_date: goal.target_date ?? '',
    available_time: goal.available_time ?? '',
    constraints: goal.constraints ?? '',
    preferences: goal.preferences ?? '',
    status: goal.status,
  };
}

export function GoalsPage() {
  const loadCategories = useCallback(() => api.goals.categories(), []);
  const loadGoals = useCallback(() => api.goals.list(), []);
  const categoriesState = useApiResource<GoalCategory[]>(loadCategories);
  const goalsState = useApiResource<Goal[]>(loadGoals);

  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [assessmentErrors, setAssessmentErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const categories = categoriesState.data ?? [];
  const goals = goalsState.data ?? [];
  const categoriesBySlug = useMemo(
    () => new Map(categories.map((category) => [category.slug, category])),
    [categories],
  );

  const activeCount = goals.filter((goal) => goal.status === 'active').length;
  const formCategory =
    form.category === '' ? null : (categoriesBySlug.get(form.category) ?? null);
  const editingGoal = editing !== null && editing !== 'new' ? editing : null;
  /**
   * The category can only change while no answers are stored: the server
   * merges assessment payloads, and old answers are not questions of the new
   * category, so a switch would be rejected.
   */
  const categoryLocked =
    editingGoal !== null &&
    editingGoal.assessment !== null &&
    Object.keys(editingGoal.assessment.answers).length > 0;

  function startCreate() {
    setForm({ ...EMPTY_FORM, category: categories[0]?.slug ?? '' });
    setAnswers({});
    setFormErrors({});
    setAssessmentErrors({});
    setFormError(null);
    setEditing('new');
  }

  function startEdit(goal: Goal) {
    setForm(goalToForm(goal));
    setAnswers(
      answersToFormState(
        categoriesBySlug.get(goal.category)?.assessment ?? [],
        goal.assessment?.answers,
      ),
    );
    setFormErrors({});
    setAssessmentErrors({});
    setFormError(null);
    setEditing(goal);
  }

  function cancelEdit() {
    setEditing(null);
    setFormErrors({});
    setAssessmentErrors({});
    setFormError(null);
  }

  function updateAnswer(key: string, value: string | string[]) {
    setAssessmentErrors((current) => ({ ...current, [key]: undefined }));
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (saving) {
      return;
    }

    const errors: Record<string, string> = {};
    if (!form.name.trim()) {
      errors.name = 'A goal name is required.';
    }
    if (!form.category) {
      errors.category = 'Choose a category.';
    }
    if (form.target_date && Number.isNaN(new Date(form.target_date).getTime())) {
      errors.target_date = 'Enter a valid date.';
    } else if (form.target_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(form.target_date) < today) {
        errors.target_date = 'Target date cannot be in the past.';
      }
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const category = categoriesBySlug.get(form.category);
    const assessmentErrors = category ? validateAssessment(category, answers) : {};
    setAssessmentErrors(assessmentErrors);
    if (Object.keys(assessmentErrors).length > 0) {
      setFormError('Please fix the highlighted assessment answers.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const assessmentPayload = category
        ? buildAssessmentPayload(category.assessment, answers)
        : {};
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || null,
        motivation: form.motivation.trim() || null,
        priority: form.priority,
        target_date: form.target_date || null,
        available_time: form.available_time.trim() || null,
        constraints: form.constraints.trim() || null,
        preferences: form.preferences.trim() || null,
        assessment: assessmentPayload,
      };

      const target = editing;
      if (target === null) {
        return;
      }
      if (target === 'new') {
        await api.goals.create({ ...payload, status: form.status });
      } else {
        await api.goals.update(target.id, payload);
      }
      setEditing(null);
      goalsState.reload();
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Could not save the goal. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(goal: Goal, status: GoalStatus) {
    setPageError(null);
    try {
      await api.goals.update(goal.id, { status });
      goalsState.reload();
    } catch (error) {
      setPageError(
        error instanceof ApiError ? error.message : 'Could not update the goal. Try again.',
      );
    }
  }

  async function removeGoal(goal: Goal) {
    setPageError(null);
    try {
      await api.goals.remove(goal.id);
      goalsState.reload();
    } catch (error) {
      setPageError(
        error instanceof ApiError ? error.message : 'Could not delete the goal. Try again.',
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (categoriesState.status === 'loading' || goalsState.status === 'loading') {
    return <LoadingState label="Loading goals…" />;
  }

  if (categoriesState.status === 'error') {
    return (
      <ErrorState
        message={categoriesState.error.message}
        onRetry={categoriesState.reload}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Goals"
        description={`${activeCount} active · ${goals.length} total. Goals, milestones, and AI roadmaps arrive across Phases 3–4.`}
        action={
          editing === null ? (
            <Button onClick={startCreate}>Add goal</Button>
          ) : (
            <Button variant="secondary" onClick={cancelEdit}>
              Close
            </Button>
          )
        }
      />

      {pageError ? <Alert tone="danger">{pageError}</Alert> : null}

      {editing !== null ? (
        <Card>
          <CardHeader
            title={editing === 'new' ? 'New goal' : `Edit “${editing.name}”`}
            description="Answer the category questions so future plans fit your situation."
          />
          {formError ? <Alert tone="danger">{formError}</Alert> : null}

          <div className="mt-4 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="goal-name"
                label="Goal name *"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                error={formErrors.name}
                maxLength={120}
              />
              <SelectField
                id="goal-category"
                label="Category *"
                options={categories.map((category) => ({
                  value: category.slug,
                  label: category.label,
                }))}
                value={form.category}
                disabled={categoryLocked}
                onChange={(event) => {
                  const slug = event.target.value;
                  setForm((current) => ({ ...current, category: slug }));
                  setAnswers(
                    answersToFormState(
                      categoriesBySlug.get(slug)?.assessment ?? [],
                      undefined,
                    ),
                  );
                }}
                error={formErrors.category}
                hint={
                  categoryLocked
                    ? 'The category is fixed once a goal has assessment answers.'
                    : editing !== 'new'
                      ? 'Changing the category resets the assessment questions.'
                      : undefined
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="goal-priority"
                label="Priority"
                options={PRIORITIES}
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as GoalPriority,
                  }))
                }
              />
              <TextField
                id="goal-target-date"
                label="Target date"
                type="date"
                value={form.target_date}
                onChange={(event) =>
                  setForm((current) => ({ ...current, target_date: event.target.value }))
                }
                error={formErrors.target_date}
              />
            </div>

            <TextAreaField
              id="goal-description"
              label="Description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              maxLength={2000}
            />
            <TextAreaField
              id="goal-motivation"
              label="Why this matters to you"
              value={form.motivation}
              onChange={(event) =>
                setForm((current) => ({ ...current, motivation: event.target.value }))
              }
              maxLength={2000}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="goal-available-time"
                label="Time you can commit"
                value={form.available_time}
                onChange={(event) =>
                  setForm((current) => ({ ...current, available_time: event.target.value }))
                }
                maxLength={120}
                placeholder="e.g. 3 mornings a week"
              />
              {editing !== 'new' ? (
                <SelectField
                  id="goal-status"
                  label="Status"
                  options={STATUSES}
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as GoalStatus,
                    }))
                  }
                  hint="Pause, complete, or archive a goal here."
                />
              ) : null}
            </div>
            <TextAreaField
              id="goal-constraints"
              label="Constraints"
              value={form.constraints}
              onChange={(event) =>
                setForm((current) => ({ ...current, constraints: event.target.value }))
              }
              maxLength={2000}
            />
            <TextAreaField
              id="goal-preferences"
              label="Preferences"
              value={form.preferences}
              onChange={(event) =>
                setForm((current) => ({ ...current, preferences: event.target.value }))
              }
              maxLength={2000}
            />

            {formCategory ? (
              <div className="border-line mt-2 border-t pt-4">
                <h3 className="text-ink text-sm font-semibold">
                  {formCategory.label} assessment
                </h3>
                <p className="text-muted mt-1 mb-4 text-sm">{formCategory.description}</p>
                <AssessmentFields
                  category={formCategory}
                  values={answers}
                  onChange={updateAnswer}
                  errors={assessmentErrors}
                  idPrefix="goal-assessment"
                />
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} loading={saving}>
              {editing === 'new' ? 'Create goal' : 'Save changes'}
            </Button>
          </div>
        </Card>
      ) : null}

      {goalsState.status === 'error' ? (
        <ErrorState message={goalsState.error.message} onRetry={goalsState.reload} />
      ) : goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Add a goal to start turning an ambition into a plan. Goals you create are stored on the server and appear on your dashboard."
          hint="Roadmaps, weekly plans, and daily tasks build on these goals in later phases."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((goal) => {
            const category = categoriesBySlug.get(goal.category);
            const answeredCount = goal.assessment
              ? Object.keys(goal.assessment.answers).length
              : 0;
            const questionCount = category?.assessment.length ?? 0;
            return (
              <li key={goal.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-ink text-base font-semibold">{goal.name}</h2>
                        <StatusPill
                          tone={STATUS_TONES[goal.status]}
                          label={STATUS_LABELS[goal.status]}
                        />
                      </div>
                      <p className="text-muted mt-1 text-sm">{goal.category_label}</p>
                      {goal.description ? (
                        <p className="text-muted mt-2 max-w-prose text-sm">{goal.description}</p>
                      ) : null}
                      <p className="text-faint mt-2 text-xs">
                        {questionCount === 0
                          ? 'No assessment questions for this category.'
                          : answeredCount > 0
                            ? `Assessment: ${answeredCount} of ${questionCount} questions answered.`
                            : 'Assessment not answered yet.'}
                        {goal.target_date ? ` · Target: ${goal.target_date}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {goal.status === 'active' ? (
                        <Button
                          variant="secondary"
                          onClick={() => void changeStatus(goal, 'paused')}
                        >
                          Pause
                        </Button>
                      ) : null}
                      {goal.status === 'paused' ? (
                        <Button
                          variant="secondary"
                          onClick={() => void changeStatus(goal, 'active')}
                        >
                          Resume
                        </Button>
                      ) : null}
                      {goal.status === 'active' || goal.status === 'paused' ? (
                        <Button
                          variant="secondary"
                          onClick={() => void changeStatus(goal, 'completed')}
                        >
                          Complete
                        </Button>
                      ) : null}
                      <Button variant="secondary" onClick={() => startEdit(goal)}>
                        Edit
                      </Button>
                      {deletingId === goal.id ? (
                        <span className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => void removeGoal(goal)}
                          >
                            Confirm delete
                          </Button>
                          <Button variant="secondary" onClick={() => setDeletingId(null)}>
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <Button variant="secondary" onClick={() => setDeletingId(goal.id)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
