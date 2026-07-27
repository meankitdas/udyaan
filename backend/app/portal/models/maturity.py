"""Digital Maturity Index snapshots.

The framework itself (dimensions, weights, level bands) lives in code and is
versioned, deliberately: every organisation is scored by the same ruler, which
is the only way a benchmark across organisations means anything. Per-org
tailoring happens by marking a dimension not-applicable, never by re-weighting,
because re-weighting would let an org score well by discounting what it is bad at.

Dimension results are stored as JSON rather than as a fixed child table so a
future framework version can change its dimensions without a migration and
without invalidating history captured under the old version.
"""

from sqlalchemy import TIMESTAMP, Column, Float, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.portal.models.base import Base


class MaturityAssessment(Base):
    __tablename__ = "maturity_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(String(12), ForeignKey("organizations.id"), nullable=False, index=True)

    framework_version = Column(String(20), nullable=False)
    composite_score = Column(Float, nullable=False)
    level = Column(Integer, nullable=False)

    # [{key, label, score, level, weight, applicable, signals: {...}}]
    dimensions = Column(JSONB, nullable=False)
    # The raw counts the scores were derived from, kept so an old snapshot can
    # still be explained after the underlying records have moved on.
    evidence = Column(JSONB, nullable=False)

    captured_by = Column(String(10), ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

    organization = relationship("Organization")
    capturer = relationship("User", foreign_keys=[captured_by])
