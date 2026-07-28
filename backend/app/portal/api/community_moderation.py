"""Moderation: members report content, admins triage and act on it."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import aliased

from app.portal.core.deps import get_current_user
from app.portal.crud import community_message as message_crud
from app.portal.crud import community_post as post_crud
from app.portal.database import get_db
from app.portal.models.community import ModerationReport, ReportStatus
from app.portal.models.community_message import Conversation, Message
from app.portal.models.community_post import CommunityPost, PostComment
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.community import ReportCreate, ReportOut, ReportResolve

router = APIRouter(prefix="/community", tags=["community-moderation"])

ADMIN_ROLE_KEYS = ("ADMIN", "SUPERADMIN")

# How much of a post or comment to show in the admin queue.
SNIPPET_LENGTH = 140


async def require_moderator(
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
        raise HTTPException(status_code=403, detail="Moderator access required")
    return current_user


def _snippet(text_value: Optional[str], fallback: str) -> str:
    cleaned = " ".join((text_value or "").split())
    if not cleaned:
        return fallback
    if len(cleaned) <= SNIPPET_LENGTH:
        return cleaned
    return cleaned[:SNIPPET_LENGTH].rstrip() + "…"


async def _get_post(db: AsyncSession, target_id: str) -> Optional[CommunityPost]:
    """Load a post by its stringified UUID.

    ``target_id`` is a free-text column shared with user reports, so a value that
    is not a UUID is a missing target rather than a server error.
    """

    try:
        post_uuid = UUID(target_id)
    except (ValueError, AttributeError):
        return None
    return (
        await db.execute(select(CommunityPost).where(CommunityPost.id == post_uuid))
    ).scalars().first()


async def _get_comment(db: AsyncSession, target_id: str) -> Optional[PostComment]:
    try:
        comment_uuid = UUID(target_id)
    except (ValueError, AttributeError):
        return None
    return (
        await db.execute(select(PostComment).where(PostComment.id == comment_uuid))
    ).scalars().first()


async def _get_message(db: AsyncSession, target_id: str) -> Optional[Message]:
    try:
        message_uuid = UUID(target_id)
    except (ValueError, AttributeError):
        return None
    return (
        await db.execute(select(Message).where(Message.id == message_uuid))
    ).scalars().first()


async def _load_reportable_content(
    db: AsyncSession, target_type: str, target_id: str, reporter: User
):
    """Confirm reported content exists, is visible to the reporter, and is not theirs."""

    if target_type == "post":
        post = await _get_post(db, target_id)
        if not post or post.is_removed:
            raise HTTPException(status_code=404, detail="Post not found")
        if not await post_crud.can_view_post(db, post, reporter.id):
            raise HTTPException(status_code=404, detail="Post not found")
        if post.author_id == reporter.id:
            raise HTTPException(
                status_code=400, detail="You cannot report your own post."
            )
        return post

    if target_type == "message":
        message = await _get_message(db, target_id)
        if not message or message.is_removed:
            raise HTTPException(status_code=404, detail="Message not found")
        # Only a participant can report a message, and only one they did not
        # send. Anything else 404s rather than 403s so a stranger cannot use
        # the report endpoint to test whether a message id exists.
        participant = await message_crud.get_participant(
            db, message.conversation_id, reporter.id
        )
        if participant is None:
            raise HTTPException(status_code=404, detail="Message not found")
        if message.sender_id == reporter.id:
            raise HTTPException(
                status_code=400, detail="You cannot report your own message."
            )
        return message

    comment = await _get_comment(db, target_id)
    if not comment or comment.is_removed:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id == reporter.id:
        raise HTTPException(
            status_code=400, detail="You cannot report your own comment."
        )
    parent = await _get_post(db, str(comment.post_id))
    if not parent or not await post_crud.can_view_post(db, parent, reporter.id):
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


async def _remove_post(db: AsyncSession, post: CommunityPost, moderator_id: str) -> None:
    """Soft-delete a post and keep the original's share count honest."""

    post.is_removed = True
    post.removed_at = datetime.utcnow()
    post.removed_by = moderator_id
    await db.flush()
    if post.shared_from_id:
        original = (
            await db.execute(
                select(CommunityPost).where(CommunityPost.id == post.shared_from_id)
            )
        ).scalars().first()
        if original:
            await post_crud.recount_post(db, original)


async def _content_labels(db: AsyncSession, reports) -> dict:
    """Batch a display snippet for every post/comment target in the queue."""

    post_ids = [r.target_id for r in reports if r.target_type == "post"]
    comment_ids = [r.target_id for r in reports if r.target_type == "comment"]
    message_ids = [r.target_id for r in reports if r.target_type == "message"]
    labels: dict = {}

    def _as_uuids(values):
        out = []
        for value in values:
            try:
                out.append(UUID(value))
            except (ValueError, AttributeError):
                continue
        return out

    if post_ids:
        rows = (
            await db.execute(
                select(CommunityPost.id, CommunityPost.body, CommunityPost.post_type)
                .where(CommunityPost.id.in_(_as_uuids(post_ids)))
            )
        ).all()
        for post_id, body, post_type in rows:
            labels[str(post_id)] = _snippet(body, f"({post_type} post)")

    if comment_ids:
        rows = (
            await db.execute(
                select(PostComment.id, PostComment.body).where(
                    PostComment.id.in_(_as_uuids(comment_ids))
                )
            )
        ).all()
        for comment_id, body in rows:
            labels[str(comment_id)] = _snippet(body, "(comment)")

    if message_ids:
        rows = (
            await db.execute(
                select(Message.id, Message.body, Message.attachment_name).where(
                    Message.id.in_(_as_uuids(message_ids))
                )
            )
        ).all()
        for message_id, body, attachment_name in rows:
            fallback = f"(attachment: {attachment_name})" if attachment_name else "(message)"
            labels[str(message_id)] = _snippet(body, fallback)

    return labels


@router.post("/reports", response_model=ReportOut, status_code=201)
async def create_report(
    payload: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.target_type == "user":
        if payload.target_id == current_user.id:
            raise HTTPException(status_code=400, detail="You cannot report yourself.")
        target = (
            await db.execute(select(User).where(User.id == payload.target_id))
        ).scalars().first()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
    else:
        # Validate the content exists and the reporter can actually see it, so
        # the queue cannot be filled with reports against invented ids.
        await _load_reportable_content(db, payload.target_type, payload.target_id, current_user)

    # One open report per person per target: re-reporting the same thing should
    # not let a single user inflate the queue.
    duplicate = (
        await db.execute(
            select(ModerationReport).where(
                ModerationReport.reporter_id == current_user.id,
                ModerationReport.target_type == payload.target_type,
                ModerationReport.target_id == payload.target_id,
                ModerationReport.status.in_(
                    [ReportStatus.OPEN.value, ReportStatus.REVIEWING.value]
                ),
            )
        )
    ).scalars().first()
    if duplicate:
        return await _render_one(db, duplicate)

    report = ModerationReport(
        reporter_id=current_user.id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reason=payload.reason,
        details=payload.details,
        status=ReportStatus.OPEN.value,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return await _render_one(db, report)


@router.get("/moderation/reports", response_model=List[ReportOut])
async def list_reports(
    status: Optional[str] = Query(default="open", description="open | reviewing | actioned | dismissed | all"),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_moderator),
):
    reporter = aliased(User)
    resolver = aliased(User)

    query = (
        select(ModerationReport, reporter.full_name, resolver.full_name)
        .join(reporter, reporter.id == ModerationReport.reporter_id, isouter=True)
        .join(resolver, resolver.id == ModerationReport.resolved_by, isouter=True)
    )
    if status and status != "all":
        query = query.where(ModerationReport.status == status)

    rows = (
        await db.execute(query.order_by(ModerationReport.created_at.desc()).limit(limit))
    ).all()

    # Resolve reported user names in one pass rather than per row.
    user_targets = [r[0].target_id for r in rows if r[0].target_type == "user"]
    labels = {}
    if user_targets:
        found = (
            await db.execute(select(User.id, User.full_name).where(User.id.in_(user_targets)))
        ).all()
        labels = dict(found)

    # Post and comment snippets, also batched.
    labels.update(await _content_labels(db, [r[0] for r in rows]))

    return [
        _to_out(report, reporter_name, resolver_name, labels.get(report.target_id))
        for report, reporter_name, resolver_name in rows
    ]


@router.get("/moderation/summary")
async def moderation_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_moderator),
):
    """Counts per status, for the admin badge."""
    rows = (
        await db.execute(
            select(ModerationReport.status, func.count(ModerationReport.id)).group_by(
                ModerationReport.status
            )
        )
    ).all()
    counts = dict(rows)
    return {
        "open": counts.get(ReportStatus.OPEN.value, 0),
        "reviewing": counts.get(ReportStatus.REVIEWING.value, 0),
        "actioned": counts.get(ReportStatus.ACTIONED.value, 0),
        "dismissed": counts.get(ReportStatus.DISMISSED.value, 0),
    }


@router.post("/moderation/reports/{report_id}/resolve", response_model=ReportOut)
async def resolve_report(
    report_id: UUID,
    payload: ReportResolve,
    db: AsyncSession = Depends(get_db),
    moderator: User = Depends(require_moderator),
):
    report = (
        await db.execute(select(ModerationReport).where(ModerationReport.id == report_id))
    ).scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if payload.action == "deactivate_user":
        if report.target_type != "user":
            raise HTTPException(
                status_code=400, detail="Only user reports can be resolved by deactivation."
            )
        target = (
            await db.execute(select(User).where(User.id == report.target_id))
        ).scalars().first()
        if not target:
            raise HTTPException(status_code=404, detail="Reported user no longer exists")
        if target.id == moderator.id:
            raise HTTPException(status_code=400, detail="You cannot deactivate yourself.")
        # Deactivate rather than delete: the account's projects, reports and
        # action items must stay attributable. `get_current_user` already
        # rejects inactive users, and the directory filters them out.
        target.is_active = False
        target.is_discoverable = False

    elif payload.action == "remove_content":
        if report.target_type == "user":
            # A profile is not removable content — hiding it from the directory
            # is the equivalent action.
            target = (
                await db.execute(select(User).where(User.id == report.target_id))
            ).scalars().first()
            if target:
                target.is_discoverable = False
        elif report.target_type == "post":
            post = await _get_post(db, report.target_id)
            if not post:
                raise HTTPException(
                    status_code=404, detail="Reported post no longer exists"
                )
            await _remove_post(db, post, moderator.id)
        elif report.target_type == "comment":
            comment = await _get_comment(db, report.target_id)
            if not comment:
                raise HTTPException(
                    status_code=404, detail="Reported comment no longer exists"
                )
            comment.is_removed = True
            comment.removed_at = datetime.utcnow()
            comment.removed_by = moderator.id
            await db.flush()
            parent_post = await _get_post(db, str(comment.post_id))
            if parent_post:
                await post_crud.recount_post(db, parent_post)
        elif report.target_type == "message":
            message = await _get_message(db, report.target_id)
            if not message:
                raise HTTPException(
                    status_code=404, detail="Reported message no longer exists"
                )
            message.is_removed = True
            message.removed_at = datetime.utcnow()
            message.removed_by = moderator.id
            await db.flush()
            conversation = (
                await db.execute(
                    select(Conversation).where(
                        Conversation.id == message.conversation_id
                    )
                )
            ).scalars().first()
            if conversation is not None:
                # The inbox preview may still be quoting the removed text, and
                # the recipient's unread count included it.
                await message_crud.touch_conversation(db, conversation)
                await message_crud.recount_conversation(db, conversation.id)

    report.status = (
        ReportStatus.DISMISSED.value
        if payload.action == "dismiss"
        else ReportStatus.ACTIONED.value
    )
    report.resolved_by = moderator.id
    report.resolved_at = datetime.utcnow()
    report.resolution_note = payload.note

    await db.commit()
    await db.refresh(report)
    return await _render_one(db, report)


def _to_out(
    report: ModerationReport,
    reporter_name: Optional[str],
    resolver_name: Optional[str],
    target_label: Optional[str],
) -> ReportOut:
    return ReportOut(
        id=report.id,
        target_type=report.target_type,
        target_id=report.target_id,
        reason=report.reason,
        details=report.details,
        status=report.status,
        created_at=report.created_at,
        resolved_at=report.resolved_at,
        resolution_note=report.resolution_note,
        reporter_id=report.reporter_id,
        reporter_name=reporter_name,
        resolver_name=resolver_name,
        target_label=target_label,
    )


async def _render_one(db: AsyncSession, report: ModerationReport) -> ReportOut:
    names = (
        await db.execute(
            select(User.id, User.full_name).where(
                User.id.in_([i for i in (report.reporter_id, report.resolved_by, report.target_id) if i])
            )
        )
    ).all()
    lookup = dict(names)

    if report.target_type == "user":
        target_label = lookup.get(report.target_id)
    else:
        target_label = (await _content_labels(db, [report])).get(report.target_id)

    return _to_out(
        report,
        lookup.get(report.reporter_id),
        lookup.get(report.resolved_by) if report.resolved_by else None,
        target_label,
    )
