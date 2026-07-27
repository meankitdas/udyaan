"""Schemas for action dependency graph management."""

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DependencyCreate(BaseModel):
    depends_on_id: UUID


class DependencyEdge(BaseModel):
    id: UUID
    action_id: UUID
    depends_on_id: UUID


class DependencyNode(BaseModel):
    id: UUID
    title: str
    status: str
    urgency: str
    due_date: date
    assigned_to: str
    assigned_to_name: Optional[str] = None
    prerequisite_ids: list[UUID]
    dependent_ids: list[UUID]
    unresolved_prerequisites: int
    blocked: bool
    overdue: bool
    ready: bool
    on_critical_path: bool = False


class DependencyGraph(BaseModel):
    project_id: str
    nodes: list[DependencyNode]
    edges: list[DependencyEdge]
    blocked_count: int
    ready_count: int
    overdue_count: int
    critical_path: list[UUID]
