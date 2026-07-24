import asyncio
from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

async def check_org_id():
    async with AsyncSessionLocal() as db:
        print("\n--- Checking Org ID ---")
        email = "autoadmin@org.com"
        res = await db.execute(select(User).where(User.email == email))
        user = res.scalars().first()
        if user:
            print(f"User: {user.email}")
            print(f"Org ID: {user.organization_id}")
            print(f"Is Approved: {user.is_approved}")
        else:
             print("User not found.")

if __name__ == "__main__":
    asyncio.run(check_org_id())
