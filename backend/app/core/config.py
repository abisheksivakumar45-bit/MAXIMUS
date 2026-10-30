"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

#: Minimum accepted length for ``secret_key``. Shorter values are rejected at
#: startup so a weak secret can never silently protect real sessions.
MIN_SECRET_KEY_LENGTH = 32


class Settings(BaseSettings):
    """Runtime settings resolved from environment variables (and .env)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "MAXIMUS"
    app_version: str = "0.1.0"
    app_env: str = Field(default="development")
    api_v1_prefix: str = "/api"
    log_level: str = "INFO"

    database_url: str = (
        "postgresql+psycopg://maximus_dev:change_me_local_only@localhost:5432/maximus_dev"
    )

    # Comma-separated list of allowed browser origins (strict CORS).
    backend_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- Authentication and sessions (Phase 2) --------------------------------
    # Server-side secret used to derive session-token digests. Mandatory: the
    # application refuses to start without a strong value (see the
    # model_validator below). ``repr=False`` keeps it out of tracebacks/logs.
    secret_key: str = Field(default="", repr=False)

    # Server-managed session cookies hold an opaque token; only a keyed digest
    # of that token is stored in the database.
    session_cookie_name: str = "maximus_session"
    session_lifetime_days: int = Field(default=30, ge=1, le=365)
    # Only add the Secure flag when actually served over HTTPS.
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    # Double-submit CSRF protection for state-changing requests.
    csrf_cookie_name: str = "maximus_csrf"
    csrf_header_name: str = "X-CSRF-Token"

    # Sliding-window rate limiting for authentication endpoints (per client IP).
    auth_rate_limit_attempts: int = Field(default=10, ge=1)
    auth_rate_limit_window_seconds: int = Field(default=60, ge=1)

    # --- AI roadmap generation (Phase 4) --------------------------------------
    # ``none`` keeps the application fully functional without any outbound AI
    # call: roadmap generation reports that it is not configured instead of
    # pretending to succeed. ``openai`` talks to any OpenAI-compatible
    # Chat Completions endpoint (OpenAI, OpenRouter, Groq, local runtimes, ...).
    ai_provider: Literal["none", "openai"] = "none"
    # Secrets are never logged or serialised (repr=False) and never leave the
    # backend. An empty key simply means "not configured", not a startup error.
    ai_api_key: str = Field(default="", repr=False)
    ai_model: str = ""
    ai_base_url: str = "https://api.openai.com/v1"
    ai_connect_timeout_seconds: float = Field(default=10.0, ge=1, le=60)
    ai_request_timeout_seconds: float = Field(default=60.0, ge=5, le=300)
    ai_max_retries: int = Field(default=2, ge=0, le=5)
    ai_max_output_tokens: int = Field(default=4000, ge=256, le=16000)
    ai_temperature: float = Field(default=0.3, ge=0, le=2)
    ai_json_mode: bool = True

    # Roadmap generation is expensive (external API + large prompt): limit it
    # per authenticated user rather than per IP.
    roadmap_rate_limit_attempts: int = Field(default=5, ge=1)
    roadmap_rate_limit_window_seconds: int = Field(default=300, ge=1)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def session_lifetime_seconds(self) -> int:
        return self.session_lifetime_days * 24 * 60 * 60

    @field_validator("log_level")
    @classmethod
    def _normalize_log_level(cls, value: str) -> str:
        return value.upper()

    @model_validator(mode="after")
    def _validate_secret_key(self) -> Settings:
        if len(self.secret_key) < MIN_SECRET_KEY_LENGTH:
            raise ValueError(
                "SECRET_KEY must be set to a random value of at least "
                f"{MIN_SECRET_KEY_LENGTH} characters. Generate one with: "
                'python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
