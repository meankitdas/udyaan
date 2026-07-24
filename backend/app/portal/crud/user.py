from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import join
from app.portal.models.user import User
from app.portal.models.role import Role, UserRole
from app.portal.schemas.auth import UserCreate
from app.portal.core.security import get_password_hash
from app.portal.core.security import get_password_hash
from uuid import uuid4, UUID

async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(User).where(User.email == email))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: UserCreate, role_key: str, is_email_verified: bool = False):
    # 1. Create User
    hashed_password = get_password_hash(user.password)
    
    from app.portal.utils.id_generator import generate_user_id
    new_id = generate_user_id(role_key)
    
    db_user = User(
        id=new_id,
        email=user.email,
        full_name=user.full_name,
        password_hash=hashed_password,
        phone=user.phone,
        organization_id=user.organization_id,
        is_active=True,
        is_email_verified=is_email_verified,
        is_approved=True if role_key not in ['STUDENT', 'FACULTY'] else False # Auto-approve admins/project heads? Or restrict them too? Assuming auto for now or handled by superadmin creation script.
    )
    db.add(db_user)
    await db.flush() # Get ID
    
    # 2. Assign Role
    # Find role ID
    role_result = await db.execute(select(Role).where(Role.role_key == role_key))
    role = role_result.scalars().first()
    
    if role:
        user_role = UserRole(user_id=db_user.id, role_id=role.id)
        db.add(user_role)
    
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def get_users_by_role_key(db: AsyncSession, role_key: str, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(User)
        .join(UserRole)
        .join(Role)
        .where(Role.role_key == role_key)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

async def get_users_by_organization(db: AsyncSession, organization_id: UUID, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(User, Role.role_key)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(User.organization_id == organization_id)
        .offset(skip)
        .limit(limit)
    )
    
    users = []
    for user, role_key in result:
        user.role_key = role_key
        users.append(user)
        
    return users

