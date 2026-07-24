import asyncio
import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.getcwd())

# Load env vars
load_dotenv()

from app.database import _init_db_sync, AsyncSessionLocal
from app.crud.user import get_user_by_email
from sqlalchemy import text

async def diagnose():
    print("1. Initializing Database...")
    try:
        _init_db_sync()
        print("   Database engine initialized.")
    except Exception as e:
        print(f"   FAILED to initialize DB: {e}")
        return

    print("\n2. Testing Database Connection...")
    try:
        async with AsyncSessionLocal() as db:
            print("   Executing SELECT 1...")
            await db.execute(text("SELECT 1"))
            print("   Connection SUCCESSFUL!")
            
            print("\n3. Verifying User 'apkumawat8437@gmail.com'...")
            user = await get_user_by_email(db, "apkumawat8437@gmail.com")
            if user:
                print(f"   User FOUND! ID: {user.id}, Role: {user.role}, Is Active: {user.is_active}")
                print(f"   Hashed Password: {user.hashed_password[:10]}...")
            else:
                print("   User NOT FOUND.")
                
    except Exception as e:
        print(f"   FAILED during DB operations: {e}")
        print("   (This is likely a connection timeout due to AWS Security Group IP whitelisting)")

if __name__ == "__main__":
    asyncio.run(diagnose())
