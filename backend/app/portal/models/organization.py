from sqlalchemy import Column, String, TEXT, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import UUID
from app.portal.models.base import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(12), primary_key=True) # Custom ID
    name = Column(String(150), nullable=False)
    email = Column(String(150)) # Contact email for the org
    phone = Column(String(20))
    address = Column(TEXT)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))
