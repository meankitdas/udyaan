"""Community feed: posts, tags, likes, comments, and shares.

Layered directly on the Phase 1 community graph in ``community.py``. A few
decisions here shape everything downstream:

*A share is a post, not a join row.* ``shared_from_id`` is a self-referential FK,
so resharing produces a normal post that happens to wrap another one. That keeps
the feed a single queryable table -- a share can carry its own commentary, be
liked, be reported, and be ranked exactly like any other post, with no union
query and no second timeline type.

*Post tags reuse ``community_tags``.* The feed ranks on overlap between a post's
tags and the viewer's interest tags, so both sides must resolve to the same tag
IDs. A separate post-tag vocabulary would make that overlap uncomputable.

*Counters are denormalized.* ``like_count``/``comment_count``/``share_count`` are
maintained on write. A feed page renders 20 posts; recomputing three aggregates
per post per request is 60 extra scans to display numbers that change rarely.
The authoritative rows still live in ``post_likes``/``post_comments``, so the
counters are a cache that can be rebuilt, never the source of truth.

*Removal is soft.* Moderating a comment out of existence would orphan its
replies, and hard-deleting a post that others have reshared would break their
timelines. ``is_removed`` keeps the row and its thread intact while hiding the
content everywhere it is read.
"""

import enum

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


class PostType(str, enum.Enum):
    UPDATE = "update"
    RESEARCH = "research"
    ACHIEVEMENT = "achievement"


class PostVisibility(str, enum.Enum):
    PUBLIC = "public"
    CONNECTIONS = "connections"


class CommunityPost(Base):
    """A single feed entry: a text update, a research finding, or an achievement."""

    __tablename__ = "community_posts"
    __table_args__ = (
        CheckConstraint(
            "post_type IN ('update', 'research', 'achievement')",
            name="ck_post_type",
        ),
        CheckConstraint(
            "visibility IN ('public', 'connections')", name="ck_post_visibility"
        ),
        CheckConstraint("id <> shared_from_id", name="ck_post_not_self_share"),
        # The three read paths. Each is filtered to live posts because a removed
        # post is never rendered, so it should not occupy index space either.
        Index(
            "ix_post_created",
            "created_at",
            postgresql_where=text("is_removed = false"),
        ),
        Index(
            "ix_post_author_created",
            "author_id",
            "created_at",
            postgresql_where=text("is_removed = false"),
        ),
        Index(
            "ix_post_shared_from",
            "shared_from_id",
            postgresql_where=text("shared_from_id IS NOT NULL"),
        ),
    )

    id = Column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    author_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    post_type = Column(String(20), nullable=False, server_default=text("'update'"))
    body = Column(TEXT, nullable=True)

    # Research findings: either an external link (DOI, journal, repo) or an
    # uploaded document, commonly both.
    link_url = Column(TEXT, nullable=True)
    attachment_url = Column(TEXT, nullable=True)
    attachment_name = Column(String(255), nullable=True)
    attachment_type = Column(String(100), nullable=True)
    attachment_size = Column(BigInteger, nullable=True)

    # Achievement posts point back at the profile achievement they announce, so
    # editing the achievement does not leave a stale copy in the feed.
    achievement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_achievements.id", ondelete="SET NULL"),
        nullable=True,
    )

    shared_from_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_posts.id", ondelete="SET NULL"),
        nullable=True,
    )

    visibility = Column(String(20), nullable=False, server_default=text("'public'"))

    like_count = Column(Integer, nullable=False, server_default=text("0"))
    comment_count = Column(Integer, nullable=False, server_default=text("0"))
    share_count = Column(Integer, nullable=False, server_default=text("0"))

    is_removed = Column(Boolean, nullable=False, server_default=text("false"))
    removed_at = Column(TIMESTAMP, nullable=True)
    removed_by = Column(
        String(10), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))
    # Distinct from updated_at, which also moves when counters change. Only this
    # one means "the author changed what it says", so only this one is shown.
    edited_at = Column(TIMESTAMP, nullable=True)

    author = relationship("User", foreign_keys=[author_id])
    shared_from = relationship("CommunityPost", remote_side=[id])


class PostTag(Base):
    """Tags on a post, drawn from the same vocabulary as user interests."""

    __tablename__ = "post_tags"
    __table_args__ = (
        # The ranking join runs tag_id -> posts, the opposite direction to the
        # primary key, so it needs its own index.
        Index("ix_post_tag_tag", "tag_id"),
    )

    post_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id = Column(
        Integer, ForeignKey("community_tags.id", ondelete="CASCADE"), primary_key=True
    )

    tag = relationship("CommunityTag", lazy="joined")


class PostLike(Base):
    """One like per user per post."""

    __tablename__ = "post_likes"
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_like"),
        # "which of these posts have I liked" for a whole feed page at once.
        Index("ix_post_like_user", "user_id"),
    )

    post_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))


class PostComment(Base):
    """A comment, or a reply to one.

    Replies are capped at a single level in the API: ``parent_id`` may only point
    at a top-level comment. Arbitrary nesting is a rendering and moderation
    problem well out of proportion to its value on a feed of this kind.
    """

    __tablename__ = "post_comments"
    __table_args__ = (
        Index(
            "ix_comment_post_created",
            "post_id",
            "created_at",
            postgresql_where=text("is_removed = false"),
        ),
        Index(
            "ix_comment_parent",
            "parent_id",
            postgresql_where=text("parent_id IS NOT NULL"),
        ),
    )

    id = Column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    post_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    parent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("post_comments.id", ondelete="CASCADE"),
        nullable=True,
    )

    body = Column(TEXT, nullable=False)

    is_removed = Column(Boolean, nullable=False, server_default=text("false"))
    removed_at = Column(TIMESTAMP, nullable=True)
    removed_by = Column(
        String(10), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))
    edited_at = Column(TIMESTAMP, nullable=True)

    author = relationship("User", foreign_keys=[author_id])
