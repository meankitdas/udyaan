from pydantic import BaseModel, Field, validator
from typing import Optional
from uuid import UUID
from datetime import date, datetime

class ProjectBase(BaseModel):
    title: str = Field(..., max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    project_type: Optional[str] = Field(None, max_length=100)
    target_assignee: Optional[str] = None
    required_skills: Optional[str] = None
    duration: Optional[str] = Field(None, max_length=50)
    deliverables: Optional[str] = None
    deadline: Optional[date] = None
    status: Optional[str] = "Draft"

    @validator('status')
    def validate_status(cls, v):
        allowed = ["Draft", "Assigned", "In Progress", "Completed", "Archived"]
        if v not in allowed:
            raise ValueError(f"Status must be one of {allowed}")
        return v

class ProjectCreate(ProjectBase):
    pass

class AssigneeInfo(BaseModel):
    id: str
    full_name: str
    email: str

class ProjectResponse(ProjectBase):
    id: str
    created_by: str
    organization_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # New Field
    assignees_details: Optional[list[AssigneeInfo]] = []

    class Config:
        from_attributes = True

class ProjectWithDetails(ProjectResponse):
    created_by_name: Optional[str] = None
    assignee_name: Optional[str] = None
