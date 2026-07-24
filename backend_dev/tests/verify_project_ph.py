import asyncio
import httpx
import sys
import os
from datetime import date, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

BASE_URL = "http://127.0.0.1:8014"

async def verify_project_ph():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # SUPERADMIN FLOW to setup Org and Admin
        print("1. Login as Superadmin...")
        response = await client.post("/auth/login", data={
            "username": settings.SUPERADMIN_EMAIL,
            "password": settings.SUPERADMIN_PASSWORD
        })
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print("\n2. Create an Organization...")
        import time
        suffix = int(time.time())
        org_data = {
            "name": f"PH Project Org {suffix}",
            "email": f"phprojorg{suffix}@example.com",
            "phone": "9988776655",
            "address": "Org Addr",
            "admin_name": f"Org Admin {suffix}",
            "admin_email": f"phprojadmin{suffix}@example.com",
            "admin_password": "AdminPassword123!"
        }
        
        response = await client.post("/organizations/", json=org_data, headers=headers)
        if response.status_code != 200:
            print(f"FAILED to create org: {response.text}")
            return
        
        org_id = response.json()["id"]
        print(f"   Org Created: {org_id}")
        
        # PH Creation
        print("\n3. Create Project Head Linked to Org...")
        ph_data = {
            "full_name": f"Linked PH {suffix}",
            "email": f"phprojph{suffix}@example.com",
            "password": "PHPassword123!",
            "phone": f"55{suffix}"[:10],
            "organization_id": org_id
        }
        response = await client.post("/project-heads/", json=ph_data, headers=headers)
        if response.status_code != 200:
            print(f"Failed to create PH: {response.status_code} {response.text}")
            return
            
        print("\n4. Login as Project Head...")
        response = await client.post("/auth/login", data={
            "username": ph_data["email"],
            "password": ph_data["password"]
        })
        ph_token = response.json()["access_token"]
        ph_headers = {"Authorization": f"Bearer {ph_token}"}
        
        print("\n5. Create Project as Project Head...")
        project_data = {
            "title": "Smart Irrigation (PH)",
            "category": "Irrigation & Water",
            "description": "Design a low-cost system...",
            "project_type": "Prototype",
            "target_assignee": "Faculty + Students",
            "required_skills": "IoT, basic agriculture",
            "duration": "3 months",
            "deliverables": "Prototype setup...",
            "deadline": str(date.today() + timedelta(days=90)),
            "status": "Draft"
        }
        
        response = await client.post("/projects/", json=project_data, headers=ph_headers)
        if response.status_code == 200:
            print("   SUCCESS: Project created by Project Head.")
            print(f"   Project ID: {response.json()['id']}")
        else:
            print(f"   FAILURE: {response.status_code} {response.text}")

if __name__ == "__main__":
    asyncio.run(verify_project_ph())
