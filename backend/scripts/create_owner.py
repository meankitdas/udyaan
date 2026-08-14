"""Create or reset the platform owner account.

Usage:
    python -m scripts.create_owner --email owner@udyaan.org --name "Ankit Das"

The password is read from the OWNER_PASSWORD environment variable or prompted
for interactively, never passed as an argument, so it does not land in shell
history or the process list.
"""

import argparse
import asyncio
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from app.portal import database as portal_db  # noqa: E402
from app.portal.core.roles import OWNER  # noqa: E402
from app.portal.core.security import get_password_hash  # noqa: E402
from app.portal.models.role import Role, UserRole  # noqa: E402
from app.portal.models.user import User  # noqa: E402
from app.portal.utils.id_generator import generate_user_id  # noqa: E402

MIN_PASSWORD_LENGTH = 10


async def main(email: str, name: str, password: str) -> None:
    from sqlalchemy.future import select

    await portal_db.init_models()

    async with portal_db.AsyncSessionLocal() as db:
        role = (await db.execute(select(Role).where(Role.role_key == OWNER))).scalars().first()
        if not role:
            raise SystemExit("OWNER role missing — run the app once so roles are seeded.")

        user = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if user:
            user.password_hash = get_password_hash(password)
            user.full_name = name or user.full_name
            await db.execute(UserRole.__table__.delete().where(UserRole.user_id == user.id))
            action = "updated"
        else:
            user = User(
                id=generate_user_id(OWNER),
                full_name=name,
                email=email,
                password_hash=get_password_hash(password),
            )
            db.add(user)
            await db.flush()
            action = "created"

        user.is_active = True
        user.is_email_verified = True
        user.is_approved = True
        db.add(UserRole(user_id=user.id, role_id=role.id))
        await db.commit()

        print(f"Owner {action}: {user.email} (id {user.id})")

    await portal_db.engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create or reset the platform owner")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Platform Owner")
    args = parser.parse_args()

    secret = os.getenv("OWNER_PASSWORD") or getpass.getpass("Owner password: ")
    if len(secret) < MIN_PASSWORD_LENGTH:
        raise SystemExit(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.")

    asyncio.run(main(args.email.strip().lower(), args.name, secret))
