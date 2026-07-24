"""Community & insights features: skill-based matching, leaderboard, org analytics."""

from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.api.auth import get_current_user
from app.portal.database import get_db
from app.portal.models.project import Project
from app.portal.models.project_compliance import ActionItem
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User

router = APIRouter(prefix="/community", tags=["community"])


def _skill_set(raw: Optional[str]) -> set:
    return {s.strip().lower() for s in (raw or "").split(",") if s.strip()}


# ---------- Schemas ----------

class PeerMatch(BaseModel):
    id: str
    full_name: str
    role_key: Optional[str] = None
    shared_skills: List[str]
    score: float


class ProjectMatch(BaseModel):
    id: str
    title: str
    category: Optional[str] = None
    status: Optional[str] = None
    matched_skills: List[str]
    score: float


class MatchesResponse(BaseModel):
    my_skills: List[str]
    peers: List[PeerMatch]
    projects: List[ProjectMatch]


class LeaderboardEntry(BaseModel):
    user_id: str
    full_name: str
    role_key: Optional[str] = None
    completed: int
    total: int
    points: int


class OrgInsights(BaseModel):
    users_by_role: dict
    pending_approvals: int
    projects_by_status: dict
    action_items_total: int
    action_items_completed: int
    action_items_overdue: int
    upcoming_deadlines: List[dict]


# ---------- Endpoints ----------

@router.get("/matches", response_model=MatchesResponse)
async def get_matches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Skill-based matching: peers who share skills, and projects that need them."""
    my_skills = _skill_set(current_user.skills)
    peers: List[PeerMatch] = []
    projects: List[ProjectMatch] = []

    if current_user.organization_id:
        result = await db.execute(
            select(User, Role.role_key)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                User.organization_id == current_user.organization_id,
                User.id != current_user.id,
                User.is_active == True,  # noqa: E712
            )
        )
        for user, role_key in result:
            theirs = _skill_set(user.skills)
            shared = sorted(my_skills & theirs)
            if not shared:
                continue
            union = my_skills | theirs
            peers.append(
                PeerMatch(
                    id=user.id,
                    full_name=user.full_name,
                    role_key=role_key,
                    shared_skills=shared,
                    score=round(len(shared) / len(union), 3) if union else 0.0,
                )
            )
        peers.sort(key=lambda p: p.score, reverse=True)

        proj_result = await db.execute(
            select(Project).where(
                Project.organization_id == current_user.organization_id,
                Project.status.in_(["Draft", "Assigned", "In Progress"]),
            )
        )
        for project in proj_result.scalars():
            needed = _skill_set(project.required_skills)
            matched = sorted(my_skills & needed)
            if not matched:
                continue
            projects.append(
                ProjectMatch(
                    id=project.id,
                    title=project.title,
                    category=project.category,
                    status=project.status,
                    matched_skills=matched,
                    score=round(len(matched) / len(needed), 3) if needed else 0.0,
                )
            )
        projects.sort(key=lambda p: p.score, reverse=True)

    return MatchesResponse(my_skills=sorted(my_skills), peers=peers[:10], projects=projects[:10])


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top contributors in the org, ranked by completed action items."""
    if not current_user.organization_id:
        return []

    result = await db.execute(
        select(
            User.id,
            User.full_name,
            Role.role_key,
            func.count(ActionItem.id).label("total"),
            func.count(ActionItem.id).filter(ActionItem.status == "Completed").label("completed"),
        )
        .join(ActionItem, ActionItem.assigned_to == User.id)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(User.organization_id == current_user.organization_id)
        .group_by(User.id, User.full_name, Role.role_key)
        .order_by(func.count(ActionItem.id).filter(ActionItem.status == "Completed").desc())
        .limit(10)
    )
    entries = []
    for user_id, full_name, role_key, total, completed in result:
        entries.append(
            LeaderboardEntry(
                user_id=user_id,
                full_name=full_name,
                role_key=role_key,
                completed=completed,
                total=total,
                points=completed * 10 + (total - completed) * 2,
            )
        )
    entries.sort(key=lambda e: e.points, reverse=True)
    return entries


@router.get("/insights", response_model=OrgInsights)
async def get_org_insights(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Org-wide analytics for admin dashboards."""
    empty = OrgInsights(
        users_by_role={}, pending_approvals=0, projects_by_status={},
        action_items_total=0, action_items_completed=0, action_items_overdue=0,
        upcoming_deadlines=[],
    )
    org_id = current_user.organization_id
    if not org_id:
        return empty

    users_result = await db.execute(
        select(Role.role_key, func.count(User.id))
        .join(UserRole, UserRole.role_id == Role.id)
        .join(User, User.id == UserRole.user_id)
        .where(User.organization_id == org_id)
        .group_by(Role.role_key)
    )
    users_by_role = {role_key: count for role_key, count in users_result}

    pending_result = await db.execute(
        select(func.count(User.id)).where(
            User.organization_id == org_id, User.is_approved == False  # noqa: E712
        )
    )
    pending_approvals = pending_result.scalar() or 0

    projects_result = await db.execute(
        select(Project.status, func.count(Project.id))
        .where(Project.organization_id == org_id)
        .group_by(Project.status)
    )
    projects_by_status = {status or "Unknown": count for status, count in projects_result}

    ai_result = await db.execute(
        select(
            func.count(ActionItem.id),
            func.count(ActionItem.id).filter(ActionItem.status == "Completed"),
            func.count(ActionItem.id).filter(
                ActionItem.status != "Completed", ActionItem.due_date < date.today()
            ),
        )
        .join(Project, ActionItem.project_id == Project.id)
        .where(Project.organization_id == org_id)
    )
    total, completed, overdue = ai_result.one()

    deadline_result = await db.execute(
        select(Project.id, Project.title, Project.deadline, Project.status)
        .where(
            Project.organization_id == org_id,
            Project.deadline.isnot(None),
            Project.deadline >= date.today(),
            Project.deadline <= date.today() + timedelta(days=14),
            Project.status.notin_(["Completed", "Archived"]),
        )
        .order_by(Project.deadline)
        .limit(10)
    )
    upcoming = [
        {"id": pid, "title": title, "deadline": str(deadline), "status": status}
        for pid, title, deadline, status in deadline_result
    ]

    return OrgInsights(
        users_by_role=users_by_role,
        pending_approvals=pending_approvals,
        projects_by_status=projects_by_status,
        action_items_total=total or 0,
        action_items_completed=completed or 0,
        action_items_overdue=overdue or 0,
        upcoming_deadlines=upcoming,
    )
