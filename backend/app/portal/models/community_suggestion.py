"""Personalization state: which suggestions a user has already rejected.

Suggestions are computed, not stored -- "people you may know" is a query over
connections, tags and cohorts that re-runs on every request. That is the right
default (it stays fresh as the graph changes) but it has one failure mode: a
person the viewer has deliberately declined keeps reappearing, because nothing
about the graph changed when they dismissed it.

This table is the small piece of state that makes an otherwise stateless
recommender feel like it listens. It records only rejections, never acceptances,
because acceptance already shows up in the graph as a connection or follow.
"""

from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    String,
    TIMESTAMP,
    text,
)

from app.portal.models.base import Base


class SuggestionDismissal(Base):
    """A viewer's "not interested" against one suggested person.

    Permanent by design. A dismissal that expired after some interval would
    resurface exactly the people the viewer has already told us to stop showing,
    and the cost of honouring it forever is one narrow row per rejection.
    """

    __tablename__ = "community_suggestion_dismissals"
    __table_args__ = (
        CheckConstraint("user_id <> dismissed_user_id", name="ck_dismissal_not_self"),
        Index("ix_dismissal_user", "user_id"),
    )

    user_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    dismissed_user_id = Column(
        String(10), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
