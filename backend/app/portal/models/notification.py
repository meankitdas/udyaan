"""Notification queue for digest emails.

Modelled on the parts of LinkedIn's Air Traffic Controller that matter at this
scale: every notification goes through one gateway, is held for an aggregation
window, is cancelled if the member already saw it in-app, and is capped so a
busy day cannot turn into a mailbox full of individual emails.

The row is the queue *and* the audit trail — ``seen_at`` and ``emailed_at``
record which of the two outcomes happened, so a dispatch that runs twice cannot
send the same notification again.
"""

from sqlalchemy import (
    TIMESTAMP,
    Column,
    ForeignKey,
    Index,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.portal.models.base import Base


class NotificationKind:
    CONNECTION_REQUEST = "connection_request"
    MESSAGE = "message"
    POST = "post"


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        # Dedupe only across *pending* rows. A plain unique constraint would let
        # a conversation notify once and never again, because the delivered row
        # would keep winning the conflict forever.
        Index(
            "uq_notification_pending_target",
            "user_id",
            "kind",
            "target_id",
            unique=True,
            postgresql_where=text("emailed_at IS NULL AND seen_at IS NULL"),
        ),
        # The dispatcher's only query: unsent, unseen, oldest first.
        Index("ix_notification_pending", "user_id", "emailed_at", "seen_at"),
    )

    id = Column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    kind = Column(String(32), nullable=False)

    actor_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    # Conversation id, post id or connection id, depending on kind. Kept as text
    # because it spans three different id shapes.
    target_id = Column(String(64), nullable=True)

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    # Set when the member saw it in-app, which cancels the email.
    seen_at = Column(TIMESTAMP, nullable=True)
    emailed_at = Column(TIMESTAMP, nullable=True)
