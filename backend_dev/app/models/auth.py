from sqlalchemy import Column, String, ForeignKey, TIMESTAMP, TEXT, text
from sqlalchemy.dialects.postgresql import UUID, INET
from app.models.base import Base

class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(String(10), ForeignKey("users.id", ondelete="CASCADE"))
    token = Column(TEXT, unique=True, nullable=False)
    expires_at = Column(TIMESTAMP, nullable=False)
    verified_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(String(10), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash = Column(TEXT, nullable=False)
    device_id = Column(String(100))
    ip_address = Column(INET)
    user_agent = Column(TEXT)
    expires_at = Column(TIMESTAMP, nullable=False)
    revoked_at = Column(TIMESTAMP)
    rotated_from = Column(UUID(as_uuid=True), ForeignKey("refresh_tokens.id"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))

class LoginSession(Base):
    __tablename__ = "login_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(String(10), ForeignKey("users.id", ondelete="CASCADE"))
    refresh_token_id = Column(UUID(as_uuid=True), ForeignKey("refresh_tokens.id"))
    ip_address = Column(INET)
    user_agent = Column(TEXT)
    logged_in_at = Column(TIMESTAMP, server_default=text("NOW()"))
    logged_out_at = Column(TIMESTAMP)

class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(String(10), ForeignKey("users.id", ondelete="CASCADE"))
    token = Column(TEXT, unique=True, nullable=False)
    expires_at = Column(TIMESTAMP, nullable=False)
    used_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
