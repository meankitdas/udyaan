import asyncio
from app.database import AsyncSessionLocal
from app.utils.id_generator import generate_org_id, generate_user_id, generate_project_id
from app.models.organization import Organization
from app.models.user import User
from app.models.project import Project
from app.models.role import Role
from sqlalchemy import text

async def verify_ids():
    async with AsyncSessionLocal() as db:
        print("\n--- Verifying ID Generation ---")
        
        # 1. Organization ID
        org_id = await generate_org_id(db)
        print(f"Generated Org ID: {org_id}")
        assert org_id.startswith("ORG")
        
        # 2. User IDs
        st_id = generate_user_id("STUDENT")
        print(f"Generated Student ID: {st_id}")
        assert st_id.startswith("ST")
        
        fa_id = generate_user_id("FACULTY")
        print(f"Generated Faculty ID: {fa_id}")
        assert fa_id.startswith("FA")
        
        # 3. Project ID
        pr_id = generate_project_id()
        print(f"Generated Project ID: {pr_id}")
        assert pr_id.startswith("PR")
        
        print("\n--- Seed Base Roles ---")
        # Since we dropped DB, we need roles back
        roles = ["SUPERADMIN", "ADMIN", "PROJECT_HEAD", "FACULTY", "STUDENT", "USER"]
        for r in roles:
             await db.execute(text(f"INSERT INTO roles (role_key, role_name) VALUES ('{r}', '{r.title()}') ON CONFLICT DO NOTHING"))
        await db.commit()
        print("Roles seeded.")

if __name__ == "__main__":
    asyncio.run(verify_ids())
