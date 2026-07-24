import asyncio
from sqlalchemy import text
import app.database
from app.models import Base
from dotenv import load_dotenv

load_dotenv()

async def init_db():
    await app.database.init_db()
    async with app.database.engine.begin() as conn:
        print("Creating extension...")
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pgcrypto"'))
        
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        
        print("Seeding roles...")
        roles_data = [
            ('SUPERADMIN', 'Super Admin'),
            ('ADMIN', 'Admin'),
            ('PROJECT_HEAD', 'Project Head'),
            ('FACULTY', 'Faculty'),
            ('STUDENT', 'Student')
        ]
        
        for role_key, role_name in roles_data:
            await conn.execute(text(
                "INSERT INTO roles (role_key, role_name) VALUES (:key, :name) ON CONFLICT (role_key) DO NOTHING"
            ), {"key": role_key, "name": role_name})
        
    print("Database initialised successfully.")
    await app.database.engine.dispose()

if __name__ == "__main__":
    asyncio.run(init_db())
