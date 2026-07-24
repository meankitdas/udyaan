import asyncio
import sys
import os

sys.path.append(os.getcwd())

from app.database import AsyncSessionLocal
from app.crud.user import create_user
from app.models.auth import EmailVerification
from datetime import datetime, timedelta
from uuid import uuid4

async def main():
    async with AsyncSessionLocal() as db:
        print("Creating superadmin...")
        # Customize schema/user as needed
        from app.schemas.auth import UserCreate
        
        email = "superadmin@example.com"
        
        # Check if already exists to avoid error
        from app.crud.user import get_user_by_email
        existing = await get_user_by_email(db, email)
        if existing:
            print("Superadmin already exists")
            return

        user_in = UserCreate(email=email, password="password123", full_name="Super Admin", role_key="SUPERADMIN")
        # Note: create_user might need role_key passed explicitly if logic depends on it
        # The schema has role_key, but create_user function signature in previous view:
        # await create_user(db, user, user.role_key)
        
        try:
            u = await create_user(db, user_in, "SUPERADMIN")
            print("Created superadmin user!")
            
            # Verify email manually
            token = str(uuid4())
            verification = EmailVerification(
                 user_id=u.id,
                 token=token,
                 expires_at=datetime.utcnow() + timedelta(hours=24),
                 verified_at=datetime.utcnow() # Auto verify
            )
            db.add(verification)
            u.is_email_verified = True
            
            await db.commit()
            print("Superadmin verified!")
        except Exception:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
