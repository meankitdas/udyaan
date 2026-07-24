import asyncio
import httpx
from app.database import AsyncSessionLocal
from sqlalchemy import text
from app.core.security import create_access_token
from app.main import app

async def verify_reset():
    async with AsyncSessionLocal() as db:
        # 1. Get/Create User
        result = await db.execute(text("SELECT id, email, password_hash FROM users LIMIT 1"))
        row = result.first()
        if not row:
             print("No users found.")
             return
        
        user_id, email, old_hash = row
        print(f"Testing with User: {email}")

    # Start Async Client
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        
        # 2. Request Reset (Forgot Password)
        print(f"\n--- Testing POST /auth/forgot-password ---")
        res = await ac.post("/auth/forgot-password", json={"email": email})
        if res.status_code == 200:
            print("SUCCESS: Reset Email Sent (Mock)")
        else:
            print(f"FAILED: {res.status_code} - {res.text}")
            return
            
        # 3. Retrieve Token from DB (Simulation of checking email)
        async with AsyncSessionLocal() as db:
            from app.models.auth import PasswordReset
            from sqlalchemy.future import select
            
            # Get latest token
            result = await db.execute(
                select(PasswordReset)
                .where(PasswordReset.user_id == user_id)
                .order_by(PasswordReset.created_at.desc())
            )
            reset_entry = result.scalars().first()
            if not reset_entry:
                print("FAILED: No token found in DB.")
                return
            
            token = reset_entry.token
            print(f"RETRIEVED TOKEN: {token}")

        # 4. Reset Password
        print(f"\n--- Testing POST /auth/reset-password ---")
        new_pass = "newpassword123"
        res = await ac.post("/auth/reset-password", json={"token": token, "new_password": new_pass})
        if res.status_code == 200:
             print("SUCCESS: Password Reset")
        else:
             print(f"FAILED: {res.status_code} - {res.text}")
             return

        # 5. Verify Login with New Password
        print(f"\n--- Verifying Login with New Password ---")
        login_data = {
            "username": email,
            "password": new_pass
        }
        res = await ac.post("/auth/login", data=login_data)
        if res.status_code == 200:
            print("SUCCESS: Login Successful with New Password")
        else:
            print(f"FAILED LOGIN: {res.status_code} - {res.text}")

if __name__ == "__main__":
    asyncio.run(verify_reset())
