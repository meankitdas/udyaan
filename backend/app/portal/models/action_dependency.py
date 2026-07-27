"""Directed dependency edges between action items.

`action_id` cannot start until `depends_on_id` is complete. Keeping the graph in
its own table is additive (no action-item migration) and supports many-to-many
dependencies without serialising IDs into a text column.
"""

from sqlalchemy import TIMESTAMP, Column, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.portal.models.base import Base


class ActionDependency(Base):
    __tablename__ = "action_dependencies"
    __table_args__ = (
        UniqueConstraint("action_id", "depends_on_id", name="uq_action_dependency_edge"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    action_id = Column(UUID(as_uuid=True), ForeignKey("action_items.id", ondelete="CASCADE"), nullable=False, index=True)
    depends_on_id = Column(UUID(as_uuid=True), ForeignKey("action_items.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(String(10), ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

    action = relationship("ActionItem", foreign_keys=[action_id])
    prerequisite = relationship("ActionItem", foreign_keys=[depends_on_id])
