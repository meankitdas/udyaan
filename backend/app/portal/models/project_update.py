"""Weekly status records for a project.

Udyaan reviews run on a weekly cadence, so a project's history is stored as one
row per ISO week rather than as free-form posts. Keying on the Monday of the week
(`period_start`) makes "did this project report in week N?" a lookup instead of a
date-range scan, and the unique constraint stops two people filing competing
records for the same week.

Live dashboard numbers are derived from the other tables at read time; this table
only holds what a human explicitly reported for a period.
"""

import enum

from sqlalchemy import (
    TEXT,
    TIMESTAMP,
    Column,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.portal.models.base import Base


class UpdateStatus(str, enum.Enum):
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    BLOCKED = "blocked"
    COMPLETED = "completed"


class ProjectWeeklyUpdate(Base):
    __tablename__ = "project_weekly_updates"
    __table_args__ = (
        # One authoritative record per project per week.
        UniqueConstraint("project_id", "period_start", name="uq_weekly_update_project_period"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id = Column(String(14), ForeignKey("projects.id"), nullable=False, index=True)

    # Monday of the reported week. Snapped server-side so clients can send any
    # day inside the week and still land on the same row.
    period_start = Column(Date, nullable=False, index=True)
    iso_year = Column(Integer, nullable=False)
    iso_week = Column(Integer, nullable=False)

    status = Column(String(20), nullable=False, default=UpdateStatus.ON_TRACK.value)
    headline = Column(String(200), nullable=False)
    progress_note = Column(TEXT, nullable=True)
    blockers = Column(TEXT, nullable=True)
    next_steps = Column(TEXT, nullable=True)

    # Self-reported completion for the project as a whole at the end of this week.
    completion_percent = Column(Float, nullable=True)

    submitted_by = Column(String(10), ForeignKey("users.id"), nullable=False)

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))

    project = relationship("Project")
    submitter = relationship("User", foreign_keys=[submitted_by])
