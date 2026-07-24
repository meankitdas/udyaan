import asyncio
import sys
from app.database import engine
from sqlalchemy import text

async def alter_table():
    async with engine.begin() as conn:
        print("Altering projects table...")
        # Alter column type to TEXT to support longer strings (multiple IDs)
        await conn.execute(text("ALTER TABLE projects ALTER COLUMN target_assignee TYPE TEXT;"))
        print("Column target_assignee altered to TEXT.")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(alter_table())
