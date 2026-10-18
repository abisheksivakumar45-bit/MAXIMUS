# MAXIMUS — AI Design

> **Status: planned (Phase 4+).** No AI provider is integrated in Phase 1. This
> document records the intended design so later phases implement it
> consistently. Nothing described here is active yet, and the application does
> not present any output as AI-generated.

## 1. Principles

- **Backend only.** Provider credentials and calls live exclusively in the
  backend. No API keys ever reach the frontend or source code.
- **AI for personalisation, deterministic logic for calculations.** XP,
  scheduling constraints, progress metrics, and permissions are computed by
  deterministic application code, never by a model.
- **Honest failure.** If no key is configured, the provider is unreachable,
  times out, rate-limits, or returns malformed output, the app must say so
  clearly. A rule-based fallback, if used, must be labelled as such — never
  presented as AI output.
- **Structured output.** The model returns structured data that is validated
  against a Pydantic schema before anything is persisted or displayed.
- **Least data.** Send only the structured context a task needs — never the
  whole database or full personal history.

## 2. Planned abstraction

```
backend/app/ai/
    provider.py     # Protocol: generate_structured(prompt, schema, ...) -> T
    openai_provider.py / <future providers>.py
    service.py      # orchestration: build context, call provider, validate, retry
    prompts/        # versioned prompt templates
```

- **Configuration** (environment): `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`,
  request timeout, and token limits. Model/provider are configurable, never
  assumed.
- **Reliability**: bounded request timeouts, controlled retries with backoff,
  rate limiting, and logging that never records full prompt contents or user
  data.
- **Validation**: every structured response is validated before use; invalid
  output is rejected with an honest error rather than coerced.

## 3. Behaviour when AI is unavailable

The application must still start and remain useful:

- Core (non-AI) features keep working.
- AI-dependent screens show a clear "AI not configured / unavailable" state.
- No fabricated roadmaps, advice, or coaching messages are produced.

This is consistent with the strict no-fake-functionality policy
(`MASTER_SPEC.md` §29).
