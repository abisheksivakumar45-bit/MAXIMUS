"""Request schemas for the authentication endpoints."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import DISPLAY_NAME_MAX_LENGTH, normalize_display_name

#: Length-based password policy (NIST-style: favour length over complexity),
#: plus a light "must mix a letter and a number" rule to reject the weakest
#: passwords. 10+ characters is the enforced minimum.
PASSWORD_MIN_LENGTH = 10
PASSWORD_MAX_LENGTH = 128


def _validate_password_strength(value: str) -> str:
    if value.strip() == "":
        raise ValueError("Password cannot be empty or whitespace only.")
    if not any(character.isalpha() for character in value):
        raise ValueError("Password must contain at least one letter.")
    if not any(character.isdigit() for character in value):
        raise ValueError("Password must contain at least one number.")
    return value


class RegisterRequest(BaseModel):
    """Payload for creating a new account."""

    display_name: str = Field(min_length=1, max_length=DISPLAY_NAME_MAX_LENGTH)
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("display_name")
    @classmethod
    def _validate_display_name(cls, value: str) -> str:
        return normalize_display_name(value)

    @field_validator("password")
    @classmethod
    def _validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class LoginRequest(BaseModel):
    """Payload for authenticating an existing account."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
