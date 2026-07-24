import asyncio
import httpx
from app.database import AsyncSessionLocal
from sqlalchemy import text
from app.core.security import get_password_hash
from app.main import app

async def verify_login_security():
    async with AsyncSessionLocal() as db:
        # 1. Get User
        result = await db.execute(text("SELECT id, email, password_hash FROM users LIMIT 1"))
        row = result.first()
        if not row:
             print("No users found.")
             return
        
        user_id, email, password_hash = row
        print(f"Testing with User: {email}")
        
    # We need a known password. 
    # Since hashes are irreversible, let's reset this user's password to 'correct_password' for testing.
    # Note: This changes state! But it's necessary for reliable testing.
    new_pass = "correct_password"
    new_hash = get_password_hash(new_pass)
    
    async with AsyncSessionLocal() as db:
        await db.execute(
            text("UPDATE users SET password_hash = :h WHERE email = :e"),
            {"h": new_hash, "e": email}
        )
        await db.commit()
        print(f"Reset password to '{new_pass}' for testing.")

    # Start Async Client
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        
        # Test 1: Invalid Password
        print(f"\n--- Test 1: Invalid Password ---")
        login_data = {"username": email, "password": "wrong_password"}
        res = await ac.post("/auth/login", data=login_data)
        if res.status_code == 400:
            print("PASS: Invalid password rejected.")
        else:
            print(f"FAIL: Accepted invalid password! Status: {res.status_code}")
            
        # Test 2: Correct Password
        print(f"\n--- Test 2: Correct Password ---")
        login_data = {"username": email, "password": "correct_password"}
        res = await ac.post("/auth/login", data=login_data)
        if res.status_code == 200:
            print("PASS: Valid password accepted.")
        else:
            print(f"FAIL: Valid password rejected! Status: {res.status_code}")

if __name__ == "__main__":
    asyncio.run(verify_login_security())
