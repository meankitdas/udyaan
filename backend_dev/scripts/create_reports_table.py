import asyncio
from sqlalchemy import text
from app.database import engine

async def create_reports():
    async with engine.begin() as conn:
        print("Creating reports table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS reports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                project_id UUID REFERENCES projects(id),
                submitted_by UUID REFERENCES users(id),
                submitted_to UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        print("Reports table created.")

if __name__ == "__main__":
    asyncio.run(create_reports())
