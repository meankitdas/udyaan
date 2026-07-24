from sqlalchemy import Column, String, TEXT, TIMESTAMP, text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.portal.models.base import Base

class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, server_default=text("gen_random_uuid()")) # Keeping UUID for Reports sub-table ID or change? Let's use standard UUID string or keep db gen. Since no specific request for report ID, keeping as UUID string.
    title = Column(String(255), nullable=False)
    content = Column(TEXT, nullable=False)
    
    project_id = Column(String(14), ForeignKey("projects.id"), nullable=False)
    submitted_by = Column(String(10), ForeignKey("users.id"), nullable=False)
    submitted_to = Column(String(10), ForeignKey("users.id"), nullable=False)
    
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
