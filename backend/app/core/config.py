"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Required starting with Phase 2 (token-based sessions). Kept optional in
    # Phase 1 so the foundation boots without secrets configured.
    secret_key: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @field_validator("log_level")
    @classmethod
    def _normalize_log_level(cls, value: str) -> str:
        return value.upper()


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
