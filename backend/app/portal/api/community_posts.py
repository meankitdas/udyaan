"""Community feed: posts, likes, comments, shares, and attachment uploads."""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.core.deps import get_current_user
from app.portal.crud import community as community_crud
from app.portal.crud import community_embedding as embedding_crud
from app.portal.crud import community_post as crud
from app.portal.database import get_db
from app.portal.models.community import UserAchievement
from app.portal.models.community_post import (
    CommunityPost,
    PostComment,
    PostLike,
)
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.community_post import (
    CommentCreate,
    CommentOut,
    CommentPage,
    CommentUpdate,
    FeedPage,
    LikeResult,
    PostCreate,
    PostOut,
    PostUpdate,
    ShareCreate,
    UploadSignRequest,
    UploadSignResponse,
)
from app.portal.utils import storage

router = APIRouter(prefix="/community", tags=["community-feed"])

ADMIN_ROLE_KEYS = ("OWNER", "ADMIN", "SUPERADMIN")


def _utcnow() -> datetime:
    """Naive UTC, matching the TIMESTAMP WITHOUT TIME ZONE columns.

    Writing an aware datetime into these columns raises in asyncpg, and the
    rest of the portal stores naive UTC, so mixing would break comparisons.
    """

    return datetime.now(timezone.utc).replace(tzinfo=None)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

async def _is_moderator(db: AsyncSession, user_id: str) -> bool:
    role_keys = (
        await db.execute(
            select(Role.role_key)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )
    ).scalars().all()
    return bool(set(role_keys) & set(ADMIN_ROLE_KEYS))


async def _load_post(
    db: AsyncSession, post_id: UUID, viewer_id: str, *, allow_removed: bool = False
) -> CommunityPost:
    post = (
        await db.execute(select(CommunityPost).where(CommunityPost.id == post_id))
    ).scalars().first()
    if not post or (post.is_removed and not allow_removed):
        raise HTTPException(status_code=404, detail="Post not found")
    if not await crud.can_view_post(db, post, viewer_id):
        # Deliberately the same error as a missing post: a 403 would confirm
        # that a connections-only post exists at this id.
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def _own_post(db: AsyncSession, post_id: UUID, user_id: str) -> CommunityPost:
    """Load a post the caller authored. Scoped in the query, so a wrong owner 404s."""

    post = (
        await db.execute(
            select(CommunityPost).where(
                CommunityPost.id == post_id,
                CommunityPost.author_id == user_id,
                CommunityPost.is_removed.is_(False),
            )
        )
    ).scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def _single_output(
    db: AsyncSession, post: CommunityPost, viewer_id: str
) -> PostOut:
    is_mod = await _is_moderator(db, viewer_id)
    outputs = await crud.build_post_outputs(
        db, [post], viewer_id, is_moderator=is_mod
    )
    return outputs[0]


def _validate_attachment(payload_attachment) -> None:
    """Reject an attachment URL that did not come from our own bucket.

    Without this, ``attachment_url`` would accept any URL and render it in the
    UI with the styling and implied provenance of an uploaded document.
    """

    if payload_attachment is None:
        return
    if not storage.is_managed_attachment(payload_attachment.url):
        raise HTTPException(
            status_code=400,
            detail="Attachments must be uploaded through the community uploader. "
            "Use the link field for external resources.",
        )


# --------------------------------------------------------------------------
# Uploads
# --------------------------------------------------------------------------

@router.post("/uploads/sign", response_model=UploadSignResponse)
async def sign_upload(
    payload: UploadSignRequest,
    current_user: User = Depends(get_current_user),
):
    """Mint a short-lived signed URL for a direct-to-GCS upload."""

    try:
        result = storage.create_upload_url(
            user_id=current_user.id,
            filename=payload.filename,
            content_type=payload.content_type,
            size=payload.size,
        )
    except storage.UploadRejected as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except storage.StorageUnavailable as exc:
        # 503 rather than 500: the deployment simply has no bucket wired up, and
        # the client falls back to link-only attachments.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return UploadSignResponse(**result)


# --------------------------------------------------------------------------
# Posts
# --------------------------------------------------------------------------

@router.post("/posts", response_model=PostOut, status_code=201)
async def create_post(
    payload: PostCreate,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _validate_attachment(payload.attachment)

    achievement: Optional[UserAchievement] = None
    if payload.achievement_id:
        achievement = (
            await db.execute(
                select(UserAchievement).where(
                    UserAchievement.id == payload.achievement_id,
                    UserAchievement.user_id == current_user.id,
                )
            )
        ).scalars().first()
        if not achievement:
            raise HTTPException(
                status_code=404, detail="Achievement not found on your profile."
            )

    post = CommunityPost(
        author_id=current_user.id,
        post_type=payload.post_type,
        body=payload.body,
        link_url=(payload.link_url or None),
        visibility=payload.visibility,
        achievement_id=payload.achievement_id,
    )
    if payload.attachment:
        post.attachment_url = payload.attachment.url
        post.attachment_name = storage.sanitize_filename(payload.attachment.name or "")
        post.attachment_type = payload.attachment.content_type
        post.attachment_size = payload.attachment.size

    db.add(post)
    await db.flush()

    tags = list(payload.tags)
    # An achievement post with no tags of its own inherits the author's
    # interests, so it can still be ranked into relevant feeds.
    if not tags and payload.post_type == "achievement":
        tags = sorted(await community_crud.get_viewer_tag_slugs(db, current_user.id))[:3]
    if tags:
        await crud.set_post_tags(db, post, tags)

    await db.commit()
    await db.refresh(post)
    output = await _single_output(db, post, current_user.id)

    # Queued after the response, so an embedding provider having a bad day never
    # delays a post. A failure here simply leaves the post ranked on tag overlap
    # until the next backfill sweeps it up.
    background.add_task(
        embedding_crud.embed_post_task,
        post.id,
        post.body,
        [t.label for t in output.tags],
    )
    return output


@router.get("/feed", response_model=FeedPage)
async def get_feed(
    scope: str = Query("for-you", pattern="^(for-you|following|latest)$"),
    limit: int = Query(20, ge=1, le=50),
    cursor: Optional[str] = None,
    tag: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    posts, scores, overlaps, next_cursor, has_more = await crud.fetch_feed(
        db,
        current_user.id,
        scope=scope,
        limit=limit,
        cursor=cursor,
        tag_slugs=tag,
    )
    is_mod = await _is_moderator(db, current_user.id)
    items = await crud.build_post_outputs(
        db,
        posts,
        current_user.id,
        is_moderator=is_mod,
        scores=scores if scope == "for-you" else None,
        overlaps=overlaps,
    )
    return FeedPage(items=items, next_cursor=next_cursor, has_more=has_more)


@router.get("/profiles/{user_id}/posts", response_model=FeedPage)
async def get_user_posts(
    user_id: str,
    limit: int = Query(20, ge=1, le=50),
    cursor: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    posts, scores, overlaps, next_cursor, has_more = await crud.fetch_feed(
        db,
        current_user.id,
        scope="latest",
        limit=limit,
        cursor=cursor,
        author_id=user_id,
    )
    is_mod = await _is_moderator(db, current_user.id)
    items = await crud.build_post_outputs(
        db, posts, current_user.id, is_moderator=is_mod, overlaps=overlaps
    )
    return FeedPage(items=items, next_cursor=next_cursor, has_more=has_more)


@router.get("/posts/{post_id}", response_model=PostOut)
async def get_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = await _load_post(db, post_id, current_user.id)
    return await _single_output(db, post, current_user.id)


@router.patch("/posts/{post_id}", response_model=PostOut)
async def update_post(
    post_id: UUID,
    payload: PostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = await _own_post(db, post_id, current_user.id)

    fields = payload.model_dump(exclude_unset=True)
    changed = False

    if "body" in fields:
        post.body = (fields["body"] or "").strip() or None
        changed = True
    if "link_url" in fields:
        post.link_url = (fields["link_url"] or "").strip() or None
        changed = True
    if "visibility" in fields and fields["visibility"]:
        post.visibility = fields["visibility"]
    if "tags" in fields and fields["tags"] is not None:
        await crud.set_post_tags(db, post, fields["tags"])
        changed = True

    if not (post.body or post.link_url or post.attachment_url or post.achievement_id):
        raise HTTPException(
            status_code=400, detail="A post cannot be left completely empty."
        )

    if changed:
        post.edited_at = _utcnow()

    await db.commit()
    await db.refresh(post)
    return await _single_output(db, post, current_user.id)


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete an own post, then correct the share count on its original."""

    post = await _own_post(db, post_id, current_user.id)
    post.is_removed = True
    post.removed_at = _utcnow()
    post.removed_by = current_user.id

    original_id = post.shared_from_id
    await db.flush()

    if original_id:
        original = (
            await db.execute(
                select(CommunityPost).where(CommunityPost.id == original_id)
            )
        ).scalars().first()
        if original:
            await crud.recount_post(db, original)

    await db.commit()
    return Response(status_code=204)


# --------------------------------------------------------------------------
# Likes
# --------------------------------------------------------------------------

@router.post("/posts/{post_id}/like", response_model=LikeResult)
async def like_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = await _load_post(db, post_id, current_user.id)

    existing = (
        await db.execute(
            select(PostLike).where(
                PostLike.post_id == post.id, PostLike.user_id == current_user.id
            )
        )
    ).scalars().first()
    # Idempotent: a double-tap or a retried request is not an error.
    if not existing:
        db.add(PostLike(post_id=post.id, user_id=current_user.id))
        await db.flush()

    await crud.recount_post(db, post)
    await db.commit()
    return LikeResult(
        post_id=post.id, viewer_has_liked=True, like_count=post.like_count
    )


@router.delete("/posts/{post_id}/like", response_model=LikeResult)
async def unlike_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = await _load_post(db, post_id, current_user.id)

    existing = (
        await db.execute(
            select(PostLike).where(
                PostLike.post_id == post.id, PostLike.user_id == current_user.id
            )
        )
    ).scalars().first()
    if existing:
        await db.delete(existing)
        await db.flush()

    await crud.recount_post(db, post)
    await db.commit()
    return LikeResult(
        post_id=post.id, viewer_has_liked=False, like_count=post.like_count
    )


# --------------------------------------------------------------------------
# Shares
# --------------------------------------------------------------------------

@router.post("/posts/{post_id}/share", response_model=PostOut, status_code=201)
async def share_post(
    post_id: UUID,
    payload: ShareCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reshare a post, optionally with commentary."""

    post = await _load_post(db, post_id, current_user.id)

    # Resharing a reshare points at the original, so the chain never nests more
    # than one level deep and the UI has a single case to render.
    original = post
    if post.shared_from_id:
        root = (
            await db.execute(
                select(CommunityPost).where(CommunityPost.id == post.shared_from_id)
            )
        ).scalars().first()
        if root and not root.is_removed:
            original = root

    if original.author_id == current_user.id and not payload.body:
        raise HTTPException(
            status_code=400, detail="Add a comment when resharing your own post."
        )

    # A connections-only post must not gain reach through a public reshare.
    visibility = payload.visibility
    if original.visibility == "connections":
        visibility = "connections"

    share = CommunityPost(
        author_id=current_user.id,
        post_type=original.post_type,
        body=(payload.body or "").strip() or None,
        shared_from_id=original.id,
        visibility=visibility,
    )
    db.add(share)
    await db.flush()

    # Inherit the original's tags so the reshare ranks on the same interests.
    tag_rows = await crud.get_tags_for_posts(db, [original.id])
    inherited = [t.label for t in tag_rows.get(original.id, [])]
    if inherited:
        await crud.set_post_tags(db, share, inherited)

    await crud.recount_post(db, original)
    await db.commit()
    await db.refresh(share)
    return await _single_output(db, share, current_user.id)


# --------------------------------------------------------------------------
# Comments
# --------------------------------------------------------------------------

@router.get("/posts/{post_id}/comments", response_model=CommentPage)
async def list_comments(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = await _load_post(db, post_id, current_user.id)

    rows = (
        await db.execute(
            select(PostComment)
            .where(PostComment.post_id == post.id)
            .order_by(PostComment.created_at.asc())
        )
    ).scalars().all()

    is_mod = await _is_moderator(db, current_user.id)
    items = await crud.build_comment_tree(
        db, rows, current_user.id, is_moderator=is_mod
    )
    return CommentPage(items=items, total=post.comment_count or 0)


@router.post("/posts/{post_id}/comments", response_model=CommentOut, status_code=201)
async def create_comment(
    post_id: UUID,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = await _load_post(db, post_id, current_user.id)

    parent_id = payload.parent_id
    if parent_id:
        parent = (
            await db.execute(
                select(PostComment).where(
                    PostComment.id == parent_id,
                    PostComment.post_id == post.id,
                    PostComment.is_removed.is_(False),
                )
            )
        ).scalars().first()
        if not parent:
            raise HTTPException(status_code=404, detail="Comment not found")
        # Flatten deeper replies onto the top-level thread rather than rejecting
        # them; the user's intent is clear and nesting is capped at one level.
        parent_id = parent.parent_id or parent.id

    comment = PostComment(
        post_id=post.id,
        author_id=current_user.id,
        parent_id=parent_id,
        body=payload.body.strip(),
    )
    db.add(comment)
    await db.flush()

    await crud.recount_post(db, post)
    await db.commit()
    await db.refresh(comment)

    is_mod = await _is_moderator(db, current_user.id)
    tree = await crud.build_comment_tree(
        db, [comment], current_user.id, is_moderator=is_mod
    )
    return tree[0]


@router.patch("/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    comment_id: UUID,
    payload: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = (
        await db.execute(
            select(PostComment).where(
                PostComment.id == comment_id,
                PostComment.author_id == current_user.id,
                PostComment.is_removed.is_(False),
            )
        )
    ).scalars().first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.body = payload.body.strip()
    comment.edited_at = _utcnow()
    await db.commit()
    await db.refresh(comment)

    tree = await crud.build_comment_tree(db, [comment], current_user.id)
    return tree[0]


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a comment. Authors delete their own; moderators delete any."""

    comment = (
        await db.execute(
            select(PostComment).where(
                PostComment.id == comment_id, PostComment.is_removed.is_(False)
            )
        )
    ).scalars().first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_id != current_user.id and not await _is_moderator(
        db, current_user.id
    ):
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.is_removed = True
    comment.removed_at = _utcnow()
    comment.removed_by = current_user.id
    await db.flush()

    post = (
        await db.execute(
            select(CommunityPost).where(CommunityPost.id == comment.post_id)
        )
    ).scalars().first()
    if post:
        await crud.recount_post(db, post)

    await db.commit()
    return Response(status_code=204)
