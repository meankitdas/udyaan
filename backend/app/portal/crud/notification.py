"""The notification gateway and digest dispatcher.

Enqueue is deliberately the only way a notification is created, so the rules
that stop members being spammed live in one place rather than in each feature.

Timing, following LinkedIn's ATC:

* ``AGGREGATION_MINUTES`` — how long a notification is held before it may be
  emailed. This is the window in which seeing it in-app cancels the email, and
  it is what turns a burst into one digest instead of several.
* ``MIN_GAP_HOURS`` — frequency cap. However busy the platform gets, one member
  receives at most one digest in this window.
* ``MAX_AGE_DAYS`` — anything older is dropped rather than emailed, because a
  four-day-old "someone messaged you" is noise, not a notification.
"""

import hashlib
import hmac
import logging
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Optional, Sequence

from sqlalchemy import and_, func, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.config import settings
from app.portal.models.notification import Notification, NotificationKind
from app.portal.models.user import User

log = logging.getLogger(__name__)

AGGREGATION_MINUTES = 20
MIN_GAP_HOURS = 4
MAX_AGE_DAYS = 3
# Bounds one digest so a very active week cannot render a thousand-row email.
MAX_LINES_PER_DIGEST = 12
# Bounds the fan-out of a single post, which is the only unbounded source here.
MAX_POST_RECIPIENTS = 500


def utcnow() -> datetime:
    """Naive UTC, matching the TIMESTAMP columns used across the portal."""
    return datetime.utcnow()


async def enqueue(
    db: AsyncSession,
    *,
    user_id: str,
    kind: str,
    actor_id: Optional[str] = None,
    target_id: Optional[str] = None,
) -> None:
    """Queue one notification, collapsing repeats onto the pending row.

    Never raises: a notification is not worth failing the action that caused it.
    """
    if not user_id or user_id == actor_id:
        return
    try:
        # ON CONFLICT DO NOTHING is what makes "five messages in one thread"
        # collapse to a single digest line without a read-then-write race.
        await db.execute(
            pg_insert(Notification.__table__)
            .values(
                user_id=user_id,
                kind=kind,
                actor_id=actor_id,
                target_id=str(target_id) if target_id else None,
                created_at=utcnow(),
            )
            .on_conflict_do_nothing(
                index_elements=["user_id", "kind", "target_id"],
                index_where=text("emailed_at IS NULL AND seen_at IS NULL"),
            )
        )
    except Exception as exc:
        log.warning("notification enqueue failed (%s for %s): %s", kind, user_id, exc)


async def enqueue_many(
    db: AsyncSession,
    *,
    user_ids: Sequence[str],
    kind: str,
    actor_id: Optional[str] = None,
    target_id: Optional[str] = None,
) -> None:
    recipients = [u for u in dict.fromkeys(user_ids) if u and u != actor_id]
    if not recipients:
        return
    rows = [
        {
            "user_id": user_id,
            "kind": kind,
            "actor_id": actor_id,
            "target_id": str(target_id) if target_id else None,
            "created_at": utcnow(),
        }
        for user_id in recipients[:MAX_POST_RECIPIENTS]
    ]
    try:
        await db.execute(
            pg_insert(Notification.__table__)
            .values(rows)
            .on_conflict_do_nothing(
                index_elements=["user_id", "kind", "target_id"],
                index_where=text("emailed_at IS NULL AND seen_at IS NULL"),
            )
        )
    except Exception as exc:
        log.warning("bulk notification enqueue failed (%s): %s", kind, exc)


async def mark_seen(
    db: AsyncSession, user_id: str, *, kind: str, target_id: Optional[str] = None
) -> None:
    """Cancel the pending email because the member saw it in the app."""
    conditions = [
        Notification.user_id == user_id,
        Notification.kind == kind,
        Notification.seen_at.is_(None),
    ]
    if target_id is not None:
        conditions.append(Notification.target_id == str(target_id))
    try:
        await db.execute(
            update(Notification).where(and_(*conditions)).values(seen_at=utcnow())
        )
    except Exception as exc:
        log.debug("mark_seen failed for %s: %s", user_id, exc)


# --------------------------------------------------------------------------
# Unsubscribe
# --------------------------------------------------------------------------

def unsubscribe_token(user_id: str) -> str:
    """Signed, stateless opt-out token. No table, nothing to expire."""
    return hmac.new(
        settings.SECRET_KEY.encode(), f"unsub:{user_id}".encode(), hashlib.sha256
    ).hexdigest()[:32]


def verify_unsubscribe(user_id: str, token: str) -> bool:
    return hmac.compare_digest(unsubscribe_token(user_id), token or "")


# --------------------------------------------------------------------------
# Dispatch
# --------------------------------------------------------------------------

async def pending_recipients(db: AsyncSession, limit: int = 200) -> List[str]:
    """Users with notifications ready to be emailed.

    "Ready" means unseen, never emailed, older than the aggregation window and
    younger than the staleness cutoff.
    """
    now = utcnow()
    ready_before = now - timedelta(minutes=AGGREGATION_MINUTES)
    too_old = now - timedelta(days=MAX_AGE_DAYS)

    rows = (
        await db.execute(
            select(Notification.user_id)
            .where(
                Notification.seen_at.is_(None),
                Notification.emailed_at.is_(None),
                Notification.created_at <= ready_before,
                Notification.created_at >= too_old,
            )
            .group_by(Notification.user_id)
            .limit(limit)
        )
    ).scalars().all()
    return list(rows)


async def claim_for_user(db: AsyncSession, user_id: str) -> List[Notification]:
    """The notifications that will go into this user's digest."""
    now = utcnow()
    return list(
        (
            await db.execute(
                select(Notification)
                .where(
                    Notification.user_id == user_id,
                    Notification.seen_at.is_(None),
                    Notification.emailed_at.is_(None),
                    Notification.created_at <= now - timedelta(minutes=AGGREGATION_MINUTES),
                    Notification.created_at >= now - timedelta(days=MAX_AGE_DAYS),
                )
                .order_by(Notification.created_at.desc())
                .limit(MAX_LINES_PER_DIGEST)
            )
        ).scalars().all()
    )


async def within_frequency_cap(db: AsyncSession, user_id: str) -> bool:
    """False when this user was emailed too recently."""
    last = (
        await db.execute(
            select(func.max(Notification.emailed_at)).where(
                Notification.user_id == user_id
            )
        )
    ).scalar()
    if last is None:
        return True
    return last <= utcnow() - timedelta(hours=MIN_GAP_HOURS)


async def actor_names(db: AsyncSession, ids: Iterable[str]) -> Dict[str, str]:
    wanted = [i for i in dict.fromkeys(ids) if i]
    if not wanted:
        return {}
    rows = (
        await db.execute(select(User.id, User.full_name).where(User.id.in_(wanted)))
    ).all()
    return {uid: name for uid, name in rows}


async def mark_emailed(db: AsyncSession, notifications: Sequence[Notification]) -> None:
    if not notifications:
        return
    await db.execute(
        update(Notification)
        .where(Notification.id.in_([n.id for n in notifications]))
        .values(emailed_at=utcnow())
    )


async def purge_stale(db: AsyncSession) -> int:
    """Drop notifications too old to be worth sending, so they stop being scanned."""
    result = await db.execute(
        update(Notification)
        .where(
            Notification.emailed_at.is_(None),
            Notification.seen_at.is_(None),
            Notification.created_at < utcnow() - timedelta(days=MAX_AGE_DAYS),
        )
        .values(seen_at=utcnow())
    )
    return result.rowcount or 0
