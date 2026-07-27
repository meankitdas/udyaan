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
from app.portal.database import get_db
from app.portal.models.community import ModerationReport, ReportStatus
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.community import ReportCreate, ReportOut, ReportResolve

router = APIRouter(prefix="/community", tags=["community-moderation"])

ADMIN_ROLE_KEYS = ("ADMIN", "SUPERADMIN")


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
        # Post/comment removal lands with the feed in the next phase.

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
    return _to_out(
        report,
        lookup.get(report.reporter_id),
        lookup.get(report.resolved_by) if report.resolved_by else None,
        lookup.get(report.target_id) if report.target_type == "user" else None,
    )
