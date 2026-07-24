import asyncio
import sys
import os
import aiohttp
from uuid import uuid4

sys.path.append(os.getcwd())

# Configuration
BASE_URL = "http://localhost:8000"
# Use the credentials provided by user to test real scenario if possible, 
# but I can't easily create that specific user without DB access or signup.
# I will use a test admin I create.
ORG_ADMIN_EMAIL = f"profile_admin_{uuid4().hex[:8]}@example.com"
ORG_ADMIN_PASSWORD = "password123"

async def get_token(session, email, password):
    async with session.post(f"{BASE_URL}/auth/login", data={"username": email, "password": password}) as resp:
        if resp.status != 200:
            return None
        data = await resp.json()
        print(f"DEBUG LOGIN RESPONSE: {data}")
        return data["access_token"]

async def create_org_admin(session):
    # Login as superadmin to create org
    async with session.post(f"{BASE_URL}/auth/login", data={"username": "superadmin@example.com", "password": "password123"}) as resp:
        if resp.status != 200:
            print("Superadmin login failed")
            return None
        data = await resp.json()
        sa_token = data["access_token"]

    # Create Org
    headers = {"Authorization": f"Bearer {sa_token}"}
    payload = {
        "name": f"Profile Test Org {uuid4().hex[:4]}",
        "email": f"info_{uuid4().hex[:8]}@example.com",
        "admin_name": "Profile Admin",
        "admin_email": ORG_ADMIN_EMAIL,
        "admin_password": ORG_ADMIN_PASSWORD,
        "phone": "9998887776"
    }
    async with session.post(f"{BASE_URL}/organizations/", json=payload, headers=headers) as resp:
        if resp.status != 200:
            print(f"Org creation failed: {await resp.text()}")
            return None
        return True

async def verify_me(session, token):
    headers = {"Authorization": f"Bearer {token}"}
    async with session.get(f"{BASE_URL}/auth/me", headers=headers) as resp:
        if resp.status != 200:
            print(f"GET /me failed: {resp.status} - {await resp.text()}")
            return None
        return await resp.json()

async def main():
    async with aiohttp.ClientSession() as session:
        print("--- Setting up Admin User ---")
        if not await create_org_admin(session):
            return

        print(f"--- Logging in as {ORG_ADMIN_EMAIL} ---")
        token = await get_token(session, ORG_ADMIN_EMAIL, ORG_ADMIN_PASSWORD)
        if not token:
            print("Login failed")
            return

        print("--- Verifying /auth/me ---")
        profile = await verify_me(session, token)
        if profile:
            print("SUCCESS: Profile Retrieved")
            print(f"Name: {profile['full_name']}")
            print(f"Email: {profile['email']}")
            print(f"Role Key (from login): {profile.get('role_key', 'Not in /me response')}") 
            # Note: /me returns UserResponse which usually doesn't have role_key inside User object unless modified Schema.
            # UserResponse has id, email, full_name, etc.
        else:
            print("FAILED to get profile")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
