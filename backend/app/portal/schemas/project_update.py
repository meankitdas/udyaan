"""Schemas for weekly project records and the dashboard that reads them."""

import math
from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.portal.models.project_update import UpdateStatus


def _percent(value: Optional[float]) -> Optional[float]:
    """Completion is a percentage: reject NaN/inf and anything outside 0-100."""
    if value is None:
        return None
    if math.isnan(value) or math.isinf(value):
        raise ValueError("Completion must be a finite number.")
    if value < 0 or value > 100:
        raise ValueError("Completion must be between 0 and 100.")
    return round(value, 1)


class WeeklyUpdateBase(BaseModel):
    status: UpdateStatus = UpdateStatus.ON_TRACK
    headline: str = Field(min_length=1, max_length=200)
    progress_note: Optional[str] = Field(default=None, max_length=4000)
    blockers: Optional[str] = Field(default=None, max_length=4000)
    next_steps: Optional[str] = Field(default=None, max_length=4000)
    completion_percent: Optional[float] = None

    @field_validator("completion_percent")
    @classmethod
    def validate_completion(cls, value: Optional[float]) -> Optional[float]:
        return _percent(value)


class WeeklyUpdateCreate(WeeklyUpdateBase):
    # Any day inside the target week; the API snaps it to that week's Monday.
    # Omit to file against the current week.
    period_start: Optional[date] = None


class WeeklyUpdateUpdate(BaseModel):
    status: Optional[UpdateStatus] = None
    headline: Optional[str] = Field(default=None, min_length=1, max_length=200)
    progress_note: Optional[str] = Field(default=None, max_length=4000)
    blockers: Optional[str] = Field(default=None, max_length=4000)
    next_steps: Optional[str] = Field(default=None, max_length=4000)
    completion_percent: Optional[float] = None

    @field_validator("completion_percent")
    @classmethod
    def validate_completion(cls, value: Optional[float]) -> Optional[float]:
        return _percent(value)


class WeeklyUpdateResponse(WeeklyUpdateBase):
    id: UUID
    project_id: str
    period_start: date
    period_end: date
    iso_year: int
    iso_week: int
    label: str
    submitted_by: str
    submitted_by_name: Optional[str] = None
    submitted_late: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CadenceStatus(BaseModel):
    """How well the project is keeping to the weekly reporting rhythm."""

    period_start: date
    period_end: date
    label: str
    due_at: datetime
    reported: bool
    current: Optional[WeeklyUpdateResponse] = None
    streak_weeks: int
    weeks_tracked: int
    weeks_reported: int
    missed_weeks: List[str]
    on_time_rate: float


class LiveCounters(BaseModel):
    """Real-time activity, recomputed on every read."""

    meetings_total: int
    meetings_this_week: int
    actions_open: int
    actions_overdue: int
    actions_completed: int
    action_completion_rate: float
    impact_entries: int
    tools_connected: int


class ProjectPulse(BaseModel):
    project_id: str
    project_title: Optional[str] = None
    mode: str
    generated_at: datetime
    # Live mode reports "now"; weekly mode reports the close of the reported week.
    as_of: datetime
    stale: bool
    cadence: CadenceStatus
    counters: LiveCounters
    recent_updates: List[WeeklyUpdateResponse]


class DigestRow(BaseModel):
    project_id: str
    title: Optional[str] = None
    reported: bool
    status: Optional[UpdateStatus] = None
    headline: Optional[str] = None
    completion_percent: Optional[float] = None
    streak_weeks: int


class WeeklyDigest(BaseModel):
    """Org-wide view of a single week: who reported and who did not."""

    period_start: date
    period_end: date
    label: str
    projects_total: int
    projects_reported: int
    reporting_rate: float
    at_risk: int
    blocked: int
    rows: List[DigestRow]
