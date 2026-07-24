import asyncio
import httpx
from app.database import AsyncSessionLocal
from sqlalchemy import text
from app.main import app

async def debug_login():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        print("\n--- Debugging Login ---")
        
        # 1. Test Login
        login_data = {"username": "superadmin@example.com", "password": "password123"}
        res = await ac.post("/auth/login", data=login_data)
        
        if res.status_code == 200:
            print("LOGIN SUCCESS")
            token = res.json()["access_token"]
            print(f"Token: {token[:20]}...")
            
            # 2. Test /auth/me
            headers = {"Authorization": f"Bearer {token}"}
            res_me = await ac.get("/auth/me", headers=headers)
            if res_me.status_code == 200:
                print("GET /auth/me SUCCESS")
                print(res_me.json())
            else:
                print(f"GET /auth/me FAILED: {res_me.status_code} - {res_me.text}")
        else:
             print(f"LOGIN FAILED: {res.status_code} - {res.text}")

if __name__ == "__main__":
    asyncio.run(debug_login())
