import asyncio
import httpx
from app.main import app

async def test_create_ph():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
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

        # Use the org ID from find_org.py
        # Assume we got it, if not we will fail here but let's make it flexible or just hardcode if found.
        # FOR NOW: I will wait for find_org.py output.
        
        # PH Data
        ph_data = {
            "full_name": "SK",
            "email": "silentknight1480@gmail.com",
            "password": "TemporaryPassword123!", # User might want a specific one or I generate one
            "organization_id": "REPLACE_WITH_ORG_ID"
        }
        
        print(f"Creating Project Head {ph_data['email']}...")
        # res_create = await ac.post("/project-heads", json=ph_data, headers=headers)
        # if res_create.status_code == 200:
        #     print("PROJECT HEAD CREATED SUCCESSFULLY")
        # else:
        #     print(f"CREATION FAILED: {res_create.status_code} - {res_create.text}")

if __name__ == "__main__":
    asyncio.run(test_create_ph())
