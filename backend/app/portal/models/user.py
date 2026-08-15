from sqlalchemy import Column, String, Boolean, TIMESTAMP, TEXT, text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.portal.models.base import Base

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
    skills = Column(TEXT, nullable=True)  # Comma-separated skills for community matching

    # ---- Community network profile (see models/community.py) ----
    avatar_url = Column(TEXT, nullable=True)
    headline = Column(String(160), nullable=True)
    bio = Column(TEXT, nullable=True)
    university = Column(String(150), nullable=True)
    cohort = Column(String(50), nullable=True)  # e.g. "2026" — used for cohort matching
    is_discoverable = Column(Boolean, server_default=text("TRUE"))

    # Live presence lives in Redis; this is only the fallback shown once the
    # presence key has expired ("last seen 2h ago").
    last_seen_at = Column(TIMESTAMP, nullable=True)

    # Opt-out for the notification digest. Unsubscribing must not require an
    # account setting page, so the digest carries a signed one-click link.
    email_digest_enabled = Column(Boolean, server_default=text("TRUE"))

    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))
    
    organization_id = Column(String(12), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
