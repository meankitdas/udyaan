from sqlalchemy import Column, String, Boolean, TIMESTAMP, TEXT, text, ForeignKey, Date, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.portal.models.base import Base
import enum

class UrgencyLevel(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class ActionStatus(str, enum.Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"

class ProjectMeeting(Base):
    __tablename__ = "project_meetings"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id = Column(String(14), ForeignKey("projects.id"), nullable=False)
    created_by = Column(String(10), ForeignKey("users.id"), nullable=False)
    
    title = Column(String(255), nullable=False)
    meeting_date = Column(TIMESTAMP, nullable=False)
    agenda = Column(TEXT, nullable=True)
    mom_content = Column(TEXT, nullable=True) # Minutes of Meeting
    attendees = Column(TEXT, nullable=True) # JSON or Comma-separated string
    
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationships
    project = relationship("Project", back_populates="meetings")
    creator = relationship("User", foreign_keys=[created_by])
    action_items = relationship("ActionItem", back_populates="meeting")


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id = Column(String(14), ForeignKey("projects.id"), nullable=False)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("project_meetings.id"), nullable=True) # Optional link to a meeting
    
    created_by = Column(String(10), ForeignKey("users.id"), nullable=False)
    assigned_to = Column(String(10), ForeignKey("users.id"), nullable=False)
    
    title = Column(String(255), nullable=False)
    description = Column(TEXT, nullable=True)
    due_date = Column(Date, nullable=False)
    
    urgency = Column(String(50), nullable=False, default=UrgencyLevel.MEDIUM) # Stored as string but enforced via Enum in Pydantic/App
    status = Column(String(50), nullable=False, default=ActionStatus.PENDING)

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))

    # Relationships
    project = relationship("Project", back_populates="action_items")
    meeting = relationship("ProjectMeeting", back_populates="action_items")
    creator = relationship("User", foreign_keys=[created_by])
    assignee = relationship("User", foreign_keys=[assigned_to])
