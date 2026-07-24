from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

class ReportBase(BaseModel):
    title: str = Field(..., max_length=255)
    content: str
    project_id: str

class StudentReportCreate(ReportBase):
    faculty_id: str

class FacultyReportCreate(ReportBase):
    project_head_id: str

class ReportResponse(ReportBase):
    id: str
    submitted_by: str
    submitted_to: str
    created_at: datetime

    class Config:
        from_attributes = True
