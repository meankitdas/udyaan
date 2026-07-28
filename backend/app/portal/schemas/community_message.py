"""Pydantic schemas for the direct messaging API."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.portal.schemas.community import ProfileSummary
from app.portal.schemas.community_post import AttachmentIn, AttachmentOut

MAX_MESSAGE_LENGTH = 5000
PREVIEW_LENGTH = 160


class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: str
    body: Optional[str] = None
    attachment: Optional[AttachmentOut] = None

    is_mine: bool = False
    is_removed: bool = False
    can_delete: bool = False

    created_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None


class MessageCreate(BaseModel):
    body: Optional[str] = Field(default=None, max_length=MAX_MESSAGE_LENGTH)
    attachment: Optional[AttachmentIn] = None
    # Echoed back untouched so an optimistic bubble can be reconciled with the
    # stored row instead of being duplicated when the response arrives.
    client_token: Optional[str] = Field(default=None, max_length=64)

    @model_validator(mode="after")
    def _require_content(self) -> "MessageCreate":
        if not (self.body and self.body.strip()) and self.attachment is None:
            raise ValueError("A message needs text or an attachment.")
        return self


class MessagePage(BaseModel):
    """One page of a thread, ordered oldest-first for rendering."""

    items: List[MessageOut] = []
    next_cursor: Optional[str] = None
    has_more: bool = False


class ConversationOut(BaseModel):
    id: UUID
    other: Optional[ProfileSummary] = None

    last_message_preview: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_is_mine: bool = False

    unread_count: int = 0
    is_muted: bool = False
    is_archived: bool = False

    created_at: Optional[datetime] = None


class ConversationPage(BaseModel):
    items: List[ConversationOut] = []
    next_cursor: Optional[str] = None
    has_more: bool = False
    total_unread: int = 0


class ConversationCreate(BaseModel):
    user_id: str = Field(min_length=1, max_length=10)


class ReadReceipt(BaseModel):
    """Marks everything up to ``until`` as read; defaults to now."""

    until: Optional[datetime] = None


class ReadResult(BaseModel):
    conversation_id: UUID
    unread_count: int
    total_unread: int


class SyncResponse(BaseModel):
    """Everything that changed since the client's cursor.

    This is the transport seam. A push implementation would deliver exactly this
    payload over a socket instead of in a poll response, so the client-side
    reducer does not change when the transport does.
    """

    # Opaque high-water mark to send back on the next call.
    cursor: str
    server_time: datetime

    messages: List[MessageOut] = []
    conversations: List[ConversationOut] = []
    total_unread: int = 0


class UnreadSummary(BaseModel):
    total_unread: int = 0
    conversation_count: int = 0
