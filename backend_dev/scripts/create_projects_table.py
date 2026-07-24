import asyncio
from sqlalchemy import text
from app.database import engine

async def create_projects():
    async with engine.begin() as conn:
        print("Creating projects table...")
        try:
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
            print("Projects table created successfully.")
        except Exception as e:
            print(f"Error creating projects table: {e}")

if __name__ == "__main__":
    asyncio.run(create_projects())
