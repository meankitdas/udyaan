"""AI endpoints: agentic copilot, indexing, and structured generation helpers."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.ai.agent import run_agent
from app.portal.ai.indexer import reindex_organization
from app.portal.ai.llm import get_llm
from app.portal.core.deps import get_current_user
from app.portal.database import get_db
from app.portal.models.project_compliance import ProjectMeeting
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User

router = APIRouter(prefix="/ai", tags=["ai"])


async def _role_of(db: AsyncSession, user: User) -> str:
    result = await db.execute(
        select(Role.role_key).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == user.id)
    )
    return result.scalars().first() or "USER"


# ---------------------------------------------------------------- schemas

class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list)


class Citation(BaseModel):
    kind: str
    ref_id: str
    title: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    trace: list[dict]
    model: str


class BriefRequest(BaseModel):
    idea: str = Field(..., min_length=3, max_length=1500)


class MeetingSummaryRequest(BaseModel):
    notes: str = Field(..., min_length=10, max_length=8000)
    meeting_id: Optional[str] = None


# ---------------------------------------------------------------- endpoints

@router.get("/status")
async def ai_status(current_user: User = Depends(get_current_user)):
    llm = get_llm()
    return {
        "generation": "azure-openai" if llm.available else "retrieval-only",
        "model": llm.model,
        "retrieval": "hybrid (vector + BM25, RRF fused)",
        "organization_id": current_user.organization_id,
    }


@router.post("/reindex")
async def reindex(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Rebuild the retrieval index for the caller's organization."""
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="You are not linked to an organization yet.")
    return await reindex_organization(db, current_user.organization_id)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agentic RAG copilot grounded in the caller's workspace."""
    role = await _role_of(db, current_user)
    result = await run_agent(
        db,
        current_user,
        role,
        payload.message,
        [t.model_dump() for t in payload.history],
    )
    return result


@router.post("/project-brief")
async def project_brief(
    payload: BriefRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Turn a rough idea into a structured, ready-to-submit project brief."""
    llm = get_llm()
    if not llm.available:
        raise HTTPException(status_code=503, detail="AI generation is not configured on this deployment.")

    data = llm.json(
        system=(
            "You design agriculture/agri-tech student projects. Return STRICT JSON with keys: "
            "title (string), category (string), description (string, 2-4 sentences), "
            "project_type (string), required_skills (comma-separated string), duration (string), "
            "deliverables (string), milestones (array of {week: string, goal: string}). "
            "Be concrete and achievable for a student team."
        ),
        user=f"Idea: {payload.idea}",
        max_tokens=900,
    )
    if not data:
        raise HTTPException(status_code=502, detail="The model did not return a usable brief. Try rephrasing.")
    return data


@router.post("/meeting-summary")
async def meeting_summary(
    payload: MeetingSummaryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Summarize raw meeting notes into minutes + extracted action items."""
    llm = get_llm()
    if not llm.available:
        raise HTTPException(status_code=503, detail="AI generation is not configured on this deployment.")

    context = ""
    if payload.meeting_id:
        meeting = (
            await db.execute(select(ProjectMeeting).where(ProjectMeeting.id == payload.meeting_id))
        ).scalars().first()
        if meeting:
            context = f"Meeting title: {meeting.title}\nAgenda: {meeting.agenda or ''}\n"

    data = llm.json(
        system=(
            "You write concise minutes of meeting. Return STRICT JSON with keys: "
            "summary (string, 3-6 sentences), decisions (array of strings), "
            "action_items (array of {title: string, owner: string, due_hint: string, urgency: one of Low|Medium|High|Critical}), "
            "risks (array of strings). Only use information present in the notes."
        ),
        user=f"{context}Raw notes:\n{payload.notes}",
        max_tokens=900,
    )
    if not data:
        raise HTTPException(status_code=502, detail="The model did not return a usable summary.")
    return data
