import asyncio
import httpx
from app.database import AsyncSessionLocal
from sqlalchemy import text
from app.core.security import create_access_token
from app.main import app

async def verify_auth_me():
    async with AsyncSessionLocal() as db:
        # 1. Get User
        result = await db.execute(text("SELECT id, email FROM users LIMIT 1"))
        row = result.first()
        if not row:
             print("No users found to test.")
             return
        
        user_id, email = row
        print(f"Testing with User: {email}")

    # Generate Token
    token = create_access_token({"sub": email})
    headers = {"Authorization": f"Bearer {token}"}

    # Start Async Client
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        
        # Test GET /auth/me
        print(f"\n--- Testing GET /auth/me ---")
        res = await ac.get("/auth/me", headers=headers)
        if res.status_code == 200:
            data = res.json()
            print("SUCCESS: Profile Retrieved")
            print(f"Role Key: {data.get('role_key')}")
            if data.get('role_key'):
                print("PASS: Role Key is present.")
            else:
                print("FAIL: Role Key is missing/null.")
        else:
            print(f"FAILED: {res.status_code} - {res.text}")

if __name__ == "__main__":
    asyncio.run(verify_auth_me())
