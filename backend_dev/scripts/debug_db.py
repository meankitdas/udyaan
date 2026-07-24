import asyncio
import sys
import os

sys.path.append(os.getcwd())

from app.database import AsyncSessionLocal
from app.crud.user import get_user_by_email
from app.config import settings

async def main():
    print("Connecting to DB...")
    async with AsyncSessionLocal() as db:
        print("Checking user...")
        try:
            u = await get_user_by_email(db, settings.SUPERADMIN_EMAIL)
            print(f"User found: {u.email if u else 'None'}")
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
