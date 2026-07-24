import asyncio
import sys
import os
import aiohttp

sys.path.append(os.getcwd())

from app.core.security import get_password_hash
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.role import Role, UserRole
from app.models.organization import Organization
from sqlalchemy.future import select
from uuid import uuid4

# Configuration
BASE_URL = "http://localhost:8000"
SUPERADMIN_EMAIL = "superadmin@example.com"
SUPERADMIN_PASSWORD = "password123"
ORG_ADMIN_EMAIL = f"orgadmin_{uuid4().hex[:8]}@example.com"
ORG_ADMIN_PASSWORD = "password123"
ORG_NAME = f"Test Org {uuid4().hex[:8]}"

async def get_token(session, email, password):
    async with session.post(f"{BASE_URL}/auth/login", data={"username": email, "password": password}) as resp:
        if resp.status != 200:
            text = await resp.text()
            print(f"Login failed: {resp.status} - {text}")
            return None
        data = await resp.json()
        return data["access_token"]

async def create_organization(session, token):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "name": ORG_NAME,
        "email": f"info_{uuid4().hex[:8]}@example.com",
        "admin_email": ORG_ADMIN_EMAIL,
        "admin_name": "Org Admin",
        "admin_password": ORG_ADMIN_PASSWORD,
        "phone": "1234567890"
    }
    async with session.post(f"{BASE_URL}/organizations/", json=payload, headers=headers) as resp:
        if resp.status != 200:
            text = await resp.text()
            print(f"Create Organization failed: {resp.status} - {text}")
            return None
        return await resp.json()

async def create_project(session, token, org_id):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "title": "Test Project",
        "category": "Development",
        "description": "Test Description",
        "status": "Draft",
        "deadline": "2026-12-31"
    }
    async with session.post(f"{BASE_URL}/projects/", json=payload, headers=headers) as resp:
        if resp.status != 200:
            text = await resp.text()
            print(f"Create Project failed: {resp.status} - {text}")
            return None
        return await resp.json()

async def list_projects(session, token):
    headers = {"Authorization": f"Bearer {token}"}
    async with session.get(f"{BASE_URL}/projects/", headers=headers) as resp:
        if resp.status != 200:
            text = await resp.text()
            print(f"List Projects failed: {resp.status} - {text}")
            return None
        return await resp.json()

async def list_users(session, token):
    headers = {"Authorization": f"Bearer {token}"}
    async with session.get(f"{BASE_URL}/organizations/users", headers=headers) as resp:
        if resp.status != 200:
            text = await resp.text()
            print(f"List Users failed: {resp.status} - {text}")
            return None
        return await resp.json()

async def main():
    async with aiohttp.ClientSession() as session:
        print(f"--- 1. Login as Superadmin ({SUPERADMIN_EMAIL}) ---")
        sa_token = await get_token(session, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        if not sa_token:
            print("Failed to login as superadmin. Ensure server is running and fix_superadmin.py was run.")
            return

        print(f"\n--- 2. Create Organization ({ORG_NAME}) & Admin ({ORG_ADMIN_EMAIL}) ---")
        org_data = await create_organization(session, sa_token)
        if not org_data: return
        print(f"Organization created: {org_data['name']}")

        print(f"\n--- 3. Login as New Org Admin ({ORG_ADMIN_EMAIL}) ---")
        oa_token = await get_token(session, ORG_ADMIN_EMAIL, ORG_ADMIN_PASSWORD)
        if not oa_token: return

        print("\n--- 4. Create Project ---")
        project_data = await create_project(session, oa_token, org_data['id'])
        if not project_data: return
        print(f"Project created: {project_data['title']}")

        print("\n--- 5. Verify Project Listing ---")
        projects = await list_projects(session, oa_token)
        if projects and len(projects) > 0:
            print(f"Projects found: {len(projects)}")
            print(f"First Project: {projects[0]['title']}")
        else:
            print("No projects found or failed.")

        print("\n--- 6. Verify User Listing ---")
        users = await list_users(session, oa_token)
        if users:
            print(f"Users found: {len(users)}")
            names = [u['full_name'] for u in users]
            print(f"User Names: {names}")
            if "Org Admin" in names:
                print("SUCCESS: Admin found in user list.")
            else:
                print("WARNING: Admin not found in user list.")
        else:
            print("No users found or failed.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
