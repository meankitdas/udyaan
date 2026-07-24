# app/database.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
# from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
import os

from app.portal.config import settings

load_dotenv()

engine = None
AsyncSessionLocal = None


def _init_db_sync():
    """Synchronous initialization of the database engine."""
    global engine, AsyncSessionLocal
    
    if engine is not None:
        return

    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL not set")

    # Optimized for AWS Lambda (Warm Starts)
    # pool_pre_ping=True: Checks connection liveliness before use (vital for handling server-side disconnects)
    # pool_recycle=300: Refresh connections every 5 mins to avoid stale connections
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,        # Keep pool small for Lambda concurrency
        max_overflow=10,
        connect_args={
            "command_timeout": 10  # Fail fast if DB is unresponsive
        }
    )
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )


async def get_db():
    global AsyncSessionLocal
    
    if AsyncSessionLocal is None:
        _init_db_sync()
        
    async with AsyncSessionLocal() as session:
        yield session


async def init_models():
    """Create portal tables and seed roles. Safe to call repeatedly."""
    from sqlalchemy import text
    from app.portal.models import Base

    _init_db_sync()
    async with engine.begin() as conn:
        try:
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pgcrypto"'))
        except Exception:
            # Managed Postgres may not permit extensions; tables may still work if it already exists.
            pass
        await conn.run_sync(Base.metadata.create_all)
        roles = [
            ("SUPERADMIN", "Super Admin"),
            ("ADMIN", "Admin"),
            ("PROJECT_HEAD", "Project Head"),
            ("FACULTY", "Faculty"),
            ("STUDENT", "Student"),
        ]
        for role_key, role_name in roles:
            await conn.execute(
                text(
                    "INSERT INTO roles (role_key, role_name) VALUES (:key, :name) "
                    "ON CONFLICT (role_key) DO NOTHING"
                ),
                {"key": role_key, "name": role_name},
            )
