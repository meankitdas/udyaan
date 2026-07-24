from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.portal.database import get_db
from app.portal.schemas.project import ProjectCreate, ProjectResponse, ProjectWithDetails
from app.portal.crud.project import create_project
from app.portal.models.user import User
from app.portal.models.role import UserRole, Role
from sqlalchemy.future import select
from jose import jwt, JWTError
from app.portal.config import settings
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/projects", tags=["projects"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="portal/auth/login")

from app.portal.core.deps import get_current_user  # noqa: E402,F401

async def get_privileged_user(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Check if user has ADMIN or PROJECT_HEAD role
    result = await db.execute(
        select(Role).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == current_user.id)
    )
    roles = result.scalars().all()
    role_keys = [r.role_key for r in roles]
    
    if "ADMIN" in role_keys or "PROJECT_HEAD" in role_keys:
        return current_user, role_keys
        
    raise HTTPException(status_code=403, detail="Not enough permissions")

@router.post("", response_model=ProjectResponse)
async def create_new_project(
    project_data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user_context: tuple = Depends(get_privileged_user)
):
    current_user, role_keys = user_context
    
    # Validation: Must belong to an organization
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User is not part of any organization")

    try:
        from app.portal.utils.id_generator import generate_project_id
        pid = generate_project_id()
        
        new_project = await create_project(
            db, 
            project_data, 
            user_id=current_user.id, 
            organization_id=current_user.organization_id,
            custom_id=pid
        )
        return new_project
    except Exception as e:
        import traceback
        traceback.print_exc()
        with open("project_error.txt", "w") as f:
            f.write(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("", response_model=list[ProjectWithDetails])
async def read_projects(
    skip: int = 0,
    limit: int = 100,
    created_by_me: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check permissions logic manually here since we need different filters for Student vs Admin
    # is_superadmin check moved below after fetching roles
    
    # Fetch Roles
    result = await db.execute(
        select(Role).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == current_user.id)
    )
    roles = result.scalars().all()
    role_keys = [r.role_key for r in roles]
    
    is_superadmin = "SUPERADMIN" in role_keys
    
    if not current_user.organization_id and not is_superadmin:
        raise HTTPException(status_code=400, detail="User is not part of any organization")

    target_assignee_id = None
    target_assignee_name = None
    creator_id = None
    
    target_assignee_id = None
    target_assignee_name = None
    creator_id = None
    
    # If Student or Faculty, ONLY show assigned projects
    # We check if they are NOT Admin/ProjectHead/Superadmin.
    # Basically if they have STUDENT or FACULTY role and none of the higher privs.
    
    has_higher_priv = "ADMIN" in role_keys or "SUPERADMIN" in role_keys or "PROJECT_HEAD" in role_keys
    
    if ("STUDENT" in role_keys or "FACULTY" in role_keys) and not has_higher_priv:
        target_assignee_id = str(current_user.id)
        target_assignee_name = current_user.full_name
    
    # If Admin/ProjectHead
    if created_by_me:
         creator_id = current_user.id
    
    # If Superadmin, organization_id can be None
    org_id = current_user.organization_id if not is_superadmin else None
    
    from app.portal.crud.project import get_projects_with_details
    projects = await get_projects_with_details(
        db, 
        org_id, 
        skip=skip, 
        limit=limit, 
        target_assignee_id=target_assignee_id,
        target_assignee_name=target_assignee_name,
        creator_id=creator_id
    )
    print(f"DEBUG PROJECT FETCH: User={current_user.email}, Roles={role_keys}, IsSuper={is_superadmin}, OrgID={org_id}, Count={len(projects)}")
    print(f"DEBUG PROJECT FETCH: User={current_user.email}, Roles={role_keys}, IsSuper={is_superadmin}, OrgID={org_id}, Count={len(projects)}")
    return projects

@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.portal.crud.project import get_project_by_id
    project = await get_project_by_id(db, project_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Permission Check
    # Fetch Roles
    result = await db.execute(
        select(Role).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == current_user.id)
    )
    roles = result.scalars().all()
    role_keys = [r.role_key for r in roles]

    is_superadmin = "SUPERADMIN" in role_keys
    is_org_admin = "ADMIN" in role_keys and current_user.organization_id == project.organization_id
    is_creator = project.created_by == current_user.id
    
    # Allow deletion if: Superadmin OR Org Admin (of that org) OR Creator
    if not (is_superadmin or is_org_admin or is_creator):
        raise HTTPException(status_code=403, detail="Not authorized to delete this project")
        
    await db.delete(project)
    await db.commit()
    
    return {"message": "Project deleted successfully"}

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project_details(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.portal.crud.project import get_project_by_id
    # from uuid import UUID # Removed
    
    # try:
    #     pid = UUID(project_id)
    # except ValueError:
    #     pass
        
    project = await get_project_by_id(db, project_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Permission Check
    # 1. Admin/ProjectHead/Superadmin can view ANY project (in their org, or all if super)
    # 2. Creator can view their own
    # 3. Assigned Student/Faculty can view
    
    # Allow if in same Org (basic check)
    if current_user.organization_id and project.organization_id and current_user.organization_id != project.organization_id:
         # Unless superadmin?
         # For now restrict strictly
         raise HTTPException(status_code=403, detail="Access denied")

    # If specifically assigned, allow access? 
    # Current list logic filtered by assignment for students.
    # We should enforce that here too.
    
    # Check access logic duplicated from list or simplified?
    # Simple: If user is Org Admin -> Allow
    # If user is Project Head -> Allow
    # If user is Creator -> Allow
    # If user is Assigned -> Allow
    
    # We need roles.
    result = await db.execute(
        select(Role).join(UserRole, Role.id == UserRole.role_id).where(UserRole.user_id == current_user.id)
    )
    roles = result.scalars().all()
    role_keys = [r.role_key for r in roles]

    # Permission Check
    allowed = False
    if "SUPERADMIN" in role_keys:
        allowed = True
    elif "ADMIN" in role_keys or "PROJECT_HEAD" in role_keys:
        if current_user.organization_id == project.organization_id:
            allowed = True
    elif project.created_by == current_user.id:
        allowed = True
    elif project.target_assignee and str(current_user.id) in project.target_assignee:
        allowed = True
        
    if not allowed:
        raise HTTPException(status_code=403, detail="You do not have permission to view this project.")

    # Populate Assignee Details
    project_response = ProjectResponse.from_orm(project)
    
    if project.target_assignee:
        try:
            assignee_ids = project.target_assignee.split(',')
            # Filter empty strings or spaces
            assignee_ids = [aid.strip() for aid in assignee_ids if aid.strip()]
            
            if assignee_ids:
                # Fetch Users
                stmt = select(User).where(User.id.in_(assignee_ids))
                res = await db.execute(stmt)
                users = res.scalars().all()
                
                details = []
                for u in users:
                    details.append({
                        "id": u.id,
                        "full_name": u.full_name,
                        "email": u.email
                    })
                project_response.assignees_details = details
        except Exception as e:
            print(f"Error fetching assignees: {e}")
            # Don't fail the whole request
            
    return project_response

