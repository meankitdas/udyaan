import asyncio
from sqlalchemy import text
from app.database import engine
from app.models import Base

async def recreate():
    async with engine.begin() as conn:
        print("Dropping organization_id from users...")
        try:
            await conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS organization_id"))
        except Exception as e:
            print(e)
            
        print("Dropping organizations table...")
        try:
            await conn.execute(text("DROP TABLE IF EXISTS organizations CASCADE"))
        except Exception as e:
            print(e)
            
        print("Recreating tables...")
        # Since I imported Base, it should have Organization now
        await conn.run_sync(Base.metadata.create_all)
        
        # Add the column back to users (if create_all didn't do it because users existed)
        print("Adding organization_id to users...")
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id)"))
        except Exception as e:
            print(f"Error adding column (maybe exists?): {e}")

if __name__ == "__main__":
    asyncio.run(recreate())
