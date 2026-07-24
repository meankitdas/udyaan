import asyncio
import httpx
from app.main import app
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.project import Project
from sqlalchemy.future import select
from app.utils.id_generator import generate_project_id

async def verify_assignee_details():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        print("\n--- Verifying Project Assignees ---")
        
        # 1. Login Superadmin (simpler)
        token_res = await ac.post("/auth/login", data={"username": "apkumawat8437@gmail.com", "password": "Akumawat8437@"})
        token = token_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get/Create a User to Assign
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(User).limit(1))
            assignee = res.scalars().first()
            assignee_id = assignee.id
            org_id = assignee.organization_id # Assuming user has org
            
            # Create a Project manually in DB to skip schema validation for now or use API
            # Let's use API to be safe
            
        print(f"Assigning to User ID: {assignee_id}")

        # 3. Create Project
        project_data = {
           "title": "Assignee Test Project",
           "status": "Assigned",
           "target_assignee": assignee_id, # Can be comma sep
           "organization_id": org_id 
        }
        # API expects creation via privileged user. Superadmin is fine.
        
        # Note: current create endpoint might require specific schema.
        # Let's just create raw in DB for speed.
        async with AsyncSessionLocal() as db:
             pid = generate_project_id()
             p = Project(
                 id=pid,
                 title="Assignee Test Project",
                 target_assignee=assignee_id,
                 created_by=assignee_id, # Self created? or just field
                 organization_id=org_id
             )
             db.add(p)
             await db.commit()
             print(f"Created Project: {pid}")

        # 4. Fetch Details via API
        fetch_res = await ac.get(f"/projects/{pid}", headers=headers)
        if fetch_res.status_code == 200:
            data = fetch_res.json()
            print("Project Fetched.")
            
            details = data.get("assignees_details")
            print(f"Assignees Details: {details}")
            
            if details and len(details) > 0 and details[0]["id"] == assignee_id:
                print("SUCCESS: Assignee details found.")
            else:
                print("FAILURE: Assignee details missing or incorrect.")
        else:
            print(f"Fetch Failed: {fetch_res.text}")

if __name__ == "__main__":
    asyncio.run(verify_assignee_details())
