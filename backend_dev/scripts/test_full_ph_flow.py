import asyncio
import httpx
from app.main import app as fastapi_app
import app.database as db_module
from sqlalchemy.future import select
from app.models.organization import Organization

async def run_full_test():
    # 1. Find Org
    db_module._init_db_sync()
    org_id = None
    async with db_module.AsyncSessionLocal() as db:
        result = await db.execute(select(Organization).where(Organization.name.ilike('%Jain University%')))
        org = result.scalars().first()
        if org:
            print(f"FOUND ORG: {org.name} (ID: {org.id})")
            org_id = org.id
        else:
            print("ORG NOT FOUND: Jain University")
            return

    # 2. Login
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=fastapi_app), base_url="http://test") as ac:
        print("\n--- Testing Superadmin Login ---")
        login_data = {
            "username": "apkumawat8437@gmail.com",
            "password": "Akumawat8437@"
        }
        res = await ac.post("/auth/login", data=login_data)
        
        if res.status_code != 200:
            print(f"LOGIN FAILED: {res.status_code} - {res.text}")
            return
            
        token = res.json()["access_token"]
        print("LOGIN SUCCESS")
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Create Project Head
        ph_data = {
            "full_name": "SK",
            "email": "silentknight1480@gmail.com",
            "password": "TemporaryPassword123!",
            "organization_id": str(org_id)
        }
        
        print(f"Creating Project Head {ph_data['email']}...")
        res_create = await ac.post("/project-heads", json=ph_data, headers=headers)
        if res_create.status_code == 200:
            print("PROJECT HEAD CREATED SUCCESSFULLY")
            print(res_create.json())
        else:
            print(f"CREATION FAILED: {res_create.status_code} - {res_create.text}")

if __name__ == "__main__":
    asyncio.run(run_full_test())
