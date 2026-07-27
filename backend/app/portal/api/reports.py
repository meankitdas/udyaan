from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.portal.database import get_db
from app.portal.schemas.report import (
    StudentReportCreate,
    FacultyReportCreate,
    ReportResponse,
    ReportDetail,
)
from app.portal.crud.report import create_report
from app.portal.models.project import Project
from app.portal.models.report import Report
from app.portal.models.user import User
from app.portal.models.role import UserRole, Role
from sqlalchemy.future import select
from jose import jwt, JWTError
from app.portal.config import settings
from fastapi.security import OAuth2PasswordBearer
from uuid import UUID

router = APIRouter(prefix="/reports", tags=["reports"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="portal/auth/login")

from app.portal.core.deps import get_current_user  # noqa: E402,F401

async def get_role_key(user: User, db: AsyncSession):
    result = await db.execute(
        select(Role).join(UserRole).where(UserRole.user_id == user.id)
    )
    roles = result.scalars().all()
    # Assuming single role for simplicity in check, but list handling is safer
    return [r.role_key for r in roles]

async def check_target_user_role(target_id: str, required_role_key: str, db: AsyncSession):
    # Verify the target user exists and has the required role
    result = await db.execute(
        select(User).join(UserRole).join(Role).where(
            User.id == target_id,
            Role.role_key == required_role_key
        )
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=400, detail=f"Target user does not have role {required_role_key} or does not exist")
    return user

@router.post("/student", response_model=ReportResponse)
async def create_student_report(
    report_data: StudentReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify Current User is STUDENT
    roles = await get_role_key(current_user, db)
    if "STUDENT" not in roles:
        raise HTTPException(status_code=403, detail="Only Students can submit this report")

    # 2. Verify Target is FACULTY
    await check_target_user_role(report_data.faculty_id, "FACULTY", db)
    
    # 3. Create Report
    try:
        new_report = await create_report(
            db,
            title=report_data.title,
            content=report_data.content,
            project_id=report_data.project_id,
            submitted_by=current_user.id,
            submitted_to=report_data.faculty_id
        )
        return new_report
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal Server Error")


# ---------------------------------------------------------------- reading
#
# Reports were write-only until now: students and faculty could submit them and
# nobody could ever read one back. These close that loop. Visibility follows the
# reporting line rather than a blanket role check — you see what you wrote and
# what was written to you; admins see their organisation; superadmins see all.

@router.get("", response_model=List[ReportDetail])
async def list_reports(
    project_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=200, description="Match against title or content."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    roles = set(await get_role_key(current_user, db))

    stmt = select(Report)
    if "SUPERADMIN" in roles:
        pass  # platform-wide
    elif "ADMIN" in roles:
        if not current_user.organization_id:
            return []
        org_project_ids = (
            await db.execute(
                select(Project.id).where(Project.organization_id == current_user.organization_id)
            )
        ).scalars().all()
        if not org_project_ids:
            return []
        stmt = stmt.where(Report.project_id.in_(org_project_ids))
    else:
        stmt = stmt.where(
            or_(Report.submitted_by == current_user.id, Report.submitted_to == current_user.id)
        )

    if project_id:
        stmt = stmt.where(Report.project_id == project_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Report.title.ilike(like), Report.content.ilike(like)))

    rows = (
        await db.execute(stmt.order_by(Report.created_at.desc()).limit(200))
    ).scalars().all()
    if not rows:
        return []

    # Resolve names in two lookups rather than per row.
    user_ids = {r.submitted_by for r in rows} | {r.submitted_to for r in rows}
    people = {
        u.id: u.full_name or u.email
        for u in (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
    }
    proj_ids = {r.project_id for r in rows}
    projects = {
        p.id: p.title
        for p in (await db.execute(select(Project).where(Project.id.in_(proj_ids)))).scalars().all()
    }

    return [
        ReportDetail(
            id=str(r.id),
            title=r.title,
            content=r.content,
            project_id=r.project_id,
            project_title=projects.get(r.project_id),
            submitted_by=r.submitted_by,
            submitted_by_name=people.get(r.submitted_by),
            submitted_to=r.submitted_to,
            submitted_to_name=people.get(r.submitted_to),
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/{report_id}", response_model=ReportDetail)
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = (await db.execute(select(Report).where(Report.id == report_id))).scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    roles = set(await get_role_key(current_user, db))
    if not roles & {"SUPERADMIN"}:
        involved = current_user.id in (report.submitted_by, report.submitted_to)
        in_org = False
        if "ADMIN" in roles and current_user.organization_id:
            project = (
                await db.execute(select(Project).where(Project.id == report.project_id))
            ).scalars().first()
            in_org = bool(project and project.organization_id == current_user.organization_id)
        if not (involved or in_org):
            raise HTTPException(status_code=403, detail="Access denied")

    people = {
        u.id: u.full_name or u.email
        for u in (
            await db.execute(
                select(User).where(User.id.in_({report.submitted_by, report.submitted_to}))
            )
        ).scalars().all()
    }
    project = (
        await db.execute(select(Project).where(Project.id == report.project_id))
    ).scalars().first()

    return ReportDetail(
        id=str(report.id),
        title=report.title,
        content=report.content,
        project_id=report.project_id,
        project_title=project.title if project else None,
        submitted_by=report.submitted_by,
        submitted_by_name=people.get(report.submitted_by),
        submitted_to=report.submitted_to,
        submitted_to_name=people.get(report.submitted_to),
        created_at=report.created_at,
    )


@router.post("/faculty", response_model=ReportResponse)
async def create_faculty_report(
    report_data: FacultyReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verify Current User is FACULTY
    roles = await get_role_key(current_user, db)
    if "FACULTY" not in roles:
        raise HTTPException(status_code=403, detail="Only Faculty can submit this report")

    # 2. Verify Target is PROJECT_HEAD
    await check_target_user_role(report_data.project_head_id, "PROJECT_HEAD", db)
    
    # 3. Create Report
    try:
        new_report = await create_report(
            db,
            title=report_data.title,
            content=report_data.content,
            project_id=report_data.project_id,
            submitted_by=current_user.id,
            submitted_to=report_data.project_head_id
        )
        return new_report
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal Server Error")
