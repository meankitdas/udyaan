"""Schemas for the owner console (platform-wide user administration)."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.portal.core.roles import ALL_ROLE_KEYS

MIN_PASSWORD_LENGTH = 10


def _validate_role(value: str) -> str:
    key = (value or "").strip().upper()
    if key not in ALL_ROLE_KEYS:
        raise ValueError(f"Unknown role '{value}'")
    return key


def _validate_password(value: str) -> str:
    if len(value or "") < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    return value


class ManagedUser(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    role_key: Optional[str] = None
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    is_active: bool = True
    is_approved: bool = False
    is_email_verified: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ManagedUserPage(BaseModel):
    total: int
    users: List[ManagedUser]


class OwnerUserCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    email: EmailStr
    password: str
    role_key: str
    phone: Optional[str] = None
    organization_id: Optional[str] = None
    # An owner-created account is trusted, so it skips OTP and admin approval by
    # default; both are still overridable per invite.
    is_email_verified: bool = True
    is_approved: bool = True

    _check_role = field_validator("role_key")(_validate_role)
    _check_password = field_validator("password")(_validate_password)


class OwnerUserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    phone: Optional[str] = None
    organization_id: Optional[str] = None
    is_active: Optional[bool] = None
    is_approved: Optional[bool] = None
    is_email_verified: Optional[bool] = None


class RoleChange(BaseModel):
    role_key: str

    _check_role = field_validator("role_key")(_validate_role)


class PasswordChange(BaseModel):
    new_password: str

    _check_password = field_validator("new_password")(_validate_password)


class RoleOption(BaseModel):
    role_key: str
    role_name: str
    user_count: int


class OwnerOverview(BaseModel):
    total_users: int
    active_users: int
    pending_approval: int
    organizations: int
    users_by_role: dict
