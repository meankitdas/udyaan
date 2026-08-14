"""Create the platform owner account.

The owner is the only role that can assign roles, so it cannot be created
through the API — something has to exist first. This runs on startup and is
idempotent: an existing owner is never overwritten, so redeploying does not
reset a password the owner has since changed.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.config import settings
from app.portal.core.roles import OWNER
from app.portal.core.security import get_password_hash
from app.portal import database as portal_db
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.utils.id_generator import generate_user_id

log = logging.getLogger(__name__)


async def ensure_owner(db: AsyncSession) -> str | None:
    """Create the configured owner if no owner exists yet. Returns its id."""
    email = (settings.OWNER_EMAIL or "").strip().lower()
    password = settings.OWNER_PASSWORD or ""
    if not email or not password:
        return None

    role = (await db.execute(select(Role).where(Role.role_key == OWNER))).scalars().first()
    if not role:
        log.warning("OWNER role is not seeded; skipping owner bootstrap")
        return None

    existing_owner = (
        await db.execute(
            select(User).join(UserRole, UserRole.user_id == User.id).where(UserRole.role_id == role.id)
        )
    ).scalars().first()
    if existing_owner:
        return existing_owner.id

    user = (await db.execute(select(User).where(User.email == email))).scalars().first()
    if user:
        # Account already exists under another role: promote it rather than
        # failing on the unique email constraint.
        await db.execute(UserRole.__table__.delete().where(UserRole.user_id == user.id))
    else:
        user = User(
            id=generate_user_id(OWNER),
            full_name=settings.OWNER_NAME or "Platform Owner",
            email=email,
            password_hash=get_password_hash(password),
        )
        db.add(user)
        await db.flush()

    user.is_active = True
    user.is_email_verified = True
    user.is_approved = True
    db.add(UserRole(user_id=user.id, role_id=role.id))
    await db.commit()

    log.info("Owner account provisioned: %s", email)
    return user.id


async def bootstrap_owner() -> None:
    # Assigned lazily by the first DB call, so it must be read off the module.
    if portal_db.AsyncSessionLocal is None:
        portal_db._init_db_sync()
    async with portal_db.AsyncSessionLocal() as db:
        await ensure_owner(db)
