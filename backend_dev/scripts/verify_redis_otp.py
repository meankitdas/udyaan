import asyncio
import httpx
import random
import string
from app.main import app
from app.core.redis import redis_client

async def verify_redis_otp():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        print("\n--- Verifying Redis OTP ---")
        
        # 1. Signup
        suffix = ''.join(random.choices(string.ascii_lowercase, k=4))
        email = f"redis_test_{suffix}@example.com"
        
        # Get org (required for signup)
        org_res = await ac.get("/organizations/public")
        if not org_res.json():
             print("Create org first.")
             return
        org_id = org_res.json()[0]["id"]
        
        signup_data = {
            "email": email,
            "full_name": "Redis Tester",
            "password": "password123",
            "role_key": "STUDENT",
            "organization_id": org_id
        }
        
        print(f"Signing up {email}...")
        res_signup = await ac.post("/auth/signup", json=signup_data)
        if res_signup.status_code != 200:
            print(f"Signup Failed: {res_signup.text}")
            return
            
        print("Signup Success.")
        
        # 2. Check Redis
        redis_key = f"otp:{email}"
        otp = await redis_client.get(redis_key)
        
        if otp:
            print(f"SUCCESS: OTP found in Redis: {otp}")
        else:
            print("FAILURE: OTP NOT found in Redis.")
            return

        # 3. Verify OTP
        print("Verifying OTP...")
        verify_data = {
            "email": email,
            "otp": otp
        }
        res_verify = await ac.post("/auth/verify-otp", json=verify_data)
        
        if res_verify.status_code == 200:
            print("SUCCESS: OTP Verified.")
        else:
            print(f"FAILURE: Verify Endpoint Failed: {res_verify.text}")
            
        # 4. Check Redis Key Deleted
        if not await redis_client.get(redis_key):
             print("SUCCESS: Redis Key Deleted after usage.")
        else:
             print("WARNING: Redis Key NOT Deleted.")

if __name__ == "__main__":
    asyncio.run(verify_redis_otp())
