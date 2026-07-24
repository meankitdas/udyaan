from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from app.portal.models.project_compliance import UrgencyLevel, ActionStatus

# --- Meeting Schemas ---
class MeetingBase(BaseModel):
    title: str
    meeting_date: datetime
    agenda: Optional[str] = None
    attendees: Optional[str] = None

class MeetingCreate(MeetingBase):
    pass

class MeetingUpdate(BaseModel):
    mom_content: Optional[str] = None
    agenda: Optional[str] = None
    attendees: Optional[str] = None

class MeetingResponse(MeetingBase):
    id: UUID
    project_id: UUID
    created_by: UUID
    mom_content: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# --- Action Item Schemas ---
class ActionItemBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: date
    urgency: UrgencyLevel = UrgencyLevel.MEDIUM

class ActionItemCreate(ActionItemBase):
    assigned_to: UUID # User ID of the student
    meeting_id: Optional[UUID] = None # Optional link to a meeting

class ActionItemUpdateStatus(BaseModel):
    status: ActionStatus

class ActionItemResponse(ActionItemBase):
    id: UUID
    project_id: UUID
    created_by: UUID
    assigned_to: UUID
    meeting_id: Optional[UUID] = None
    status: ActionStatus
    created_at: datetime

    class Config:
        from_attributes = True
