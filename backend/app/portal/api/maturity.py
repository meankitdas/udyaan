"""Digital Maturity Index endpoints.

Scores are computed live from the organisation's own records; snapshots are
explicit, so an admin can capture a baseline and later show movement against it
rather than only ever seeing "today".
"""

from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.core.deps import get_current_user
from app.portal.database import get_db
from app.portal.maturity import DIMENSIONS, FRAMEWORK_VERSION, OrgFacts, assess, framework_definition
from app.portal.models.maturity import MaturityAssessment
from app.portal.models.organization import Organization
from app.portal.models.project import Project
from app.portal.models.project_compliance import ActionItem, ProjectMeeting
from app.portal.models.project_impact import ProjectImpactEntry
from app.portal.models.project_tool import ProjectTool, ToolStatus
from app.portal.models.project_update import ProjectWeeklyUpdate
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.maturity import (
    Benchmark,
    BenchmarkRow,
    DimensionBenchmark,
    MaturityResult,
    SnapshotResponse,
)

router = APIRouter(prefix="/maturity", tags=["maturity"])

ADMIN_ROLES = {"ADMIN", "SUPERADMIN"}


async def _role_keys(db: AsyncSession, user: User) -> set[str]:
    result = await db.execute(
        select(Role.role_key).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == user.id)
    )
    return {key for key in result.scalars().all() if key}


async def _resolve_org(db: AsyncSession, user: User, organization_id: Optional[str]) -> str:
    """Callers see their own organisation; superadmins may target any."""
    if organization_id and organization_id != user.organization_id:
        if not (await _role_keys(db, user)) & {"SUPERADMIN"}:
            raise HTTPException(status_code=403, detail="Access denied")
        return organization_id
    if not user.organization_id:
        raise HTTPException(status_code=400, detail="You are not linked to an organization yet.")
    return user.organization_id


async def gather_facts(db: AsyncSession, organization_id: str) -> OrgFacts:
    """Read everything the index scores, in one place, for one organisation."""
    projects = (
        (await db.execute(select(Project).where(Project.organization_id == organization_id)))
        .scalars()
        .all()
    )
    project_ids = [p.id for p in projects]

    users = (
        (await db.execute(select(User).where(User.organization_id == organization_id))).scalars().all()
    )
    user_ids = [u.id for u in users]

    role_keys: set[str] = set()
    if user_ids:
        role_keys = {
            key
            for key in (
                await db.execute(
                    select(Role.role_key)
                    .join(UserRole, Role.id == UserRole.role_id)
                    .where(UserRole.user_id.in_(user_ids))
                )
            )
            .scalars()
            .all()
            if key
        }

    meetings: list = []
    actions: list = []
    impact: list = []
    tools: list = []
    weekly_rows: list = []
    if project_ids:
        meetings = (
            (await db.execute(select(ProjectMeeting).where(ProjectMeeting.project_id.in_(project_ids))))
            .scalars()
            .all()
        )
        actions = (
            (await db.execute(select(ActionItem).where(ActionItem.project_id.in_(project_ids))))
            .scalars()
            .all()
        )
        impact = (
            (
                await db.execute(
                    select(ProjectImpactEntry).where(ProjectImpactEntry.project_id.in_(project_ids))
                )
            )
            .scalars()
            .all()
        )
        tools = (
            (
                await db.execute(
                    select(ProjectTool).where(
                        ProjectTool.project_id.in_(project_ids),
                        ProjectTool.status == ToolStatus.APPROVED.value,
                    )
                )
            )
            .scalars()
            .all()
        )
        weekly_rows = (
            (
                await db.execute(
                    select(ProjectWeeklyUpdate).where(ProjectWeeklyUpdate.project_id.in_(project_ids))
                )
            )
            .scalars()
            .all()
        )

    weekly_by_project: dict[str, set] = {}
    for row in weekly_rows:
        weekly_by_project.setdefault(row.project_id, set()).add(row.period_start)

    # "Active" means the person left a trace, not merely that an account exists.
    contributors = {row.submitted_by for row in weekly_rows if row.submitted_by}
    contributors |= {e.recorded_by for e in impact if e.recorded_by}
    contributors |= {m.created_by for m in meetings if m.created_by}
    contributors &= set(user_ids)

    return OrgFacts(
        projects=projects,
        weekly_by_project=weekly_by_project,
        meetings=meetings,
        actions=actions,
        impact=impact,
        tools=tools,
        role_keys=role_keys,
        user_count=len(users),
        contributor_ids=contributors,
    )


def _evidence(facts: OrgFacts) -> dict:
    return {
        "projects": len(facts.projects),
        "users": facts.user_count,
        "active_contributors": len(facts.contributor_ids),
        "meetings": len(facts.meetings),
        "action_items": len(facts.actions),
        "impact_entries": len(facts.impact),
        "approved_tools": len(facts.tools),
        "weekly_updates": sum(len(v) for v in facts.weekly_by_project.values()),
    }


@router.get("/framework")
async def get_framework(current_user: User = Depends(get_current_user)):
    """The model itself: dimensions, weights and level bands."""
    return framework_definition()


@router.get("/assessment", response_model=MaturityResult)
async def get_assessment(
    organization_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = await _resolve_org(db, current_user, organization_id)
    org = (
        await db.execute(select(Organization).where(Organization.id == org_id))
    ).scalars().first()

    facts = await gather_facts(db, org_id)
    result = assess(facts)
    return MaturityResult(
        organization_id=org_id,
        organization_name=org.name if org else None,
        evidence=_evidence(facts),
        generated_at=datetime.now(),
        **result,
    )


@router.post("/snapshots", response_model=SnapshotResponse)
async def capture_snapshot(
    organization_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Freeze today's score so later movement can be shown against a baseline."""
    if not (await _role_keys(db, current_user)) & ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only administrators can capture a maturity snapshot.")

    org_id = await _resolve_org(db, current_user, organization_id)
    facts = await gather_facts(db, org_id)
    result = assess(facts)

    snapshot = MaturityAssessment(
        organization_id=org_id,
        framework_version=result["framework_version"],
        composite_score=result["composite_score"],
        level=result["level"],
        dimensions=result["dimensions"],
        evidence=_evidence(facts),
        captured_by=current_user.id,
    )
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)
    return snapshot


@router.get("/snapshots", response_model=List[SnapshotResponse])
async def list_snapshots(
    organization_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = await _resolve_org(db, current_user, organization_id)
    rows = (
        (
            await db.execute(
                select(MaturityAssessment)
                .where(MaturityAssessment.organization_id == org_id)
                .order_by(MaturityAssessment.created_at.desc())
                .limit(24)
            )
        )
        .scalars()
        .all()
    )
    return rows


@router.get("/benchmark", response_model=Benchmark)
async def benchmark(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Score every organisation on the same framework and place the caller's.

    This is the part that makes the index worth having: a number is only useful
    once you know whether it is good.
    """
    org_id = await _resolve_org(db, current_user, None)
    organizations = (await db.execute(select(Organization))).scalars().all()

    rows: list[BenchmarkRow] = []
    per_dimension: dict[str, list[float]] = {d.key: [] for d in DIMENSIONS}
    your_score: Optional[float] = None

    for org in organizations:
        facts = await gather_facts(db, org.id)
        if not facts.projects and not facts.user_count:
            continue  # An empty shell org would drag the cohort average to zero.
        result = assess(facts)
        rows.append(
            BenchmarkRow(
                organization_id=org.id,
                organization_name=org.name,
                composite_score=result["composite_score"],
                level=result["level"],
                coverage=result["coverage"],
            )
        )
        for dim in result["dimensions"]:
            if dim["applicable"] and dim["score"] is not None:
                per_dimension[dim["key"]].append(dim["score"])
        if org.id == org_id:
            your_score = result["composite_score"]

    scores = [r.composite_score for r in rows]
    percentile = None
    if your_score is not None and len(scores) > 1:
        at_or_below = sum(1 for s in scores if s <= your_score)
        percentile = round(at_or_below / len(scores) * 100, 1)

    rows.sort(key=lambda r: r.composite_score, reverse=True)
    return Benchmark(
        framework_version=FRAMEWORK_VERSION,
        organizations=len(rows),
        cohort_average=round(sum(scores) / len(scores), 1) if scores else None,
        your_score=your_score,
        your_percentile=percentile,
        dimensions=[
            DimensionBenchmark(
                key=d.key,
                label=d.label,
                cohort_average=(
                    round(sum(per_dimension[d.key]) / len(per_dimension[d.key]), 1)
                    if per_dimension[d.key]
                    else None
                ),
                organizations_scored=len(per_dimension[d.key]),
            )
            for d in DIMENSIONS
        ],
        leaderboard=rows[:10],
    )
