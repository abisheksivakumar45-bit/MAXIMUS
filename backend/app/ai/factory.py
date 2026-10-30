"""Provider selection based on validated application settings."""

from __future__ import annotations

from app.ai.openai_provider import OpenAICompatibleProvider
from app.ai.provider import AIProvider, AIProviderStatus, UnconfiguredProvider
from app.core.config import Settings


def build_provider(settings: Settings) -> AIProvider:
    """Return the configured provider, or an honest unconfigured stand-in."""
    if settings.ai_provider == "openai":
        return OpenAICompatibleProvider(settings)
    return UnconfiguredProvider(settings.ai_provider)


def describe_provider(settings: Settings) -> AIProviderStatus:
    """Return a non-sensitive status payload for the UI."""
    provider = build_provider(settings)
    return AIProviderStatus(
        provider=provider.name,
        model=provider.model,
        configured=provider.is_configured,
        message=provider.configuration_message(),
    )
