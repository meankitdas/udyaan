"""Owner console: platform-wide user administration.

Restricted to the OWNER role rather than to every platform-level role. Role
assignment is privilege escalation by definition, so allowing a superadmin here
would let any superadmin promote themselves to owner.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.core.deps import get_current_user
from app.portal.core.roles import ALL_ROLES, OWNER, role_keys
from app.portal.core.security import get_password_hash
from app.portal.database import get_db
from app.portal.models.auth import RefreshToken
from app.portal.models.organization import Organization
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.owner import (
    ManagedUser,
    ManagedUserPage,
    OwnerOverview,
    OwnerUserCreate,
    OwnerUserUpdate,
    PasswordChange,
    RoleChange,
    RoleOption,
)
from app.portal.utils.id_generator import generate_user_id

router = APIRouter(prefix="/owner", tags=["owner"])


async def require_owner(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if OWNER not in await role_keys(db, current_user.id):
        raise HTTPException(status_code=403, detail="Owner access required")
    return current_user


async def _owner_count(db: AsyncSession) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(UserRole)
            .join(Role, Role.id == UserRole.role_id)
            .where(Role.role_key == OWNER)
        )
    ).scalar_one()


async def _load_target(db: AsyncSession, user_id: str) -> User:
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _revoke_sessions(db: AsyncSession, user_id: str) -> None:
    """Drop refresh tokens so a demotion or lockout takes effect immediately."""
    tokens = (
        await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
            )
        )
    ).scalars().all()
    from datetime import datetime

    for token in tokens:
        token.revoked_at = datetime.utcnow()


def _to_managed(user: User, role_key: Optional[str], org_name: Optional[str]) -> ManagedUser:
    return ManagedUser(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role_key=role_key,
        organization_id=user.organization_id,
        organization_name=org_name,
        is_active=bool(user.is_active),
        is_approved=bool(user.is_approved),
        is_email_verified=bool(user.is_email_verified),
        created_at=user.created_at,
    )


@router.get("/overview", response_model=OwnerOverview)
async def overview(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_owner),
):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    active_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_active.is_(True)))
    ).scalar_one()
    pending = (
        await db.execute(select(func.count()).select_from(User).where(User.is_approved.is_(False)))
    ).scalar_one()
    orgs = (await db.execute(select(func.count()).select_from(Organization))).scalar_one()

    by_role = (
        await db.execute(
            select(Role.role_key, func.count(UserRole.user_id))
            .join(UserRole, UserRole.role_id == Role.id, isouter=True)
            .group_by(Role.role_key)
        )
    ).all()

    return OwnerOverview(
        total_users=total_users,
        active_users=active_users,
        pending_approval=pending,
        organizations=orgs,
        users_by_role={key: count for key, count in by_role},
    )


@router.get("/roles", response_model=list[RoleOption])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_owner),
):
    counts = dict(
        (
            await db.execute(
                select(Role.role_key, func.count(UserRole.user_id))
                .join(UserRole, UserRole.role_id == Role.id, isouter=True)
                .group_by(Role.role_key)
            )
        ).all()
    )
    return [
        RoleOption(role_key=key, role_name=name, user_count=counts.get(key, 0))
        for key, name in ALL_ROLES
    ]


@router.get("/users", response_model=ManagedUserPage)
async def list_users(
    search: Optional[str] = None,
    role_key: Optional[str] = None,
    organization_id: Optional[str] = None,
    is_approved: Optional[bool] = None,
    skip: int = 0,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_owner),
):
    query = (
        select(User, Role.role_key, Organization.name)
        .join(UserRole, UserRole.user_id == User.id, isouter=True)
        .join(Role, Role.id == UserRole.role_id, isouter=True)
        .join(Organization, Organization.id == User.organization_id, isouter=True)
    )
    count_query = (
        select(func.count(func.distinct(User.id)))
        .select_from(User)
        .join(UserRole, UserRole.user_id == User.id, isouter=True)
        .join(Role, Role.id == UserRole.role_id, isouter=True)
    )

    if search:
        # Bound the pattern and escape the wildcards so a search for "%" does not
        # degrade into a full scan the caller did not ask for.
        term = f"%{search.strip()[:80].replace('%', r'\%').replace('_', r'\_')}%"
        clause = or_(User.full_name.ilike(term), User.email.ilike(term), User.id.ilike(term))
        query = query.where(clause)
        count_query = count_query.where(clause)
    if role_key:
        query = query.where(Role.role_key == role_key.upper())
        count_query = count_query.where(Role.role_key == role_key.upper())
    if organization_id:
        query = query.where(User.organization_id == organization_id)
        count_query = count_query.where(User.organization_id == organization_id)
    if is_approved is not None:
        query = query.where(User.is_approved.is_(is_approved))
        count_query = count_query.where(User.is_approved.is_(is_approved))

    total = (await db.execute(count_query)).scalar_one()
    rows = (
        await db.execute(query.order_by(User.created_at.desc()).offset(skip).limit(limit))
    ).all()

    return ManagedUserPage(
        total=total,
        users=[_to_managed(user, key, org_name) for user, key, org_name in rows],
    )


@router.post("/users", response_model=ManagedUser, status_code=201)
async def create_managed_user(
    payload: OwnerUserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_owner),
):
    existing = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = (
        await db.execute(select(Role).where(Role.role_key == payload.role_key))
    ).scalars().first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role {payload.role_key} is not configured")

    if payload.organization_id:
        org = (
            await db.execute(
                select(Organization).where(Organization.id == payload.organization_id)
            )
        ).scalars().first()
        if not org:
            raise HTTPException(status_code=400, detail="Organization not found")

    user = User(
        id=generate_user_id(payload.role_key),
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone or None,
        password_hash=get_password_hash(payload.password),
        organization_id=payload.organization_id or None,
        is_active=True,
        is_email_verified=payload.is_email_verified,
        is_approved=payload.is_approved,
    )
    db.add(user)
    try:
        await db.flush()
        db.add(UserRole(user_id=user.id, role_id=role.id))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Email or phone number already in use")

    await db.refresh(user)
    return _to_managed(user, payload.role_key, None)


@router.patch("/users/{user_id}", response_model=ManagedUser)
async def update_managed_user(
    user_id: str,
    payload: OwnerUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    user = await _load_target(db, user_id)

    if payload.is_active is False and user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone or None
    if payload.organization_id is not None:
        if payload.organization_id:
            org = (
                await db.execute(
                    select(Organization).where(Organization.id == payload.organization_id)
                )
            ).scalars().first()
            if not org:
                raise HTTPException(status_code=400, detail="Organization not found")
        user.organization_id = payload.organization_id or None
    if payload.is_approved is not None:
        user.is_approved = payload.is_approved
    if payload.is_email_verified is not None:
        user.is_email_verified = payload.is_email_verified
    if payload.is_active is not None:
        user.is_active = payload.is_active
        if payload.is_active is False:
            await _revoke_sessions(db, user.id)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Phone number already in use")

    await db.refresh(user)
    keys = await role_keys(db, user.id)
    return _to_managed(user, next(iter(keys), None), None)


@router.put("/users/{user_id}/role", response_model=ManagedUser)
async def change_role(
    user_id: str,
    payload: RoleChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    user = await _load_target(db, user_id)

    role = (
        await db.execute(select(Role).where(Role.role_key == payload.role_key))
    ).scalars().first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role {payload.role_key} is not configured")

    current_keys = await role_keys(db, user.id)
    if OWNER in current_keys and payload.role_key != OWNER and await _owner_count(db) <= 1:
        raise HTTPException(status_code=400, detail="The last owner cannot be demoted")
    if user.id == current_user.id and payload.role_key != OWNER:
        raise HTTPException(status_code=400, detail="You cannot remove your own owner role")

    await db.execute(
        UserRole.__table__.delete().where(UserRole.user_id == user.id)
    )
    db.add(UserRole(user_id=user.id, role_id=role.id))
    # A cached JWT still carries the old role until it expires.
    await _revoke_sessions(db, user.id)
    await db.commit()
    await db.refresh(user)

    return _to_managed(user, payload.role_key, None)


@router.put("/users/{user_id}/password")
async def set_password(
    user_id: str,
    payload: PasswordChange,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_owner),
):
    user = await _load_target(db, user_id)
    user.password_hash = get_password_hash(payload.new_password)
    await _revoke_sessions(db, user.id)
    await db.commit()
    return {"message": "Password updated"}


@router.delete("/users/{user_id}")
async def delete_managed_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    user = await _load_target(db, user_id)

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if OWNER in await role_keys(db, user.id) and await _owner_count(db) <= 1:
        raise HTTPException(status_code=400, detail="The last owner cannot be deleted")

    await db.delete(user)
    await db.commit()
    return {"message": "User deleted"}
