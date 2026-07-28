"""Direct messaging: conversations, participants, and messages.

Sits on the Phase 1 connection graph -- a conversation can only exist between
two people with an accepted connection, so the request flow that gates
mentorship also gates the inbox.

*A conversation is identified by a canonical pair key.* ``pair_key`` is
``"{smaller_id}:{larger_id}"`` under a UNIQUE constraint. Two people tapping
"Message" on each other at the same moment would otherwise race and produce two
threads for the same pair, splitting the history in half with no way to merge
it. Ordering the ids before hashing makes the key identical from both
directions, and the constraint makes the database, not application timing, the
thing that decides.

*Per-user state lives on the participant row, not the conversation.* Unread
counts, read cursors, mute and archive are all one-sided. Storing them as
``a_last_read_at``/``b_last_read_at`` on the conversation would force every
read to branch on which side of the pair you are, and that branch is exactly the
kind of thing that eventually gets written backwards in one query. A
participants table also leaves group conversations open as a later addition
without a migration of the message table.

*Unread counts are derived, never incremented.* ``unread_count`` is a cache
recomputed from messages newer than ``last_read_at``. An increment-on-send
scheme drifts permanently the first time a delivery is retried or a read
receipt arrives out of order, and an inbox badge that is wrong forever is worse
than one that costs a count query.

*Removal is soft.* A deleted message keeps its row so the thread's ordering and
the recipient's read cursor stay meaningful; only the body is withheld.
"""

from sqlalchemy import (
    TEXT,
    TIMESTAMP,
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.portal.models.base import Base


def pair_key_for(user_a: str, user_b: str) -> str:
    """Canonical, direction-independent key for a pair of users."""
    low, high = sorted([user_a, user_b])
    return f"{low}:{high}"


class Conversation(Base):
    """A one-to-one thread between two members."""

    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("pair_key", name="uq_conversation_pair"),
        # The inbox is always "my conversations, most recent first".
        Index("ix_conversation_last_message", "last_message_at"),
    )

    id = Column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    pair_key = Column(String(32), nullable=False)

    # Denormalized so the inbox renders without joining the last message of
    # every thread. Rebuilt from the authoritative message row on every send.
    last_message_at = Column(TIMESTAMP, nullable=True)
    last_message_preview = Column(String(160), nullable=True)
    last_message_sender_id = Column(
        String(10), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

    participants = relationship(
        "ConversationParticipant",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class ConversationParticipant(Base):
    """One member's side of a conversation: their read cursor and preferences."""

    __tablename__ = "conversation_participants"
    __table_args__ = (
        UniqueConstraint(
            "conversation_id", "user_id", name="uq_conversation_participant"
        ),
        # Drives both the inbox listing and the global unread badge.
        Index("ix_participant_user", "user_id"),
    )

    id = Column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Everything strictly after this instant is unread. Kept as a timestamp
    # rather than a last-read message id so that a message arriving while the
    # thread is open does not need a second write to stay marked read.
    last_read_at = Column(TIMESTAMP, nullable=True)
    unread_count = Column(Integer, nullable=False, server_default=text("0"))

    is_muted = Column(Boolean, nullable=False, server_default=text("false"))
    is_archived = Column(Boolean, nullable=False, server_default=text("false"))

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

    conversation = relationship("Conversation", back_populates="participants")


class Message(Base):
    """A single message in a conversation."""

    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint(
            "body IS NOT NULL OR attachment_url IS NOT NULL",
            name="ck_message_has_content",
        ),
        # Thread pagination reads newest-first within one conversation; the id
        # tiebreaks messages that share a timestamp so a cursor can never skip
        # or repeat a row.
        Index("ix_message_conversation_created", "conversation_id", "created_at", "id"),
        # The sync endpoint scans "anything newer than my cursor" across every
        # conversation the caller belongs to.
        Index("ix_message_created", "created_at"),
    )

    id = Column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    body = Column(TEXT, nullable=True)

    # Reuses the Phase 2 signed-upload pipeline, so an attachment here is
    # validated and stored exactly like one on a post.
    attachment_url = Column(TEXT, nullable=True)
    attachment_name = Column(String(255), nullable=True)
    attachment_type = Column(String(100), nullable=True)
    attachment_size = Column(BigInteger, nullable=True)

    is_removed = Column(Boolean, nullable=False, server_default=text("false"))
    removed_at = Column(TIMESTAMP, nullable=True)
    removed_by = Column(
        String(10), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    edited_at = Column(TIMESTAMP, nullable=True)
