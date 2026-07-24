import asyncio
import httpx
from app.main import app
from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

async def verify_auto_approval():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        print("\n--- Verifying Auto Approval ---")
        
        # 1. Login Superadmin
        email = "apkumawat8437@gmail.com" # Updated Creds
        password = "Akumawat8437@"
        
        login_res = await ac.post("/auth/login", data={"username": email, "password": password})
        if login_res.status_code != 200:
            print("Login Failed")
            return
        
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Test Org Admin Approval (Create Org)
        org_data = {
            "name": "AutoApproveOrg",
            "email": "auto@org.com",
            "phone": "1112223333",
            "address": "Street",
            "admin_name": "Auto Admin",
            "admin_email": "autoadmin@org.com",
            "admin_password": "password123"
        }
        res_org = await ac.post("/organizations/", json=org_data, headers=headers)
        if res_org.status_code == 200:
            print("Org Created.")
            # Verify Admin Status
            async with AsyncSessionLocal() as db:
                res = await db.execute(select(User).where(User.email == "autoadmin@org.com"))
                user = res.scalars().first()
                if user.is_approved:
                    print("SUCCESS: Org Admin is Auto-Approved.")
                else:
                    print("FAILURE: Org Admin is NOT Approved.")
        else:
            print(f"Org Create Failed: {res_org.text}")
            
        # 3. Test Project Head Approval
        # Assuming we can create PH via API or Signup?
        # Let's try API /project-heads/ (requires Superadmin)
        from app.utils.id_generator import generate_org_id, generate_user_id
        # We need an org ID. Let's use the one created.
        org_id = res_org.json()["id"]
        
        ph_data = {
            "full_name": "Auto PH",
            "email": "autoph@org.com",
            "password": "password123",
            "phone": "4445556666",
            "organization_id": org_id
        }
        
        res_ph = await ac.post("/project-heads/", json=ph_data, headers=headers)
        if res_ph.status_code == 200:
            print("Project Head Created.")
            async with AsyncSessionLocal() as db:
                res = await db.execute(select(User).where(User.email == "autoph@org.com"))
                ph = res.scalars().first()
                if ph.is_approved:
                    print("SUCCESS: Project Head is Auto-Approved.")
                else:
                    print("FAILURE: Project Head is NOT Approved.")
        else:
             print(f"PH Create Failed: {res_ph.text}")

if __name__ == "__main__":
    asyncio.run(verify_auto_approval())
