"""Weekly project records and the dashboard that reads them.

Two ways to read the same project:

* ``mode=weekly`` - the periodic view. Counters are frozen at the close of the
  reported week so a Monday review meeting sees the same numbers all day and
  nobody's mid-week edits change what is being discussed.
* ``mode=live``   - the real-time view. Counters are recomputed as of now.

Both come from one endpoint so the two views can never drift apart in the way
that separate "report" and "dashboard" code paths always eventually do.
"""

from datetime import date, datetime, time, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.core.deps import get_current_user
from app.portal.database import get_db
from app.portal.models.project import Project
from app.portal.models.project_compliance import ActionItem, ProjectMeeting
from app.portal.models.project_impact import ProjectImpactEntry
from app.portal.models.project_tool import ProjectTool, ToolStatus
from app.portal.models.project_update import ProjectWeeklyUpdate, UpdateStatus
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.project_update import (
    CadenceStatus,
    DigestRow,
    LiveCounters,
    ProjectPulse,
    WeeklyDigest,
    WeeklyUpdateCreate,
    WeeklyUpdateResponse,
    WeeklyUpdateUpdate,
)

router = APIRouter(tags=["project-updates"])

REVIEWER_ROLES = {"ADMIN", "PROJECT_HEAD", "FACULTY", "SUPERADMIN"}

# How far back the cadence scorecard looks. Bounded so a long-running project's
# on-time rate reflects recent discipline rather than being diluted by history.
CADENCE_WINDOW_WEEKS = 12
RECENT_UPDATES = 8

# Weekly records are due Friday 17:00 in the week they cover.
DUE_WEEKDAY_OFFSET = 4
DUE_HOUR = 17


def _week_start(value: date) -> date:
    """Monday of the week containing `value`."""
    return value - timedelta(days=value.weekday())


def _week_end(start: date) -> date:
    return start + timedelta(days=6)


def _week_label(start: date) -> str:
    iso_year, iso_week, _ = start.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


def _due_at(start: date) -> datetime:
    return datetime.combine(start + timedelta(days=DUE_WEEKDAY_OFFSET), time(hour=DUE_HOUR))


def _end_of_week_dt(start: date) -> datetime:
    return datetime.combine(_week_end(start), time.max)


async def _role_keys(db: AsyncSession, user: User) -> set[str]:
    result = await db.execute(
        select(Role.role_key).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == user.id)
    )
    return {key for key in result.scalars().all() if key}


async def _load_project(db: AsyncSession, project_id: str, user: User) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.organization_id and project.organization_id and user.organization_id != project.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return project


def _to_response(entry: ProjectWeeklyUpdate, submitter_name: Optional[str]) -> WeeklyUpdateResponse:
    created = entry.created_at
    return WeeklyUpdateResponse(
        id=entry.id,
        project_id=entry.project_id,
        period_start=entry.period_start,
        period_end=_week_end(entry.period_start),
        iso_year=entry.iso_year,
        iso_week=entry.iso_week,
        label=_week_label(entry.period_start),
        status=entry.status,
        headline=entry.headline,
        progress_note=entry.progress_note,
        blockers=entry.blockers,
        next_steps=entry.next_steps,
        completion_percent=entry.completion_percent,
        submitted_by=entry.submitted_by,
        submitted_by_name=submitter_name,
        submitted_late=bool(created and created > _due_at(entry.period_start)),
        created_at=created,
    )


async def _history(db: AsyncSession, project_id: str) -> List[WeeklyUpdateResponse]:
    result = await db.execute(
        select(ProjectWeeklyUpdate, User.full_name)
        .join(User, User.id == ProjectWeeklyUpdate.submitted_by, isouter=True)
        .where(ProjectWeeklyUpdate.project_id == project_id)
        .order_by(ProjectWeeklyUpdate.period_start.desc())
    )
    return [_to_response(entry, name) for entry, name in result.all()]


async def _counters(db: AsyncSession, project_id: str, as_of: datetime) -> LiveCounters:
    """Activity counts as they stood at `as_of`.

    Passing "now" gives the real-time view; passing the close of a week gives
    that week's frozen snapshot.
    """
    meetings_total = await db.scalar(
        select(func.count())
        .select_from(ProjectMeeting)
        .where(ProjectMeeting.project_id == project_id, ProjectMeeting.meeting_date <= as_of)
    )
    week_floor = datetime.combine(_week_start(as_of.date()), time.min)
    meetings_this_week = await db.scalar(
        select(func.count())
        .select_from(ProjectMeeting)
        .where(
            ProjectMeeting.project_id == project_id,
            ProjectMeeting.meeting_date >= week_floor,
            ProjectMeeting.meeting_date <= as_of,
        )
    )

    rows = await db.execute(
        select(ActionItem.status, ActionItem.due_date).where(
            ActionItem.project_id == project_id, ActionItem.created_at <= as_of
        )
    )
    actions = rows.all()
    completed = sum(1 for status, _ in actions if status == "Completed")
    open_items = len(actions) - completed
    overdue = sum(
        1 for status, due in actions if status != "Completed" and due is not None and due < as_of.date()
    )

    impact_entries = await db.scalar(
        select(func.count())
        .select_from(ProjectImpactEntry)
        .where(ProjectImpactEntry.project_id == project_id, ProjectImpactEntry.created_at <= as_of)
    )
    tools_connected = await db.scalar(
        select(func.count())
        .select_from(ProjectTool)
        .where(
            ProjectTool.project_id == project_id,
            ProjectTool.status == ToolStatus.APPROVED.value,
            ProjectTool.created_at <= as_of,
        )
    )

    return LiveCounters(
        meetings_total=meetings_total or 0,
        meetings_this_week=meetings_this_week or 0,
        actions_open=open_items,
        actions_overdue=overdue,
        actions_completed=completed,
        action_completion_rate=round(completed / len(actions) * 100, 1) if actions else 0.0,
        impact_entries=impact_entries or 0,
        tools_connected=tools_connected or 0,
    )


def _cadence(
    updates: List[WeeklyUpdateResponse],
    current_week: date,
    project_started: Optional[datetime],
) -> CadenceStatus:
    by_period = {item.period_start: item for item in updates}

    # Track from the project's first week, but never more than the window.
    first_tracked = _week_start(project_started.date()) if project_started else current_week
    if updates:
        first_tracked = min(first_tracked, min(by_period))
    window_floor = current_week - timedelta(weeks=CADENCE_WINDOW_WEEKS - 1)
    start = max(first_tracked, window_floor)

    weeks: List[date] = []
    cursor = start
    while cursor <= current_week:
        weeks.append(cursor)
        cursor += timedelta(days=7)

    # The current week is still open, so a missing record is not yet a miss.
    closed_weeks = [week for week in weeks if week != current_week]
    missed = [_week_label(week) for week in closed_weeks if week not in by_period]
    reported_closed = [week for week in closed_weeks if week in by_period]
    on_time = sum(1 for week in reported_closed if not by_period[week].submitted_late)

    # Streak counts back from the current week; an unreported open week doesn't break it.
    streak = 0
    cursor = current_week if current_week in by_period else current_week - timedelta(days=7)
    while cursor in by_period:
        streak += 1
        cursor -= timedelta(days=7)

    return CadenceStatus(
        period_start=current_week,
        period_end=_week_end(current_week),
        label=_week_label(current_week),
        due_at=_due_at(current_week),
        reported=current_week in by_period,
        current=by_period.get(current_week),
        streak_weeks=streak,
        weeks_tracked=len(weeks),
        weeks_reported=len(by_period),
        missed_weeks=missed[-6:],
        on_time_rate=round(on_time / len(closed_weeks) * 100, 1) if closed_weeks else 100.0,
    )


@router.get("/projects/{project_id}/pulse", response_model=ProjectPulse)
async def get_project_pulse(
    project_id: str,
    mode: str = Query("weekly", pattern="^(weekly|live)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard for one project, as a weekly snapshot or in real time."""
    project = await _load_project(db, project_id, current_user)

    now = datetime.now()
    current_week = _week_start(now.date())
    updates = await _history(db, project_id)
    cadence = _cadence(updates, current_week, project.created_at)

    if mode == "weekly":
        # Freeze on the reported week: the current one if it's already filed,
        # otherwise the last week that was.
        anchor = current_week if cadence.reported else None
        if anchor is None:
            reported = [item.period_start for item in updates if item.period_start < current_week]
            anchor = max(reported) if reported else current_week
        as_of = min(now, _end_of_week_dt(anchor))
    else:
        as_of = now

    return ProjectPulse(
        project_id=project_id,
        project_title=project.title,
        mode=mode,
        generated_at=now,
        as_of=as_of,
        stale=not cadence.reported,
        cadence=cadence,
        counters=await _counters(db, project_id, as_of),
        recent_updates=updates[:RECENT_UPDATES],
    )


@router.get("/projects/{project_id}/weekly-updates", response_model=List[WeeklyUpdateResponse])
async def list_weekly_updates(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _load_project(db, project_id, current_user)
    return await _history(db, project_id)


@router.post("/projects/{project_id}/weekly-updates", response_model=WeeklyUpdateResponse)
async def record_weekly_update(
    project_id: str,
    payload: WeeklyUpdateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """File (or replace) the record for a week.

    Re-filing the same week overwrites it rather than creating a duplicate, so
    the "one record per week" guarantee holds without the client having to know
    whether a record already exists.
    """
    await _load_project(db, project_id, current_user)

    today = date.today()
    target = _week_start(payload.period_start or today)
    if target > _week_start(today):
        raise HTTPException(status_code=422, detail="Cannot file a record for a future week.")

    result = await db.execute(
        select(ProjectWeeklyUpdate).where(
            ProjectWeeklyUpdate.project_id == project_id,
            ProjectWeeklyUpdate.period_start == target,
        )
    )
    entry = result.scalars().first()
    iso_year, iso_week, _ = target.isocalendar()

    if entry:
        is_reviewer = bool((await _role_keys(db, current_user)) & REVIEWER_ROLES)
        if entry.submitted_by != current_user.id and not is_reviewer:
            raise HTTPException(
                status_code=403,
                detail="This week has already been recorded by someone else.",
            )
        entry.status = payload.status.value
        entry.headline = payload.headline
        entry.progress_note = payload.progress_note
        entry.blockers = payload.blockers
        entry.next_steps = payload.next_steps
        entry.completion_percent = payload.completion_percent
    else:
        entry = ProjectWeeklyUpdate(
            project_id=project_id,
            period_start=target,
            iso_year=iso_year,
            iso_week=iso_week,
            status=payload.status.value,
            headline=payload.headline,
            progress_note=payload.progress_note,
            blockers=payload.blockers,
            next_steps=payload.next_steps,
            completion_percent=payload.completion_percent,
            submitted_by=current_user.id,
        )
        db.add(entry)

    await db.commit()
    await db.refresh(entry)
    return _to_response(entry, current_user.full_name)


@router.patch("/weekly-updates/{update_id}", response_model=WeeklyUpdateResponse)
async def edit_weekly_update(
    update_id: UUID,
    payload: WeeklyUpdateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ProjectWeeklyUpdate).where(ProjectWeeklyUpdate.id == update_id))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Weekly record not found")
    await _load_project(db, entry.project_id, current_user)

    is_reviewer = bool((await _role_keys(db, current_user)) & REVIEWER_ROLES)
    if entry.submitted_by != current_user.id and not is_reviewer:
        raise HTTPException(status_code=403, detail="You can only edit records you filed")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value.value if isinstance(value, UpdateStatus) else value)

    await db.commit()
    await db.refresh(entry)
    return _to_response(entry, None)


@router.delete("/weekly-updates/{update_id}")
async def delete_weekly_update(
    update_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ProjectWeeklyUpdate).where(ProjectWeeklyUpdate.id == update_id))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Weekly record not found")
    await _load_project(db, entry.project_id, current_user)

    is_reviewer = bool((await _role_keys(db, current_user)) & REVIEWER_ROLES)
    if entry.submitted_by != current_user.id and not is_reviewer:
        raise HTTPException(status_code=403, detail="You can only remove records you filed")

    await db.delete(entry)
    await db.commit()
    return {"message": "Weekly record removed"}


@router.get("/weekly-digest", response_model=WeeklyDigest)
async def organization_weekly_digest(
    week_of: Optional[date] = Query(None, description="Any day inside the week to report on."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One week, every project in the caller's organization: who reported, who didn't."""
    target = _week_start(week_of or date.today())
    end = _week_end(target)

    if not current_user.organization_id:
        return WeeklyDigest(
            period_start=target,
            period_end=end,
            label=_week_label(target),
            projects_total=0,
            projects_reported=0,
            reporting_rate=0.0,
            at_risk=0,
            blocked=0,
            rows=[],
        )

    projects = (
        (await db.execute(select(Project).where(Project.organization_id == current_user.organization_id)))
        .scalars()
        .all()
    )
    project_ids = [project.id for project in projects]
    if not project_ids:
        return WeeklyDigest(
            period_start=target,
            period_end=end,
            label=_week_label(target),
            projects_total=0,
            projects_reported=0,
            reporting_rate=0.0,
            at_risk=0,
            blocked=0,
            rows=[],
        )

    # Pull the whole cadence window once, then bucket in memory: one query
    # instead of one per project.
    window_floor = target - timedelta(weeks=CADENCE_WINDOW_WEEKS)
    entries = (
        (
            await db.execute(
                select(ProjectWeeklyUpdate).where(
                    ProjectWeeklyUpdate.project_id.in_(project_ids),
                    ProjectWeeklyUpdate.period_start >= window_floor,
                    ProjectWeeklyUpdate.period_start <= target,
                )
            )
        )
        .scalars()
        .all()
    )

    filed: dict[str, dict[date, ProjectWeeklyUpdate]] = {}
    for entry in entries:
        filed.setdefault(entry.project_id, {})[entry.period_start] = entry

    rows: List[DigestRow] = []
    for project in projects:
        weeks = filed.get(project.id, {})
        entry = weeks.get(target)
        streak = 0
        cursor = target
        while cursor in weeks:
            streak += 1
            cursor -= timedelta(days=7)
        rows.append(
            DigestRow(
                project_id=project.id,
                title=project.title,
                reported=entry is not None,
                status=entry.status if entry else None,
                headline=entry.headline if entry else None,
                completion_percent=entry.completion_percent if entry else None,
                streak_weeks=streak,
            )
        )

    reported = [row for row in rows if row.reported]
    rows.sort(key=lambda row: (row.reported, row.title or ""))
    return WeeklyDigest(
        period_start=target,
        period_end=end,
        label=_week_label(target),
        projects_total=len(rows),
        projects_reported=len(reported),
        reporting_rate=round(len(reported) / len(rows) * 100, 1) if rows else 0.0,
        at_risk=sum(1 for row in reported if row.status == UpdateStatus.AT_RISK),
        blocked=sum(1 for row in reported if row.status == UpdateStatus.BLOCKED),
        rows=rows,
    )
