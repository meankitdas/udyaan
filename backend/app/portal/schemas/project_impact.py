import math
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.portal.models.project_impact import ImpactStage


def _finite(value: Optional[float]) -> Optional[float]:
    """Reject NaN/inf, which would poison every downstream roll-up."""
    if value is None:
        return None
    if math.isnan(value) or math.isinf(value):
        raise ValueError("Metric values must be finite numbers.")
    return value


class ImpactEntryBase(BaseModel):
    stage: ImpactStage
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    metric_name: Optional[str] = Field(default=None, max_length=120)
    metric_unit: Optional[str] = Field(default=None, max_length=40)
    baseline_value: Optional[float] = None
    metric_value: Optional[float] = None
    target_value: Optional[float] = None

    @field_validator("baseline_value", "metric_value", "target_value")
    @classmethod
    def validate_numbers(cls, value: Optional[float]) -> Optional[float]:
        return _finite(value)


class ImpactEntryCreate(ImpactEntryBase):
    pass


class ImpactEntryUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    metric_name: Optional[str] = Field(default=None, max_length=120)
    metric_unit: Optional[str] = Field(default=None, max_length=40)
    baseline_value: Optional[float] = None
    metric_value: Optional[float] = None
    target_value: Optional[float] = None

    @field_validator("baseline_value", "metric_value", "target_value")
    @classmethod
    def validate_numbers(cls, value: Optional[float]) -> Optional[float]:
        return _finite(value)


class ImpactEntryResponse(ImpactEntryBase):
    id: UUID
    project_id: str
    recorded_by: str
    recorded_by_name: Optional[str] = None
    progress: Optional[float] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ImpactStageSummary(BaseModel):
    stage: ImpactStage
    entries: int
    measured: int
    average_progress: Optional[float] = None


class ImpactOverview(BaseModel):
    project_id: str
    stages: list[ImpactStageSummary]
    total_entries: int
    chain_completeness: float
    entries: list[ImpactEntryResponse]
