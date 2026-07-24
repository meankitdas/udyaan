import asyncio
import sys
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.role import Role, UserRole
from app.crud.project import get_projects_with_details
from sqlalchemy import select
from uuid import uuid4

# Mocking the logic found in api/projects.py
async def simulate_superadmin_view():
    async with AsyncSessionLocal() as db:
        print("--- SIMULATING SUPERADMIN VIEW ---")
        
        # 1. Get User
        email = "query_test@example.com" # The user we created in previous step (Superadmin)
        result = await db.execute(select(User).where(User.email == email))
        current_user = result.scalars().first()
        if not current_user:
            print("User not found!")
            return

        # 2. Fetch Roles
        result = await db.execute(
            select(Role).join(UserRole).where(UserRole.user_id == current_user.id)
        )
        roles = result.scalars().all()
        role_keys = [r.role_key for r in roles]
        is_superadmin = "SUPERADMIN" in role_keys
        
        print(f"User: {current_user.email}")
        print(f"Roles: {role_keys}")
        print(f"Is Superadmin: {is_superadmin}")
        
        # 3. Determine filters
        if not current_user.organization_id and not is_superadmin:
            print("ERROR: User is not part of any organization")
            return

        org_id = current_user.organization_id if not is_superadmin else None
        print(f"Filter Org ID: {org_id}")
        
        # 4. Fetch Projects
        projects = await get_projects_with_details(
            db, 
            org_id, 
            skip=0, 
            limit=100
        )
        print(f"Projects Found: {len(projects)}")
        for p in projects:
            print(f" - {p['title']} (Org: {p.get('organization_id')}, CreatedBy: {p.get('created_by_name')})")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(simulate_superadmin_view())
