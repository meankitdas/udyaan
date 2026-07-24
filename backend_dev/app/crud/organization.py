from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.organization import Organization
from app.models.user import User
from app.models.role import Role, UserRole
from app.schemas.organization import OrganizationWithAdminCreate
from app.core.security import get_password_hash
from app.crud.user import get_user_by_email

async def create_organization_with_admin(db: AsyncSession, org_data: OrganizationWithAdminCreate, custom_id: str = None):
    # 1. Create Organization
    db_org = Organization(
        id=custom_id, # Use Custom ID
        name=org_data.name,
        email=org_data.email,
        phone=org_data.phone,
        address=org_data.address
    )
    db.add(db_org)
    await db.flush() # Get Org ID
    
    # 2. Check if Admin User exists
    existing_user = await get_user_by_email(db, org_data.admin_email)
    if existing_user:
        # What to do? 
        # Requirement: "creates admin profile". Implies new user.
        # If user exists, maybe fail? or link? 
        # Let's assume fail for now for safety.
        raise ValueError("Admin email already registered")

    # 3. Create Admin User
    hashed_password = get_password_hash(org_data.admin_password)
    
    from app.utils.id_generator import generate_user_id
    admin_id = generate_user_id("ADMIN")
    
    db_user = User(
        id=admin_id,
        email=org_data.admin_email,
        full_name=org_data.admin_name,
        password_hash=hashed_password,
        organization_id=custom_id if custom_id else db_org.id,
        is_active=True,
        is_email_verified=True, # Auto-verify admin created by superadmin? Yes, likely.
        is_approved=True # Auto-approve Admin created by Superadmin
    )
    db.add(db_user)
    await db.flush()
    
    # 4. Assign ADMIN Role
    role_result = await db.execute(select(Role).where(Role.role_key == "ADMIN"))
    role = role_result.scalars().first()
    if not role:
        raise ValueError("ADMIN role not found in system")
        
    user_role = UserRole(user_id=db_user.id, role_id=role.id)
    db.add(user_role)
    
    await db.commit()
    await db.refresh(db_org)
    await db.commit()
    await db.refresh(db_org)
    return db_org

async def create_organization(db: AsyncSession, org_data: OrganizationWithAdminCreate, custom_id: str = None):
    db_org = Organization(
        id=custom_id,
        name=org_data.name,
        email=org_data.email,
        phone=org_data.phone,
        address=org_data.address
    )
    db.add(db_org)
    await db.commit()
    await db.refresh(db_org)
    return db_org

async def get_organizations(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(select(Organization).offset(skip).limit(limit))
    return result.scalars().all()
