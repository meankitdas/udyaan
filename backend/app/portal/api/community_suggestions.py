"""Suggestions and embedding maintenance.

Two endpoint groups that share a dependency on the vector infrastructure:
"people you may know", which works with or without it, and the backfill hook,
which exists only because of it.
"""

import logging
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal import vectors
from app.portal.config import settings
from app.portal.core.deps import (
    get_current_user,
    unauthorized,
    user_from_access_token,
)
from app.portal.crud import community_embedding as embedding_crud
from app.portal.crud import community_suggestion as suggestion_crud
from app.portal.database import get_db
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.community import (
    BackfillResult,
    DismissResult,
    SuggestionPage,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/community", tags=["community-suggestions"])

ADMIN_ROLE_KEYS = ("OWNER", "ADMIN", "SUPERADMIN")

# auto_error=False so a missing Authorization header falls through to the
# service-token check instead of 401-ing before it runs.
oauth2_optional = OAuth2PasswordBearer(tokenUrl="portal/auth/login", auto_error=False)

# Backfill is a paid, long-running operation. The cap bounds both the spend and
# the request duration, and the endpoint is designed to be called repeatedly
# until it reports zero rather than to finish everything in one shot.
MAX_BACKFILL = 500


async def _has_admin_role(db: AsyncSession, user_id: str) -> bool:
    role_keys = (
        await db.execute(
            select(Role.role_key)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )
    ).scalars().all()
    return bool(set(role_keys) & set(ADMIN_ROLE_KEYS))


def _service_token_valid(candidate: Optional[str]) -> bool:
    """Constant-time check of the unattended-maintenance token.

    An unset ``BACKFILL_TOKEN`` must reject every candidate rather than compare
    equal to an absent header, otherwise forgetting to configure the secret
    would silently expose the endpoint.
    """
    expected = settings.BACKFILL_TOKEN
    if not expected or not candidate:
        return False
    return secrets.compare_digest(candidate, expected)


async def require_backfill_caller(
    x_internal_token: Optional[str] = Header(default=None, alias="X-Internal-Token"),
    token: Optional[str] = Depends(oauth2_optional),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Accept either an admin session or the scheduler's service token.

    Embedding writes are best-effort background tasks, and App Runner throttles
    CPU once a response is sent, so some of them are lost and nothing else
    reconciles them. That makes unattended backfill necessary, but a recurring
    job cannot hold an admin JWT because access tokens expire. The service token
    covers that gap without widening access for anyone else.
    """
    if _service_token_valid(x_internal_token):
        return None
    if token is None:
        raise unauthorized("Could not validate credentials", "token_invalid")
    user = await user_from_access_token(token, db)
    if not await _has_admin_role(db, user.id):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/suggestions", response_model=SuggestionPage)
async def list_suggestions(
    limit: int = Query(12, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """People the viewer may know, best match first."""
    results, has_more = await suggestion_crud.fetch_suggestions(
        db, current_user.id, limit=limit, offset=offset
    )
    return SuggestionPage(
        results=results,
        has_more=has_more,
        personalized=bool(vectors.HAS_PGVECTOR),
    )


@router.post("/suggestions/{user_id}/dismiss", response_model=DismissResult)
async def dismiss_suggestion(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stop suggesting this person.

    Does not verify the target exists. A dismissal for an unknown id is inert --
    it can only ever filter a row out of a suggestion list -- and checking would
    turn this into an endpoint that reports whether an arbitrary user id is
    real.
    """
    dismissed = await suggestion_crud.dismiss_suggestion(db, current_user.id, user_id)
    if not dismissed:
        raise HTTPException(status_code=400, detail="Cannot dismiss yourself")
    return DismissResult(dismissed=True, user_id=user_id)


@router.post("/embeddings/backfill", response_model=BackfillResult)
async def backfill_embeddings(
    limit: int = Query(200, ge=1, le=MAX_BACKFILL),
    _admin: Optional[User] = Depends(require_backfill_caller),
    db: AsyncSession = Depends(get_db),
):
    """Embed posts and profiles that have no vector yet.

    The recovery path for background tasks that App Runner killed before they
    finished, and the migration path for content that predates embeddings being
    enabled. Idempotent: rows that already have a current vector are skipped.
    """
    if not vectors.HAS_PGVECTOR:
        return BackfillResult(
            posts_embedded=0, users_embedded=0, vector_search_enabled=False
        )

    posts = await embedding_crud.backfill_post_embeddings(db, limit=limit)
    users = await embedding_crud.backfill_user_embeddings(db, limit=limit)
    return BackfillResult(
        posts_embedded=posts, users_embedded=users, vector_search_enabled=True
    )
