# MAXIMUS — AI Design

> **Status: implemented in Phase 4 (roadmap generation only).**
> A real provider is optional. With the default `AI_PROVIDER=none` the backend
> reports generation as **not configured** and makes no outbound call. When
> configured, the backend calls an OpenAI-compatible Chat Completions endpoint,
> validates the response against a strict schema, and only then persists it.
> No real paid AI call was made during development or verification.

## 1. Principles

- **Backend only.** Provider credentials and calls live exclusively in the
  backend. No API key reaches the frontend, the browser, logs, or API
  responses.
- **AI for content, deterministic code for rules.** Ownership, eligibility,
  idempotency, rate limits, persistence, and status transitions are computed by
  application code, never by a model.
- **Honest failure.** If no key is configured, the provider is unreachable,
  times out, rate-limits, or returns malformed output, the app says so clearly.
  There is no rule-based fallback pretending to be AI, and no partial roadmap.
- **Structured output.** The model must return JSON matching a strict Pydantic
  contract (`extra="forbid"`). Invalid output is rejected, not coerced.
- **Least data.** Only the selected goal, its assessment, and a bounded subset
  of onboarding answers are sent. Full history and credentials are never sent.
- **No unnecessary calls.** A configured provider is not called when generation
  is ineligible, the request is a replay, or the rate limit is exhausted.

## 2. Implemented architecture

```
backend/app/ai/
    provider.py          Protocol, provider status, AI exception hierarchy
    openai_provider.py   httpx client for OpenAI-compatible /chat/completions
    factory.py           builds the configured provider; non-sensitive status
    prompts.py           bounded, injection-resistant prompt builder
    schemas.py           strict generated-roadmap contract
backend/app/services/
    roadmap_service.py   eligibility, idempotency, orchestration, persistence
backend/app/api/routes/
    roadmaps.py          HTTP status mapping, ownership, rate limit dependency
```

The service depends on the `AIProvider` protocol, not on `httpx` or OpenAI. A
future provider only needs to implement `generate_roadmap(...)` and expose
`name`, `model`, `is_configured`, and `configuration_message()`.

## 3. Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `AI_PROVIDER` | `none` | `none` or `openai` (any OpenAI-compatible endpoint). |
| `AI_API_KEY` | empty | Backend-only bearer token. Empty means not configured. |
| `AI_MODEL` | empty | Model id sent to the provider. |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Base URL; `/chat/completions` is appended. |
| `AI_CONNECT_TIMEOUT_SECONDS` | `10` | TCP/TLS connect timeout. |
| `AI_REQUEST_TIMEOUT_SECONDS` | `60` | Whole-request timeout (including response body). |
| `AI_MAX_RETRIES` | `2` | Bounded retries (0–5) for transient failures only. |
| `AI_MAX_OUTPUT_TOKENS` | `4000` | Output ceiling. |
| `AI_TEMPERATURE` | `0.3` | Sampling temperature. |
| `AI_JSON_MODE` | `true` | Request `response_format={"type":"json_object"}`. |
| `ROADMAP_RATE_LIMIT_ATTEMPTS` | `5` | Generations per authenticated user per window. |
| `ROADMAP_RATE_LIMIT_WINDOW_SECONDS` | `300` | Rate-limit window. |

`GET /api/roadmaps/config` exposes only `configured`, `provider`, `model`, and a
human-readable `message`. It never returns the key or the base URL.

## 4. Generation flow

1. Resolve the authenticated user from the session.
2. Load the goal through the **user-scoped** repository. Missing and foreign
   goals both return `404 Goal not found.`
3. Reject goals whose status is not `active` or `paused` (`400`).
4. If an idempotency key was supplied, look it up for this user. A matching
   roadmap is returned (`200`) without a provider call; a key belonging to a
   different goal returns `409`.
5. Fail with `503` before any outbound call when the provider is not configured.
6. Acquire the in-process generation guard, then build the bounded prompt from
   the goal, its assessment, and onboarding context.
7. Call the provider with connect/read timeouts and bounded retries.
8. Parse the response into the strict `GeneratedRoadmap` schema.
9. Persist the roadmap, milestones, tasks, and resources in one transaction,
   then commit. A failure at any earlier step leaves no row.
10. Return the persisted roadmap. The first creation is `201`; an idempotent
    replay is `200`.

## 5. Output contract

`GeneratedRoadmap` requires:

- title, description, objective, starting/target level, estimated duration;
- one or more ordered milestones, each with description, duration, completion
  criteria, tasks, and resources;
- each task with title, description, optional minutes, optional criteria;
- each resource with title, type, optional URL, optional note.

Limits prevent unbounded storage and prompt-inflated output: milestone, task,
resource, and string lengths are bounded by the schema. Unknown fields are
rejected. The provider's `finish_reason` and JSON parsing are checked before
schema validation.

## 6. Failure mapping

| Failure | HTTP | Persisted? |
| --- | --- | --- |
| No provider configured | `503` with configuration message | No |
| Provider rate limit | `503` + `Retry-After: 30` | No |
| Timeout | `504` | No |
| Invalid/malformed output | `502` | No |
| Network/unavailable | `502` | No |
| Idempotency key reused for another goal | `409` | No |
| Goal not eligible | `400` | No |
| Goal missing/not owned | `404` | No |
| Generation already running in this process | `409` | No |
| User rate limit exceeded | `429` | No |

## 7. Prompt-injection and untrusted content

All user-authored text (goal name, description, assessment answers, onboarding
values) is treated as untrusted **data**:

- The system prompt states that user context is untrusted and must not change
  the task, schema, or safety rules.
- Context is serialised as delimited data, with control characters removed.
- Each field and answer is clipped, and the whole context has a hard size
  ceiling; oversized context fails with `422` instead of being sent.
- The response is still treated as untrusted: it must pass the strict schema
  before persistence. There is no code execution or tool use.

This reduces but does not eliminate semantic risk: a model can still produce
poor or biased content that is structurally valid.

## 8. Privacy and logging

- The API key is a `repr=False` settings field; it is never logged, serialised,
  or returned.
- Application logs record roadmap id, goal id, milestone count, provider, and
  model. They never record prompts, answers, or raw provider responses.
- Only the minimum context needed for a roadmap is sent to the provider.
- No real provider is contacted in tests. Provider tests use `httpx.MockTransport`
  and generation tests use an in-memory fake provider.

## 9. Real vs mocked in verification

| What | Real or mocked | Evidence |
| --- | --- | --- |
| Unit/API tests | Mocked provider | `pytest`; no network calls |
| Frontend tests | Stubbed `fetch` | `vitest`; no backend or AI |
| Live end-to-end | Local mock OpenAI-compatible HTTP server inside the backend container | 32/32 checks; bearer header and JSON mode observed |
| Real paid provider | **Not used** | No credentials configured; no paid call made |
| Default running stack | Unconfigured | `/api/roadmaps/config` → `configured: false`; generation → `503` |

## 10. Limitations

- Only OpenAI-compatible Chat Completions is implemented; no streaming, tools,
  or provider-specific APIs.
- JSON mode is requested but can be disabled for endpoints that do not support
  it; the strict parser remains mandatory.
- Generation is synchronous and can take up to the configured request timeout;
  the browser uses a longer client timeout and shows a loading state.
- Rate limiting and the duplicate-call guard are in-process and per-instance.
- Validation guarantees structure and bounds, not factual correctness.
- Progress tracking, adaptive regeneration, and AI coaching are later phases.
