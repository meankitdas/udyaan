import asyncio
import sys
import os

sys.path.append(os.getcwd())

from app.database import AsyncSessionLocal
from app.models.role import Role, UserRole
from app.models.user import User
from app.crud.user import create_user
from app.schemas.auth import UserCreate
from sqlalchemy.future import select
from app.core.security import get_password_hash

async def main():
    async with AsyncSessionLocal() as db:
        print("Checking Roles...")
        # 1. Ensure Role Exists
        result = await db.execute(select(Role).where(Role.role_key == "SUPERADMIN"))
        role = result.scalars().first()
        if not role:
            print("Creating SUPERADMIN role...")
            role = Role(role_key="SUPERADMIN", role_name="Super Administrator")
            db.add(role)
            await db.commit()
            await db.refresh(role)
        else:
            print(f"Role SUPERADMIN exists (id: {role.id})")

        # 2. Ensure User Exists
        print("Checking User...")
        result = await db.execute(select(User).where(User.email == "superadmin@example.com"))
        user = result.scalars().first()
        
        if not user:
            print("Creating superadmin user...")
            hashed_pw = get_password_hash("password123")
            
            from app.utils.id_generator import generate_user_id
            new_id = generate_user_id("SUPERADMIN")
            
            user = User(
                id=new_id,
                email="superadmin@example.com",
                full_name="Super Admin",
                password_hash=hashed_pw,
                is_active=True,
                is_email_verified=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            print(f"User superadmin exists (id: {user.id})")
        
        # 3. Ensure UserRole Link
        print("Checking Link...")
        link_result = await db.execute(select(UserRole).where(
            UserRole.user_id == user.id,
            UserRole.role_id == role.id
        ))
        link = link_result.scalars().first()
        
        if not link:
            print("Linking user to role...")
            link = UserRole(user_id=user.id, role_id=role.id)
            db.add(link)
            await db.commit()
            print("Linked!")
        else:
            print("User is already linked to SUPERADMIN role.")

if __name__ == "__main__":
    asyncio.run(main())
