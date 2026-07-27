from datetime import datetime
import re
from typing import Optional
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

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

    @model_validator(mode="after")
    def validate_embedded_provider(self):
        key = self.tool_key.lower()
        if key not in {"notion", "miro"}:
            return self
        if not self.url:
            raise ValueError("Notion and Miro require a shared workspace URL.")

        host = (urlsplit(self.url).hostname or "").lower()
        if key == "miro":
            if host != "miro.com" and not host.endswith(".miro.com"):
                raise ValueError("Miro workspace URL must be hosted on miro.com.")
            match = re.match(r"^/app/(?:board|live-embed)/([^/]+)", urlsplit(self.url).path)
            if not match or not re.match(r"^uXjV[A-Za-z0-9_=-]{8,}$", match.group(1)):
                raise ValueError("Use a Miro board share URL.")
        if key == "notion":
            allowed = any(
                host == domain or host.endswith(f".{domain}")
                for domain in ("notion.so", "notion.site", "notion.com")
            )
            if not allowed:
                raise ValueError("Notion workspace URL must be hosted on notion.so, notion.site, or notion.com.")
        return self


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
