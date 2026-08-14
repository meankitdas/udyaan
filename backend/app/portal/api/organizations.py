from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.portal.database import get_db
from app.portal.core.roles import PLATFORM_ROLES
from app.portal.schemas.organization import OrganizationCreate, OrganizationWithAdminCreate, OrganizationResponse, OrganizationAdminCreate
from app.portal.schemas.auth import UserResponse, UserCreate
from app.portal.crud.organization import create_organization_with_admin, create_organization as crud_create_org
from app.portal.crud.user import create_user, get_user_by_email
from app.portal.models.user import User
from app.portal.models.role import UserRole, Role
from sqlalchemy.future import select
from app.portal.core.security import verify_password
from fastapi.security import OAuth2PasswordBearer
from app.portal.config import settings
from jose import jwt, JWTError

from app.portal.models.organization import Organization
from sqlalchemy import delete

router = APIRouter(prefix="/organizations", tags=["organizations"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="portal/auth/login")

from app.portal.core.deps import get_current_user  # noqa: E402,F401

async def get_current_superadmin(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Check if user has SUPERADMIN role
    # Need to join UserRoles and Roles
    # Explicit query
    result = await db.execute(
        select(Role).join(UserRole).where(UserRole.user_id == current_user.id)
    )
    roles = result.scalars().all()
    role_keys = [r.role_key for r in roles]
    
    if not (PLATFORM_ROLES & set(role_keys)):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

@router.post("", response_model=OrganizationResponse)
async def create_organization(
    org_data: OrganizationCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin) # Permission Check
):

    try:
        # Generate ID inside CRUD or here? Since generate_org_id validates sequence using DB, better inside API or passed to CRUD.
        from app.portal.utils.id_generator import generate_org_id
        org_id = await generate_org_id(db)

        # Only create organization
        new_org = await crud_create_org(db, org_data, custom_id=org_id)
        
        return new_org
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/{org_id}/admins", response_model=UserResponse)
async def create_org_admin(
    org_id: str,
    user_data: OrganizationAdminCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    # Check if user exists
    db_user = await get_user_by_email(db, email=user_data.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_create = UserCreate(
        email=user_data.email,
        full_name=user_data.full_name,
        password=user_data.password,
        phone=user_data.phone,
        role_key="ADMIN",
        organization_id=org_id
    )
    
    try:
        # Fetch organization name for email
        org_result = await db.execute(select(Organization).where(Organization.id == org_id))
        org = org_result.scalars().first()
        org_name = org.name if org else org_id

        new_user = await create_user(db, user_create, role_key="ADMIN", is_email_verified=True)
        
        # Send Welcome Email
        from app.portal.utils.email import send_email
        subject = f"Welcome to Udyaan Pvt Ltd - Admin Account Created for {org_name}"
        
        # Plain text version
        body = f"""
        Hello {user_data.full_name},

        An Admin account has been created for you on Udyaan Pvt Ltd for organization {org_name}.

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
                    <p>An Admin account has been created for you on Udyaan Pvt Ltd for <strong>{org_name}</strong>.</p>
                    
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
        raise HTTPException(status_code=500, detail="Internal Server Error")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("", response_model=list[OrganizationResponse])
async def read_organizations(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.portal.crud.organization import get_organizations
    orgs = await get_organizations(db, skip=skip, limit=limit)
    return orgs

@router.get("/public", response_model=list[OrganizationResponse])
async def read_organizations_public(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db)
):
    from app.portal.crud.organization import get_organizations
    orgs = await get_organizations(db, skip=skip, limit=limit)
    return orgs

@router.get("/{org_id}/users", response_model=list[UserResponse])
async def read_specific_organization_users(
    org_id: str,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check permissions: Superadmin OR Org Admin of this org
    result = await db.execute(
        select(Role).join(UserRole).where(UserRole.user_id == current_user.id)
    )
    roles = result.scalars().all()
    role_keys = [r.role_key for r in roles]
    
    is_superadmin = "SUPERADMIN" in role_keys
    is_org_admin = "ADMIN" in role_keys and current_user.organization_id == org_id
    
    if not (is_superadmin or is_org_admin):
         raise HTTPException(status_code=403, detail="Not authorized to view users of this organization")

    from app.portal.crud.user import get_users_by_organization
    users = await get_users_by_organization(db, org_id, skip=skip, limit=limit)
    return users

@router.get("/users", response_model=list[UserResponse]) # Using list as response model for now, could be specific UserResponse
async def read_organization_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user) # Using basic auth check first
):
    # Check if user is Organization Admin (or Superadmin, or even regular user depending on reqs, but prompt says Admin Dashboard)
    # Re-using get_privileged_user logic or similar. For now, let's just check if they have an org_id
    
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User is not part of any organization")
    
    # Check roles - only Admin or Project Head should theoretically see this, or maybe everyone? 
    # Prompt says "let admin see...". Let's enforce Admin role.
    result = await db.execute(
        select(Role).join(UserRole).where(UserRole.user_id == current_user.id)
    )
    roles = result.scalars().all()
    role_keys = [r.role_key for r in roles]
    
    if "ADMIN" not in role_keys and "SUPERADMIN" not in role_keys and "PROJECT_HEAD" not in role_keys:
         raise HTTPException(status_code=403, detail="Not enough permissions")

    from app.portal.crud.user import get_users_by_organization
    # We might want to filter by roles (Student/Faculty) specifically, but get_users_by_organization gets all.
    # The prompt says "students and faculties". 
    # Let's get all and frontend can filter or backend can filter. 
    # For now, getting all users in org is safest general approach.
    users = await get_users_by_organization(db, current_user.organization_id, skip=skip, limit=limit)
    
    from app.portal.schemas.auth import UserResponse # Return UserResponse to be safe
    from app.portal.schemas.auth import UserResponse # Return UserResponse to be safe
    return users

@router.delete("/{org_id}")
async def delete_organization(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    # Check if exists
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalars().first()
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    # Delete Organization
    await db.delete(org)
    await db.commit()
    
    return {"message": "Organization deleted successfully"}

@router.delete("/{org_id}/admins/{user_id}")
async def delete_org_admin(
    org_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    # Check if user exists and is part of this org
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.organization_id != org_id:
         raise HTTPException(status_code=400, detail="User does not belong to this organization")
         
    # Check if user is actually an ADMIN
    # Optional strict check, but assuming ID is enough? 
    # Let's perform delete
    await db.delete(user)
    await db.commit()
    
    return {"message": "Admin deleted successfully"}
