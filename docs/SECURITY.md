# MAXIMUS — Security

Security is implemented incrementally. This document records the current
posture honestly and the controls each phase adds.

## 1. Current posture (Phase 4)

- **Authentication.** Users register and log in with an email + password. The
  password is hashed with **Argon2id** (`argon2-cffi`, secure defaults). Login
  returns an identical generic error (`Invalid email or password.`) for both an
  unknown email and a wrong password, with a dummy Argon2 verification to
  equalise timing — so the API does not reveal which emails exist.
- **Sessions.** Authentication is a **server-managed opaque session**. On
  success the server generates a random 256-bit token
  (`secrets.token_urlsafe(32)`), sends it in an `HttpOnly`, `SameSite=Lax`
  cookie (`maximus_session`; `Secure` when `COOKIE_SECURE=true`, `Path=/`), and
  stores **only** an HMAC-SHA256 hash of the token (keyed with `SECRET_KEY`) in
  the `auth_sessions` table. The raw token is never persisted, never logged, and
  never returned in a response body. Logout revokes the row; expiry and sliding
  renewal are enforced server-side.
- **CSRF.** Double-submit token: any safe request sets a non-`HttpOnly`
  `maximus_csrf` cookie, and state-changing requests (`POST`/`PATCH`/`PUT`/
  `DELETE`) must echo it in the `X-CSRF-Token` header — otherwise **403**.
- **Authorization.** There are no client-supplied user identifiers. Every
  profile/session read derives the user id from the validated session cookie
  alone. The same rule applies to goals, assessments, onboarding, and roadmaps:
  every repository query is scoped to the authenticated user, and a foreign
  record is indistinguishable from a missing one (`404` with an identical body).
- **Rate limiting.** Auth endpoints are protected by an in-process sliding-window
  limiter (`AUTH_RATE_LIMIT_ATTEMPTS` per `AUTH_RATE_LIMIT_WINDOW_SECONDS`);
  excess requests get **429**. Expensive roadmap generation has its own
  per-authenticated-user limiter (`ROADMAP_RATE_LIMIT_*`), also **429**.
- **AI provider security.** Provider calls are backend-only. `AI_API_KEY` is a
  `repr=False` settings field, never returned by `GET /api/roadmaps/config`,
  never sent to the frontend, and never logged. The default
  `AI_PROVIDER=none` disables all outbound AI calls and reports an honest
  unconfigured state. Connect/request timeouts and bounded retries prevent
  unbounded hangs; malformed output is rejected before persistence.
- **Untrusted AI input and output.** Goal text, assessment answers, and
  onboarding values are treated as untrusted data: control characters are
  stripped, fields are clipped, the context has a hard ceiling, and the system
  prompt explicitly denies instructions inside user data. Model output is
  untrusted too: it must satisfy a strict Pydantic schema (`extra="forbid"`,
  bounded strings/lists) before any database write. Invalid output returns
  `502` and saves nothing.
- **No partial writes.** Roadmap persistence is one transaction after
  validation; provider failures, timeouts, rate limits, and invalid output leave
  no roadmap, milestone, task, or resource rows.
- **Idempotency and duplicate-call protection.** A user-scoped unique
  `(user_id, generation_key)` constraint plus an optional client key makes retries
  safe. A replayed key returns the original roadmap (`200`) without another
  provider call; reusing a key for a different goal returns `409`.
- **Secrets.** `SECRET_KEY` is **mandatory**: it is validated at startup and the
  backend refuses to start if it is missing or shorter than 32 characters. It is
  held in a `repr=False` settings field. All configuration comes from environment
  variables / `.env`; `.env` is git-ignored and `.env.example` holds placeholders
  only. `alembic.ini` and Compose store no real credentials.
- **Input validation.** Pydantic schemas validate every request body on the
  backend (email format, display-name bounds, password 10–128 chars with a
  letter and a digit); the frontend validates the same rules client-side.
  Responses expose a dedicated public user shape — never `password_hash`, ids
  other than the user's own, or internal columns.
- **Error handling.** Unhandled exceptions are logged with a traceback
  server-side and returned to clients as a generic message. Stack traces and
  internal details are never exposed.
- **CORS.** Strict allow-list from `BACKEND_CORS_ORIGINS` with
  `allow_credentials=true` (required for the session cookie) and an explicit
  method list; unknown origins receive no `Access-Control-Allow-Origin`.
- **SQL injection.** All database access goes through SQLAlchemy with bound
  parameters; no string-built SQL.
- **Dependencies.** Pinned versions; `npm audit` is clean. Backend and frontend
  images run as a non-root user (backend) / standard node user (frontend).
- **Logging.** Request logging records method and path only — never bodies,
  tokens, or personal data.

## 2. Controls by phase

| Phase | Control |
| --- | --- |
| 4 ✅ | Backend-only AI credentials, strict output validation, prompt-injection hardening, bounded prompts/timeouts, generation rate limiting, idempotency, owner-scoped roadmap access. |
| 5+ | Continued per-user authorization on every new user-owned table (`WHERE user_id = :current_user`); progress writes require the same ownership checks. |
| 8 | Practical security learning occurs only in legal, authorised environments. |
| 12 | Full security review: authorization tests (cross-user access), API input fuzzing, dependency and configuration audit. |

Phase 2 delivered the controls originally planned for it: Argon2id password
hashing, opaque server-managed sessions, protected routes with identity derived
from the validated session, request validation, login rate limiting, user-data
isolation, a mandatory validated `SECRET_KEY`, and a finalised CSRF strategy
(double-submit).

Phase 3 extended those controls to the first business data: every goals and
onboarding route derives the owner from the session (never from client input),
the repository layer has no "get by id alone" helper so scoping cannot be
forgotten, cross-user reads/writes return a 404 identical to a missing record
(no id probing), assessment answers are validated server-side (choices,
required fields, length limits), and goal creation is protected by a database
uniqueness constraint in addition to the application check.

Phase 4 extended them to AI-generated content and roadmap ownership: generation
is authenticated, eligible goals are checked, the provider is called only when
configured, prompts are bounded and injection-resistant, responses are strictly
validated before a single-transaction commit, provider failures never persist
partial data, idempotency prevents duplicate paid calls, and all roadmap
reads/approvals are owner-scoped with identical 404s for foreign records. Tests
cover cross-user access, invalid output, timeouts, retries, key leakage, prompt
injection, oversized context, rate limits, and duplicate requests.

## 3. Standing rules

- Never trust a user ID supplied by the client as proof of ownership — always
  derive identity from the validated session/token.
- Never expose password hashes, secret keys, database credentials, internal
  stack traces, or another user's data.
- Never hardcode AI keys or commit credentials.
- Never send user content to an AI provider without bounds and an explicit
  purpose; never trust model output before schema validation.
- Never persist a partial roadmap or report success when the provider failed.
- Never suppress an error to make a check appear to pass.
