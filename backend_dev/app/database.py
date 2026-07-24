# app/database.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
# from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
import os

from app.config import settings

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
