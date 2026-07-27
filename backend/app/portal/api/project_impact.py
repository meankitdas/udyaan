"""Record and read a project's full results chain.

Progress is derived server-side so every dashboard (project view, org roll-up)
reports the same number rather than each client inventing its own formula.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.core.deps import get_current_user
from app.portal.database import get_db
from app.portal.models.project import Project
from app.portal.models.project_impact import ImpactStage, ProjectImpactEntry
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.project_impact import (
    ImpactEntryCreate,
    ImpactEntryResponse,
    ImpactEntryUpdate,
    ImpactOverview,
    ImpactStageSummary,
)

router = APIRouter(tags=["project-impact"])

STAGE_ORDER = [
    ImpactStage.INPUTS,
    ImpactStage.PROCESS,
    ImpactStage.OUTPUTS,
    ImpactStage.OUTCOMES,
    ImpactStage.IMPACT,
]
REVIEWER_ROLES = {"ADMIN", "PROJECT_HEAD", "FACULTY", "SUPERADMIN"}


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


def _progress(entry: ProjectImpactEntry) -> Optional[float]:
    """Percent of the way from baseline to target. None when not measurable."""
    if entry.metric_value is None or entry.target_value is None:
        return None
    baseline = entry.baseline_value or 0.0
    span = entry.target_value - baseline
    if span == 0:
        # Target already equals baseline: either met or not, no gradient to report.
        return 100.0 if entry.metric_value >= entry.target_value else 0.0
    ratio = (entry.metric_value - baseline) / span
    return round(max(0.0, min(1.0, ratio)) * 100, 1)


def _to_response(entry: ProjectImpactEntry, recorder_name: Optional[str]) -> ImpactEntryResponse:
    return ImpactEntryResponse(
        id=entry.id,
        project_id=entry.project_id,
        stage=entry.stage,
        title=entry.title,
        description=entry.description,
        metric_name=entry.metric_name,
        metric_unit=entry.metric_unit,
        baseline_value=entry.baseline_value,
        metric_value=entry.metric_value,
        target_value=entry.target_value,
        recorded_by=entry.recorded_by,
        recorded_by_name=recorder_name,
        progress=_progress(entry),
        created_at=entry.created_at,
    )


async def _load_entry(db: AsyncSession, entry_id: UUID, user: User):
    result = await db.execute(
        select(ProjectImpactEntry, User.full_name)
        .join(User, User.id == ProjectImpactEntry.recorded_by, isouter=True)
        .where(ProjectImpactEntry.id == entry_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Impact entry not found")
    entry, recorder_name = row
    await _load_project(db, entry.project_id, user)
    return entry, recorder_name


@router.get("/projects/{project_id}/impact", response_model=ImpactOverview)
async def get_project_impact(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _load_project(db, project_id, current_user)
    result = await db.execute(
        select(ProjectImpactEntry, User.full_name)
        .join(User, User.id == ProjectImpactEntry.recorded_by, isouter=True)
        .where(ProjectImpactEntry.project_id == project_id)
        .order_by(ProjectImpactEntry.created_at)
    )
    rows = result.all()
    entries = [_to_response(entry, name) for entry, name in rows]

    stages: list[ImpactStageSummary] = []
    for stage in STAGE_ORDER:
        in_stage = [item for item in entries if item.stage == stage]
        measured = [item.progress for item in in_stage if item.progress is not None]
        stages.append(
            ImpactStageSummary(
                stage=stage,
                entries=len(in_stage),
                measured=len(measured),
                average_progress=round(sum(measured) / len(measured), 1) if measured else None,
            )
        )

    filled = sum(1 for summary in stages if summary.entries > 0)
    return ImpactOverview(
        project_id=project_id,
        stages=stages,
        total_entries=len(entries),
        chain_completeness=round(filled / len(STAGE_ORDER) * 100, 1),
        entries=entries,
    )


@router.post("/projects/{project_id}/impact", response_model=ImpactEntryResponse)
async def create_impact_entry(
    project_id: str,
    payload: ImpactEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _load_project(db, project_id, current_user)
    entry = ProjectImpactEntry(
        project_id=project_id,
        stage=payload.stage.value,
        title=payload.title,
        description=payload.description,
        metric_name=payload.metric_name,
        metric_unit=payload.metric_unit,
        baseline_value=payload.baseline_value,
        metric_value=payload.metric_value,
        target_value=payload.target_value,
        recorded_by=current_user.id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _to_response(entry, current_user.full_name)


@router.patch("/impact-entries/{entry_id}", response_model=ImpactEntryResponse)
async def update_impact_entry(
    entry_id: UUID,
    payload: ImpactEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry, recorder_name = await _load_entry(db, entry_id, current_user)

    is_reviewer = bool((await _role_keys(db, current_user)) & REVIEWER_ROLES)
    if entry.recorded_by != current_user.id and not is_reviewer:
        raise HTTPException(status_code=403, detail="You can only edit entries you recorded")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)

    await db.commit()
    await db.refresh(entry)
    return _to_response(entry, recorder_name)


@router.delete("/impact-entries/{entry_id}")
async def delete_impact_entry(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry, _ = await _load_entry(db, entry_id, current_user)

    is_reviewer = bool((await _role_keys(db, current_user)) & REVIEWER_ROLES)
    if entry.recorded_by != current_user.id and not is_reviewer:
        raise HTTPException(status_code=403, detail="You can only remove entries you recorded")

    await db.delete(entry)
    await db.commit()
    return {"message": "Impact entry removed"}


@router.get("/impact/overview", response_model=List[ImpactStageSummary])
async def organization_impact_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Roll the results chain up across every project in the caller's organization."""
    if not current_user.organization_id:
        return []

    result = await db.execute(
        select(ProjectImpactEntry)
        .join(Project, Project.id == ProjectImpactEntry.project_id)
        .where(Project.organization_id == current_user.organization_id)
    )
    entries = result.scalars().all()

    summaries: list[ImpactStageSummary] = []
    for stage in STAGE_ORDER:
        in_stage = [entry for entry in entries if entry.stage == stage.value]
        measured = [value for value in (_progress(entry) for entry in in_stage) if value is not None]
        summaries.append(
            ImpactStageSummary(
                stage=stage,
                entries=len(in_stage),
                measured=len(measured),
                average_progress=round(sum(measured) / len(measured), 1) if measured else None,
            )
        )
    return summaries
