import asyncio
from sqlalchemy import text
from app.database import engine

async def recreate_projects():
    async with engine.begin() as conn:
        print("Dropping projects table...")
        await conn.execute(text("DROP TABLE IF EXISTS projects CASCADE"))
        
        print("Creating projects table...")
        await conn.execute(text("""
            CREATE TABLE projects (
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
        print("Projects table recreated successfully.")

if __name__ == "__main__":
    asyncio.run(recreate_projects())
