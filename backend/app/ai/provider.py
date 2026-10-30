"""Provider-neutral AI interface and error taxonomy.

The interface is intentionally tiny: one structured-generation call. That is
all the roadmap engine needs, and it keeps vendor details out of services,
repositories, and API routes.

Every failure mode has its own exception so the HTTP layer can be honest about
what happened (not configured, unreachable, timed out, rate limited, or
returned invalid data) without ever exposing prompts, credentials, or raw
provider output.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, TypeVar

from pydantic import BaseModel

#: Bound for the Pydantic model a provider must return.
StructuredModel = TypeVar("StructuredModel", bound=BaseModel)


class AIError(Exception):
    """Base class for all AI provider failures."""


class AIConfigurationError(AIError):
    """Raised when no usable AI provider credentials/configuration exist."""


class AIRequestError(AIError):
    """Raised when the provider could not be reached or rejected the request."""


class AITimeoutError(AIRequestError):
    """Raised when the provider did not answer within the configured timeout."""


class AIRateLimitError(AIRequestError):
    """Raised when the provider kept rate limiting us after the retry budget."""


class AIResponseError(AIError):
    """Raised when the provider answered with malformed or invalid data."""


@dataclass(frozen=True)
class AIProviderStatus:
    """Non-sensitive description of the configured provider (safe to expose)."""

    provider: str
    model: str | None
    configured: bool
    message: str


class AIProvider(Protocol):
    """Structural interface every AI provider implementation satisfies."""

    @property
    def name(self) -> str:
        """Short provider identifier, e.g. ``"openai"``."""

    @property
    def model(self) -> str | None:
        """Configured model identifier, or ``None`` when unset."""

    @property
    def is_configured(self) -> bool:
        """True when a real call can be attempted."""

    def configuration_message(self) -> str:
        """User-facing explanation of the current configuration state."""

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: type[StructuredModel],
    ) -> StructuredModel:
        """Generate one JSON object and validate it against ``schema``."""


class UnconfiguredProvider:
    """Stand-in provider used when AI generation is not configured.

    It never fakes a result: every generation attempt raises
    :class:`AIConfigurationError`, which the API translates into a clear
    "not configured" response.
    """

    def __init__(self, provider: str = "none") -> None:
        self._provider = provider

    @property
    def name(self) -> str:
        return self._provider

    @property
    def model(self) -> str | None:
        return None

    @property
    def is_configured(self) -> bool:
        return False

    def configuration_message(self) -> str:
        return (
            "AI roadmap generation is not configured. Set AI_PROVIDER, "
            "AI_API_KEY, and AI_MODEL on the backend to enable it."
        )

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: type[StructuredModel],
    ) -> StructuredModel:
        raise AIConfigurationError(self.configuration_message())
