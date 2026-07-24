"""Builds the retrieval index from live portal entities.

Every project, action item, meeting, report and person profile becomes a
document with an embedding, so the copilot can ground its answers in the
organization's real data instead of hallucinating.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.models.ai import AiDocument
from app.portal.models.project import Project
from app.portal.models.project_compliance import ActionItem, ProjectMeeting
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User

logger = logging.getLogger(__name__)


def _clean(value) -> str:
    return str(value).strip() if value not in (None, "") else ""


async def _collect(db: AsyncSession, organization_id: str) -> list[dict]:
    """Flatten org entities into indexable documents."""
    docs: list[dict] = []

    # --- Projects ---
    projects = (
        await db.execute(select(Project).where(Project.organization_id == organization_id))
    ).scalars().all()
    project_titles = {p.id: p.title for p in projects}

    for p in projects:
        body = "\n".join(
            filter(
                None,
                [
                    f"Project: {_clean(p.title)}",
                    f"Category: {_clean(p.category)}" if p.category else "",
                    f"Status: {_clean(p.status)}" if p.status else "",
                    f"Deadline: {_clean(p.deadline)}" if p.deadline else "",
                    f"Duration: {_clean(p.duration)}" if p.duration else "",
                    f"Description: {_clean(p.description)}" if p.description else "",
                    f"Deliverables: {_clean(p.deliverables)}" if p.deliverables else "",
                    f"Required skills: {_clean(p.required_skills)}" if p.required_skills else "",
                ],
            )
        )
        docs.append({
            "kind": "project", "ref_id": p.id, "title": p.title or "Untitled project",
            "content": body, "visibility": "org",
        })

    # --- Action items (private to the assignee, plus visible to staff via project) ---
    project_ids = list(project_titles.keys())
    if project_ids:
        actions = (
            await db.execute(select(ActionItem).where(ActionItem.project_id.in_(project_ids)))
        ).scalars().all()
        for a in actions:
            body = "\n".join(
                filter(
                    None,
                    [
                        f"Action item: {_clean(a.title)}",
                        f"Project: {project_titles.get(a.project_id, a.project_id)}",
                        f"Status: {_clean(a.status)}",
                        f"Urgency: {_clean(a.urgency)}",
                        f"Due date: {_clean(a.due_date)}",
                        f"Description: {_clean(a.description)}" if a.description else "",
                    ],
                )
            )
            docs.append({
                "kind": "action_item", "ref_id": str(a.id), "title": a.title or "Action item",
                "content": body, "visibility": "org",
            })

        # --- Meetings & minutes ---
        meetings = (
            await db.execute(select(ProjectMeeting).where(ProjectMeeting.project_id.in_(project_ids)))
        ).scalars().all()
        for m in meetings:
            body = "\n".join(
                filter(
                    None,
                    [
                        f"Meeting: {_clean(m.title)}",
                        f"Project: {project_titles.get(m.project_id, m.project_id)}",
                        f"Date: {_clean(m.meeting_date)}",
                        f"Agenda: {_clean(m.agenda)}" if m.agenda else "",
                        f"Attendees: {_clean(m.attendees)}" if m.attendees else "",
                        f"Minutes: {_clean(m.mom_content)}" if m.mom_content else "",
                    ],
                )
            )
            docs.append({
                "kind": "meeting", "ref_id": str(m.id), "title": m.title or "Meeting",
                "content": body, "visibility": "org",
            })

    # --- People (skills directory powers team matching questions) ---
    people = (
        await db.execute(
            select(User, Role.role_key)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(User.organization_id == organization_id)
        )
    ).all()
    for user, role_key in people:
        body = "\n".join(
            filter(
                None,
                [
                    f"Person: {_clean(user.full_name)}",
                    f"Role: {_clean(role_key)}",
                    f"Skills: {_clean(user.skills)}" if getattr(user, "skills", None) else "",
                    f"Email: {_clean(user.email)}",
                ],
            )
        )
        docs.append({
            "kind": "person", "ref_id": user.id, "title": user.full_name or user.email,
            "content": body, "visibility": "org",
        })

    return docs


async def reindex_organization(db: AsyncSession, organization_id: str) -> dict:
    """Rebuild the retrieval index for one organization."""
    if not organization_id:
        return {"indexed": 0, "embedded": False}

    docs = await _collect(db, organization_id)

    # Embed in one batch where possible; degrade to unembedded (BM25-only) on failure.
    embedded = False
    vectors: list[Optional[list[float]]] = [None] * len(docs)
    if docs:
        try:
            from app.rag.embeddings import Embedder

            embedder = Embedder()
            vectors = embedder.embed([f"{d['title']}\n{d['content']}" for d in docs])
            embedded = True
        except Exception as exc:
            logger.warning("Embedding failed, index will use keyword search only: %s", exc)
            vectors = [None] * len(docs)

    # Replace the org's slice of the index atomically.
    await db.execute(delete(AiDocument).where(AiDocument.organization_id == organization_id))
    for doc, vec in zip(docs, vectors):
        db.add(
            AiDocument(
                organization_id=organization_id,
                kind=doc["kind"],
                ref_id=doc["ref_id"],
                title=doc["title"][:255],
                content=doc["content"],
                visibility=doc["visibility"],
                embedding=json.dumps(vec) if vec else None,
                dim=len(vec) if vec else None,
            )
        )
    await db.commit()

    by_kind: dict[str, int] = {}
    for d in docs:
        by_kind[d["kind"]] = by_kind.get(d["kind"], 0) + 1

    return {"indexed": len(docs), "embedded": embedded, "by_kind": by_kind}
