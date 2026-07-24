import asyncio
import sys
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.role import Role, UserRole
from sqlalchemy import select
from uuid import uuid4

async def test_query():
    async with AsyncSessionLocal() as db:
        print("--- TESTING ROLE QUERY ---")
        
        # 1. Ensure we have a Superadmin user setup for testing
        # Find or create a user
        email = "query_test@example.com"
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if not user:
            print(f"Creating test user {email}")
            user = User(full_name="Query Test", email=email, password_hash="hash", phone="9999999999")
            db.add(user)
            await db.commit()
            await db.refresh(user)

        # 2. Assign SUPERADMIN role
        result = await db.execute(select(Role).where(Role.role_key == "SUPERADMIN"))
        role = result.scalars().first()
        if not role:
            print("Creating SUPERADMIN role")
            role = Role(role_key="SUPERADMIN", role_name="Super Admin")
            db.add(role)
            await db.commit()
            await db.refresh(role)
            
        # Check link
        result = await db.execute(select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role.id))
        ur = result.scalars().first()
        if not ur:
            print("Linking User to Role")
            ur = UserRole(user_id=user.id, role_id=role.id)
            db.add(ur)
            await db.commit()
            
        # 3. RUN THE PROBLEMATIC QUERY
        print("Running query: select(Role).join(UserRole).where(UserRole.user_id == user.id)")
        try:
            stmt = select(Role).join(UserRole).where(UserRole.user_id == user.id)
            result = await db.execute(stmt)
            roles = result.scalars().all()
            print(f"Roles found: {[r.role_key for r in roles]}")
        except Exception as e:
            print(f"QUERY FAILED: {e}")
            
        # 4. RUN THE FIXED QUERY
        print("Running fixed query: select(Role).join(UserRole, Role.id == UserRole.role_id).where(...)")
        try:
            stmt = select(Role).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == user.id)
            result = await db.execute(stmt)
            roles = result.scalars().all()
            print(f"Roles found (Fixed): {[r.role_key for r in roles]}")
        except Exception as e:
            print(f"FIXED QUERY FAILED: {e}")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_query())
