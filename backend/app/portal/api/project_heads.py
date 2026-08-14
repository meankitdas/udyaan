from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.portal.database import get_db
from app.portal.core.roles import PLATFORM_ROLES
from app.portal.schemas.auth import UserCreate, UserResponse
from app.portal.crud.user import create_user, get_user_by_email
from app.portal.models.user import User
from app.portal.models.role import UserRole, Role
from sqlalchemy.future import select
from jose import jwt, JWTError
from app.portal.config import settings
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

router = APIRouter(prefix="/project-heads", tags=["project-heads"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="portal/auth/login")

from app.portal.core.deps import get_current_user  # noqa: E402,F401

async def get_current_superadmin(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Role).join(UserRole).where(UserRole.user_id == current_user.id)
    )
    roles = result.scalars().all()
    role_keys = [r.role_key for r in roles]

    if not (PLATFORM_ROLES & set(role_keys)):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

class ProjectHeadCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    organization_id: str

@router.post("", response_model=UserResponse)
async def create_project_head(
    user_data: ProjectHeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    # Check if exists
    db_user = await get_user_by_email(db, email=user_data.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_create = UserCreate(
        email=user_data.email,
        full_name=user_data.full_name,
        password=user_data.password,
        phone=user_data.phone,
        role_key="PROJECT_HEAD",
        organization_id=user_data.organization_id 
    )
    
    try:
        # Fetch organization name for email
        from app.portal.models.organization import Organization
        org_result = await db.execute(select(Organization).where(Organization.id == user_data.organization_id))
        org = org_result.scalars().first()
        org_name = org.name if org else user_data.organization_id

        new_user = await create_user(db, user_create, role_key="PROJECT_HEAD", is_email_verified=True)
        
        # Send Welcome Email
        from app.portal.utils.email import send_email
        subject = f"Welcome to Udyaan Pvt Ltd - Project Head Account Created for {org_name}"
        
        # Plain text version
        body = f"""
        Hello {user_data.full_name},

        A Project Head account has been created for you on Udyaan Pvt Ltd for organization {org_name}.

        Login Credentials:
        Email: {user_data.email}
        Password: {user_data.password}

        Please login and change your password immediately.
        """
        
        # Professional HTML template
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .container {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; color: #333; }}
                .header {{ text-align: center; padding-bottom: 20px; border-bottom: 2px solid #007bff; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #007bff; text-decoration: none; }}
                .content {{ padding: 30px 0; line-height: 1.6; }}
                .credentials-box {{ background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 20px; border-radius: 5px; margin: 20px 0; }}
                .button-container {{ text-align: center; margin: 30px 0; }}
                .button {{ background-color: #007bff; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; }}
                .footer {{ font-size: 12px; color: #777; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <a href="https://udyaan.org" class="logo">Udyaan Pvt Ltd</a>
                </div>
                <div class="content">
                    <h3>Welcome aboard!</h3>
                    <p>Hello <strong>{user_data.full_name}</strong>,</p>
                    <p>A Project Head account has been created for you on Udyaan Pvt Ltd for <strong>{org_name}</strong>.</p>
                    
                    <div class="credentials-box">
                        <strong>Login Credentials:</strong><br>
                        Email: {user_data.email}<br>
                        Password: {user_data.password}
                    </div>
                    
                    <div class="button-container">
                        <a href="{settings.FRONTEND_URL}/login" class="button">Login Now</a>
                    </div>
                    
                    <p>Please login and change your password immediately for security reasons.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2026 Udyaan Pvt Ltd. All rights reserved.</p>
                    <p>Contact us: <a href="mailto:info@udyaan.org">info@udyaan.org</a></p>
                </div>
            </div>
        </body>
        </html>
        """
        send_email(user_data.email, subject, body, html_content=html_content)
        
        return new_user
    except Exception as e:
        import traceback
        traceback.print_exc()
        with open("ph_error.txt", "w") as f:
            f.write(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("", response_model=list[UserResponse])
async def get_project_heads(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    from app.portal.crud.user import get_users_by_role_key
    users = await get_users_by_role_key(db, role_key="PROJECT_HEAD", skip=skip, limit=limit)
    return users

@router.delete("/{user_id}")
async def delete_project_head(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    # Check if user exists
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Strictly check if they are Project Head? 
    # Or just allow delete if Superadmin?
    # Let's just delete using DB session
    await db.delete(user)
    await db.commit()
    
    return {"message": "Project Head deleted successfully"}
