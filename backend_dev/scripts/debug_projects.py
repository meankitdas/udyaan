import asyncio
import sys
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models.project import Project
from app.models.user import User

async def debug_projects():
    async with AsyncSessionLocal() as db:
        print("--- DEBUGGING PROJECTS ---")
        
        # 1. List Users to see IDs and Names
        print("\n[USERS]")
        result = await db.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(f"ID: {u.id}, Name: {repr(u.full_name)}, Org: {u.organization_id}, Role: {u.role_key if hasattr(u, 'role_key') else 'N/A'}")

        # 2. List Projects to see target_assignee values
        print("\n[PROJECTS]")
        result = await db.execute(select(Project))
        projects = result.scalars().all()
        for p in projects:
            print(f"ID: {p.id}, Title: {repr(p.title)}, Org: {p.organization_id}, Assignee: {repr(p.target_assignee)}")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(debug_projects())
