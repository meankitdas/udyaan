import asyncio
from sqlalchemy import text
from app.portal.database import engine

async def update_schema():
    async with engine.begin() as conn:
        print("Creating organizations table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS organizations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(150) NOT NULL,
                email VARCHAR(150),
                phone VARCHAR(20),
                address TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        
        print("Creating projects table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                description TEXT,
                project_type VARCHAR(100),
                target_assignee VARCHAR(100),
                required_skills TEXT,
                duration VARCHAR(50),
                deliverables TEXT,
                deadline DATE,
                status VARCHAR(50) DEFAULT 'Draft',
                created_by UUID REFERENCES users(id),
                organization_id UUID REFERENCES organizations(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        
        print("Adding organization_id to users...")
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id)"))
            print("Column added.")
        except Exception as e:
            # Likely already exists
            print(f"Computed error (maybe already exists): {e}")

if __name__ == "__main__":
    asyncio.run(update_schema())
