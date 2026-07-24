import asyncio
from app.database import engine
from app.models import Base
from sqlalchemy import text

async def create_tables():
    async with engine.begin() as conn:
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created.")
        
        # Verify
        result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [row[0] for row in result]
        print("Existing tables:", tables)

if __name__ == "__main__":
    asyncio.run(create_tables())
