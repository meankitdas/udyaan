import asyncio
import httpx
from app.main import app

async def debug_create_org():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        print("\n--- Debugging Create Org ---")
        
        # 1. Login
        email = "apkumawat8437@gmail.com"
        password = "Akumawat8437@"
        
        login_data = {"username": email, "password": password}
        res = await ac.post("/auth/login", data=login_data)
        
        if res.status_code != 200:
            print(f"LOGIN FAILED: {res.status_code} - {res.text}")
            return
            
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Create Org
        org_data = {
            "name": "Test Organization",
            "email": "testorg@example.com",
            "phone": "9876543210",
            "address": "123 Test St",
            "admin_name": "Test Org Admin",
            "admin_email": "admin@testorg.com",
            "admin_password": "password123"
        }
        
        print("Sending Create Request...")
        res_org = await ac.post("/organizations/", json=org_data, headers=headers)
        
        print(f"Status Code: {res_org.status_code}")
        if res_org.status_code != 200:
            print(f"Response: {res_org.text}")
        else:
            print("SUCCESS: Org Created")
            print(res_org.json())

if __name__ == "__main__":
    asyncio.run(debug_create_org())
