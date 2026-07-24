import asyncio
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.role import Role, UserRole
from app.core.security import get_password_hash
from sqlalchemy.future import select

async def setup_custom_superadmin():
    email = "apkumawat8437@gmail.com"
    password = "Akumawat8437@"
    
    async with AsyncSessionLocal() as db:
        print(f"Checking for user: {email}")
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        hashed_pw = get_password_hash(password)
        
        if user:
            print("User exists. Updating password...")
            user.password_hash = hashed_pw
            user.is_approved = True # Ensure approved
            user.is_active = True
            await db.commit()
            print("User updated.")
        else:
            print("User does not exist. Creating...")
            from app.utils.id_generator import generate_user_id
            new_id = generate_user_id("SUPERADMIN")
            
            user = User(
                id=new_id,
                email=email,
                full_name="Arvind Superadmin",
                password_hash=hashed_pw,
                is_active=True,
                is_email_verified=True,
                is_approved=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print("User created.")
            
        # Ensure Superadmin Role
        print("Checking Role...")
        role_res = await db.execute(select(Role).where(Role.role_key == "SUPERADMIN"))
        role = role_res.scalars().first()
        
        if not role:
             print("Creating Role...")
             role = Role(role_key="SUPERADMIN", role_name="Super Administrator")
             db.add(role)
             await db.commit()
             await db.refresh(role)
             
        # Link Role
        link_res = await db.execute(select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == role.id))
        link = link_res.scalars().first()
        
        if not link:
            print("Linking Role...")
            link = UserRole(user_id=user.id, role_id=role.id)
            db.add(link)
            await db.commit()
            print("Linked.")
        else:
            print("Already linked.")

if __name__ == "__main__":
    asyncio.run(setup_custom_superadmin())
