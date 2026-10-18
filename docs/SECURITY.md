# MAXIMUS — Security

Security is implemented incrementally. This document records the current
posture honestly and the controls each phase adds.

## 1. Current posture (Phase 2)

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
  alone, so one user can never read or modify another user's data.
- **Rate limiting.** Auth endpoints are protected by an in-process sliding-window
  limiter (`AUTH_RATE_LIMIT_ATTEMPTS` per `AUTH_RATE_LIMIT_WINDOW_SECONDS`);
  excess requests get **429**.
- **Secrets.** `SECRET_KEY` is **mandatory**: it is validated at startup and the
  backend refuses to start if it is missing or shorter than 32 characters. It is
  held in a `repr=False` settings field. All configuration comes from environment
  variables / `.env`; `.env` is git-ignored and `.env.example` holds placeholders
  only. `alembic.ini` stores no credentials.
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

## 2. Planned controls (by phase)

| Phase | Control |
| --- | --- |
| 3+ | Continued per-user authorization on every new user-owned table (`WHERE user_id = :current_user`). |
| 8 | Practical security learning occurs only in legal, authorised environments. |
| 12 | Full security review: authorization tests (cross-user access), API input fuzzing, dependency and configuration audit. |

Phase 2 delivered the controls originally planned for it: Argon2id password
hashing, opaque server-managed sessions, protected routes with identity derived
from the validated session, request validation, login rate limiting, user-data
isolation, a mandatory validated `SECRET_KEY`, and a finalised CSRF strategy
(double-submit).

## 3. Standing rules

- Never trust a user ID supplied by the client as proof of ownership — always
  derive identity from the validated session/token.
- Never expose password hashes, secret keys, database credentials, internal
  stack traces, or another user's data.
- Never hardcode AI keys or commit credentials.
- Never suppress an error to make a check appear to pass.
