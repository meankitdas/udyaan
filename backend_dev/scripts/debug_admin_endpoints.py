import asyncio
import httpx
from app.main import app

async def debug_admin():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        print("\n--- Debugging Admin Endpoints ---")
        
        # 1. Login as Superadmin
        email = "apkumawat8437@gmail.com"
        password = "Akumawat8437@"
        print(f"Logging in as {email}...")

        # PRE-STEP: Create a Pending User via DB (Directly, to avoid API auto-approval or signup complexities)
        from app.database import AsyncSessionLocal
        from app.models.user import User
        from sqlalchemy.future import select
        from app.utils.id_generator import generate_user_id
        
        async with AsyncSessionLocal() as db:
             print("Creating dummy pending user...")
             uid = generate_user_id("STUDENT")
             dummy = User(
                 id=uid,
                 email="pending_test@example.com",
                 full_name="Pending Test",
                 password_hash="hash",
                 is_approved=False, # KEY
                 is_active=True,
                 organization_id=None # Superadmin calls should see it
             )
             # Check if exists
             res = await db.execute(select(User).where(User.email == "pending_test@example.com"))
             if not res.scalars().first():
                 db.add(dummy)
                 await db.commit()
             else:
                 print("Dummy user exists.")
        
        login_res = await ac.post("/auth/login", data={"username": email, "password": password})
        if login_res.status_code != 200:
            print(f"Login Failed: {login_res.text}")
            # Try creating if not exists? (Assume previous step ran)
            # If failed, maybe try superadmin?
            return
            
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Test Get Pending Approvals
        print("\nFetching Pending Approvals /admin/approvals ...")
        res_approvals = await ac.get("/admin/approvals", headers=headers)
        print(f"Status: {res_approvals.status_code}")
        if res_approvals.status_code != 200:
             print(f"Response: {res_approvals.text}")
             
        # 3. Test Get Projects
        print("\nFetching Projects /projects/ ...")
        res_projects = await ac.get("/projects/", headers=headers)
        print(f"Status: {res_projects.status_code}")
        if res_projects.status_code != 200:
             print(f"Response: {res_projects.text}")

if __name__ == "__main__":
    asyncio.run(debug_admin())
