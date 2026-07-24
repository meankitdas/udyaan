import asyncio
import httpx
import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings


BASE_URL = "http://127.0.0.1:8003"

async def verify_flow():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        print("1. Testing Superadmin Login...")
        # Superadmin should already be seeded
        response = await client.post("/auth/login", data={
            "username": settings.SUPERADMIN_EMAIL,
            "password": settings.SUPERADMIN_PASSWORD
        })
        if response.status_code == 200:
            print("   SUCCESS: Superadmin logged in.")
            tokens = response.json()
            print(f"   Access Token: {tokens['access_token'][:10]}...")
        else:
            print(f"   FAILURE: Superadmin login failed: {response.text}")
            return

        print("\n2. Testing Student Signup...")
        student_email = "student_test@example.com"
        student_data = {
            "email": student_email,
            "password": "StudentPassword123!",
            "full_name": "Test Student",
            "role_key": "STUDENT"
        }
        
        # Cleanup previous run if needed? (Not doing cleanup here, might fail if exists)
        # We can ignore 400 if already exists for this test or use random email.
        import time
        student_data["email"] = f"student_{int(time.time())}@example.com"
        
        response = await client.post("/auth/signup", json=student_data)
        if response.status_code == 200:
            print("   SUCCESS: Student signed up.")
            user_data = response.json()
            # print(f"   User: {user_data}")
        else:
            print(f"   FAILURE: Student signup failed: {response.text}")
            return

        print("\n3. Testing Student Login (Unverified)...")
        # Should succeed because we permitted unverified login in code but optional check is commented out.
        # If we uncommented it, this would fail.
        # Let's verify email first anyway.
        # We need the token. The API didn't return it (it printed it to console).
        # For this script we can't easily get the console output of the server.
        # So we might need to rely on DB access or just skip verify if the API allows unverified login.
        # The current implementation allows login without verification (commented out check).
        
        response = await client.post("/auth/login", data={
            "username": student_data["email"],
            "password": student_data["password"]
        })
        if response.status_code == 200:
            print("   SUCCESS: Student logged in.")
            tokens = response.json()
            refresh_token = tokens["refresh_token"]
            access_token = tokens["access_token"]
        else:
            print(f"   FAILURE: Student login failed: {response.text}")
            return

        print("\n4. Testing Refresh Token...")
        response = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        if response.status_code == 200:
             print("   SUCCESS: Token refreshed.")
             new_tokens = response.json()
             new_refresh = new_tokens["refresh_token"]
        else:
             print(f"   FAILURE: Refresh failed: {response.text}")
             return

        print("\n5. Testing Logout...")
        response = await client.post("/auth/logout", json={"refresh_token": new_refresh})
        if response.status_code == 200:
            print("   SUCCESS: Logged out.")
        else:
            print(f"   FAILURE: Logout failed: {response.text}")

        print("\n6. Testing Old Refresh Token (Should Fail)...")
        response = await client.post("/auth/refresh", json={"refresh_token": refresh_token}) # Used in step 4, rotated.
        if response.status_code == 401:
            print("   SUCCESS: Old token rejected.")
        else:
             print(f"   FAILURE: Old token accepted or other error: {response.status_code} {response.text}")

if __name__ == "__main__":
    # We need to run the server first! 
    # This script assumes server is running on 8000.
    # We will invoke this script AFTER starting the server in background.
    asyncio.run(verify_flow())
