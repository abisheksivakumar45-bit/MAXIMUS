"""AI provider abstraction.

Business logic never talks to a vendor SDK directly. It depends on the small
:class:`AIProvider` protocol in :mod:`app.ai.provider`, so a real provider, a
local OpenAI-compatible runtime, or a deterministic test double are
interchangeable. See ``docs/AI_DESIGN.md``.
"""

from app.ai.factory import build_provider, describe_provider
from app.ai.provider import (
    AIConfigurationError,
    AIError,
    AIProvider,
    AIProviderStatus,
    AIRateLimitError,
    AIRequestError,
    AIResponseError,
    AITimeoutError,
)

__all__ = [
    "AIConfigurationError",
    "AIError",
    "AIProvider",
    "AIProviderStatus",
    "AIRateLimitError",
    "AIRequestError",
    "AIResponseError",
    "AITimeoutError",
    "build_provider",
    "describe_provider",
]
