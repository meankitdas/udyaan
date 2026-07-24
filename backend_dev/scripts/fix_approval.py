import asyncio
from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

async def fix_approval():
    async with AsyncSessionLocal() as db:
        print("Fixing Superadmin Approval...")
        result = await db.execute(select(User).where(User.email == "superadmin@example.com"))
        user = result.scalars().first()
        
        if user:
            user.is_approved = True
            await db.commit()
            print("Superadmin approved successfully.")
        else:
            print("Superadmin user not found.")

if __name__ == "__main__":
    asyncio.run(fix_approval())
