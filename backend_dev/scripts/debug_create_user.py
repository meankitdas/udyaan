import asyncio
import sys
import os

sys.path.append(os.getcwd())

from app.database import AsyncSessionLocal
from app.crud.user import create_user
from app.schemas.auth import UserCreate
import traceback

async def main():
    async with AsyncSessionLocal() as db:
        print("Creating user...")
        # Use a unique email
        import time
        email = f"test_{int(time.time())}@example.com"
        user = UserCreate(email=email, password="pwd", full_name="Test", role_key="STUDENT")
        try:
            u = await create_user(db, user, "STUDENT")
            print("Created user!")
            
            from app.models.auth import EmailVerification
            from datetime import datetime, timedelta
            from uuid import uuid4
            
            token = str(uuid4())
            verification = EmailVerification(
                 user_id=u.id,
                 token=token,
                 expires_at=datetime.utcnow() + timedelta(hours=24)
            )
            db.add(verification)
            await db.commit()
            print("Created verification!")
        except Exception:
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
