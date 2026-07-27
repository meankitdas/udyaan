"""Project management tool integrations proposed for a project.

Teams run their delivery in external tools (Notion, Miro, Jira ...). Rather than
guessing where the work lives, each project keeps an explicit, reviewed list of
the workspaces it is integrated with.
"""

import enum

from sqlalchemy import TEXT, TIMESTAMP, Column, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.portal.models.base import Base


class ToolStatus(str, enum.Enum):
    PROPOSED = "Proposed"
    APPROVED = "Approved"
    DECLINED = "Declined"


class ProjectTool(Base):
    __tablename__ = "project_tools"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id = Column(String(14), ForeignKey("projects.id"), nullable=False)

    # Catalogue key (notion, miro, ...) plus the workspace this project uses.
    tool_key = Column(String(50), nullable=False)
    name = Column(String(150), nullable=False)
    url = Column(TEXT, nullable=True)
    purpose = Column(TEXT, nullable=True)

    status = Column(String(20), nullable=False, default=ToolStatus.PROPOSED.value)
    review_note = Column(TEXT, nullable=True)

    proposed_by = Column(String(10), ForeignKey("users.id"), nullable=False)
    decided_by = Column(String(10), ForeignKey("users.id"), nullable=True)

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))

    project = relationship("Project")
    proposer = relationship("User", foreign_keys=[proposed_by])
    reviewer = relationship("User", foreign_keys=[decided_by])
