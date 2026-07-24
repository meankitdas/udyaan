# app/database.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
# from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
import os
import ssl as ssl_module
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from app.portal.config import settings

load_dotenv()

engine = None
AsyncSessionLocal = None


def _normalize_asyncpg_url(url: str):
    """Return (url, connect_args) for asyncpg.

    asyncpg does not accept libpq-style ``sslmode``/``ssl`` query params the way
    psycopg does. If the URL asks for SSL (e.g. AWS RDS ``?ssl=require``), strip
    those params and hand asyncpg an SSL context instead.
    """
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))

    ssl_value = query.pop("ssl", None) or query.pop("sslmode", None)
    connect_args: dict = {"command_timeout": 10}

    if ssl_value:
        value = ssl_value.lower()
        if value in ("disable", "false", "0"):
            connect_args["ssl"] = False
        elif value in ("require", "true", "1", "prefer", "allow"):
            # Encrypt but don't verify the CA (matches libpq sslmode=require).
            ctx = ssl_module.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl_module.CERT_NONE
            connect_args["ssl"] = ctx
        else:  # verify-ca / verify-full
            connect_args["ssl"] = ssl_module.create_default_context()

    rebuilt = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return rebuilt, connect_args


def _init_db_sync():
    """Synchronous initialization of the database engine."""
    global engine, AsyncSessionLocal
    
    if engine is not None:
        return

    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL not set")

    # Coerce plain postgres schemes to the async driver.
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = "postgresql+asyncpg://" + DATABASE_URL[len("postgres://"):]
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = "postgresql+asyncpg://" + DATABASE_URL[len("postgresql://"):]

    DATABASE_URL, connect_args = _normalize_asyncpg_url(DATABASE_URL)

    # pool_pre_ping=True: Checks connection liveliness before use
    # pool_recycle=300: Refresh connections every 5 mins to avoid stale connections
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=10,
        connect_args=connect_args,
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
        # Lightweight migrations for columns added after initial deployments.
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS skills TEXT"))
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
