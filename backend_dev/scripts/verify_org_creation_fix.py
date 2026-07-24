import asyncio
import httpx
from app.main import app
from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

async def verify_org_fix():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        print("\n--- Verifying Org Creation Fix ---")
        
        # 1. Login Superadmin
        token_res = await ac.post("/auth/login", data={"username": "apkumawat8437@gmail.com", "password": "Akumawat8437@"})
        token = token_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Create Org
        org_data = {
            "name": "Fixed Org",
            "email": "fixed@org.com",
            "phone": "9998887777",
            "address": "Fix St",
            "admin_name": "Fixed Admin",
            "admin_email": "fixedadmin@org.com",
            "admin_password": "password123"
        }
        res = await ac.post("/organizations/", json=org_data, headers=headers)
        if res.status_code == 200:
            print("Org Created.")
            org_id = res.json()["id"]
            
            # 3. Check Admin in DB
            async with AsyncSessionLocal() as db:
                user_res = await db.execute(select(User).where(User.email == "fixedadmin@org.com"))
                user = user_res.scalars().first()
                
                print(f"Admin Org ID: {user.organization_id}")
                print(f"Expected: {org_id}")
                
                if user.organization_id == org_id:
                    print("SUCCESS: Admin linked to Org.")
                else:
                    print("FAILURE: Admin NOT linked to Org.")
        else:
            print(f"Org Create Failed: {res.text}")

if __name__ == "__main__":
    asyncio.run(verify_org_fix())
