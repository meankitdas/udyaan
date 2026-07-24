import asyncio
import httpx
from app.main import app

async def verify_custom_login():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        print("\n--- Verifying Custom Login ---")
        
        email = "apkumawat8437@gmail.com"
        password = "Akumawat8437@"
        
        login_data = {"username": email, "password": password}
        res = await ac.post("/auth/login", data=login_data)
        
        if res.status_code == 200:
            print("LOGIN SUCCESS")
            print(f"Token: {res.json()['access_token'][:20]}...")
        else:
             print(f"LOGIN FAILED: {res.status_code} - {res.text}")

if __name__ == "__main__":
    asyncio.run(verify_custom_login())
