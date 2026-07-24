from sqlalchemy import Column, String, TEXT, TIMESTAMP, text, ForeignKey, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.portal.models.base import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(14), primary_key=True) # PR + Timestamp (14 chars)
    title = Column(String(255), nullable=False)
    category = Column(String(100))
    description = Column(TEXT)
    project_type = Column(String(100)) # e.g. Prototype
    target_assignee = Column(TEXT) # e.g. "uuid1,uuid2"
    required_skills = Column(TEXT)
    duration = Column(String(50))
    deliverables = Column(TEXT)
    deadline = Column(Date)
    status = Column(String(50), default="Draft") # Draft, Assigned, In Progress, Completed, Archived
    
    created_by = Column(String(10), ForeignKey("users.id"))
    organization_id = Column(String(12), ForeignKey("organizations.id"))
    
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

    # Relationships
    meetings = relationship("ProjectMeeting", back_populates="project")
    action_items = relationship("ActionItem", back_populates="project")
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))
