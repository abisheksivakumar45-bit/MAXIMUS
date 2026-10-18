"""Schemas for user identity and profile.

These are the only shapes the API ever returns for a user. They deliberately
exclude internal database fields, ``password_hash``, and ``is_active``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

DISPLAY_NAME_MAX_LENGTH = 120


def normalize_display_name(value: str) -> str:
    """Trim a display name and reject blank values."""
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Display name cannot be empty.")
    return cleaned


class UserPublic(BaseModel):
    """Public representation of a user account."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str | None
    created_at: datetime


class ProfileUpdate(BaseModel):
    """Editable profile fields. Only provided fields are changed."""

    display_name: str | None = Field(default=None, max_length=DISPLAY_NAME_MAX_LENGTH)

    @field_validator("display_name")
    @classmethod
    def _validate_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_display_name(value)
