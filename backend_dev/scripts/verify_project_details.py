import asyncio
import httpx
from app.database import AsyncSessionLocal
from sqlalchemy import text
from app.core.security import create_access_token
from app.main import app

async def verify_get_project():
    async with AsyncSessionLocal() as db:
        print("Setting up test data...")
        
        # 1. Get/Create User
        result = await db.execute(text("SELECT id, email FROM users LIMIT 1"))
        row = result.first()
        if not row:
             await db.execute(text("INSERT INTO users (id, email, hashed_password, full_name, role_key, is_active, is_verified, is_approved) VALUES (gen_random_uuid(), 'testadmin@example.com', 'hashedfake', 'Test Admin', 'ADMIN', true, true, true)"))
             await db.commit()
             result = await db.execute(text("SELECT id, email FROM users WHERE email='testadmin@example.com' LIMIT 1"))
             row = result.first()
        
        user_id, email = row
        print(f"User: {email}")

        # 2. Get/Create Project
        result = await db.execute(text(f"SELECT id FROM projects WHERE created_by='{user_id}' LIMIT 1"))
        project_id = result.scalar()
        if not project_id:
            await db.execute(text(f"INSERT INTO projects (id, title, created_by, status) VALUES (gen_random_uuid(), 'Test Details Project', '{user_id}', 'Assigned')"))
            await db.commit()
            result = await db.execute(text(f"SELECT id FROM projects WHERE title='Test Details Project' LIMIT 1"))
            project_id = result.scalar()
        
        print(f"Project: {project_id}")

    # Generate Token
    token = create_access_token({"sub": email})
    headers = {"Authorization": f"Bearer {token}"}

    # Start Async Client
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        
        # Test GET Project Details
        print(f"\n--- Testing GET /projects/{project_id} ---")
        res = await ac.get(f"/projects/{project_id}", headers=headers)
        if res.status_code == 200:
            print("SUCCESS: Project Details Retrieved")
            print(res.json())
        else:
            print(f"FAILED: {res.status_code} - {res.text}")

if __name__ == "__main__":
    asyncio.run(verify_get_project())
