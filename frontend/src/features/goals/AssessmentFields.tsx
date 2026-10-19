import { SelectField } from '../../components/ui/SelectField';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { TextField } from '../../components/ui/TextField';
import type { AssessmentAnswers, AssessmentField, GoalCategory } from '../../types/goal';

interface AssessmentFieldsProps {
  category: GoalCategory;
  values: AssessmentAnswers;
  onChange: (key: string, value: string | string[]) => void;
  /** Per-field validation errors, keyed by field key. */
  errors: Record<string, string | undefined>;
  /** Prefix for input ids so multiple forms on one page stay unique. */
  idPrefix: string;
}

/**
 * Renders a category's assessment questions exactly as served by the backend.
 *
 * The field list is never hard-coded here: whatever `GET /api/goals/categories`
 * returns is what the user answers, so a question can never drift between the
 * API and this form.
 */
export function AssessmentFields({
  category,
  values,
  onChange,
  errors,
  idPrefix,
}: AssessmentFieldsProps) {
  if (category.assessment.length === 0) {
    return (
      <p className="text-muted text-sm">
        This category has no assessment questions yet — you can add detail later.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {category.assessment.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        const value = values[field.key] ?? (field.kind === 'multiselect' ? [] : '');
        const error = errors[field.key] ?? null;
        const hint = field.help_text || undefined;

        return (
          <AssessmentFieldControl
            key={field.key}
            field={field}
            id={id}
            value={value}
            error={error}
            hint={hint}
            onChange={onChange}
          />
        );
      })}
    </div>
  );
}

interface AssessmentFieldControlProps {
  field: AssessmentField;
  id: string;
  value: string | string[];
  error: string | null;
  hint: string | undefined;
  onChange: (key: string, value: string | string[]) => void;
}

function AssessmentFieldControl({
  field,
  id,
  value,
  error,
  hint,
  onChange,
}: AssessmentFieldControlProps) {
  const requiredMarker = field.required ? ' *' : '';

  if (field.kind === 'choice') {
    return (
      <SelectField
        id={id}
        label={`${field.label}${requiredMarker}`}
        options={field.options}
        placeholder="Choose an option…"
        value={typeof value === 'string' ? value : ''}
        error={error}
        hint={hint}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    );
  }

  if (field.kind === 'multiselect') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="flex flex-col gap-1.5" aria-invalid={error ? true : undefined}>
        <legend className="text-ink text-sm font-medium">
          {field.label}
          {requiredMarker}
        </legend>
        {hint ? <p className="text-faint text-xs">{hint}</p> : null}
        <div className="bg-surface-raised border-line rounded-control flex flex-col gap-2 border p-3">
          {field.options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                id={`${id}-${option}`}
                checked={selected.includes(option)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, option]
                    : selected.filter((item) => item !== option);
                  onChange(field.key, next);
                }}
                className="accent-accent size-4"
              />
              <span className="text-ink">{option}</span>
            </label>
          ))}
        </div>
        {error ? <p className="text-danger text-xs">{error}</p> : null}
      </fieldset>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <TextAreaField
        id={id}
        label={`${field.label}${requiredMarker}`}
        value={typeof value === 'string' ? value : ''}
        error={error}
        hint={hint}
        maxLength={field.max_length}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    );
  }

  return (
    <TextField
      id={id}
      label={`${field.label}${requiredMarker}`}
      value={typeof value === 'string' ? value : ''}
      error={error}
      hint={hint}
      maxLength={field.max_length}
      onChange={(event) => onChange(field.key, event.target.value)}
    />
  );
}
