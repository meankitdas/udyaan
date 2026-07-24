import asyncio
import httpx
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

BASE_URL = "http://127.0.0.1:8003" # Keeping 8003 from previous fix

async def verify_org_creation():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        print("1. Login as Superadmin...")
        response = await client.post("/auth/login", data={
            "username": settings.SUPERADMIN_EMAIL,
            "password": settings.SUPERADMIN_PASSWORD
        })
        if response.status_code != 200:
            print("Failed to login as superadmin")
            return
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("   Logged in.")
        
        print("\n2. Create Organization...")
        import time
        suffix = int(time.time())
        org_data = {
            "name": f"Test Org {suffix}",
            "email": f"org{suffix}@example.com",
            "phone": "9876543210",
            "address": "123 Test St",
            "admin_name": f"Org Admin {suffix}",
            "admin_email": f"admin{suffix}@example.com",
            "admin_password": "AdminPassword123!"
        }
        
        response = await client.post("/organizations/", json=org_data, headers=headers)
        if response.status_code == 200:
            print("   SUCCESS: Organization created.")
            print(f"   Org ID: {response.json()['id']}")
        else:
            print(f"   FAILURE: {response.status_code} {response.text}")
            return
            
        print("\n3. Verify Admin Login...")
        response = await client.post("/auth/login", data={
            "username": org_data["admin_email"],
            "password": org_data["admin_password"]
        })
        if response.status_code == 200:
            print("   SUCCESS: Org Admin logged in.")
            admin_token = response.json()["access_token"]
            
            print("\n4. Verify Non-Superadmin cannot create Org...")
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            fail_org_data = org_data.copy()
            fail_org_data["name"] = "Should Fail Org"
            fail_org_data["email"] = "fail@example.com"
            
            fail_response = await client.post("/organizations/", json=fail_org_data, headers=admin_headers)
            if fail_response.status_code == 403:
                print("   SUCCESS: Non-Superadmin was denied (403).")
            else:
                print(f"   FAILURE: Non-Superadmin was allowed or other error: {fail_response.status_code}")
                
        else:
            print(f"   FAILURE: Org Admin login failed: {response.text}")

if __name__ == "__main__":
    asyncio.run(verify_org_creation())
