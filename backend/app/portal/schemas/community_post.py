"""Pydantic schemas for the community feed API."""

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.portal.schemas.community import ProfileSummary, TagOut

PostTypeName = Literal["update", "research", "achievement"]
PostVisibilityName = Literal["public", "connections"]
FeedScope = Literal["for-you", "following", "latest"]

MAX_BODY_LENGTH = 5000
MAX_COMMENT_LENGTH = 2000


# --------------------------------------------------------------------------
# Attachments
# --------------------------------------------------------------------------

class AttachmentIn(BaseModel):
    """A file already uploaded via a signed URL.

    ``url`` is checked against our own bucket prefix in the API before it is
    stored, so this cannot be used to attribute an arbitrary third-party link.
    """

    url: str = Field(min_length=1)
    name: Optional[str] = Field(default=None, max_length=255)
    content_type: Optional[str] = Field(default=None, max_length=100)
    size: Optional[int] = Field(default=None, ge=0)


class AttachmentOut(BaseModel):
    url: str
    name: Optional[str] = None
    content_type: Optional[str] = None
    size: Optional[int] = None


class UploadSignRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)
    size: Optional[int] = Field(default=None, ge=0)


class UploadSignResponse(BaseModel):
    upload_url: str
    file_url: str
    object_key: str
    method: str = "PUT"
    headers: dict = {}
    max_bytes: int
    expires_at: datetime


# --------------------------------------------------------------------------
# Posts
# --------------------------------------------------------------------------

class PostCreate(BaseModel):
    post_type: PostTypeName = "update"
    body: Optional[str] = Field(default=None, max_length=MAX_BODY_LENGTH)
    link_url: Optional[str] = Field(default=None, max_length=2000)
    attachment: Optional[AttachmentIn] = None
    achievement_id: Optional[UUID] = None
    visibility: PostVisibilityName = "public"
    tags: List[str] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def _require_content(self):
        """A post must actually say something.

        Enforced here rather than in the endpoint so the same rule applies to
        every entry point, including shares with commentary.
        """

        if self.body:
            self.body = self.body.strip() or None

        has_body = bool(self.body)
        has_link = bool(self.link_url and self.link_url.strip())
        has_attachment = self.attachment is not None
        has_achievement = self.achievement_id is not None

        if self.post_type == "achievement" and not has_achievement:
            raise ValueError("An achievement post must reference an achievement.")
        if self.post_type == "research" and not (has_link or has_attachment):
            raise ValueError(
                "A research post needs a link or an attached document."
            )
        if not (has_body or has_link or has_attachment or has_achievement):
            raise ValueError("Add some text, a link, or a file before posting.")
        return self


class PostUpdate(BaseModel):
    """Only the narrative parts are editable.

    Type, attachment, and shared source are fixed at creation: letting an author
    swap the document under a post that has already been liked and reshared
    would rewrite history for everyone who engaged with it.
    """

    body: Optional[str] = Field(default=None, max_length=MAX_BODY_LENGTH)
    link_url: Optional[str] = Field(default=None, max_length=2000)
    visibility: Optional[PostVisibilityName] = None
    tags: Optional[List[str]] = Field(default=None, max_length=8)


class ShareCreate(BaseModel):
    body: Optional[str] = Field(default=None, max_length=MAX_BODY_LENGTH)
    visibility: PostVisibilityName = "public"


class PostAchievementOut(BaseModel):
    id: UUID
    title: str
    issuer: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: UUID
    post_type: str
    body: Optional[str] = None
    link_url: Optional[str] = None
    attachment: Optional[AttachmentOut] = None
    achievement: Optional[PostAchievementOut] = None
    visibility: str = "public"
    tags: List[TagOut] = []

    author: Optional[ProfileSummary] = None

    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0

    # Viewer-relative, so a feed page renders without a request per post.
    viewer_has_liked: bool = False
    can_edit: bool = False
    can_moderate: bool = False

    shared_from: Optional["PostOut"] = None

    # True when the original of a share was removed or deleted, so the client
    # can render a tombstone instead of silently dropping the context.
    shared_source_missing: bool = False

    is_removed: bool = False
    created_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None

    # Debug/tuning aid: why this post ranked where it did. Only populated on the
    # "for-you" feed.
    score: Optional[float] = None
    matched_tags: List[str] = []


PostOut.model_rebuild()


class FeedPage(BaseModel):
    items: List[PostOut] = []
    # Opaque cursor. For ranked feeds it encodes an offset, for chronological
    # ones a timestamp; clients must not interpret it.
    next_cursor: Optional[str] = None
    has_more: bool = False


# --------------------------------------------------------------------------
# Comments
# --------------------------------------------------------------------------

class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=MAX_COMMENT_LENGTH)
    parent_id: Optional[UUID] = None


class CommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=MAX_COMMENT_LENGTH)


class CommentOut(BaseModel):
    id: UUID
    post_id: UUID
    parent_id: Optional[UUID] = None
    body: str
    author: Optional[ProfileSummary] = None
    can_edit: bool = False
    can_moderate: bool = False
    is_removed: bool = False
    created_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None
    replies: List["CommentOut"] = []


CommentOut.model_rebuild()


class CommentPage(BaseModel):
    items: List[CommentOut] = []
    total: int = 0


class LikeResult(BaseModel):
    post_id: UUID
    viewer_has_liked: bool
    like_count: int
