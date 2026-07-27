"""Community profiles, the member directory, and the interest-tag taxonomy."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.core.deps import get_current_user
from app.portal.crud import community as crud
from app.portal.database import get_db
from app.portal.models.community import (
    CommunityTag,
    Connection,
    ConnectionStatus,
    Follow,
    UserAchievement,
    UserTag,
)
from app.portal.models.organization import Organization
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.community import (
    AchievementCreate,
    AchievementOut,
    AchievementUpdate,
    DirectoryFacets,
    DirectoryPage,
    ProfileDetail,
    ProfileTagsUpdate,
    ProfileUpdate,
    TagCreate,
    TagOut,
)

router = APIRouter(prefix="/community", tags=["community-profiles"])


# --------------------------------------------------------------------------
# Tags
# --------------------------------------------------------------------------

@router.get("/tags", response_model=List[TagOut])
async def list_tags(
    q: Optional[str] = Query(default=None, description="Substring match on label or slug"),
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Autocomplete source for the tag picker, most-used first."""
    query = select(CommunityTag)
    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        query = query.where(
            or_(func.lower(CommunityTag.label).like(needle), CommunityTag.slug.like(needle))
        )
    query = query.order_by(CommunityTag.usage_count.desc(), CommunityTag.label).limit(limit)

    result = await db.execute(query)
    return [TagOut.model_validate(tag) for tag in result.scalars()]


@router.post("/tags", response_model=TagOut)
async def create_tag(
    payload: TagCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Create-or-get a tag. Idempotent on the normalized slug."""
    slug = crud.slugify(payload.label)
    if not slug:
        raise HTTPException(status_code=400, detail="Tag name must contain letters or numbers.")

    existing = (
        await db.execute(select(CommunityTag).where(CommunityTag.slug == slug))
    ).scalars().first()
    if existing:
        return TagOut.model_validate(existing)

    tag = CommunityTag(slug=slug, label=payload.label.strip()[:80], category=payload.category)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return TagOut.model_validate(tag)


# --------------------------------------------------------------------------
# Profile reads
# --------------------------------------------------------------------------

async def _build_detail(db: AsyncSession, user: User, viewer: User) -> ProfileDetail:
    is_self = user.id == viewer.id

    viewer_tag_slugs = await crud.get_viewer_tag_slugs(db, viewer.id)
    viewer_partners = await crud.get_accepted_partner_ids(db, viewer.id)
    summaries = await crud.build_summaries(
        db,
        [user],
        viewer.id,
        viewer_tag_slugs=viewer_tag_slugs,
        viewer_partners=viewer_partners,
        include_mutuals=not is_self,
    )
    summary = summaries[0]

    achievements = (
        await db.execute(
            select(UserAchievement)
            .where(UserAchievement.user_id == user.id)
            .order_by(UserAchievement.sort_order, UserAchievement.achieved_on.desc().nullslast())
        )
    ).scalars().all()

    connection_count = (
        await db.execute(
            select(func.count()).select_from(Connection).where(
                Connection.status == ConnectionStatus.ACCEPTED.value,
                or_(Connection.requester_id == user.id, Connection.addressee_id == user.id),
            )
        )
    ).scalar() or 0

    follower_count = (
        await db.execute(
            select(func.count()).select_from(Follow).where(Follow.following_id == user.id)
        )
    ).scalar() or 0

    following_count = (
        await db.execute(
            select(func.count()).select_from(Follow).where(Follow.follower_id == user.id)
        )
    ).scalar() or 0

    return ProfileDetail(
        **summary.model_dump(),
        # Contact details are for the member themself and their accepted
        # connections; the directory is not a scrapeable address book.
        email=user.email if (is_self or summary.connection_state == "connected") else None,
        phone=user.phone if (is_self or summary.connection_state == "connected") else None,
        bio=user.bio,
        is_discoverable=bool(user.is_discoverable),
        achievements=[AchievementOut.model_validate(a) for a in achievements],
        connection_count=connection_count,
        follower_count=follower_count,
        following_count=following_count,
        is_self=is_self,
        created_at=user.created_at,
    )


@router.get("/profiles/me", response_model=ProfileDetail)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _build_detail(db, current_user, current_user)


@router.put("/profiles/me", response_model=ProfileDetail)
async def update_my_profile(
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # exclude_unset so an omitted field keeps its value instead of being nulled.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)
    return await _build_detail(db, current_user, current_user)


@router.put("/profiles/me/tags", response_model=List[TagOut])
async def update_my_tags(
    payload: ProfileTagsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tags = await crud.set_user_tags(db, current_user, payload.tags)
    return [TagOut.model_validate(tag) for tag in tags]


@router.get("/profiles/{user_id}", response_model=ProfileDetail)
async def get_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user or user.is_active is False:
        raise HTTPException(status_code=404, detail="Profile not found")
    return await _build_detail(db, user, current_user)


# --------------------------------------------------------------------------
# Directory
# --------------------------------------------------------------------------

@router.get("/directory", response_model=DirectoryPage)
async def directory(
    q: Optional[str] = Query(default=None, description="Name, headline, or university"),
    role: Optional[str] = Query(default=None, description="student | mentor"),
    tags: Optional[str] = Query(default=None, description="Comma-separated tag slugs"),
    university: Optional[str] = None,
    organization_id: Optional[str] = None,
    cohort: Optional[str] = None,
    sort: str = Query(default="relevance", description="relevance | name | newest"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Searchable, filterable member directory."""
    query = select(User).where(
        User.is_active == True,  # noqa: E712
        User.is_discoverable == True,  # noqa: E712
        User.id != current_user.id,
    )

    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(User.full_name).like(needle),
                func.lower(User.headline).like(needle),
                func.lower(User.university).like(needle),
                func.lower(User.bio).like(needle),
            )
        )

    if university:
        query = query.where(User.university == university)
    if organization_id:
        query = query.where(User.organization_id == organization_id)
    if cohort:
        query = query.where(User.cohort == cohort)

    if role in ("student", "mentor"):
        from app.portal.schemas.community import MENTOR_ROLE_KEYS

        mentor_ids = select(UserRole.user_id).join(Role, Role.id == UserRole.role_id).where(
            Role.role_key.in_(MENTOR_ROLE_KEYS)
        )
        query = query.where(
            User.id.in_(mentor_ids) if role == "mentor" else User.id.not_in(mentor_ids)
        )

    tag_slugs = [t.strip().lower() for t in (tags or "").split(",") if t.strip()]
    if tag_slugs:
        # ANY of the selected tags, matching how faceted filters are usually read.
        tagged = (
            select(UserTag.user_id)
            .join(CommunityTag, CommunityTag.id == UserTag.tag_id)
            .where(CommunityTag.slug.in_(tag_slugs))
        )
        query = query.where(User.id.in_(tagged))

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar() or 0

    viewer_tag_slugs = await crud.get_viewer_tag_slugs(db, current_user.id)

    if sort == "name":
        query = query.order_by(User.full_name)
    elif sort == "newest":
        query = query.order_by(User.created_at.desc().nullslast())
    else:
        # "Relevance" is shared-interest count, computed as a correlated
        # subquery so it can be sorted in the database rather than by paging the
        # whole directory into memory. This is the same overlap signal the feed
        # will rank on, and the seam where embeddings slot in later.
        overlap = (
            select(func.count())
            .select_from(UserTag)
            .join(CommunityTag, CommunityTag.id == UserTag.tag_id)
            .where(UserTag.user_id == User.id, CommunityTag.slug.in_(viewer_tag_slugs or [""]))
            .correlate(User)
            .scalar_subquery()
        )
        query = query.order_by(overlap.desc(), User.full_name)

    query = query.offset((page - 1) * page_size).limit(page_size)
    users = (await db.execute(query)).scalars().all()

    viewer_partners = await crud.get_accepted_partner_ids(db, current_user.id)
    results = await crud.build_summaries(
        db,
        users,
        current_user.id,
        viewer_tag_slugs=viewer_tag_slugs,
        viewer_partners=viewer_partners,
        include_mutuals=True,
    )

    return DirectoryPage(
        results=results,
        total=total,
        page=page,
        page_size=page_size,
        has_more=page * page_size < total,
    )


@router.get("/directory/facets", response_model=DirectoryFacets)
async def directory_facets(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Filter options derived from live data, so no option returns nothing."""
    universities = (
        await db.execute(
            select(distinct(User.university))
            .where(User.university.isnot(None), User.university != "", User.is_active == True)  # noqa: E712
            .order_by(User.university)
            .limit(200)
        )
    ).scalars().all()

    cohorts = (
        await db.execute(
            select(distinct(User.cohort))
            .where(User.cohort.isnot(None), User.cohort != "", User.is_active == True)  # noqa: E712
            .order_by(User.cohort.desc())
            .limit(50)
        )
    ).scalars().all()

    orgs = (
        await db.execute(
            select(Organization.id, Organization.name).order_by(Organization.name).limit(200)
        )
    ).all()

    tags = (
        await db.execute(
            select(CommunityTag)
            .where(CommunityTag.usage_count > 0)
            .order_by(CommunityTag.usage_count.desc(), CommunityTag.label)
            .limit(40)
        )
    ).scalars().all()

    return DirectoryFacets(
        universities=list(universities),
        cohorts=list(cohorts),
        organizations=[{"id": oid, "name": name} for oid, name in orgs],
        tags=[TagOut.model_validate(t) for t in tags],
    )


# --------------------------------------------------------------------------
# Achievements
# --------------------------------------------------------------------------

@router.post("/profiles/me/achievements", response_model=AchievementOut, status_code=201)
async def add_achievement(
    payload: AchievementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    achievement = UserAchievement(user_id=current_user.id, **payload.model_dump())
    db.add(achievement)
    await db.commit()
    await db.refresh(achievement)
    return AchievementOut.model_validate(achievement)


@router.put("/profiles/me/achievements/{achievement_id}", response_model=AchievementOut)
async def update_achievement(
    achievement_id: UUID,
    payload: AchievementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    achievement = await _own_achievement(db, achievement_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(achievement, field, value)
    await db.commit()
    await db.refresh(achievement)
    return AchievementOut.model_validate(achievement)


@router.delete("/profiles/me/achievements/{achievement_id}", status_code=204)
async def delete_achievement(
    achievement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    achievement = await _own_achievement(db, achievement_id, current_user.id)
    await db.delete(achievement)
    await db.commit()


async def _own_achievement(
    db: AsyncSession, achievement_id: UUID, user_id: str
) -> UserAchievement:
    achievement = (
        await db.execute(
            select(UserAchievement).where(
                UserAchievement.id == achievement_id,
                # Scoped to the owner in the query itself, so a wrong-owner ID is
                # a 404 and never reveals that the record exists.
                UserAchievement.user_id == user_id,
            )
        )
    ).scalars().first()
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")
    return achievement
