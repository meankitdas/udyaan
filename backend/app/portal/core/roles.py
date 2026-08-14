"""Role keys and the privilege groups the API authorises against.

Every router used to hard-code its own set literal, so granting a new role
access meant finding all of them. They live here instead.

``OWNER`` is the platform super-user and is a member of every group below, so a
single owner account reaches every feature without being assigned extra roles.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.models.role import Role, UserRole

OWNER = "OWNER"
SUPERADMIN = "SUPERADMIN"
ADMIN = "ADMIN"
PROJECT_HEAD = "PROJECT_HEAD"
FACULTY = "FACULTY"
STUDENT = "STUDENT"

# Seeded on startup; order is the display order in role pickers.
ALL_ROLES: tuple[tuple[str, str], ...] = (
    (OWNER, "Owner"),
    (SUPERADMIN, "Super Admin"),
    (ADMIN, "Admin"),
    (PROJECT_HEAD, "Project Head"),
    (FACULTY, "Faculty"),
    (STUDENT, "Student"),
)

ALL_ROLE_KEYS: frozenset[str] = frozenset(key for key, _ in ALL_ROLES)

# Platform-wide scope: not confined to one organisation.
PLATFORM_ROLES: frozenset[str] = frozenset({OWNER, SUPERADMIN})

# May administer an organisation.
ADMIN_ROLES: frozenset[str] = frozenset({OWNER, SUPERADMIN, ADMIN})

# May review or approve project artefacts.
REVIEWER_ROLES: frozenset[str] = frozenset({OWNER, SUPERADMIN, ADMIN, PROJECT_HEAD, FACULTY})

# May reshape delivery (action items, dependencies).
MANAGER_ROLES: frozenset[str] = REVIEWER_ROLES

# Shown as mentors in the community network; their connections need approval.
MENTOR_ROLE_KEYS: tuple[str, ...] = (OWNER, SUPERADMIN, ADMIN, PROJECT_HEAD, FACULTY)


async def role_keys(db: AsyncSession, user_id: str) -> set[str]:
    """The role keys assigned to a user."""
    result = await db.execute(
        select(Role.role_key)
        .join(UserRole, Role.id == UserRole.role_id)
        .where(UserRole.user_id == user_id)
    )
    return {key for key in result.scalars().all() if key}


async def is_owner(db: AsyncSession, user_id: str) -> bool:
    return OWNER in await role_keys(db, user_id)
