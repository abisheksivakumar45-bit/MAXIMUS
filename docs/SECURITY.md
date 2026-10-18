# MAXIMUS — Security

Security is implemented incrementally. This document records the current
posture honestly and the controls each phase adds.

## 1. Current posture (Phase 1)

- **Attack surface is minimal by design.** The backend exposes only public,
  unauthenticated health endpoints. There is no user data in the API yet, so
  there is nothing to authorise or leak.
- **Secrets.** All configuration comes from environment variables / `.env`.
  `.env` is git-ignored; `.env.example` contains placeholders only.
  `alembic.ini` stores no credentials.
- **Error handling.** Unhandled exceptions are logged with a traceback
  server-side and returned to clients as a generic message. Stack traces and
  internal details are never exposed.
- **CORS.** Strict allow-list from `BACKEND_CORS_ORIGINS`; `allow_credentials`
  is `false` and only `GET` is permitted. In development the browser uses the
  same-origin Vite proxy, so CORS is not needed for the normal flow.
- **SQL injection.** All database access goes through SQLAlchemy with bound
  parameters; no string-built SQL.
- **Dependencies.** Pinned versions; `npm audit` is clean. Backend and frontend
  images run as a non-root user (backend) / standard node user (frontend).
- **Logging.** Request logging records method and path only — never bodies,
  tokens, or personal data.

## 2. Planned controls (by phase)

| Phase | Control |
| --- | --- |
| 2 | Password hashing with a memory-hard algorithm (e.g. Argon2/bcrypt) via a vetted library; token-based sessions; protected routes and per-request authorization deriving identity from the validated token; input validation; login rate limiting; user-data isolation on every query (`WHERE user_id = :current_user`). |
| 2 | `SECRET_KEY` becomes required and is validated at startup. |
| 2 | CSRF strategy finalised for the chosen session mechanism. |
| 8 | Practical security learning occurs only in legal, authorised environments. |
| 12 | Full security review: authorization tests (cross-user access), API input fuzzing, dependency and configuration audit. |

## 3. Standing rules

- Never trust a user ID supplied by the client as proof of ownership — always
  derive identity from the validated session/token.
- Never expose password hashes, secret keys, database credentials, internal
  stack traces, or another user's data.
- Never hardcode AI keys or commit credentials.
- Never suppress an error to make a check appear to pass.
