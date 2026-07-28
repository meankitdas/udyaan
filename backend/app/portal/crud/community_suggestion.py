"""People-you-may-know suggestions.

The whole computation happens in one SQL statement for the same reason feed
ranking does (see ``crud/community_post.py``): the candidate set is "everyone
the viewer is not already connected to", and pulling that into Python to score
it would mean transferring the user table on every request.

Scoring blends four signals, each normalized to [0, 1] so :data:`WEIGHTS` can be
retuned without re-deriving the formula:

``mutual``
    Shared accepted connections, saturating at :data:`MUTUAL_SATURATION`. Two
    mutuals is a far stronger signal than one; the twelfth adds almost nothing,
    and without saturation a handful of hyper-connected people would win every
    slot for everyone.
``tags``
    Overlapping interests, saturating at :data:`TAG_SATURATION`.
``cohort``
    Same cohort, university, or organization. Graded rather than boolean --
    sharing a cohort is a much sharper signal than sharing a university that may
    have thousands of students.
``similarity``
    Cosine similarity between interest embeddings, contributing 0 whenever
    pgvector is unavailable or either side has no vector yet.

The weights do not sum to 1 when embeddings are absent, which is intentional:
rescaling the remaining terms would change every score the moment a backfill
finished, reshuffling suggestions for reasons the user cannot perceive.
Suggestions simply score lower until vectors exist.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal import vectors
from app.portal.crud.community import build_summaries, get_viewer_tag_slugs
from app.portal.models.user import User
from app.portal.schemas.community import ProfileSummary

WEIGHTS = {
    "mutual": 0.40,
    "tags": 0.30,
    "cohort": 0.20,
    "similarity": 0.10,
}

MUTUAL_SATURATION = 5.0
TAG_SATURATION = 3.0

# Below this, a "suggestion" is really just a random person. Returning fewer
# results is better than padding the rail with strangers.
MIN_SCORE = 0.05


async def dismiss_suggestion(db: AsyncSession, user_id: str, target_id: str) -> bool:
    """Record a rejection. Idempotent, and silently ignores self-dismissal."""
    if user_id == target_id:
        return False

    await db.execute(
        text(
            """
            INSERT INTO community_suggestion_dismissals (user_id, dismissed_user_id)
            VALUES (:user_id, :target_id)
            ON CONFLICT (user_id, dismissed_user_id) DO NOTHING
            """
        ),
        {"user_id": user_id, "target_id": target_id},
    )
    await db.commit()
    return True


async def fetch_suggestions(
    db: AsyncSession,
    viewer_id: str,
    limit: int = 12,
    offset: int = 0,
) -> Tuple[List[ProfileSummary], bool]:
    """Rank people the viewer might know. Returns (results, has_more)."""

    use_vectors = bool(vectors.HAS_PGVECTOR)

    # Only joined when embeddings exist; otherwise the term is a literal 0 so the
    # planner never touches the vector tables.
    if use_vectors:
        similarity_join = f"""
            LEFT JOIN {vectors.USER_EMBEDDING_TABLE} ve ON ve.user_id = :viewer_id
            LEFT JOIN {vectors.USER_EMBEDDING_TABLE} ce ON ce.user_id = u.id
        """
        # `<=>` is cosine distance in [0, 2]; 1 - distance maps it back to a
        # similarity, and GREATEST clamps the antipodal case to 0 rather than
        # letting a negative term cancel out real signals.
        similarity_expr = """
            CASE
                WHEN ve.embedding IS NULL OR ce.embedding IS NULL THEN 0.0
                ELSE GREATEST(0.0, 1.0 - (ve.embedding <=> ce.embedding))
            END
        """
    else:
        similarity_join = ""
        similarity_expr = "0.0"

    query = text(
        f"""
        WITH viewer AS (
            SELECT id, cohort, university, organization_id
            FROM users WHERE id = :viewer_id
        ),
        viewer_friends AS (
            SELECT CASE WHEN c.requester_id = :viewer_id
                        THEN c.addressee_id ELSE c.requester_id END AS friend_id
            FROM connections c
            WHERE c.status = 'accepted'
              AND (c.requester_id = :viewer_id OR c.addressee_id = :viewer_id)
        ),
        -- Candidate generation before scoring. Without this the query scores
        -- every user in the database on every request; the union below is
        -- exactly the set that can score above zero, reached through indexes.
        pool AS (
            SELECT DISTINCT candidate_id FROM (
                SELECT CASE WHEN c.requester_id = vf.friend_id
                            THEN c.addressee_id ELSE c.requester_id END AS candidate_id
                FROM viewer_friends vf
                JOIN connections c
                  ON c.status = 'accepted'
                 AND (c.requester_id = vf.friend_id OR c.addressee_id = vf.friend_id)
                UNION ALL
                SELECT ut.user_id
                FROM user_tags ut
                WHERE ut.tag_id IN (SELECT tag_id FROM user_tags WHERE user_id = :viewer_id)
                UNION ALL
                SELECT u.id
                FROM users u CROSS JOIN viewer v
                WHERE (v.cohort IS NOT NULL AND u.cohort = v.cohort)
                   OR (v.organization_id IS NOT NULL AND u.organization_id = v.organization_id)
            ) AS reachable
        ),
        candidates AS (
            SELECT
                u.id AS id,
                (
                    SELECT COUNT(*)
                    FROM connections c2
                    JOIN viewer_friends vf ON (
                        (c2.requester_id = u.id AND c2.addressee_id = vf.friend_id)
                        OR (c2.addressee_id = u.id AND c2.requester_id = vf.friend_id)
                    )
                    WHERE c2.status = 'accepted'
                ) AS mutual_count,
                (
                    SELECT COUNT(*) FROM user_tags ut
                    JOIN user_tags mine ON mine.tag_id = ut.tag_id AND mine.user_id = :viewer_id
                    WHERE ut.user_id = u.id
                ) AS tag_overlap,
                (
                    CASE WHEN v.cohort IS NOT NULL AND u.cohort = v.cohort THEN 1.0
                         WHEN v.organization_id IS NOT NULL AND u.organization_id = v.organization_id THEN 0.6
                         WHEN v.university IS NOT NULL AND u.university = v.university THEN 0.4
                         ELSE 0.0 END
                ) AS cohort_boost,
                ({similarity_expr}) AS similarity
            FROM users u
            JOIN pool ON pool.candidate_id = u.id
            CROSS JOIN viewer v
            {similarity_join}
            WHERE u.id <> :viewer_id
              AND COALESCE(u.is_discoverable, TRUE) = TRUE
              AND NOT EXISTS (
                  SELECT 1 FROM connections c
                  WHERE c.status IN ('accepted', 'pending')
                    AND (
                        (c.requester_id = :viewer_id AND c.addressee_id = u.id)
                        OR (c.addressee_id = :viewer_id AND c.requester_id = u.id)
                    )
              )
              AND NOT EXISTS (
                  SELECT 1 FROM community_suggestion_dismissals d
                  WHERE d.user_id = :viewer_id AND d.dismissed_user_id = u.id
              )
        )
        SELECT
            id,
            mutual_count,
            tag_overlap,
            (
                {WEIGHTS['mutual']} * LEAST(mutual_count::float / {MUTUAL_SATURATION}, 1.0)
              + {WEIGHTS['tags']} * LEAST(tag_overlap::float / {TAG_SATURATION}, 1.0)
              + {WEIGHTS['cohort']} * cohort_boost
              + {WEIGHTS['similarity']} * similarity
            ) AS score
        FROM candidates
        WHERE (mutual_count > 0 OR tag_overlap > 0 OR cohort_boost > 0 OR similarity > 0)
        ORDER BY score DESC, id ASC
        LIMIT :limit OFFSET :offset
        """
    )

    result = await db.execute(
        query,
        {"viewer_id": viewer_id, "limit": limit + 1, "offset": offset},
    )
    rows = [r for r in result.fetchall() if float(r.score) >= MIN_SCORE]

    has_more = len(rows) > limit
    rows = rows[:limit]
    if not rows:
        return [], False

    ranked_ids = [r.id for r in rows]
    users_result = await db.execute(select(User).where(User.id.in_(ranked_ids)))
    users = list(users_result.scalars().all())

    # viewer_tag_slugs is what populates shared_tags, and shared interests are
    # the main reason a suggestion card can explain itself. include_mutuals is
    # off because the ranking query above already counted them, and that count is
    # the one this ordering was derived from.
    viewer_tags = await get_viewer_tag_slugs(db, viewer_id)
    summaries = await build_summaries(
        db, users, viewer_id, viewer_tag_slugs=viewer_tags, include_mutuals=False
    )
    by_id = {s.id: s for s in summaries}

    ordered: List[ProfileSummary] = []
    for row in rows:
        summary = by_id.get(row.id)
        if summary is None:
            continue
        # The ranking query already counted these. Reusing its numbers keeps the
        # card consistent with the order it was placed in.
        summary.mutual_connections = int(row.mutual_count or 0)
        ordered.append(summary)

    return ordered, has_more
