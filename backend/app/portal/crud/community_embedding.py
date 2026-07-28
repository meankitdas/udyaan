"""Generating and storing embeddings for posts and viewer interests.

The design is shaped by three properties of the surrounding system.

**The embedder is synchronous.** ``app/rag/embeddings.py`` wraps the blocking
``AzureOpenAI`` client. Calling it directly from an async request handler stalls
the event loop for the whole round trip, which on a single App Runner instance
stalls every concurrent request, not just the one doing the embedding. Every
call here goes through ``asyncio.to_thread``.

**Embeddings can be missing, and that must be survivable.** They are produced by
a network call to a third party, written by background tasks that an idle
App Runner instance may never finish, and skipped entirely when pgvector is
absent. So a missing row is a normal state rather than an error: ranking falls
back to tag overlap for that post, and :func:`backfill_post_embeddings` catches
up later. Nothing in this module raises into a request path.

**Re-embedding is the expensive part, not storing.** Each call costs money and
latency, so :data:`source_hash` records what the stored vector was computed from
and work is skipped when the source text has not changed. A user editing their
bio should re-embed; a user loading their feed for the ninetieth time should
not.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Iterable, List, Optional, Sequence, Tuple
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal import vectors
from app.portal.vectors import (
    POST_EMBEDDING_TABLE,
    USER_EMBEDDING_TABLE,
    vector_literal,
)

logger = logging.getLogger(__name__)

# Azure rejects oversized batches, and a smaller batch also bounds how much work
# is lost if an instance dies mid-backfill.
BATCH_SIZE = 32


def source_hash(textual: str) -> str:
    return hashlib.sha256(textual.strip().lower().encode("utf-8")).hexdigest()


def _model_name() -> str:
    from app.rag.embeddings import get_embedder

    embedder = get_embedder()
    if embedder.is_azure:
        from app.config import get_settings

        return get_settings().azure_embedding_deployment
    return "hashed-fallback-512"


async def embed_texts(texts: Sequence[str]) -> Optional[List[List[float]]]:
    """Embed in a worker thread, returning None if the provider is unreachable.

    None rather than an exception because every caller's correct response to a
    failed embedding is the same: leave the cache alone and carry on with tag
    ranking.
    """
    if not texts:
        return []

    from app.rag.embeddings import get_embedder

    try:
        return await asyncio.to_thread(get_embedder().embed, list(texts))
    except Exception as exc:
        logger.warning("Embedding request failed (%s); leaving the cache unchanged.", exc)
        return None


def build_post_text(content: Optional[str], tags: Sequence[str]) -> str:
    """Flatten a post into the string that gets embedded.

    Tags are repeated ahead of the body rather than merely appended: they are the
    curated signal, the body is noisy, and putting them first keeps them inside
    the window for long posts.
    """
    tag_part = " ".join(tags)
    body = (content or "").strip()
    return f"{tag_part}. {body}".strip(" .") or tag_part or "untagged post"


def build_user_text(
    headline: Optional[str],
    bio: Optional[str],
    tags: Sequence[str],
    university: Optional[str],
) -> str:
    """Flatten a profile into an interest string.

    Deliberately excludes the person's name. Names carry no interest signal and
    actively distort similarity, clustering people who happen to share a common
    first name.
    """
    parts = [" ".join(tags), headline or "", bio or "", university or ""]
    joined = ". ".join(p.strip() for p in parts if p and p.strip())
    return joined or "no stated interests"


async def _upsert(
    db: AsyncSession,
    table: str,
    key_column: str,
    rows: Iterable[Tuple[str, List[float], str]],
) -> int:
    """Write vectors, replacing any existing row for the same owner."""
    model = _model_name()
    written = 0
    for key, vector, digest in rows:
        await db.execute(
            text(
                f"""
                INSERT INTO {table} ({key_column}, embedding, model, source_hash, updated_at)
                VALUES (:key, CAST(:embedding AS vector), :model, :digest, NOW())
                ON CONFLICT ({key_column}) DO UPDATE
                SET embedding = EXCLUDED.embedding,
                    model = EXCLUDED.model,
                    source_hash = EXCLUDED.source_hash,
                    updated_at = NOW()
                """
            ),
            {
                "key": key,
                "embedding": vector_literal(vector),
                "model": model,
                "digest": digest,
            },
        )
        written += 1
    return written


async def _existing_hash(db: AsyncSession, table: str, key_column: str, key: str) -> Optional[str]:
    result = await db.execute(
        text(f"SELECT source_hash FROM {table} WHERE {key_column} = :key"),
        {"key": key},
    )
    row = result.first()
    return row[0] if row else None


async def update_post_embedding(
    db: AsyncSession,
    post_id: UUID,
    content: Optional[str],
    tags: Sequence[str],
    *,
    commit: bool = True,
) -> bool:
    """Refresh one post's vector. Returns False when nothing was written.

    Safe to call from a background task: it swallows its own failures, because
    there is no caller left to handle them by the time it runs.
    """
    if not vectors.HAS_PGVECTOR:
        return False

    try:
        payload = build_post_text(content, tags)
        digest = source_hash(payload)
        if await _existing_hash(db, POST_EMBEDDING_TABLE, "post_id", str(post_id)) == digest:
            return False

        vecs = await embed_texts([payload])
        if not vecs:
            return False

        await _upsert(db, POST_EMBEDDING_TABLE, "post_id", [(str(post_id), vecs[0], digest)])
        if commit:
            await db.commit()
        return True
    except Exception as exc:
        logger.warning("Could not embed post %s (%s).", post_id, exc)
        if commit:
            await db.rollback()
        return False


async def update_user_embedding(
    db: AsyncSession,
    user_id: str,
    *,
    commit: bool = True,
) -> bool:
    """Refresh one user's interest vector from their current profile and tags."""
    if not vectors.HAS_PGVECTOR:
        return False

    try:
        result = await db.execute(
            text(
                """
                SELECT u.headline, u.bio, u.university,
                       COALESCE(
                           (SELECT STRING_AGG(t.label, ' ')
                            FROM user_tags ut
                            JOIN community_tags t ON t.id = ut.tag_id
                            WHERE ut.user_id = u.id),
                           ''
                       ) AS tag_labels
                FROM users u
                WHERE u.id = :user_id
                """
            ),
            {"user_id": user_id},
        )
        row = result.first()
        if row is None:
            return False

        headline, bio, university, tag_labels = row
        payload = build_user_text(headline, bio, (tag_labels or "").split(), university)
        digest = source_hash(payload)
        if await _existing_hash(db, USER_EMBEDDING_TABLE, "user_id", user_id) == digest:
            return False

        vecs = await embed_texts([payload])
        if not vecs:
            return False

        await _upsert(db, USER_EMBEDDING_TABLE, "user_id", [(user_id, vecs[0], digest)])
        if commit:
            await db.commit()
        return True
    except Exception as exc:
        logger.warning("Could not embed user %s (%s).", user_id, exc)
        if commit:
            await db.rollback()
        return False


async def backfill_post_embeddings(db: AsyncSession, limit: int = 200) -> int:
    """Embed posts that have no current vector.

    The recovery path for everything that can go wrong above: a background task
    killed mid-flight, an Azure outage, or pgvector being enabled after posts
    already existed. Ordered newest-first so a partial run improves the feed
    people actually see.
    """
    if not vectors.HAS_PGVECTOR:
        return 0

    result = await db.execute(
        text(
            f"""
            SELECT p.id,
                   p.body,
                   COALESCE(
                       (SELECT STRING_AGG(t.label, ' ')
                        FROM post_tags pt
                        JOIN community_tags t ON t.id = pt.tag_id
                        WHERE pt.post_id = p.id),
                       ''
                   ) AS tag_labels
            FROM community_posts p
            LEFT JOIN {POST_EMBEDDING_TABLE} e ON e.post_id = p.id
            WHERE p.is_removed = FALSE
              AND e.post_id IS NULL
            ORDER BY p.created_at DESC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    )
    rows = result.fetchall()
    if not rows:
        return 0

    written = 0
    for start in range(0, len(rows), BATCH_SIZE):
        chunk = rows[start : start + BATCH_SIZE]
        payloads = [build_post_text(r[1], (r[2] or "").split()) for r in chunk]
        vecs = await embed_texts(payloads)
        if not vecs:
            break
        written += await _upsert(
            db,
            POST_EMBEDDING_TABLE,
            "post_id",
            [
                (str(row[0]), vec, source_hash(payload))
                for row, vec, payload in zip(chunk, vecs, payloads)
            ],
        )
        await db.commit()

    return written


async def backfill_user_embeddings(db: AsyncSession, limit: int = 200) -> int:
    """Embed discoverable users who have no current vector."""
    if not vectors.HAS_PGVECTOR:
        return 0

    result = await db.execute(
        text(
            f"""
            SELECT u.id, u.headline, u.bio, u.university,
                   COALESCE(
                       (SELECT STRING_AGG(t.label, ' ')
                        FROM user_tags ut
                        JOIN community_tags t ON t.id = ut.tag_id
                        WHERE ut.user_id = u.id),
                       ''
                   ) AS tag_labels
            FROM users u
            LEFT JOIN {USER_EMBEDDING_TABLE} e ON e.user_id = u.id
            WHERE e.user_id IS NULL
            LIMIT :limit
            """
        ),
        {"limit": limit},
    )
    rows = result.fetchall()
    if not rows:
        return 0

    written = 0
    for start in range(0, len(rows), BATCH_SIZE):
        chunk = rows[start : start + BATCH_SIZE]
        payloads = [
            build_user_text(r[1], r[2], (r[4] or "").split(), r[3]) for r in chunk
        ]
        vecs = await embed_texts(payloads)
        if not vecs:
            break
        written += await _upsert(
            db,
            USER_EMBEDDING_TABLE,
            "user_id",
            [
                (row[0], vec, source_hash(payload))
                for row, vec, payload in zip(chunk, vecs, payloads)
            ],
        )
        await db.commit()

    return written


# --------------------------------------------------------------------------
# Background-task entry points
#
# FastAPI background tasks run after the response is sent, by which time the
# request's session has been closed and returned to the pool. Reusing it here
# would raise on the first statement, so each of these opens its own session and
# owns its own transaction.


async def _session():
    from app.portal import database as db_module

    if db_module.AsyncSessionLocal is None:
        db_module._init_db_sync()
    return db_module.AsyncSessionLocal()


async def embed_post_task(post_id: UUID, content: Optional[str], tags: Sequence[str]) -> None:
    """Embed a newly created or edited post. Never raises."""
    if not vectors.HAS_PGVECTOR:
        return
    try:
        session = await _session()
        async with session as db:
            await update_post_embedding(db, post_id, content, list(tags))
    except Exception as exc:
        logger.warning("Background embedding for post %s failed (%s).", post_id, exc)


async def embed_user_task(user_id: str) -> None:
    """Refresh a profile's interest vector after a profile or tag change."""
    if not vectors.HAS_PGVECTOR:
        return
    try:
        session = await _session()
        async with session as db:
            await update_user_embedding(db, user_id)
    except Exception as exc:
        logger.warning("Background embedding for user %s failed (%s).", user_id, exc)
