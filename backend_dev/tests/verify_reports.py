import asyncio
import httpx
import sys
import os
from datetime import date, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

BASE_URL = "http://127.0.0.1:8016"

async def verify_reports():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        print("--- SETUP ---")
        # 1. Superadmin Creates Org
        print("1. Login Superadmin...")
        resp = await client.post("/auth/login", data={"username": settings.SUPERADMIN_EMAIL, "password": settings.SUPERADMIN_PASSWORD})
        sa_token = resp.json()["access_token"]
        sa_headers = {"Authorization": f"Bearer {sa_token}"}
        
        import time
        suffix = int(time.time())
        
        print("2. Create Org...")
        org_data = {
            "name": f"Report Org {suffix}",
            "email": f"reporg{suffix}@example.com",
            "phone": "9988776655",
            "address": "Org Addr",
            "admin_name": f"Org Admin {suffix}",
            "admin_email": f"repadmin{suffix}@example.com",
            "admin_password": "AdminPassword123!"
        }
        resp = await client.post("/organizations/", json=org_data, headers=sa_headers)
        org_id = resp.json()["id"]
        
        # 2. Org Admin Creates Project
        print("3. Login Admin & Create Project...")
        resp = await client.post("/auth/login", data={"username": org_data["admin_email"], "password": org_data["admin_password"]})
        admin_token = resp.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        proj_data = {
            "title": "Report Project",
            "status": "In Progress"
        }
        resp = await client.post("/projects/", json=proj_data, headers=admin_headers)
        project_id = resp.json()["id"]

        # 3. Create Users: Project Head, Faculty, Student (via signup for Fac/Stu)
        print("4. Create Project Head (Superadmin)...")
        ph_email = f"repph{suffix}@example.com"
        ph_pwd = "PHPassword123!"
        resp = await client.post("/project-heads/", json={
            "full_name": "Report PH",
            "email": ph_email,
            "password": ph_pwd,
            "organization_id": org_id
        }, headers=sa_headers)
        ph_id = resp.json()["id"]
        
        print("5. Create Faculty (Signup)...")
        fac_email = f"repfac{suffix}@example.com"
        fac_pwd = "FacPassword123!"
        resp = await client.post("/auth/signup", json={
            "email": fac_email,
            "password": fac_pwd,
            "full_name": "Report Faculty",
            "role_key": "FACULTY"
        })
        # Login to get ID (self)
        resp = await client.post("/auth/login", data={"username": fac_email, "password": fac_pwd})
        fac_token = resp.json()["access_token"]
        fac_headers = {"Authorization": f"Bearer {fac_token}"}
        # Get Me? Or just assume ID from somewhere? 
        # Actually UserResponse from login? No, login returns tokens.
        # We need ID for Student to submit to. 
        # Let's add a /auth/me endpoint or assume we can parse token, but token parsing in test is annoying.
        # Shortcut: Signup returns UserResponse which HAS ID?
        # Let's check signup response. crud/create_user returns db_user.
        # Yes, signup returns UserResponse.
        
        # Wait, previous signup calls didn't capture return.
        # Let's capture return of signup.
        
        # Re-doing signup to capture ID
        # Actually verify_faculty_student.py showed signup returns json.
        
        # NOTE: If Verified Email is required for login, we might fail here if we don't cheat.
        # But previous verify worked.
        
        # Resetting client session to clean state? No, distinct requests.
        pass
        
    # Re-run strict block for flow
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # SUPERADMIN SETUP (Quick)
        resp = await client.post("/auth/login", data={"username": settings.SUPERADMIN_EMAIL, "password": settings.SUPERADMIN_PASSWORD})
        sa_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        
        ts = int(time.time())
        # Org
        resp = await client.post("/organizations/", json={
            "name": f"Org{ts}", "email": f"o{ts}@x.com", "phone": "123", "address": "x",
            "admin_name": "A", "admin_email": f"a{ts}@x.com", "admin_password": "P!"
        }, headers=sa_headers)
        org_id = resp.json()["id"]
        
        # Admin -> Project
        resp = await client.post("/auth/login", data={"username": f"a{ts}@x.com", "password": "P!"})
        a_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        resp = await client.post("/projects/", json={"title": "P", "status": "In Progress"}, headers=a_headers)
        p_id = resp.json()["id"]
        
        # PH
        resp = await client.post("/project-heads/", json={
            "full_name": "PH", "email": f"ph{ts}@x.com", "password": "P!", "organization_id": org_id
        }, headers=sa_headers)
        ph_id = resp.json()["id"]
        
        # Faculty
        resp = await client.post("/auth/signup", json={
            "email": f"f{ts}@x.com", "password": "P!", "full_name": "F", "role_key": "FACULTY"
        })
        f_id = resp.json()["id"]
        resp = await client.post("/auth/login", data={"username": f"f{ts}@x.com", "password": "P!"})
        f_token = resp.json()["access_token"]
        f_headers = {"Authorization": f"Bearer {f_token}"}
        
        # Student
        resp = await client.post("/auth/signup", json={
            "email": f"s{ts}@x.com", "password": "P!", "full_name": "S", "role_key": "STUDENT"
        })
        # s_id = resp.json()["id"]
        resp = await client.post("/auth/login", data={"username": f"s{ts}@x.com", "password": "P!"})
        s_token = resp.json()["access_token"]
        s_headers = {"Authorization": f"Bearer {s_token}"}
        
        print("--- TESTING REPORTS ---")
        
        # 1. Student -> Faculty
        print("1. Student submitting report to Faculty...")
        s_report = {
            "title": "Student Report",
            "content": "Work done.",
            "project_id": p_id,
            "faculty_id": f_id
        }
        resp = await client.post("/reports/student", json=s_report, headers=s_headers)
        if resp.status_code == 200:
            print("   SUCCESS: Student Report Created.")
        else:
            print(f"   FAILURE: {resp.status_code} {resp.text}")
            
        # 2. Faculty -> PH
        print("2. Faculty submitting report to PH...")
        f_report = {
            "title": "Faculty Review",
            "content": "Review done.",
            "project_id": p_id,
            "project_head_id": ph_id
        }
        resp = await client.post("/reports/faculty", json=f_report, headers=f_headers)
        if resp.status_code == 200:
            print("   SUCCESS: Faculty Report Created.")
        else:
            print(f"   FAILURE: {resp.status_code} {resp.text}")
            
        # 3. Negative: Student -> PH (Should fail? Endpoint doesn't exist for it, or check role?)
        # Allowed endpoints are specific. Student calls /reports/student.
        # If student passes PH ID as faculty_id?
        print("3. Negative: Student submits to PH (as faculty)...")
        fail_report = s_report.copy()
        fail_report["faculty_id"] = ph_id # PH is not Faculty
        resp = await client.post("/reports/student", json=fail_report, headers=s_headers)
        if resp.status_code == 400:
             print("   SUCCESS: Blocked (Target not Faculty).")
        else:
             print(f"   FAILURE: Allowed or wrong error {resp.status_code}")

if __name__ == "__main__":
    asyncio.run(verify_reports())
