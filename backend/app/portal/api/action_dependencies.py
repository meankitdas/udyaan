"""Dependency graph for project action items.

The existing action list records ownership and dates but not sequencing. This
router adds directed edges, rejects cycles, and derives ready/blocked/critical
states server-side so every dashboard agrees about what can start next.
"""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from sqlalchemy.future import select

from app.portal.core.deps import get_current_user
from app.portal.core.roles import MANAGER_ROLES
from app.portal.database import get_db
from app.portal.models.action_dependency import ActionDependency
from app.portal.models.project import Project
from app.portal.models.project_compliance import ActionItem
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User
from app.portal.schemas.action_dependency import (
    DependencyCreate,
    DependencyEdge,
    DependencyGraph,
    DependencyNode,
)

router = APIRouter(tags=["action-dependencies"])


async def _role_keys(db: AsyncSession, user: User) -> set[str]:
    return set(
        (
            await db.execute(
                select(Role.role_key)
                .join(UserRole, Role.id == UserRole.role_id)
                .where(UserRole.user_id == user.id)
            )
        ).scalars().all()
    )


async def _require_manager(db: AsyncSession, user: User) -> None:
    if not (await _role_keys(db, user)) & MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only project managers can change dependencies.")


async def _project(db: AsyncSession, project_id: str, user: User) -> Project:
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    roles = await _role_keys(db, user)
    if "SUPERADMIN" not in roles and (
        not user.organization_id or project.organization_id != user.organization_id
    ):
        raise HTTPException(status_code=403, detail="Access denied")
    return project


async def _action(db: AsyncSession, action_id: UUID, user: User) -> ActionItem:
    action = (await db.execute(select(ActionItem).where(ActionItem.id == action_id))).scalars().first()
    if not action:
        raise HTTPException(status_code=404, detail="Action item not found")
    await _project(db, action.project_id, user)
    return action


def _has_path(start: UUID, target: UUID, outgoing: dict[UUID, set[UUID]]) -> bool:
    """Whether following dependency edges from start eventually reaches target."""
    pending = [start]
    seen: set[UUID] = set()
    while pending:
        current = pending.pop()
        if current == target:
            return True
        if current in seen:
            continue
        seen.add(current)
        pending.extend(outgoing.get(current, ()))
    return False


def _longest_chain(nodes: list[UUID], outgoing: dict[UUID, set[UUID]]) -> list[UUID]:
    """Longest chain, defensively tolerating corrupt legacy cycles."""
    memo: dict[UUID, list[UUID]] = {}

    def visit(node: UUID, active: set[UUID]) -> list[UUID]:
        if node in memo:
            return memo[node]
        if node in active:
            return []
        children = outgoing.get(node, set())
        tail = max((visit(child, active | {node}) for child in children), key=len, default=[])
        memo[node] = [node, *tail]
        return memo[node]

    return max((visit(node, set()) for node in nodes), key=len, default=[])


@router.get("/projects/{project_id}/dependency-graph", response_model=DependencyGraph)
async def get_dependency_graph(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _project(db, project_id, current_user)
    actions = (
        await db.execute(select(ActionItem).where(ActionItem.project_id == project_id))
    ).scalars().all()
    action_ids = {action.id for action in actions}

    edges = []
    if action_ids:
        edges = (
            await db.execute(
                select(ActionDependency).where(ActionDependency.action_id.in_(action_ids))
            )
        ).scalars().all()

    person_ids = {action.assigned_to for action in actions}
    names = {}
    if person_ids:
        names = {
            person.id: person.full_name or person.email
            for person in (
                await db.execute(select(User).where(User.id.in_(person_ids)))
            ).scalars().all()
        }

    prerequisites: dict[UUID, set[UUID]] = {action.id: set() for action in actions}
    dependents: dict[UUID, set[UUID]] = {action.id: set() for action in actions}
    for edge in edges:
        prerequisites.setdefault(edge.action_id, set()).add(edge.depends_on_id)
        dependents.setdefault(edge.depends_on_id, set()).add(edge.action_id)

    completed = {action.id for action in actions if action.status == "Completed"}
    critical_path = _longest_chain([action.id for action in actions], dependents)
    critical = set(critical_path) if len(critical_path) > 1 else set()
    today = date.today()

    nodes = []
    for action in actions:
        unresolved = len(prerequisites[action.id] - completed)
        done = action.id in completed
        nodes.append(
            DependencyNode(
                id=action.id,
                title=action.title,
                status=action.status,
                urgency=action.urgency,
                due_date=action.due_date,
                assigned_to=action.assigned_to,
                assigned_to_name=names.get(action.assigned_to),
                prerequisite_ids=sorted(prerequisites[action.id], key=str),
                dependent_ids=sorted(dependents[action.id], key=str),
                unresolved_prerequisites=unresolved,
                blocked=not done and unresolved > 0,
                overdue=not done and action.due_date < today,
                ready=not done and unresolved == 0,
                on_critical_path=action.id in critical,
            )
        )

    return DependencyGraph(
        project_id=project_id,
        nodes=nodes,
        edges=[
            DependencyEdge(id=edge.id, action_id=edge.action_id, depends_on_id=edge.depends_on_id)
            for edge in edges
        ],
        blocked_count=sum(1 for node in nodes if node.blocked),
        ready_count=sum(1 for node in nodes if node.ready),
        overdue_count=sum(1 for node in nodes if node.overdue),
        critical_path=critical_path if critical else [],
    )


@router.post("/action-items/{action_id}/dependencies", response_model=DependencyEdge)
async def add_dependency(
    action_id: UUID,
    payload: DependencyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_manager(db, current_user)
    action = await _action(db, action_id, current_user)
    prerequisite = await _action(db, payload.depends_on_id, current_user)
    if action.status == "Completed":
        raise HTTPException(status_code=422, detail="A completed action cannot receive new dependencies.")
    if action.project_id != prerequisite.project_id:
        raise HTTPException(status_code=422, detail="Dependencies must belong to the same project.")
    if action.id == prerequisite.id:
        raise HTTPException(status_code=422, detail="An action cannot depend on itself.")

    # Serialise edge creation for this project. Without this, two opposite edges
    # submitted concurrently can both pass cycle validation before either commits.
    await db.execute(select(func.pg_advisory_xact_lock(func.hashtext(action.project_id))))

    existing = (
        await db.execute(
            select(ActionDependency).where(
                ActionDependency.action_id == action.id,
                ActionDependency.depends_on_id == prerequisite.id,
            )
        )
    ).scalars().first()
    if existing:
        return existing

    project_ids = (
        await db.execute(select(ActionItem.id).where(ActionItem.project_id == action.project_id))
    ).scalars().all()
    graph_edges = (
        await db.execute(select(ActionDependency).where(ActionDependency.action_id.in_(project_ids)))
    ).scalars().all()
    outgoing: dict[UUID, set[UUID]] = {}
    for edge in graph_edges:
        outgoing.setdefault(edge.depends_on_id, set()).add(edge.action_id)

    # Adding prerequisite -> action is a cycle exactly when action already reaches prerequisite.
    if _has_path(action.id, prerequisite.id, outgoing):
        raise HTTPException(status_code=422, detail="This dependency would create a cycle.")

    edge = ActionDependency(
        action_id=action.id,
        depends_on_id=prerequisite.id,
        created_by=current_user.id,
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return DependencyEdge(id=edge.id, action_id=edge.action_id, depends_on_id=edge.depends_on_id)


@router.delete("/action-dependencies/{edge_id}")
async def remove_dependency(
    edge_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_manager(db, current_user)
    edge = (
        await db.execute(select(ActionDependency).where(ActionDependency.id == edge_id))
    ).scalars().first()
    if not edge:
        raise HTTPException(status_code=404, detail="Dependency not found")
    await _action(db, edge.action_id, current_user)
    await db.delete(edge)
    await db.commit()
    return {"message": "Dependency removed"}
