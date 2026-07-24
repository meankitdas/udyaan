import asyncio
import sys
from app.database import AsyncSessionLocal
from sqlalchemy import text

async def migrate_db():
    async with AsyncSessionLocal() as db:
        print("Adding is_approved column to users table...")
        try:
            # Add column
            await db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE"))
            
            # Backfill: Set is_approved = TRUE for all existing users so they don't get locked out
            await db.execute(text("UPDATE users SET is_approved = TRUE"))
            
            await db.commit()
            print("Migration successful: Added is_approved and set to TRUE for existing users.")
        except Exception as e:
            print(f"Migration failed: {e}")
            await db.rollback()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(migrate_db())
