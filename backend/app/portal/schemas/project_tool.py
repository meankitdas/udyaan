from datetime import datetime
from typing import Optional
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.portal.models.project_tool import ToolStatus

# Only these schemes are ever rendered as a link in the portal. Anything else
# (javascript:, data:, ...) would turn a stored proposal into an XSS vector.
_ALLOWED_SCHEMES = {"http", "https"}
_MAX_URL_LENGTH = 2000


def _clean_url(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    url = value.strip()
    if not url:
        return None
    if len(url) > _MAX_URL_LENGTH:
        raise ValueError("Workspace link is too long.")
    parts = urlsplit(url)
    if parts.scheme.lower() not in _ALLOWED_SCHEMES or not parts.netloc:
        raise ValueError("Workspace link must be a full http:// or https:// URL.")
    return url


class ProjectToolCreate(BaseModel):
    tool_key: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    url: Optional[str] = None
    purpose: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: Optional[str]) -> Optional[str]:
        return _clean_url(value)


class ProjectToolDecision(BaseModel):
    """Approve or decline a proposal. ``Proposed`` is not a decision."""

    status: ToolStatus
    review_note: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: ToolStatus) -> ToolStatus:
        if value is ToolStatus.PROPOSED:
            raise ValueError("Decision must be either Approved or Declined.")
        return value


class ProjectToolResponse(BaseModel):
    id: UUID
    project_id: str
    tool_key: str
    name: str
    url: Optional[str] = None
    purpose: Optional[str] = None
    status: str
    review_note: Optional[str] = None
    proposed_by: str
    proposed_by_name: Optional[str] = None
    decided_by: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
