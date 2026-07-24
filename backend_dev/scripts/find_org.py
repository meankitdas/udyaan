from app.database import AsyncSessionLocal, _init_db_sync
from sqlalchemy.future import select
from app.models.organization import Organization

async def find_org():
    _init_db_sync() # Initialize engine and sessionmaker
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Organization).where(Organization.name.ilike('%Jain University%')))
        org = result.scalars().first()
        if org:
            print(f"FOUND ORG: {org.name} (ID: {org.id})")
            return org.id
        else:
            print("ORG NOT FOUND")
            return None

if __name__ == "__main__":
    asyncio.run(find_org())
