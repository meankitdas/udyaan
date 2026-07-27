"""Control centre: one aggregated payload behind the admin dashboard.

The dashboard needs a dozen related figures at once — headline counts, twelve
weeks of activity, status distributions, the approval queue, a directory to
manage, and a recent-activity feed. Serving those as a dozen endpoints would
mean a dozen round trips and, worse, a dashboard whose panels disagree with each
other because they were fetched seconds apart. This assembles them from one
consistent read.

Scope follows role: an ADMIN sees their own organisation, a SUPERADMIN sees the
whole platform and may target any single organisation.
"""

from collections import Counter
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.core.deps import get_current_user
from app.portal.database import get_db
from app.portal.models.organization import Organization
from app.portal.models.project import Project
from app.portal.models.project_compliance import ActionItem, ProjectMeeting
from app.portal.models.project_impact import ProjectImpactEntry
from app.portal.models.project_tool import ProjectTool, ToolStatus
from app.portal.models.project_update import ProjectWeeklyUpdate
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User

router = APIRouter(prefix="/control", tags=["control-centre"])

ADMIN_ROLES = {"ADMIN", "SUPERADMIN"}
TREND_WEEKS = 12
FEED_LIMIT = 25
# Anything older than this is history, not "activity".
FEED_WINDOW_DAYS = 45


class Metric(BaseModel):
    key: str
    label: str
    value: float
    # Change against the preceding period of equal length. None when there is
    # no prior period to compare against, which is different from "no change".
    delta: Optional[float] = None
    unit: Optional[str] = None
    spark: List[float] = []


class SeriesPoint(BaseModel):
    label: str
    projects: int
    updates: int
    meetings: int
    actions: int


class Slice(BaseModel):
    name: str
    value: int


class DirectoryRow(BaseModel):
    kind: str
    id: str
    name: str
    subtitle: Optional[str] = None
    status: Optional[str] = None
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    role: Optional[str] = None
    created_at: Optional[datetime] = None
    approved: Optional[bool] = None


class FeedItem(BaseModel):
    kind: str
    title: str
    detail: Optional[str] = None
    project_id: Optional[str] = None
    at: Optional[datetime] = None


class ControlCentre(BaseModel):
    scope: str
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    generated_at: datetime
    metrics: List[Metric]
    series: List[SeriesPoint]
    project_status: List[Slice]
    role_mix: List[Slice]
    update_status: List[Slice]
    directory: List[DirectoryRow]
    feed: List[FeedItem]
    pending_approvals: int


async def _role_keys(db: AsyncSession, user: User) -> set[str]:
    result = await db.execute(
        select(Role.role_key).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == user.id)
    )
    return {key for key in result.scalars().all() if key}


def _week_start(value: date) -> date:
    return value - timedelta(days=value.weekday())


def _delta(current: float, previous: float) -> Optional[float]:
    """Percent change, or None when there is no baseline to compare against."""
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 1)


@router.get("/overview", response_model=ControlCentre)
async def control_overview(
    organization_id: Optional[str] = Query(None, description="Superadmin only: narrow to one organisation."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    roles = await _role_keys(db, current_user)
    if not roles & ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Administrators only.")

    is_super = "SUPERADMIN" in roles
    scope = "platform"
    target_org: Optional[str] = None

    if organization_id:
        if not is_super and organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Access denied")
        target_org = organization_id
        scope = "organization"
    elif not is_super:
        if not current_user.organization_id:
            raise HTTPException(status_code=400, detail="You are not linked to an organization yet.")
        target_org = current_user.organization_id
        scope = "organization"

    # ---- read once, slice in memory -------------------------------------
    org_rows = (await db.execute(select(Organization))).scalars().all()
    org_names = {o.id: o.name for o in org_rows}

    project_q = select(Project)
    user_q = select(User)
    if target_org:
        project_q = project_q.where(Project.organization_id == target_org)
        user_q = user_q.where(User.organization_id == target_org)

    projects = (await db.execute(project_q)).scalars().all()
    users = (await db.execute(user_q)).scalars().all()
    project_ids = [p.id for p in projects]
    project_titles = {p.id: p.title for p in projects}

    meetings: list = []
    actions: list = []
    updates: list = []
    impact: list = []
    tools: list = []
    if project_ids:
        meetings = (
            (await db.execute(select(ProjectMeeting).where(ProjectMeeting.project_id.in_(project_ids))))
            .scalars().all()
        )
        actions = (
            (await db.execute(select(ActionItem).where(ActionItem.project_id.in_(project_ids))))
            .scalars().all()
        )
        updates = (
            (await db.execute(select(ProjectWeeklyUpdate).where(ProjectWeeklyUpdate.project_id.in_(project_ids))))
            .scalars().all()
        )
        impact = (
            (await db.execute(select(ProjectImpactEntry).where(ProjectImpactEntry.project_id.in_(project_ids))))
            .scalars().all()
        )
        tools = (
            (
                await db.execute(
                    select(ProjectTool).where(
                        ProjectTool.project_id.in_(project_ids),
                        ProjectTool.status == ToolStatus.APPROVED.value,
                    )
                )
            ).scalars().all()
        )

    user_ids = [u.id for u in users]
    role_rows = []
    if user_ids:
        role_rows = (
            await db.execute(
                select(UserRole.user_id, Role.role_key)
                .join(Role, Role.id == UserRole.role_id)
                .where(UserRole.user_id.in_(user_ids))
            )
        ).all()
    role_of = {uid: key for uid, key in role_rows}

    today = date.today()
    this_monday = _week_start(today)
    weeks = [this_monday - timedelta(weeks=i) for i in range(TREND_WEEKS - 1, -1, -1)]

    def bucket(rows, when) -> Counter:
        counts: Counter = Counter()
        for row in rows:
            stamp = when(row)
            if not stamp:
                continue
            d = stamp.date() if isinstance(stamp, datetime) else stamp
            counts[_week_start(d)] += 1
        return counts

    proj_by_week = bucket(projects, lambda p: p.created_at)
    upd_by_week = bucket(updates, lambda u: u.period_start)
    meet_by_week = bucket(meetings, lambda m: m.meeting_date)
    act_by_week = bucket(actions, lambda a: a.created_at)

    series = [
        SeriesPoint(
            label=f"W{w.isocalendar()[1]:02d}",
            projects=proj_by_week.get(w, 0),
            updates=upd_by_week.get(w, 0),
            meetings=meet_by_week.get(w, 0),
            actions=act_by_week.get(w, 0),
        )
        for w in weeks
    ]

    # Headline metrics, each with a 6-week sparkline and a like-for-like delta.
    half = TREND_WEEKS // 2
    def split(counter: Counter) -> tuple[int, int]:
        recent = sum(counter.get(w, 0) for w in weeks[half:])
        prior = sum(counter.get(w, 0) for w in weeks[:half])
        return recent, prior

    upd_recent, upd_prior = split(upd_by_week)
    meet_recent, meet_prior = split(meet_by_week)
    act_recent, act_prior = split(act_by_week)

    completed = sum(1 for a in actions if a.status == "Completed")
    overdue = sum(1 for a in actions if a.status != "Completed" and a.due_date and a.due_date < today)
    approvals = sum(1 for u in users if not getattr(u, "is_approved", True))

    metrics = [
        Metric(key="projects", label="Projects", value=len(projects),
               spark=[proj_by_week.get(w, 0) for w in weeks[-6:]]),
        Metric(key="people", label="People", value=len(users)),
        Metric(key="updates", label="Weekly updates", value=upd_recent,
               delta=_delta(upd_recent, upd_prior),
               spark=[upd_by_week.get(w, 0) for w in weeks[-6:]]),
        Metric(key="meetings", label="Meetings", value=meet_recent,
               delta=_delta(meet_recent, meet_prior),
               spark=[meet_by_week.get(w, 0) for w in weeks[-6:]]),
        Metric(key="actions", label="Action items", value=act_recent,
               delta=_delta(act_recent, act_prior),
               spark=[act_by_week.get(w, 0) for w in weeks[-6:]]),
        Metric(key="closure", label="Actions closed", unit="%",
               value=round(completed / len(actions) * 100, 1) if actions else 0.0),
        Metric(key="overdue", label="Overdue", value=overdue),
        Metric(key="impact", label="Impact records", value=len(impact)),
        Metric(key="tools", label="Connected tools", value=len(tools)),
    ]
    if scope == "platform":
        metrics.insert(0, Metric(key="orgs", label="Organisations", value=len(org_rows)))

    project_status = [Slice(name=k or "Unknown", value=v) for k, v in Counter(p.status for p in projects).items()]
    role_mix = [Slice(name=k, value=v) for k, v in Counter(role_of.get(u.id, "UNASSIGNED") for u in users).items()]
    latest_by_project: dict[str, ProjectWeeklyUpdate] = {}
    for u in updates:
        cur = latest_by_project.get(u.project_id)
        if not cur or u.period_start > cur.period_start:
            latest_by_project[u.project_id] = u
    update_status = [Slice(name=k, value=v) for k, v in Counter(u.status for u in latest_by_project.values()).items()]

    # ---- directory: the manage-anything table ---------------------------
    directory: list[DirectoryRow] = []
    for p in projects:
        directory.append(
            DirectoryRow(
                kind="project", id=p.id, name=p.title or "Untitled",
                subtitle=p.category, status=p.status,
                organization_id=p.organization_id,
                organization_name=org_names.get(p.organization_id or ""),
                created_at=p.created_at,
            )
        )
    for u in users:
        directory.append(
            DirectoryRow(
                kind="person", id=u.id, name=u.full_name or u.email,
                subtitle=u.email, role=role_of.get(u.id),
                organization_id=u.organization_id,
                organization_name=org_names.get(u.organization_id or ""),
                created_at=getattr(u, "created_at", None),
                approved=getattr(u, "is_approved", None),
            )
        )
    if scope == "platform":
        for o in org_rows:
            directory.append(
                DirectoryRow(
                    kind="organisation", id=o.id, name=o.name,
                    subtitle=o.email, organization_id=o.id,
                    organization_name=o.name, created_at=o.created_at,
                )
            )

    # ---- activity feed --------------------------------------------------
    cutoff = datetime.now() - timedelta(days=FEED_WINDOW_DAYS)
    feed: list[FeedItem] = []
    for u in updates:
        if u.created_at and u.created_at >= cutoff:
            feed.append(FeedItem(kind="update", title=u.headline,
                                 detail=project_titles.get(u.project_id), project_id=u.project_id, at=u.created_at))
    for m in meetings:
        if m.created_at and m.created_at >= cutoff:
            feed.append(FeedItem(kind="meeting", title=m.title,
                                 detail=project_titles.get(m.project_id), project_id=m.project_id, at=m.created_at))
    for a in actions:
        if a.created_at and a.created_at >= cutoff:
            feed.append(FeedItem(kind="action", title=a.title,
                                 detail=project_titles.get(a.project_id), project_id=a.project_id, at=a.created_at))
    for e in impact:
        if e.created_at and e.created_at >= cutoff:
            feed.append(FeedItem(kind="impact", title=e.title,
                                 detail=project_titles.get(e.project_id), project_id=e.project_id, at=e.created_at))
    feed.sort(key=lambda f: f.at or datetime.min, reverse=True)

    return ControlCentre(
        scope=scope,
        organization_id=target_org,
        organization_name=org_names.get(target_org or ""),
        generated_at=datetime.now(),
        metrics=metrics,
        series=series,
        project_status=sorted(project_status, key=lambda s: -s.value),
        role_mix=sorted(role_mix, key=lambda s: -s.value),
        update_status=sorted(update_status, key=lambda s: -s.value),
        directory=directory,
        feed=feed[:FEED_LIMIT],
        pending_approvals=approvals,
    )
