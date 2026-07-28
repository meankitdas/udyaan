"""Suggestions and embedding maintenance.

Two endpoint groups that share a dependency on the vector infrastructure:
"people you may know", which works with or without it, and the backfill hook,
which exists only because of it.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal import vectors
from app.portal.core.deps import get_current_user
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

ADMIN_ROLE_KEYS = ("ADMIN", "SUPERADMIN")

# Backfill is a paid, long-running operation. The cap bounds both the spend and
# the request duration, and the endpoint is designed to be called repeatedly
# until it reports zero rather than to finish everything in one shot.
MAX_BACKFILL = 500


async def require_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    role_keys = (
        await db.execute(
            select(Role.role_key)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == current_user.id)
        )
    ).scalars().all()

    if not set(role_keys) & set(ADMIN_ROLE_KEYS):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


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
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Embed posts and profiles that have no vector yet.

    The recovery path for background tasks that Cloud Run killed before they
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
