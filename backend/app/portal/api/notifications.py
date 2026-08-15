"""Digest dispatch and unsubscribe.

Dispatch is a scheduled endpoint rather than an in-process timer: App Runner
throttles CPU once a response is sent, so a background loop would run at
unpredictable intervals or not at all. The same EventBridge -> API destination
pattern already used for the embedding backfill drives it, authenticated with
the same internal-token header.
"""

import hmac
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.config import settings
from app.portal.core.deps import get_current_user
from app.portal.crud import notification as crud
from app.portal.database import get_db
from app.portal.models.user import User
from app.portal.utils import digest
from app.portal.utils.email import asend_email

log = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


class DispatchResult(BaseModel):
    considered: int = 0
    sent: int = 0
    skipped_capped: int = 0
    skipped_optout: int = 0
    purged: int = 0


class DigestPreference(BaseModel):
    email_digest_enabled: bool


def _authorize_internal(token: Optional[str]) -> None:
    """Shared-secret auth for the scheduler, which cannot hold a user JWT."""
    if not settings.BACKFILL_TOKEN:
        # An unset secret must close the endpoint, never open it.
        raise HTTPException(status_code=503, detail="Internal dispatch is not configured")
    if not token or not hmac.compare_digest(token, settings.BACKFILL_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid internal token")


@router.post("/dispatch", response_model=DispatchResult)
async def dispatch_digests(
    limit: int = Query(200, ge=1, le=1000),
    x_internal_token: Optional[str] = Header(default=None, alias="X-Internal-Token"),
    db: AsyncSession = Depends(get_db),
):
    _authorize_internal(x_internal_token)

    result = DispatchResult()
    result.purged = await crud.purge_stale(db)
    await db.commit()

    recipients = await crud.pending_recipients(db, limit=limit)
    result.considered = len(recipients)

    for user_id in recipients:
        user = (
            await db.execute(select(User).where(User.id == user_id))
        ).scalars().first()
        if user is None or not user.is_active or not user.email:
            continue

        if user.email_digest_enabled is False:
            result.skipped_optout += 1
            # Clear the queue so an opted-out user is not rescanned forever.
            pending = await crud.claim_for_user(db, user_id)
            await crud.mark_emailed(db, pending)
            await db.commit()
            continue

        if not await crud.within_frequency_cap(db, user_id):
            result.skipped_capped += 1
            continue

        pending = await crud.claim_for_user(db, user_id)
        if not pending:
            continue

        names = await crud.actor_names(db, [n.actor_id for n in pending if n.actor_id])
        unsubscribe_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}/portal/community/unsubscribe"
            f"?u={user_id}&t={crud.unsubscribe_token(user_id)}"
        )
        subject, text, html = digest.render(
            user.full_name or "", user_id, pending, names, unsubscribe_url
        )

        if await asend_email(user.email, subject, text, html_content=html):
            await crud.mark_emailed(db, pending)
            await db.commit()
            result.sent += 1
        else:
            # Leave the rows pending so the next run retries rather than
            # silently dropping the notification.
            await db.rollback()

    return result


@router.get("/preferences", response_model=DigestPreference)
async def read_preference(current_user: User = Depends(get_current_user)):
    return DigestPreference(
        email_digest_enabled=bool(current_user.email_digest_enabled)
    )


@router.put("/preferences", response_model=DigestPreference)
async def update_preference(
    payload: DigestPreference,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.email_digest_enabled = payload.email_digest_enabled
    await db.commit()
    return payload


@router.post("/unsubscribe", response_model=DigestPreference)
async def unsubscribe(
    u: str = Query(..., description="User id from the emailed link"),
    t: str = Query(..., description="Signature from the emailed link"),
    db: AsyncSession = Depends(get_db),
):
    """One-click opt-out. Unauthenticated by design: the signature is the proof.

    Recipients must be able to unsubscribe without logging in, and the token is
    scoped to exactly this one action.
    """
    if not crud.verify_unsubscribe(u, t):
        raise HTTPException(status_code=400, detail="Invalid unsubscribe link")

    user = (await db.execute(select(User).where(User.id == u))).scalars().first()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")

    user.email_digest_enabled = False
    await db.commit()
    return DigestPreference(email_digest_enabled=False)
