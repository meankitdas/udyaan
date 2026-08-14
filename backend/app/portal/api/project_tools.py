"""Propose and review the project management tools a project runs on."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.portal.core.deps import get_current_user
from app.portal.core.roles import REVIEWER_ROLES
from app.portal.database import get_db
from app.portal.models.project import Project
from app.portal.models.project_tool import ProjectTool, ToolStatus
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.project_tool import (
    ProjectToolCreate,
    ProjectToolDecision,
    ProjectToolResponse,
)

router = APIRouter(tags=["project-tools"])


async def _role_keys(db: AsyncSession, user: User) -> set[str]:
    result = await db.execute(
        select(Role.role_key).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == user.id)
    )
    return {key for key in result.scalars().all() if key}


async def _load_project(db: AsyncSession, project_id: str, user: User) -> Project:
    """Fetch a project the caller is allowed to see, mirroring project detail access."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.organization_id and project.organization_id and user.organization_id != project.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return project


def _to_response(tool: ProjectTool, proposer_name: Optional[str]) -> ProjectToolResponse:
    return ProjectToolResponse(
        id=tool.id,
        project_id=tool.project_id,
        tool_key=tool.tool_key,
        name=tool.name,
        url=tool.url,
        purpose=tool.purpose,
        status=tool.status,
        review_note=tool.review_note,
        proposed_by=tool.proposed_by,
        proposed_by_name=proposer_name,
        decided_by=tool.decided_by,
        created_at=tool.created_at,
    )


async def _load_tool(db: AsyncSession, tool_id: UUID, user: User) -> tuple[ProjectTool, Optional[str]]:
    # Joined eagerly: async sessions cannot lazy-load the proposer relationship.
    result = await db.execute(
        select(ProjectTool, User.full_name)
        .join(User, User.id == ProjectTool.proposed_by, isouter=True)
        .where(ProjectTool.id == tool_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Tool proposal not found")
    tool, proposer_name = row
    await _load_project(db, tool.project_id, user)
    return tool, proposer_name


@router.get("/projects/{project_id}/tools", response_model=List[ProjectToolResponse])
async def list_project_tools(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _load_project(db, project_id, current_user)
    result = await db.execute(
        select(ProjectTool, User.full_name)
        .join(User, User.id == ProjectTool.proposed_by, isouter=True)
        .where(ProjectTool.project_id == project_id)
        .order_by(ProjectTool.created_at.desc())
    )
    return [_to_response(tool, name) for tool, name in result.all()]


@router.post("/projects/{project_id}/tools", response_model=ProjectToolResponse)
async def propose_project_tool(
    project_id: str,
    payload: ProjectToolCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _load_project(db, project_id, current_user)

    # Anyone on the project may propose, but a proposal is never self-approving:
    # the status is set here rather than accepted from the client.
    tool = ProjectTool(
        project_id=project_id,
        tool_key=payload.tool_key,
        name=payload.name,
        url=payload.url,
        purpose=payload.purpose,
        status=ToolStatus.PROPOSED.value,
        proposed_by=current_user.id,
    )
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return _to_response(tool, current_user.full_name)


@router.patch("/project-tools/{tool_id}", response_model=ProjectToolResponse)
async def decide_project_tool(
    tool_id: UUID,
    payload: ProjectToolDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tool, proposer_name = await _load_tool(db, tool_id, current_user)

    if not (await _role_keys(db, current_user)) & REVIEWER_ROLES:
        raise HTTPException(status_code=403, detail="Only faculty or admins can review tool proposals")

    tool.status = payload.status.value
    tool.review_note = payload.review_note
    tool.decided_by = current_user.id
    await db.commit()
    await db.refresh(tool)
    return _to_response(tool, proposer_name)


@router.delete("/project-tools/{tool_id}")
async def remove_project_tool(
    tool_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tool, _ = await _load_tool(db, tool_id, current_user)

    is_reviewer = bool((await _role_keys(db, current_user)) & REVIEWER_ROLES)
    if tool.proposed_by != current_user.id and not is_reviewer:
        raise HTTPException(status_code=403, detail="You can only remove your own proposal")

    await db.delete(tool)
    await db.commit()
    return {"message": "Tool removed"}
