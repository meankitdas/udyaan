import asyncio
import sys
import os
from sqlalchemy import text
from app.database import engine

async def check_user(email):
    async with engine.begin() as conn:
        print(f"Checking user: {email}")
        result = await conn.execute(text("SELECT id, email FROM users WHERE email = :email"), {"email": email})
        user = result.fetchone()
        
        if not user:
            print("User not found.")
            return

        print(f"User found: ID={user.id}")
        
        # Check Role
        role_res = await conn.execute(text("""
            SELECT r.role_key, r.role_name 
            FROM roles r
            JOIN user_roles ur ON ur.role_id = r.id
            WHERE ur.user_id = :uid
        """), {"uid": user.id})
        
        role = role_res.fetchone()
        if role:
            print(f"Role Key: {role.role_key}")
            print(f"Role Name: {role.role_name}")
        else:
            print("No role assigned.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        email = sys.argv[1]
    else:
        email = "silentknight1480@gmail.com"
        
    asyncio.run(check_user(email))
