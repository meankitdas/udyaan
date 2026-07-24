from sqlalchemy import Column, String, Boolean, TIMESTAMP, TEXT, text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(10), primary_key=True) # Custom ID from generate_user_id
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    phone = Column(String(15), unique=True)
    password_hash = Column(TEXT, nullable=False)
    is_email_verified = Column(Boolean, server_default=text("FALSE"))
    is_approved = Column(Boolean, server_default=text("FALSE"))
    is_active = Column(Boolean, server_default=text("TRUE"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))
    
    organization_id = Column(String(12), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
