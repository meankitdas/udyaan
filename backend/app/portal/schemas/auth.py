from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str
    role_key: str  # STUDENT or FACULTY
    phone: Optional[str] = None
    organization_id: str

class UserResponse(UserBase):
    id: str
    phone: Optional[str] = None
    organization_id: Optional[str] = None
    role_key: Optional[str] = None
    is_active: Optional[bool] = True
    is_email_verified: Optional[bool] = False
    is_approved: Optional[bool] = None
    skills: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EmailVerificationRequest(BaseModel):
    token: str

class OTPVerificationRequest(BaseModel):
    email: EmailStr
    otp: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class LoginResponse(Token):
    role_key: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    organization_id: Optional[str] = None
    skills: Optional[str] = None
