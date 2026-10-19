import type { AssessmentAnswers, AssessmentField, GoalCategory } from '../../types/goal';

/**
 * Client-side mirror of the server's assessment validation
 * (`app.core.goal_categories.validate_assessment_answers`).
 *
 * The field specification — including text limits and accepted choices — is
 * served by `GET /api/goals/categories`, so the two can never disagree. The
 * server remains the authority: this only lets the UI flag problems before a
 * request is made.
 */
export function validateAssessment(
  category: GoalCategory,
  answers: AssessmentAnswers,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of category.assessment) {
    const value = answers[field.key];
    const isEmpty =
      value === undefined ||
      (typeof value === 'string' ? value.trim() === '' : value.length === 0);

    if (field.required && isEmpty) {
      errors[field.key] = 'This answer is required.';
      continue;
    }
    if (isEmpty) {
      continue;
    }

    if (field.kind === 'multiselect') {
      if (!Array.isArray(value)) {
        errors[field.key] = 'Choose one or more options.';
        continue;
      }
      const unknown = value.find((item) => !field.options.includes(item));
      if (unknown !== undefined) {
        errors[field.key] = `Unknown choice: ${unknown}.`;
      }
      continue;
    }

    if (typeof value !== 'string') {
      errors[field.key] = 'This answer must be text.';
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > field.max_length) {
      errors[field.key] = `Must be ${field.max_length} characters or fewer.`;
    } else if (field.kind === 'choice' && !field.options.includes(trimmed)) {
      errors[field.key] = 'Choose one of the offered options.';
    }
  }

  return errors;
}

/**
 * Build the assessment payload for a save request.
 *
 * Every field of the category is sent — unanswered ones as `''` / `[]` —
 * because the backend merges the payload into the stored answers before
 * validating. Sending a blank value is what clears a previously stored answer;
 * omitting the key would silently keep the old value.
 */
export function buildAssessmentPayload(
  fields: AssessmentField[],
  answers: AssessmentAnswers,
): AssessmentAnswers {
  const payload: AssessmentAnswers = {};
  for (const field of fields) {
    const value = answers[field.key];
    if (field.kind === 'multiselect') {
      const items = Array.isArray(value) ? value.map((item) => item.trim()).filter(Boolean) : [];
      payload[field.key] = items;
      continue;
    }
    payload[field.key] = typeof value === 'string' ? value.trim() : '';
  }
  return payload;
}

/** Convert persisted answers (or an empty record) into editable form state. */
export function answersToFormState(
  fields: AssessmentField[],
  stored: Record<string, string | string[]> | undefined,
): AssessmentAnswers {
  const state: AssessmentAnswers = {};
  for (const field of fields) {
    const value = stored?.[field.key];
    if (value === undefined) {
      state[field.key] = field.kind === 'multiselect' ? [] : '';
    } else {
      state[field.key] = value;
    }
  }
  return state;
}
