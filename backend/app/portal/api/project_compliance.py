from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.portal.database import get_db
from app.portal.models.user import User
from app.portal.models.action_dependency import ActionDependency
from app.portal.models.project_compliance import ProjectMeeting, ActionItem, ActionStatus
from app.portal.models.project import Project
from app.portal.models.role import Role, UserRole
from app.portal.api.auth import get_current_user
from app.portal.schemas.project_compliance import (
    MeetingCreate, MeetingUpdate, MeetingResponse,
    ActionItemCreate, ActionItemUpdateStatus, ActionItemResponse
)
from uuid import UUID
from typing import List

router = APIRouter(tags=["project-compliance"])


async def get_role_key(user: User, db: AsyncSession) -> list[str]:
    return list(
        (
            await db.execute(
                select(Role.role_key)
                .join(UserRole, Role.id == UserRole.role_id)
                .where(UserRole.user_id == user.id)
            )
        ).scalars().all()
    )

# --- Meetings ---

@router.post("/projects/{project_id}/meetings", response_model=MeetingResponse)
async def create_meeting(
    project_id: str,
    meeting: MeetingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify Project Exists & Access (Simplified: Any auth user can add for now, ideally restrict to Faculty/Admin)
    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_meeting = ProjectMeeting(
        project_id=project_id,
        created_by=current_user.id,
        title=meeting.title,
        meeting_date=meeting.meeting_date,
        agenda=meeting.agenda,
        attendees=meeting.attendees
    )
    db.add(new_meeting)
    await db.commit()
    await db.refresh(new_meeting)
    return new_meeting

@router.get("/projects/{project_id}/meetings", response_model=List[MeetingResponse])
async def list_meetings(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(ProjectMeeting).where(ProjectMeeting.project_id == project_id).order_by(ProjectMeeting.meeting_date.desc())
    )
    return result.scalars().all()

@router.patch("/meetings/{meeting_id}", response_model=MeetingResponse)
async def update_meeting_mom(
    meeting_id: UUID,
    update_data: MeetingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(ProjectMeeting).where(ProjectMeeting.id == meeting_id))
    meeting = result.scalars().first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    if update_data.mom_content is not None:
        meeting.mom_content = update_data.mom_content
    if update_data.agenda is not None:
        meeting.agenda = update_data.agenda
    if update_data.attendees is not None:
        meeting.attendees = update_data.attendees
        
    await db.commit()
    await db.refresh(meeting)
    return meeting

# --- Action Items ---

@router.post("/projects/{project_id}/action-items", response_model=ActionItemResponse)
async def create_action_item(
    project_id: str,
    item: ActionItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_action = ActionItem(
        project_id=project_id,
        created_by=current_user.id,
        assigned_to=item.assigned_to,
        meeting_id=item.meeting_id,
        title=item.title,
        description=item.description,
        due_date=item.due_date,
        urgency=item.urgency,
        status=ActionStatus.PENDING
    )
    db.add(new_action)
    await db.commit()
    await db.refresh(new_action)
    return new_action

@router.get("/projects/{project_id}/action-items", response_model=List[ActionItemResponse])
async def list_action_items(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Filter? Maybe show only assigned to me if Student?
    # For now show all for the project
    result = await db.execute(
        select(ActionItem).where(ActionItem.project_id == project_id).order_by(ActionItem.due_date)
    )
    return result.scalars().all()

@router.get("/action-items/me", response_model=List[ActionItemResponse])
async def list_my_action_items(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch action items assigned to the current user (by UUID string match)
    # The assigned_to field is a string (UUID).
    
    # Strictly we should check if assigned_to == str(current_user.id)
    # Or strict equality?
    # Ideally should be consistent.
    
    uid = str(current_user.id)
    result = await db.execute(
        select(ActionItem).where(ActionItem.assigned_to == uid).order_by(ActionItem.due_date)
    )
    return result.scalars().all()


@router.get("/action-items", response_model=List[ActionItemResponse])
async def list_org_action_items(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """All action items across the current user's organization's projects (admin view)."""
    if not current_user.organization_id:
        return []
    result = await db.execute(
        select(ActionItem)
        .join(Project, ActionItem.project_id == Project.id)
        .where(Project.organization_id == current_user.organization_id)
        .order_by(ActionItem.due_date)
    )
    return result.scalars().all()


@router.patch("/action-items/{item_id}/status", response_model=ActionItemResponse)
async def update_action_status(
    item_id: UUID,
    status_update: ActionItemUpdateStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(ActionItem).where(ActionItem.id == item_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Action Item not found")

    project = (
        await db.execute(select(Project).where(Project.id == item.project_id))
    ).scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    roles = set(await get_role_key(current_user, db))
    is_manager = bool(roles & {"ADMIN", "FACULTY", "PROJECT_HEAD", "SUPERADMIN"})
    is_assignee = item.assigned_to == current_user.id
    same_org = bool(current_user.organization_id and project.organization_id == current_user.organization_id)
    if "SUPERADMIN" not in roles and not same_org:
        raise HTTPException(status_code=403, detail="Access denied")
    if not (is_manager or is_assignee):
        raise HTTPException(status_code=403, detail="You cannot update this action item.")

    if status_update.status == ActionStatus.COMPLETED:
        prerequisite_ids = (
            await db.execute(
                select(ActionDependency.depends_on_id).where(ActionDependency.action_id == item.id)
            )
        ).scalars().all()
        if prerequisite_ids:
            completed_ids = set(
                (
                    await db.execute(
                        select(ActionItem.id).where(
                            ActionItem.id.in_(prerequisite_ids),
                            ActionItem.status == ActionStatus.COMPLETED.value,
                        )
                    )
                ).scalars().all()
            )
            unresolved = len(set(prerequisite_ids) - completed_ids)
            if unresolved:
                raise HTTPException(
                    status_code=409,
                    detail=f"Complete {unresolved} prerequisite action(s) first.",
                )
        
    item.status = status_update.status
    await db.commit()
    await db.refresh(item)
    return item
