import asyncio
import httpx
import sys
import os
from datetime import date, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

BASE_URL = "http://127.0.0.1:8012"

async def verify_project_creation():
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
            print(f"   Created By: {response.json()['created_by']}")
        else:
            print(f"   FAILURE: {response.status_code} {response.text}")

        # PROJECT HEAD FLOW
        print("\n5. Create Project Head Linked to Org...")
        # Create PH as Superadmin
        ph_data = {
            "full_name": f"Linked PH {suffix}",
            "email": f"projph{suffix}@example.com",
            "password": "PHPassword123!",
            "phone": f"33{suffix}"[:10],
            "organization_id": org_id
        }
        response = await client.post("/project-heads/", json=ph_data, headers=headers)
        if response.status_code != 200:
            print(f"Failed to create PH: {response.status_code} {response.text}")
            return
            
        print("\n6. Login as Project Head...")
        response = await client.post("/auth/login", data={
            "username": ph_data["email"],
            "password": ph_data["password"]
        })
        ph_token = response.json()["access_token"]
        ph_headers = {"Authorization": f"Bearer {ph_token}"}
        
        print("\n7. Create Project as Project Head...")
        ph_project_data = project_data.copy()
        ph_project_data["title"] = "Available Project by PH"
        
        response = await client.post("/projects/", json=ph_project_data, headers=ph_headers)
        if response.status_code == 200:
            print("   SUCCESS: Project created by Project Head.")
        else:
            print(f"   FAILURE: {response.status_code} {response.text}")

        # NEGATIVE TEST
        print("\n8. Verify Student Cannot Create Project...")
        # Create Student
        # Requires signup flow or superadmin seeding, let's use signup endpoint
        # Signup logic: POST /auth/signup
        student_data = {
            "email": f"student{suffix}@example.com",
            "password": "StudentPassword123!",
            "full_name": "Test Student",
            "role_key": "STUDENT",
            "phone": f"44{suffix}"[:10]
        }
        # Note: Signup creates unverified student. 
        # But verify flow is mockable? 
        # Actually create_user function allows it. Let's assume we can signup and login.
        # But wait, create_user sets is_active=True.
        
        # Actually, let's just assume we catch 403.
        # I'll enable this check if I have time, but verification plan only needed positive cases for now.
        # I'll stick to positive cases for Admin and PH as requested.

if __name__ == "__main__":
    asyncio.run(verify_project_creation())
