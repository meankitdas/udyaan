from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.portal.database import get_db
from app.portal.core.roles import ADMIN_ROLES, PLATFORM_ROLES
from app.portal.models.user import User
from app.portal.models.role import Role, UserRole
from app.portal.api.auth import get_current_user
from uuid import UUID
from typing import List
from app.portal.schemas.auth import UserResponse

router = APIRouter(prefix="/admin", tags=["admin"])

async def get_org_admin(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Check if user is ADMIN and has Organization
    # 1. Check Role
    result = await db.execute(
        select(Role).join(UserRole).where(UserRole.user_id == current_user.id)
    )
    roles = result.scalars().all()
    role_keys = [r.role_key for r in roles]
    
    if not (ADMIN_ROLES & set(role_keys)):
         raise HTTPException(status_code=403, detail="Not authorized")
         
    if not current_user.organization_id and not (PLATFORM_ROLES & set(role_keys)):
        raise HTTPException(status_code=400, detail="Admin not associated with any organization")
        
    return current_user

@router.get("/approvals", response_model=List[UserResponse])
async def get_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_org_admin)
):
    query = (
        select(User, Role.role_key)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(User.is_approved == False)
    )
    
    # Filter by Org (Superadmin sees all? Or just focus on Org Admin for now)
    # User asked for: "once it select the org it should go to theirs admin only"
    if current_user.organization_id:
        query = query.where(User.organization_id == current_user.organization_id)
        
    result = await db.execute(query)
    
    users = []
    for user, role_key in result:
        user.role_key = role_key
        users.append(user)
        
    return users

@router.post("/approve/{user_id}")
async def approve_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_org_admin)
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Security: Ensure Admin owns this user
    if current_user.organization_id and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cannot approve user from another organization")
        
    user.is_approved = True
    await db.commit()
    return {"message": "User approved successfully"}

@router.post("/reject/{user_id}")
async def reject_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_org_admin)
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.organization_id and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cannot reject user from another organization")
        
    # Delete the user allowing them to sign up again
    # We might need to delete related data (UserRole, EmailVerification) - Cascade should handle it
    await db.delete(user)
    await db.commit()
    return {"message": "User rejected and removed"}
