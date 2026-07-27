"""Shared query helpers for the community network.

The three community routers all need the same derived data — a user's role, their
tags, and how the viewer relates to them — and all of it is per-user. Fetching it
inside a loop is the obvious implementation and the wrong one: a 20-card
directory page turns into 80+ round trips. Every helper here is therefore
batched, taking a list of user IDs and returning a dict keyed by user ID.
"""

import re
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.models.community import (
    CommunityTag,
    Connection,
    ConnectionStatus,
    Follow,
    UserTag,
)
from app.portal.models.organization import Organization
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.community import (
    MENTOR_ROLE_KEYS,
    ConnectionState,
    ProfileSummary,
    TagOut,
)

_SLUG_STRIP = re.compile(r"[^a-z0-9]+")


def slugify(label: str) -> str:
    """Normalize a free-text tag into its canonical slug.

    "Agri Tech", "agri_tech" and " AGRI-TECH " must all collapse to `agri-tech`,
    otherwise the directory filters fragment across near-duplicate tags.
    """
    return _SLUG_STRIP.sub("-", (label or "").strip().lower()).strip("-")[:60]


def community_role(role_key: Optional[str]) -> str:
    """Map a portal role onto the community's student/mentor split."""
    return "mentor" if (role_key or "").upper() in MENTOR_ROLE_KEYS else "student"


def is_mentor(role_key: Optional[str]) -> bool:
    return community_role(role_key) == "mentor"


async def get_role_keys(db: AsyncSession, user_ids: Sequence[str]) -> Dict[str, str]:
    """Role key per user. Users may hold several roles; the most privileged wins."""
    if not user_ids:
        return {}

    result = await db.execute(
        select(UserRole.user_id, Role.role_key)
        .join(Role, Role.id == UserRole.role_id)
        .where(UserRole.user_id.in_(list(user_ids)))
    )

    # Ranked so a FACULTY who is also a STUDENT is presented as a mentor rather
    # than flipping based on row order.
    precedence = {"SUPERADMIN": 5, "ADMIN": 4, "PROJECT_HEAD": 3, "FACULTY": 2, "STUDENT": 1}
    best: Dict[str, str] = {}
    for user_id, role_key in result:
        current = best.get(user_id)
        if current is None or precedence.get(role_key, 0) > precedence.get(current, 0):
            best[user_id] = role_key
    return best


async def get_tags_for_users(
    db: AsyncSession, user_ids: Sequence[str]
) -> Dict[str, List[TagOut]]:
    if not user_ids:
        return {}

    result = await db.execute(
        select(UserTag.user_id, CommunityTag)
        .join(CommunityTag, CommunityTag.id == UserTag.tag_id)
        .where(UserTag.user_id.in_(list(user_ids)))
        .order_by(CommunityTag.label)
    )

    tags: Dict[str, List[TagOut]] = {}
    for user_id, tag in result:
        tags.setdefault(user_id, []).append(TagOut.model_validate(tag))
    return tags


async def resolve_tags(
    db: AsyncSession, labels: Iterable[str]
) -> List[CommunityTag]:
    """Look up tags by slug, creating any that don't exist yet.

    The taxonomy is open — users can coin a tag the ecosystem hasn't seen — but
    it is normalized on the way in so the open part doesn't produce duplicates.
    """
    wanted: Dict[str, str] = {}
    for raw in labels:
        slug = slugify(raw)
        if slug and slug not in wanted:
            wanted[slug] = raw.strip()[:80]

    if not wanted:
        return []

    result = await db.execute(
        select(CommunityTag).where(CommunityTag.slug.in_(list(wanted.keys())))
    )
    found = {tag.slug: tag for tag in result.scalars()}

    for slug, label in wanted.items():
        if slug in found:
            continue
        tag = CommunityTag(slug=slug, label=label or slug.replace("-", " ").title())
        db.add(tag)
        found[slug] = tag

    await db.flush()
    # Preserve the order the caller supplied them in.
    return [found[slug] for slug in wanted if slug in found]


async def set_user_tags(db: AsyncSession, user: User, labels: Iterable[str]) -> List[CommunityTag]:
    """Replace a user's interest tags and keep the legacy `skills` column in sync.

    `users.skills` still backs the older project/peer skill matching in
    `api/community.py`. Mirroring the tags into it means adopting the new tag
    picker doesn't silently break those existing features.
    """
    tags = await resolve_tags(db, labels)
    new_ids = {tag.id for tag in tags}

    existing_rows = (
        await db.execute(select(UserTag).where(UserTag.user_id == user.id))
    ).scalars().all()
    existing_ids = {row.tag_id for row in existing_rows}

    for row in existing_rows:
        if row.tag_id not in new_ids:
            await db.delete(row)

    for tag_id in new_ids - existing_ids:
        db.add(UserTag(user_id=user.id, tag_id=tag_id))

    await _refresh_usage_counts(db, existing_ids | new_ids)

    user.skills = ", ".join(tag.label for tag in tags)
    await db.commit()
    return tags


async def _refresh_usage_counts(db: AsyncSession, tag_ids: Set[int]) -> None:
    """Recompute the denormalized counter for the tags that just changed."""
    if not tag_ids:
        return
    await db.flush()
    counts = await db.execute(
        select(UserTag.tag_id, func.count(UserTag.user_id))
        .where(UserTag.tag_id.in_(list(tag_ids)))
        .group_by(UserTag.tag_id)
    )
    tallied = dict(counts.all())
    rows = (
        await db.execute(select(CommunityTag).where(CommunityTag.id.in_(list(tag_ids))))
    ).scalars()
    for tag in rows:
        tag.usage_count = tallied.get(tag.id, 0)


async def get_connection_states(
    db: AsyncSession, viewer_id: str, user_ids: Sequence[str]
) -> Dict[str, Tuple[ConnectionState, Optional[UUID]]]:
    """How the viewer relates to each user: none / pending (either way) / connected."""
    if not user_ids:
        return {}

    ids = list(user_ids)
    result = await db.execute(
        select(Connection).where(
            or_(
                (Connection.requester_id == viewer_id) & Connection.addressee_id.in_(ids),
                (Connection.addressee_id == viewer_id) & Connection.requester_id.in_(ids),
            )
        )
    )

    states: Dict[str, Tuple[ConnectionState, Optional[UUID]]] = {}
    for conn in result.scalars():
        other = conn.addressee_id if conn.requester_id == viewer_id else conn.requester_id
        if conn.status == ConnectionStatus.ACCEPTED.value:
            states[other] = ("connected", conn.id)
        elif conn.status == ConnectionStatus.PENDING.value:
            outgoing = conn.requester_id == viewer_id
            states[other] = ("pending_outgoing" if outgoing else "pending_incoming", conn.id)
        # A declined connection is deliberately reported as "none" so the
        # requester can try again later without seeing a permanent rejection.
    return states


async def get_following(db: AsyncSession, viewer_id: str, user_ids: Sequence[str]) -> Set[str]:
    if not user_ids:
        return set()
    result = await db.execute(
        select(Follow.following_id).where(
            Follow.follower_id == viewer_id,
            Follow.following_id.in_(list(user_ids)),
        )
    )
    return set(result.scalars())


async def get_accepted_partner_ids(db: AsyncSession, user_id: str) -> Set[str]:
    """IDs of everyone this user is actually connected to."""
    result = await db.execute(
        select(Connection.requester_id, Connection.addressee_id).where(
            Connection.status == ConnectionStatus.ACCEPTED.value,
            or_(Connection.requester_id == user_id, Connection.addressee_id == user_id),
        )
    )
    partners = set()
    for requester_id, addressee_id in result:
        partners.add(addressee_id if requester_id == user_id else requester_id)
    return partners


async def get_mutual_counts(
    db: AsyncSession, viewer_partners: Set[str], user_ids: Sequence[str]
) -> Dict[str, int]:
    """Count connections shared between the viewer and each candidate.

    Takes the viewer's partner set as an argument rather than re-deriving it, so
    a directory page computes it once instead of once per card.
    """
    if not user_ids or not viewer_partners:
        return {}

    ids = list(user_ids)
    result = await db.execute(
        select(Connection.requester_id, Connection.addressee_id).where(
            Connection.status == ConnectionStatus.ACCEPTED.value,
            or_(Connection.requester_id.in_(ids), Connection.addressee_id.in_(ids)),
        )
    )

    id_set = set(ids)
    counts: Dict[str, int] = {}
    for requester_id, addressee_id in result:
        for candidate, partner in ((requester_id, addressee_id), (addressee_id, requester_id)):
            if candidate in id_set and partner in viewer_partners and partner != candidate:
                counts[candidate] = counts.get(candidate, 0) + 1
    return counts


async def get_org_names(db: AsyncSession, org_ids: Sequence[str]) -> Dict[str, str]:
    cleaned = [o for o in set(org_ids) if o]
    if not cleaned:
        return {}
    result = await db.execute(
        select(Organization.id, Organization.name).where(Organization.id.in_(cleaned))
    )
    return dict(result.all())


async def build_summaries(
    db: AsyncSession,
    users: Sequence[User],
    viewer_id: str,
    *,
    viewer_tag_slugs: Optional[Set[str]] = None,
    viewer_partners: Optional[Set[str]] = None,
    include_mutuals: bool = False,
) -> List[ProfileSummary]:
    """Turn User rows into directory cards, batching every lookup they need."""
    if not users:
        return []

    user_ids = [u.id for u in users]
    role_keys = await get_role_keys(db, user_ids)
    tags_by_user = await get_tags_for_users(db, user_ids)
    states = await get_connection_states(db, viewer_id, user_ids)
    following = await get_following(db, viewer_id, user_ids)
    org_names = await get_org_names(db, [u.organization_id for u in users])

    mutuals: Dict[str, int] = {}
    if include_mutuals:
        partners = (
            viewer_partners
            if viewer_partners is not None
            else await get_accepted_partner_ids(db, viewer_id)
        )
        mutuals = await get_mutual_counts(db, partners, user_ids)

    summaries: List[ProfileSummary] = []
    for user in users:
        role_key = role_keys.get(user.id)
        tags = tags_by_user.get(user.id, [])
        state, conn_id = states.get(user.id, ("none", None))

        shared: List[str] = []
        if viewer_tag_slugs:
            shared = [t.label for t in tags if t.slug in viewer_tag_slugs]

        summaries.append(
            ProfileSummary(
                id=user.id,
                full_name=user.full_name,
                role_key=role_key,
                community_role=community_role(role_key),
                headline=user.headline,
                avatar_url=user.avatar_url,
                university=user.university,
                organization_name=org_names.get(user.organization_id or ""),
                cohort=user.cohort,
                tags=tags,
                connection_state=state,
                connection_id=conn_id,
                is_following=user.id in following,
                shared_tags=shared,
                mutual_connections=mutuals.get(user.id, 0),
            )
        )
    return summaries


async def get_viewer_tag_slugs(db: AsyncSession, user_id: str) -> Set[str]:
    result = await db.execute(
        select(CommunityTag.slug)
        .join(UserTag, UserTag.tag_id == CommunityTag.id)
        .where(UserTag.user_id == user_id)
    )
    return set(result.scalars())
