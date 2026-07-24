import asyncio
import httpx
from app.main import app

async def verify_ph_login():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        print("\n--- Verifying Project Head Login ---")
        
        # 1. Login Superadmin
        super_creds = {"username": "apkumawat8437@gmail.com", "password": "Akumawat8437@"}
        res = await ac.post("/auth/login", data=super_creds)
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get Org ID (Create or List)
        from app.database import AsyncSessionLocal
        from app.models.organization import Organization
        from sqlalchemy.future import select
        async with AsyncSessionLocal() as db:
             res_db = await db.execute(select(Organization))
             org = res_db.scalars().first()
             org_id = org.id
             
        # 3. Create Project Head
        email = "ph_verified@test.com"
        password = "password123"
        ph_data = {
            "full_name": "Verified PH",
            "email": email,
            "password": password,
            "phone": "5556667777",
            "organization_id": org_id
        }
        print(f"Creating PH: {email}")
        res_create = await ac.post("/project-heads/", json=ph_data, headers=headers)
        
        if res_create.status_code == 200:
             print("PH Created.")
        elif res_create.status_code == 400 and "Email already registered" in res_create.text:
             print("PH already exists, proceeding to login.")
        else:
             print(f"PH Create Failed: {res_create.status_code} - {res_create.text}")
             return

        # 4. Login as PH
        print(f"Attempting to Login as PH: {email}")
        ph_creds = {"username": email, "password": password}
        res_login = await ac.post("/auth/login", data=ph_creds)
        
        if res_login.status_code == 200:
            print("SUCCESS: Project Head Logged In.")
            print(f"Token: {res_login.json()['access_token'][:10]}...")
            
            # Check Me
            token_ph = res_login.json()["access_token"]
            res_me = await ac.get("/auth/me", headers={"Authorization": f"Bearer {token_ph}"})
            print(f"Me: {res_me.json()}")
        else:
            print(f"FAILURE: PH Login Failed: {res_login.status_code} - {res_login.text}")

if __name__ == "__main__":
    asyncio.run(verify_ph_login())
