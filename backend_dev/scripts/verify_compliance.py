import asyncio
import httpx
from app.database import AsyncSessionLocal
from sqlalchemy import text
from app.core.security import create_access_token
from app.api.auth import get_password_hash 
# Note: we need to import app to ensure routes are registered, but we'll hit localhost if running, 
# OR use AsyncClient(app=app, base_url="http://test") if we want to run in-process.
from app.main import app

# We will run in-process using the app object.

async def verify_apis():
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
            await db.execute(text(f"INSERT INTO projects (id, title, created_by, status) VALUES (gen_random_uuid(), 'Test Compliance Project', '{user_id}', 'Assigned')"))
            await db.commit()
            result = await db.execute(text(f"SELECT id FROM projects WHERE title='Test Compliance Project' LIMIT 1"))
            project_id = result.scalar()
        
        print(f"Project: {project_id}")

    # Generate Token
    token = create_access_token({"sub": email})
    headers = {"Authorization": f"Bearer {token}"}

    # Start Async Client
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        
        # 4. Test Create Meeting
        print("\n--- Testing Create Meeting ---")
        meeting_payload = {
            "title": "Kickoff Meeting Async",
            "meeting_date": "2025-10-10T10:00:00",
            "agenda": "Discuss requirements",
            "attendees": "Alice, Bob"
        }
        res = await ac.post(f"/projects/{project_id}/meetings", json=meeting_payload, headers=headers)
        if res.status_code == 200:
            print("SUCCESS: Meeting Created")
            print(res.json())
            meeting_id = res.json()['id']
        else:
            print(f"FAILED: {res.status_code} - {res.text}")
            return

        # 5. Test List Meetings
        print("\n--- Testing List Meetings ---")
        res = await ac.get(f"/projects/{project_id}/meetings", headers=headers)
        if res.status_code == 200:
            print(f"SUCCESS: Found {len(res.json())} meetings")
        else:
            print(f"FAILED: {res.status_code} - {res.text}")

        # 6. Test Create Action
        print("\n--- Testing Create Action Item ---")
        action_payload = {
            "title": "Setup Repos Async",
            "description": "Create git repositories",
            "assigned_to": str(user_id), 
            "due_date": "2025-10-15",
            "urgency": "High"
        }
        res = await ac.post(f"/projects/{project_id}/action-items", json=action_payload, headers=headers)
        if res.status_code == 200:
            print("SUCCESS: Action Item Created")
            print(res.json())
            action_id = res.json()['id']
        else:
            print(f"FAILED: {res.status_code} - {res.text}")
            return

        # 7. Test Update Action Status
        print("\n--- Testing Update Action Status ---")
        res = await ac.patch(f"/action-items/{action_id}/status", json={"status": "In Progress"}, headers=headers)
        if res.status_code == 200:
            print("SUCCESS: Status Updated")
            print(res.json())
        else:
            print(f"FAILED: {res.status_code} - {res.text}")

        # 8. Test List My Actions
        print("\n--- Testing List My Action Items ---")
        res = await ac.get("/action-items/me", headers=headers)
        if res.status_code == 200:
            actions = res.json()
            print(f"SUCCESS: Found {len(actions)} assigned actions")
            if actions:
                print(f"First action title: {actions[0]['title']}")
        else:
             print(f"FAILED: {res.status_code} - {res.text}")

if __name__ == "__main__":
    asyncio.run(verify_apis())
