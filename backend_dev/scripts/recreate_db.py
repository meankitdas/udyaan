import asyncio
from app.database import engine
from app.models.base import Base
# Import all models to ensure they are registered with Base.metadata
from app.models.user import User
from app.models.organization import Organization
from app.models.role import Role, UserRole
from app.models.auth import RefreshToken, LoginSession, EmailVerification, PasswordReset
from app.models.project import Project
from app.models.project_compliance import ProjectMeeting, ActionItem
from app.models.report import Report

async def recreate_tables():
    async with engine.begin() as conn:
        print("Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables recreated successfully.")

if __name__ == "__main__":
    asyncio.run(recreate_tables())
