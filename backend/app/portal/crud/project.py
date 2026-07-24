from sqlalchemy.ext.asyncio import AsyncSession
from app.portal.models.project import Project
from app.portal.schemas.project import ProjectCreate
from uuid import UUID
from sqlalchemy.future import select

async def create_project(db: AsyncSession, project: ProjectCreate, user_id: str, organization_id: str, custom_id: str = None):
    db_project = Project(
        id=custom_id, # Use generated ID
        title=project.title,
        category=project.category,
        description=project.description,
        project_type=project.project_type,
        target_assignee=project.target_assignee,
        required_skills=project.required_skills,
        duration=project.duration,
        deliverables=project.deliverables,
        deadline=project.deadline,
        status=project.status,
        created_by=user_id,
        organization_id=organization_id
    )
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)
    return db_project

async def get_project_by_id(db: AsyncSession, project_id: str):
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalars().first()


async def get_projects_by_organization(db: AsyncSession, organization_id: str, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(Project)
        .where(Project.organization_id == organization_id)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

async def get_projects_with_details(db: AsyncSession, organization_id: str = None, skip: int = 0, limit: int = 100, target_assignee_id: str = None, target_assignee_name: str = None, creator_id: str = None):
    # 1. Fetch Projects
    query = select(Project)
    if organization_id:
        query = query.where(Project.organization_id == organization_id)
    
    from sqlalchemy import or_

    if target_assignee_id or target_assignee_name or creator_id:
        filters = []
        if target_assignee_id:
            # Check if target_assignee contains the ID (using ILIKE for CSV simulation)
            filters.append(Project.target_assignee.ilike(f"%{target_assignee_id}%"))
        if target_assignee_name:
            # Legacy support
            filters.append(Project.target_assignee == target_assignee_name)
        
        assignee_filters = []
        if target_assignee_id:
             assignee_filters.append(Project.target_assignee.ilike(f"%{target_assignee_id}%"))
        if target_assignee_name:
             assignee_filters.append(Project.target_assignee == target_assignee_name)
        
        if assignee_filters:
            query = query.where(or_(*assignee_filters))
            
        if creator_id:
            query = query.where(Project.created_by == creator_id)
        
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    projects = result.scalars().all()
    
    if not projects:
        return []

    # 2. Collect IDs
    user_ids = set()
    for p in projects:
        if p.created_by:
            user_ids.add(p.created_by)
        if p.target_assignee:
            # Split by comma for multiple assignees
            potential_ids = p.target_assignee.split(',')
            for pid in potential_ids:
                pid = pid.strip()
                # ID is now String, no need to validate as UUID, but assume it matches format
                if pid:
                    user_ids.add(pid)

    # 3. Fetch Users
    from app.portal.models.user import User
    if user_ids:
        user_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u.full_name for u in user_result.scalars().all()}
    else:
        users_map = {}

    # 4. Construct Response
    enriched_projects = []
    for p in projects:
        # Create a dict/object similar to schema
        p_dict = p.__dict__.copy()
        
        # Add creator name
        p_dict['created_by_name'] = users_map.get(p.created_by)
        
        # Add assignee names
        assignee_names = []
        if p.target_assignee:
            potential_ids = p.target_assignee.split(',')
            for pid in potential_ids:
                pid = pid.strip()
                name = users_map.get(pid) # Try finding by ID
                if name:
                    assignee_names.append(name)
                else:
                    # If not found by ID, assume it is a legacy name
                    assignee_names.append(pid)
        
        p_dict['assignee_name'] = ", ".join(assignee_names) if assignee_names else None

        enriched_projects.append(p_dict)
        
    return enriched_projects

