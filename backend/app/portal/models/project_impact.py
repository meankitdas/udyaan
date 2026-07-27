"""Results chain for a project: inputs -> process -> outputs -> outcomes -> impact.

Udyaan projects are judged on more than delivery. This table records the whole
logic model in one place so a project's invested resources, activities, tangible
deliverables, measured changes, and long-term effect can be read from a single
dashboard instead of being scattered across reports.
"""

import enum

from sqlalchemy import TEXT, TIMESTAMP, Column, Float, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.portal.models.base import Base


class ImpactStage(str, enum.Enum):
    INPUTS = "inputs"
    PROCESS = "process"
    OUTPUTS = "outputs"
    OUTCOMES = "outcomes"
    IMPACT = "impact"


class ProjectImpactEntry(Base):
    __tablename__ = "project_impact_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id = Column(String(14), ForeignKey("projects.id"), nullable=False)

    stage = Column(String(20), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(TEXT, nullable=True)

    # Optional measurement. Narrative-only entries (common for impact) leave these null.
    metric_name = Column(String(120), nullable=True)
    metric_unit = Column(String(40), nullable=True)
    baseline_value = Column(Float, nullable=True)
    metric_value = Column(Float, nullable=True)
    target_value = Column(Float, nullable=True)

    recorded_by = Column(String(10), ForeignKey("users.id"), nullable=False)

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))

    project = relationship("Project")
    recorder = relationship("User", foreign_keys=[recorded_by])
