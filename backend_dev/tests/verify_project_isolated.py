import asyncio
import httpx
import sys
import os
from datetime import date, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

BASE_URL = "http://127.0.0.1:8013"

async def verify_project_isolated():
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
            "name": f"Project Org {suffix}",
            "email": f"projorg{suffix}@example.com",
            "phone": "9988776655",
            "address": "Org Addr",
            "admin_name": f"Org Admin {suffix}",
            "admin_email": f"projadmin{suffix}@example.com",
            "admin_password": "AdminPassword123!"
        }
        
        response = await client.post("/organizations/", json=org_data, headers=headers)
        if response.status_code != 200:
            print(f"FAILED to create org: {response.text}")
            return
        
        org_id = response.json()["id"]
        print(f"   Org Created: {org_id}")
        
        # ADMIN FLOW to Create Project
        print("\n3. Login as Org Admin...")
        response = await client.post("/auth/login", data={
            "username": org_data["admin_email"],
            "password": org_data["admin_password"]
        })
        admin_token = response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        print("\n4. Create Project as Admin...")
        project_data = {
            "title": "Smart Irrigation Scheduling",
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
        
        response = await client.post("/projects/", json=project_data, headers=admin_headers)
        if response.status_code == 200:
            print("   SUCCESS: Project created by Admin.")
            print(f"   Project ID: {response.json()['id']}")
        else:
            print(f"   FAILURE: {response.status_code} {response.text}")

if __name__ == "__main__":
    asyncio.run(verify_project_isolated())
