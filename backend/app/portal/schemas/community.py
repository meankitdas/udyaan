"""Pydantic schemas for the community network API."""

from datetime import date, datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

# Which portal roles are treated as mentors in the community. Students get
# instant connections; mentors approve theirs, so this list is what decides
# whether a connection request needs a human in the loop.
MENTOR_ROLE_KEYS = ("FACULTY", "PROJECT_HEAD", "ADMIN", "SUPERADMIN")

CommunityRole = Literal["student", "mentor"]
ConnectionState = Literal["none", "pending_outgoing", "pending_incoming", "connected"]
ReportReason = Literal["spam", "harassment", "misinformation", "inappropriate", "other"]


# --------------------------------------------------------------------------
# Tags
# --------------------------------------------------------------------------

class TagOut(BaseModel):
    id: int
    slug: str
    label: str
    category: Optional[str] = None
    usage_count: int = 0

    class Config:
        from_attributes = True


class TagCreate(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    category: Optional[str] = Field(default=None, max_length=40)


# --------------------------------------------------------------------------
# Achievements
# --------------------------------------------------------------------------

class AchievementBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    issuer: Optional[str] = Field(default=None, max_length=150)
    achieved_on: Optional[date] = None
    url: Optional[str] = None
    sort_order: int = 0


class AchievementCreate(AchievementBase):
    pass


class AchievementUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    issuer: Optional[str] = Field(default=None, max_length=150)
    achieved_on: Optional[date] = None
    url: Optional[str] = None
    sort_order: Optional[int] = None


class AchievementOut(AchievementBase):
    id: UUID
    user_id: str

    class Config:
        from_attributes = True


# --------------------------------------------------------------------------
# Profiles
# --------------------------------------------------------------------------

class ProfileSummary(BaseModel):
    """The compact shape used in directory results and connection lists."""

    id: str
    full_name: str
    role_key: Optional[str] = None
    community_role: CommunityRole = "student"
    headline: Optional[str] = None
    avatar_url: Optional[str] = None
    university: Optional[str] = None
    organization_name: Optional[str] = None
    cohort: Optional[str] = None
    tags: List[TagOut] = []

    # Viewer-relative. Lets the directory render the right button without a
    # follow-up request per card.
    connection_state: ConnectionState = "none"
    connection_id: Optional[UUID] = None
    is_following: bool = False

    # Only populated where it is meaningful (directory, suggestions).
    shared_tags: List[str] = []
    mutual_connections: int = 0


class ProfileDetail(ProfileSummary):
    email: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    is_discoverable: bool = True
    achievements: List[AchievementOut] = []
    connection_count: int = 0
    follower_count: int = 0
    following_count: int = 0
    is_self: bool = False
    created_at: Optional[datetime] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    headline: Optional[str] = Field(default=None, max_length=160)
    bio: Optional[str] = None
    university: Optional[str] = Field(default=None, max_length=150)
    cohort: Optional[str] = Field(default=None, max_length=50)
    avatar_url: Optional[str] = None
    is_discoverable: Optional[bool] = None


class ProfileTagsUpdate(BaseModel):
    """Replaces the caller's full tag set. Accepts slugs or human labels."""

    tags: List[str] = Field(default_factory=list, max_length=25)

    @field_validator("tags")
    @classmethod
    def strip_blanks(cls, value: List[str]) -> List[str]:
        return [t.strip() for t in value if t and t.strip()]


class DirectoryPage(BaseModel):
    results: List[ProfileSummary]
    total: int
    page: int
    page_size: int
    has_more: bool


class DirectoryFacets(BaseModel):
    """Filter options built from real data, so no filter yields zero results."""

    universities: List[str] = []
    cohorts: List[str] = []
    organizations: List[dict] = []
    tags: List[TagOut] = []


# --------------------------------------------------------------------------
# Connections & follows
# --------------------------------------------------------------------------

class ConnectionCreate(BaseModel):
    addressee_id: str = Field(min_length=1, max_length=10)
    message: Optional[str] = Field(default=None, max_length=300)


class ConnectionOut(BaseModel):
    id: UUID
    status: str
    message: Optional[str] = None
    created_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None

    # The other party, from the caller's point of view.
    person: ProfileSummary
    # True when the caller sent the request (drives "Withdraw" vs "Accept").
    is_outgoing: bool


class ConnectionRequests(BaseModel):
    incoming: List[ConnectionOut] = []
    outgoing: List[ConnectionOut] = []


class ConnectionActionResult(BaseModel):
    id: Optional[UUID] = None
    status: str
    # "accepted" straight away for students, "pending" when a mentor must approve.
    auto_accepted: bool = False
    message: str


# --------------------------------------------------------------------------
# Moderation
# --------------------------------------------------------------------------

class ReportCreate(BaseModel):
    target_type: Literal["user", "post", "comment", "message"]
    target_id: str = Field(min_length=1, max_length=64)
    reason: ReportReason
    details: Optional[str] = Field(default=None, max_length=2000)


class ReportOut(BaseModel):
    id: UUID
    target_type: str
    target_id: str
    reason: str
    details: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None

    reporter_id: str
    reporter_name: Optional[str] = None
    resolver_name: Optional[str] = None

    # Denormalized for the admin queue so it does not need a lookup per row.
    target_label: Optional[str] = None


class ReportResolve(BaseModel):
    action: Literal["dismiss", "remove_content", "deactivate_user"]
    note: Optional[str] = Field(default=None, max_length=2000)


# --------------------------------------------------------------------------
# Phase 4: suggestions


class SuggestionPage(BaseModel):
    """One page of "people you may know".

    Reuses :class:`ProfileSummary` so the directory card renders a suggestion
    without a second component: ``shared_tags`` and ``mutual_connections`` are
    already the two things the card explains itself with.
    """

    results: List[ProfileSummary]
    has_more: bool
    # False when pgvector is unavailable, so the client can avoid promising
    # semantic matching it is not actually getting.
    personalized: bool = False


class DismissResult(BaseModel):
    dismissed: bool
    user_id: str


class BackfillResult(BaseModel):
    """Outcome of an embedding backfill run."""

    posts_embedded: int
    users_embedded: int
    # Distinguishes "nothing needed doing" from "embeddings are switched off".
    vector_search_enabled: bool
