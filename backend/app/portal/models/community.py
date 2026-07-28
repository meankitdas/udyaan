"""Community network: profiles, interest tags, connections, and moderation.

This is the professional-network layer of the portal (profiles, a searchable
directory, and follow/connect graphs) as opposed to the project-delivery layer.

Two deliberate schema choices are worth knowing before extending this file:

*Tags are normalized, not comma-separated.* ``users.skills`` already stores a
free-text CSV and it works for the small skill-overlap query in
``api/community.py``, but the directory has to filter on tags and the feed will
have to rank on tag overlap. Both are index lookups against ``user_tags`` and
full scans against a CSV column. ``UserTag.weight`` exists so affinity can be
learned later without a migration.

*Moderation targets are polymorphic from day one.* Reports currently only point
at users, but posts and comments land in the next phase. Storing
``target_type``/``target_id`` instead of a nullable FK per content type means
that phase adds rows, not columns.
"""

import enum

from sqlalchemy import (
    TEXT,
    TIMESTAMP,
    CheckConstraint,
    Column,
    Date,
    Float,
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


class ConnectionStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class ReportStatus(str, enum.Enum):
    OPEN = "open"
    REVIEWING = "reviewing"
    ACTIONED = "actioned"
    DISMISSED = "dismissed"


class ReportTargetType(str, enum.Enum):
    USER = "user"
    POST = "post"
    COMMENT = "comment"
    MESSAGE = "message"


class CommunityTag(Base):
    """A canonical interest tag, e.g. ``agri-tech``, ``drones``, ``marketing``.

    Users type free text, so the slug is the deduplication key: "Agri Tech",
    "agri-tech" and "AGRI TECH " all normalize to the same row instead of
    fragmenting the directory filters into near-duplicate tags.
    """

    __tablename__ = "community_tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(60), unique=True, nullable=False, index=True)
    label = Column(String(80), nullable=False)
    category = Column(String(40), nullable=True)

    # Denormalized so tag autocomplete can rank by popularity without a join.
    usage_count = Column(Integer, nullable=False, server_default=text("0"))

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))


class UserTag(Base):
    """Interest tags claimed by a user."""

    __tablename__ = "user_tags"

    user_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id = Column(
        Integer, ForeignKey("community_tags.id", ondelete="CASCADE"), primary_key=True
    )

    # Every tag is currently claimed at 1.0. Kept so implicit signals (posts
    # authored, profiles viewed) can down/up-weight interests later without
    # migrating the join table.
    weight = Column(Float, nullable=False, server_default=text("1.0"))

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

    tag = relationship("CommunityTag", lazy="joined")


class UserAchievement(Base):
    """A single achievement on a profile (award, publication, certification)."""

    __tablename__ = "user_achievements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title = Column(String(200), nullable=False)
    description = Column(TEXT, nullable=True)
    issuer = Column(String(150), nullable=True)
    achieved_on = Column(Date, nullable=True)
    url = Column(TEXT, nullable=True)

    # Manual ordering; profiles are curated, not chronological feeds.
    sort_order = Column(Integer, nullable=False, server_default=text("0"))

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))


class Connection(Base):
    """A mutual connection between two users, possibly awaiting approval.

    Mentors get an approval step and students do not, so a request to a student
    is written straight to ``accepted`` while a request to a mentor starts
    ``pending``. That policy lives in the API layer, not here.

    A connection is undirected once accepted, but the row is stored directionally
    to preserve who asked. The unique constraint therefore only stops a literal
    duplicate; the reverse pair (B->A when A->B exists) has to be rejected in the
    API, which checks both orderings before inserting.
    """

    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_connection_pair"),
        CheckConstraint("requester_id <> addressee_id", name="ck_connection_not_self"),
        # Powers the "pending requests waiting on me" inbox badge.
        Index("ix_connection_addressee_status", "addressee_id", "status"),
        Index("ix_connection_requester_status", "requester_id", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    requester_id = Column(String(10), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    addressee_id = Column(String(10), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    status = Column(String(20), nullable=False, server_default=text("'pending'"))

    # Intro note. Mentors triaging a queue of requests need context on why.
    message = Column(String(300), nullable=True)

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    responded_at = Column(TIMESTAMP, nullable=True)

    requester = relationship("User", foreign_keys=[requester_id])
    addressee = relationship("User", foreign_keys=[addressee_id])


class Follow(Base):
    """One-way follow. Always instant, never needs approval.

    Separate from :class:`Connection` because they answer different questions:
    follow drives "whose posts do I see", connection drives "who do I know".
    Collapsing them would force a mentor's approval step onto the act of reading
    their updates.
    """

    __tablename__ = "community_follows"
    __table_args__ = (
        CheckConstraint("follower_id <> following_id", name="ck_follow_not_self"),
        Index("ix_follow_following", "following_id"),
    )

    follower_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    following_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))


class ModerationReport(Base):
    """A user-submitted report against a user, post, comment, or message.

    ``target_id`` is a plain string because the things it points at do not share
    an ID type: users use the 10-char custom ID, while posts, comments and
    messages use UUIDs. A real FK per type would mean a nullable column per
    content type.
    """

    __tablename__ = "moderation_reports"
    __table_args__ = (
        Index("ix_report_status_created", "status", "created_at"),
        Index("ix_report_target", "target_type", "target_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    reporter_id = Column(String(10), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    target_type = Column(String(20), nullable=False)
    target_id = Column(String(64), nullable=False)

    reason = Column(String(40), nullable=False)
    details = Column(TEXT, nullable=True)

    status = Column(String(20), nullable=False, server_default=text("'open'"))

    resolved_by = Column(String(10), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(TIMESTAMP, nullable=True)
    resolution_note = Column(TEXT, nullable=True)

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

    reporter = relationship("User", foreign_keys=[reporter_id])
    resolver = relationship("User", foreign_keys=[resolved_by])
