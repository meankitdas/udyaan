"""Schemas for the Digital Maturity Index."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class DimensionResult(BaseModel):
    key: str
    label: str
    weight: float
    applicable: bool
    score: Optional[float] = None
    level: Optional[int] = None
    level_label: Optional[str] = None
    signals: dict[str, Any] = {}


class MaturityResult(BaseModel):
    organization_id: str
    organization_name: Optional[str] = None
    framework_version: str
    composite_score: float
    level: int
    level_label: str
    level_description: str
    # Share of the framework's weight the org currently has evidence for.
    coverage: float
    dimensions: list[DimensionResult]
    evidence: dict[str, Any] = {}
    generated_at: datetime


class SnapshotResponse(BaseModel):
    id: UUID
    organization_id: str
    framework_version: str
    composite_score: float
    level: int
    dimensions: list[DimensionResult]
    captured_by: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BenchmarkRow(BaseModel):
    organization_id: str
    organization_name: Optional[str] = None
    composite_score: float
    level: int
    coverage: float


class DimensionBenchmark(BaseModel):
    key: str
    label: str
    cohort_average: Optional[float] = None
    organizations_scored: int


class Benchmark(BaseModel):
    """Where one organisation sits against everyone scored on the same version."""

    framework_version: str
    organizations: int
    cohort_average: Optional[float] = None
    your_score: Optional[float] = None
    your_percentile: Optional[float] = None
    dimensions: list[DimensionBenchmark]
    leaderboard: list[BenchmarkRow]
