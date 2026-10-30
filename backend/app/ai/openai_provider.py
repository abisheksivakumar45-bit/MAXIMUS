"""OpenAI-compatible Chat Completions provider.

The implementation talks plain HTTP to ``{AI_BASE_URL}/chat/completions`` using
the documented JSON shape, so it works with OpenAI and compatible services
(OpenRouter, Groq, a local Ollama/LM Studio endpoint, ...) without adding a
vendor SDK. Only ``httpx`` (already a test dependency) is required.

Safety properties:

- Credentials come from settings and are only ever placed in the outbound
  request header. They are never logged, returned, or embedded in errors.
- The prompt and raw response are never logged.
- The response is size-capped, JSON-parsed, and validated against a strict
  Pydantic schema before it is returned to the service layer.
- Timeouts are explicit (connect and total request) and retries are bounded.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable

import httpx
from pydantic import ValidationError

from app.ai.provider import (
    AIConfigurationError,
    AIProviderStatus,
    AIRateLimitError,
    AIRequestError,
    AIResponseError,
    AITimeoutError,
    StructuredModel,
)
from app.ai.schemas import GeneratedRoadmap
from app.core.config import Settings

logger = logging.getLogger(__name__)

#: Providers occasionally wrap JSON in markdown despite instructions. We accept
#: fences, but refuse anything larger than this before parsing.
MAX_RAW_RESPONSE_CHARS = 256_000
_BACKOFF_BASE_SECONDS = 0.6
_BACKOFF_MAX_SECONDS = 6.0


class OpenAICompatibleProvider:
    """Structured generation through an OpenAI-compatible endpoint."""

    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._settings = settings
        self._transport = transport
        self._sleep = sleep

    @property
    def name(self) -> str:
        return "openai"

    @property
    def model(self) -> str | None:
        return self._settings.ai_model or None

    @property
    def is_configured(self) -> bool:
        base_url = self._settings.ai_base_url.strip()
        return bool(
            self._settings.ai_api_key
            and self._settings.ai_model.strip()
            and base_url.startswith(("http://", "https://"))
        )

    def configuration_message(self) -> str:
        if not self._settings.ai_api_key:
            return "AI roadmap generation is not configured: the backend is missing an AI API key."
        if not self._settings.ai_model.strip():
            return (
                "AI roadmap generation is not configured: the backend is missing an AI model name."
            )
        base_url = self._settings.ai_base_url.strip()
        if not base_url.startswith(("http://", "https://")):
            return "AI roadmap generation is not configured: AI_BASE_URL is invalid."
        return f"AI roadmap generation is ready with {self.name} ({self._settings.ai_model})."

    def status(self) -> AIProviderStatus:
        return AIProviderStatus(
            provider=self.name,
            model=self.model,
            configured=self.is_configured,
            message=self.configuration_message(),
        )

    # -- generation ----------------------------------------------------------
    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: type[StructuredModel],
    ) -> StructuredModel:
        if not self.is_configured:
            raise AIConfigurationError(self.configuration_message())

        url = f"{self._settings.ai_base_url.rstrip('/')}/chat/completions"
        payload: dict[str, object] = {
            "model": self._settings.ai_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self._settings.ai_temperature,
            "max_tokens": self._settings.ai_max_output_tokens,
        }
        if self._settings.ai_json_mode:
            payload["response_format"] = {"type": "json_object"}

        response = self._request_with_retries(url, payload)
        body = self._decode_body(response)
        content = self._extract_content(body)
        return self._validate_content(content, schema)

    # -- internals -----------------------------------------------------------
    def _request_with_retries(self, url: str, payload: dict[str, object]) -> httpx.Response:
        timeout = httpx.Timeout(
            self._settings.ai_request_timeout_seconds,
            connect=self._settings.ai_connect_timeout_seconds,
        )
        attempts = self._settings.ai_max_retries + 1
        last_error: AIRequestError | None = None

        with httpx.Client(timeout=timeout, transport=self._transport) as client:
            for attempt in range(1, attempts + 1):
                try:
                    response = client.post(
                        url,
                        json=payload,
                        headers={
                            "Authorization": f"Bearer {self._settings.ai_api_key}",
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                        },
                    )
                except httpx.TimeoutException:
                    last_error = AITimeoutError("The AI provider did not respond in time.")
                    self._log_retry(attempt, attempts, "timeout")
                except httpx.HTTPError:
                    last_error = AIRequestError("The AI provider could not be reached.")
                    self._log_retry(attempt, attempts, "network")
                else:
                    if response.status_code == 429:
                        last_error = AIRateLimitError(
                            "The AI provider is rate limiting requests. Please try again shortly."
                        )
                        self._log_retry(attempt, attempts, "rate_limited")
                    elif response.status_code >= 500:
                        last_error = AIRequestError(
                            "The AI provider is temporarily unavailable. Please try again shortly."
                        )
                        self._log_retry(attempt, attempts, f"http_{response.status_code}")
                    elif response.is_success:
                        logger.info(
                            "AI request succeeded provider=%s model=%s attempts=%d",
                            self.name,
                            self.model,
                            attempt,
                        )
                        return response
                    else:
                        # A non-retryable client error. Never include the body:
                        # it can echo the prompt or provider-side details.
                        raise AIRequestError(
                            f"The AI provider rejected the request (HTTP {response.status_code})."
                        )

                if attempt < attempts:
                    self._sleep(self._backoff_seconds(attempt))

        raise last_error or AIRequestError("The AI provider request failed.")

    def _log_retry(self, attempt: int, attempts: int, reason: str) -> None:
        logger.warning(
            "AI request attempt %d/%d failed provider=%s model=%s reason=%s",
            attempt,
            attempts,
            self.name,
            self.model,
            reason,
        )

    @staticmethod
    def _backoff_seconds(attempt: int) -> float:
        return min(_BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)), _BACKOFF_MAX_SECONDS)

    @staticmethod
    def _decode_body(response: httpx.Response) -> dict[str, object]:
        if len(response.content) > MAX_RAW_RESPONSE_CHARS:
            raise AIResponseError("The AI provider returned a response that was too large.")
        try:
            body = response.json()
        except ValueError as exc:
            raise AIResponseError("The AI provider returned a response that was not JSON.") from exc
        if not isinstance(body, dict):
            raise AIResponseError("The AI provider returned an unexpected response shape.")
        return body

    @staticmethod
    def _extract_content(body: dict[str, object]) -> str:
        try:
            choices = body["choices"]
            first = choices[0]  # type: ignore[index]
            message = first["message"]  # type: ignore[index]
            content = message["content"]  # type: ignore[index]
            finish_reason = first.get("finish_reason") if isinstance(first, dict) else None
        except (KeyError, IndexError, TypeError) as exc:
            raise AIResponseError("The AI provider returned an unexpected response shape.") from exc

        if finish_reason == "length":
            raise AIResponseError(
                "The AI provider response was truncated before it was complete. "
                "No roadmap was saved."
            )
        if not isinstance(content, str) or not content.strip():
            raise AIResponseError("The AI provider returned an empty response.")
        return content

    @classmethod
    def _validate_content(cls, content: str, schema: type[StructuredModel]) -> StructuredModel:
        if len(content) > MAX_RAW_RESPONSE_CHARS:
            raise AIResponseError("The AI provider returned a response that was too large.")

        cleaned = cls._strip_code_fence(content)
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise AIResponseError(
                "The AI provider returned roadmap data that was not valid JSON."
            ) from exc
        if not isinstance(data, dict):
            raise AIResponseError("The AI provider returned roadmap data in an unexpected shape.")

        try:
            return schema.model_validate(data)
        except ValidationError as exc:
            # Log only the location/count of failures, never the model output.
            locations = [str(error["loc"]) for error in exc.errors()[:3]]
            logger.warning(
                "AI response failed schema validation errors=%d locations=%s",
                exc.error_count(),
                locations,
            )
            raise AIResponseError(
                "The AI provider returned roadmap data that did not match the required "
                "structure. No roadmap was saved."
            ) from exc

    @staticmethod
    def _strip_code_fence(content: str) -> str:
        text = content.strip()
        if not text.startswith("```"):
            return text
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()


#: Re-exported for callers that want the concrete schema in one import.
__all__ = ["GeneratedRoadmap", "MAX_RAW_RESPONSE_CHARS", "OpenAICompatibleProvider"]
