"""Feed queries, ranking, and batched hydration for community posts.

Ranking runs in Postgres, not in Python. The alternative -- fetch candidates,
score them in the API, sort, then slice -- means transferring every post a user
could possibly see on every feed request. Scoring in SQL lets ``ORDER BY score
LIMIT 20`` do the work against indexes and return one page.

The score is a weighted sum of four normalized signals, each bounded to [0, 1]
so the weights in :data:`RANKING_WEIGHTS` mean what they appear to mean and can
be retuned without re-deriving the whole formula:

``tag``
    Overlap between the post's tags and the viewer's interests, saturating at
    :data:`TAG_SATURATION` shared tags. Saturating rather than dividing by the
    viewer's tag count avoids penalising users with broad interests.
``recency``
    Exponential decay with a half-life of :data:`RECENCY_HALF_LIFE_HOURS`. A
    half-life beats a hard cutoff because a genuinely relevant week-old post can
    still outrank a fresh irrelevant one, which a cutoff makes impossible.
``engagement``
    Log-compressed weighted interactions, so the difference between 0 and 10
    likes matters far more than between 500 and 510.
``graph``
    A flat boost when the viewer follows or is connected to the author.

This whole function is the Phase 4 swap point: replacing the ``tag`` term with
cosine similarity between a post embedding and a viewer embedding changes this
module and nothing else, because every caller sees only :func:`fetch_feed`.
"""

from __future__ import annotations

import base64
from typing import Dict, List, Optional, Sequence, Set
from uuid import UUID

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.crud.community import build_summaries, resolve_tags
from app.portal.models.community import CommunityTag, UserAchievement
from app.portal.models.community_post import (
    CommunityPost,
    PostComment,
    PostLike,
    PostTag,
)
from app.portal.models.user import User
from app.portal.schemas.community import ProfileSummary, TagOut
from app.portal.schemas.community_post import (
    AttachmentOut,
    CommentOut,
    PostAchievementOut,
    PostOut,
)

# Tunable without touching the SQL below. Weights need not sum to 1, but they do
# here so a score reads as a 0-1 relevance figure.
RANKING_WEIGHTS = {
    "tag": 0.40,
    "recency": 0.30,
    "engagement": 0.15,
    "graph": 0.15,
}

TAG_SATURATION = 3.0
RECENCY_HALF_LIFE_HOURS = 24.0
# Weighted interaction count that earns a full engagement score.
ENGAGEMENT_SATURATION = 100.0

MAX_PAGE_SIZE = 50


# --------------------------------------------------------------------------
# Cursors
# --------------------------------------------------------------------------

def encode_cursor(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")


def decode_cursor(cursor: Optional[str]) -> Optional[str]:
    """Decode a cursor, treating anything malformed as "start from the top".

    A tampered or stale cursor should restart the feed, not 500.
    """

    if not cursor:
        return None
    try:
        padding = "=" * (-len(cursor) % 4)
        return base64.urlsafe_b64decode(cursor + padding).decode()
    except Exception:
        return None


def _offset_from_cursor(cursor: Optional[str]) -> int:
    raw = decode_cursor(cursor)
    if not raw or not raw.startswith("o:"):
        return 0
    try:
        return max(0, int(raw[2:]))
    except ValueError:
        return 0


# --------------------------------------------------------------------------
# Visibility
# --------------------------------------------------------------------------

# Reused by every read path. Kept as a single fragment so a change to the
# visibility rules cannot be applied to the feed but missed on the profile
# timeline or the permalink.
_VISIBLE_SQL = """
    p.is_removed = false
    AND (
        p.visibility = 'public'
        OR p.author_id = :viewer_id
        OR EXISTS (
            SELECT 1 FROM connections c
            WHERE c.status = 'accepted'
              AND (
                (c.requester_id = :viewer_id AND c.addressee_id = p.author_id)
                OR (c.addressee_id = :viewer_id AND c.requester_id = p.author_id)
              )
        )
    )
"""


async def can_view_post(db: AsyncSession, post: CommunityPost, viewer_id: str) -> bool:
    """Single-post equivalent of the feed's visibility filter."""

    if post.visibility == "public":
        return True
    if post.author_id == viewer_id:
        return True
    row = await db.execute(
        text(
            """
            SELECT 1 FROM connections c
            WHERE c.status = 'accepted'
              AND (
                (c.requester_id = :viewer_id AND c.addressee_id = :author_id)
                OR (c.addressee_id = :viewer_id AND c.requester_id = :author_id)
              )
            LIMIT 1
            """
        ),
        {"viewer_id": viewer_id, "author_id": post.author_id},
    )
    return row.first() is not None


# --------------------------------------------------------------------------
# Feed
# --------------------------------------------------------------------------

async def fetch_feed(
    db: AsyncSession,
    viewer_id: str,
    *,
    scope: str = "for-you",
    limit: int = 20,
    cursor: Optional[str] = None,
    author_id: Optional[str] = None,
    tag_slugs: Optional[Sequence[str]] = None,
) -> tuple[List[CommunityPost], Dict[UUID, float], Dict[UUID, int], Optional[str], bool]:
    """Return one page of posts plus the scores that ordered them.

    Fetches ``limit + 1`` rows to detect a further page without a second count
    query, then trims the extra before returning.
    """

    limit = max(1, min(limit, MAX_PAGE_SIZE))
    offset = _offset_from_cursor(cursor)

    params: Dict[str, object] = {
        "viewer_id": viewer_id,
        "limit": limit + 1,
        "offset": offset,
    }

    filters = [_VISIBLE_SQL]

    if author_id:
        filters.append("p.author_id = :author_id")
        params["author_id"] = author_id

    if scope == "following":
        filters.append(
            """
            (
                p.author_id = :viewer_id
                OR EXISTS (
                    SELECT 1 FROM community_follows f
                    WHERE f.follower_id = :viewer_id AND f.following_id = p.author_id
                )
                OR EXISTS (
                    SELECT 1 FROM connections c2
                    WHERE c2.status = 'accepted'
                      AND (
                        (c2.requester_id = :viewer_id AND c2.addressee_id = p.author_id)
                        OR (c2.addressee_id = :viewer_id AND c2.requester_id = p.author_id)
                      )
                )
            )
            """
        )

    if tag_slugs:
        filters.append(
            """
            EXISTS (
                SELECT 1 FROM post_tags pt2
                JOIN community_tags ct2 ON ct2.id = pt2.tag_id
                WHERE pt2.post_id = p.id AND ct2.slug = ANY(:tag_slugs)
            )
            """
        )
        params["tag_slugs"] = list(tag_slugs)

    where_sql = " AND ".join(f"({f})" for f in filters)

    # Counted once per candidate row, but only against the viewer's own tag set,
    # which is small and indexed on both sides of the join.
    overlap_sql = """
        (
            SELECT COUNT(*) FROM post_tags pt
            JOIN user_tags ut ON ut.tag_id = pt.tag_id AND ut.user_id = :viewer_id
            WHERE pt.post_id = p.id
        )
    """

    if scope == "for-you":
        # References bare column names from the CTE below, so the expression can
        # be read as-is rather than reconstructed from the source table.
        score_expr = f"""
            (
                {RANKING_WEIGHTS['tag']} * LEAST(overlap::float / {TAG_SATURATION}, 1.0)
              + {RANKING_WEIGHTS['recency']} * POWER(
                    0.5,
                    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0
                        / {RECENCY_HALF_LIFE_HOURS}
                )
              + {RANKING_WEIGHTS['engagement']} * LEAST(
                    LN(1 + like_count + 2 * comment_count + 3 * share_count)
                        / LN(1 + {ENGAGEMENT_SATURATION}),
                    1.0
                )
              + {RANKING_WEIGHTS['graph']} * graph_boost
            )
        """
        order_expr = "score DESC, created_at DESC, id DESC"
    else:
        # Chronological scopes still report tag overlap so the client can show
        # why something is relevant, but ordering ignores it.
        score_expr = "0.0"
        order_expr = "created_at DESC, id DESC"

    graph_sql = """
        CASE WHEN EXISTS (
            SELECT 1 FROM community_follows f2
            WHERE f2.follower_id = :viewer_id AND f2.following_id = p.author_id
        ) OR EXISTS (
            SELECT 1 FROM connections c3
            WHERE c3.status = 'accepted'
              AND (
                (c3.requester_id = :viewer_id AND c3.addressee_id = p.author_id)
                OR (c3.addressee_id = :viewer_id AND c3.requester_id = p.author_id)
              )
        ) THEN 1.0 ELSE 0.0 END
    """

    query = text(
        f"""
        WITH candidates AS (
            SELECT
                p.id            AS id,
                p.created_at    AS created_at,
                p.like_count    AS like_count,
                p.comment_count AS comment_count,
                p.share_count   AS share_count,
                {overlap_sql}   AS overlap,
                {graph_sql}     AS graph_boost
            FROM community_posts p
            WHERE {where_sql}
        )
        SELECT id, overlap, {score_expr} AS score
        FROM candidates
        ORDER BY {order_expr}
        LIMIT :limit OFFSET :offset
        """
    )

    result = await db.execute(query, params)
    rows = result.fetchall()

    has_more = len(rows) > limit
    rows = rows[:limit]

    if not rows:
        return [], {}, {}, None, False

    ids = [r.id for r in rows]
    scores = {r.id: float(r.score or 0.0) for r in rows}
    overlaps = {r.id: int(r.overlap or 0) for r in rows}

    posts_result = await db.execute(
        select(CommunityPost).where(CommunityPost.id.in_(ids))
    )
    by_id = {p.id: p for p in posts_result.scalars()}
    # The IN query loses the ranking, so restore it from the scored row order.
    posts = [by_id[i] for i in ids if i in by_id]

    next_cursor = encode_cursor(f"o:{offset + len(rows)}") if has_more else None
    return posts, scores, overlaps, next_cursor, has_more


# --------------------------------------------------------------------------
# Batched hydration
# --------------------------------------------------------------------------

async def get_tags_for_posts(
    db: AsyncSession, post_ids: Sequence[UUID]
) -> Dict[UUID, List[TagOut]]:
    if not post_ids:
        return {}
    result = await db.execute(
        select(PostTag.post_id, CommunityTag)
        .join(CommunityTag, CommunityTag.id == PostTag.tag_id)
        .where(PostTag.post_id.in_(list(post_ids)))
        .order_by(CommunityTag.label)
    )
    out: Dict[UUID, List[TagOut]] = {}
    for post_id, tag in result:
        out.setdefault(post_id, []).append(TagOut.model_validate(tag))
    return out


async def get_viewer_likes(
    db: AsyncSession, viewer_id: str, post_ids: Sequence[UUID]
) -> Set[UUID]:
    if not post_ids:
        return set()
    result = await db.execute(
        select(PostLike.post_id).where(
            PostLike.user_id == viewer_id, PostLike.post_id.in_(list(post_ids))
        )
    )
    return set(result.scalars())


async def _get_achievements(
    db: AsyncSession, achievement_ids: Sequence[UUID]
) -> Dict[UUID, PostAchievementOut]:
    ids = [a for a in achievement_ids if a]
    if not ids:
        return {}
    result = await db.execute(
        select(UserAchievement).where(UserAchievement.id.in_(ids))
    )
    return {a.id: PostAchievementOut.model_validate(a) for a in result.scalars()}


async def _get_authors(
    db: AsyncSession, author_ids: Sequence[str], viewer_id: str
) -> Dict[str, ProfileSummary]:
    ids = list({a for a in author_ids if a})
    if not ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(ids)))
    users = list(result.scalars())
    summaries = await build_summaries(db, users, viewer_id)
    return {s.id: s for s in summaries}


def _attachment_of(post: CommunityPost) -> Optional[AttachmentOut]:
    if not post.attachment_url:
        return None
    return AttachmentOut(
        url=post.attachment_url,
        name=post.attachment_name,
        content_type=post.attachment_type,
        size=post.attachment_size,
    )


async def build_post_outputs(
    db: AsyncSession,
    posts: Sequence[CommunityPost],
    viewer_id: str,
    *,
    is_moderator: bool = False,
    scores: Optional[Dict[UUID, float]] = None,
    overlaps: Optional[Dict[UUID, int]] = None,
    include_shared: bool = True,
) -> List[PostOut]:
    """Turn post rows into API objects, batching every lookup.

    A 20-post page touches authors, tags, likes, achievements and shared
    originals. Done per post that is 100+ round trips; done here it is six
    queries regardless of page size.
    """

    if not posts:
        return []

    post_ids = [p.id for p in posts]

    shared_by_id: Dict[UUID, CommunityPost] = {}
    if include_shared:
        shared_ids = [p.shared_from_id for p in posts if p.shared_from_id]
        if shared_ids:
            shared_result = await db.execute(
                select(CommunityPost).where(CommunityPost.id.in_(shared_ids))
            )
            shared_by_id = {p.id: p for p in shared_result.scalars()}

    all_posts = list(posts) + list(shared_by_id.values())
    all_ids = [p.id for p in all_posts]

    tags_by_post = await get_tags_for_posts(db, all_ids)
    liked = await get_viewer_likes(db, viewer_id, post_ids)
    achievements = await _get_achievements(
        db, [p.achievement_id for p in all_posts if p.achievement_id]
    )
    authors = await _get_authors(db, [p.author_id for p in all_posts], viewer_id)

    def to_out(post: CommunityPost, *, nested: bool) -> PostOut:
        return PostOut(
            id=post.id,
            post_type=post.post_type,
            body=post.body,
            link_url=post.link_url,
            attachment=_attachment_of(post),
            achievement=achievements.get(post.achievement_id)
            if post.achievement_id
            else None,
            visibility=post.visibility,
            tags=tags_by_post.get(post.id, []),
            author=authors.get(post.author_id),
            like_count=post.like_count or 0,
            comment_count=post.comment_count or 0,
            share_count=post.share_count or 0,
            viewer_has_liked=post.id in liked,
            can_edit=(not nested) and post.author_id == viewer_id,
            can_moderate=(not nested) and (is_moderator or post.author_id == viewer_id),
            is_removed=bool(post.is_removed),
            created_at=post.created_at,
            edited_at=post.edited_at,
            score=(scores or {}).get(post.id),
            matched_tags=_matched_tag_labels(
                tags_by_post.get(post.id, []), (overlaps or {}).get(post.id, 0)
            ),
        )

    outputs: List[PostOut] = []
    for post in posts:
        item = to_out(post, nested=False)
        if post.shared_from_id:
            original = shared_by_id.get(post.shared_from_id)
            if original is None or original.is_removed:
                item.shared_source_missing = True
            else:
                item.shared_from = to_out(original, nested=True)
        outputs.append(item)
    return outputs


def _matched_tag_labels(tags: List[TagOut], overlap: int) -> List[str]:
    """Best-effort explanation of the tag score.

    The ranking query returns only a count, so rather than a second per-post
    query for the exact intersection the client gets the leading tags. It is
    used for a "matches your interests" hint, not for anything load-bearing.
    """

    if overlap <= 0:
        return []
    return [t.label for t in tags[:overlap]]


# --------------------------------------------------------------------------
# Writes
# --------------------------------------------------------------------------

async def set_post_tags(
    db: AsyncSession, post: CommunityPost, labels: Sequence[str]
) -> List[CommunityTag]:
    """Replace a post's tags, reusing the shared user-tag vocabulary."""

    tags = await resolve_tags(db, labels)
    await db.execute(delete(PostTag).where(PostTag.post_id == post.id))
    seen: Set[int] = set()
    for tag in tags:
        if tag.id in seen:
            continue
        seen.add(tag.id)
        db.add(PostTag(post_id=post.id, tag_id=tag.id))
    await db.flush()
    return tags


async def recount_post(db: AsyncSession, post: CommunityPost) -> None:
    """Rebuild the denormalized counters from the authoritative rows.

    Called after every like/comment/share change rather than incrementing, so a
    double-submit or a failed transaction cannot leave the counter drifting from
    reality.
    """

    likes = await db.scalar(
        select(func.count()).select_from(PostLike).where(PostLike.post_id == post.id)
    )
    comments = await db.scalar(
        select(func.count())
        .select_from(PostComment)
        .where(PostComment.post_id == post.id, PostComment.is_removed.is_(False))
    )
    shares = await db.scalar(
        select(func.count())
        .select_from(CommunityPost)
        .where(
            CommunityPost.shared_from_id == post.id,
            CommunityPost.is_removed.is_(False),
        )
    )
    post.like_count = int(likes or 0)
    post.comment_count = int(comments or 0)
    post.share_count = int(shares or 0)


# --------------------------------------------------------------------------
# Comments
# --------------------------------------------------------------------------

async def build_comment_tree(
    db: AsyncSession,
    comments: Sequence[PostComment],
    viewer_id: str,
    *,
    is_moderator: bool = False,
) -> List[CommentOut]:
    """Nest replies under their parents, preserving chronological order.

    Removed comments are kept in the tree as tombstones when they still have
    visible replies; dropping them would orphan the replies and make the
    conversation unreadable.
    """

    if not comments:
        return []

    authors = await _get_authors(db, [c.author_id for c in comments], viewer_id)

    def to_out(comment: PostComment) -> CommentOut:
        removed = bool(comment.is_removed)
        return CommentOut(
            id=comment.id,
            post_id=comment.post_id,
            parent_id=comment.parent_id,
            body="[removed]" if removed else comment.body,
            author=None if removed else authors.get(comment.author_id),
            can_edit=(not removed) and comment.author_id == viewer_id,
            can_moderate=(not removed)
            and (is_moderator or comment.author_id == viewer_id),
            is_removed=removed,
            created_at=comment.created_at,
            edited_at=comment.edited_at,
        )

    nodes = {c.id: to_out(c) for c in comments}
    roots: List[CommentOut] = []
    for comment in comments:
        node = nodes[comment.id]
        parent = nodes.get(comment.parent_id) if comment.parent_id else None
        if parent is not None:
            parent.replies.append(node)
        else:
            roots.append(node)

    # A removed comment with no surviving replies carries no information.
    return [
        node for node in roots if not (node.is_removed and not node.replies)
    ]
