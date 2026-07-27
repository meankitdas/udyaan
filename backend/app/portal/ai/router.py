"""AI endpoints: agentic copilot, indexing, and structured generation helpers."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.ai.advisor import build_project_context, context_is_thin
from app.portal.ai.agent import run_agent
from app.portal.ai.indexer import reindex_organization
from app.portal.ai.llm import get_llm
from app.portal.core.deps import get_current_user
from app.portal.database import get_db
from app.portal.models.project import Project
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


class Recommendation(BaseModel):
    title: str
    why: str
    first_step: str
    effort: str = "medium"
    impact: str = "medium"


class Pillar(BaseModel):
    key: str
    label: str
    score: int
    headline: str
    findings: list[str] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)


class AdvisorReport(BaseModel):
    project_id: str
    project_title: Optional[str] = None
    generated_at: datetime
    model: str
    health_score: int
    health_summary: str
    pillars: list[Pillar]
    evidence: dict


class WeeklyDraft(BaseModel):
    status: str
    headline: str
    progress_note: str
    blockers: Optional[str] = None
    next_steps: Optional[str] = None
    completion_percent: Optional[float] = None
    grounded_in: dict


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

    data = await llm.ajson(
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

    data = await llm.ajson(
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


# ------------------------------------------------- automated project advisor

PILLARS = [
    ("innovation", "Product innovation"),
    ("operations", "Operational excellence"),
    ("delight", "Customer delight"),
]


async def _project_for_ai(db: AsyncSession, project_id: str, user: User) -> Project:
    project = (
        await db.execute(select(Project).where(Project.id == project_id))
    ).scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.organization_id and project.organization_id and user.organization_id != project.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return project


def _require_llm():
    llm = get_llm()
    if not llm.available:
        raise HTTPException(status_code=503, detail="AI generation is not configured on this deployment.")
    return llm


def _score(value) -> int:
    """Clamp a model-supplied score into 0-100. Models drift outside the range."""
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return 0


@router.post("/projects/{project_id}/advisor", response_model=AdvisorReport)
async def project_advisor(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Review a project across innovation, operations and customer delight.

    Takes no input: the project's own record is the input. The model is given
    pre-computed counts as facts and asked only to interpret them, so the
    numbers in the report always match the numbers on the dashboard.
    """
    project = await _project_for_ai(db, project_id, current_user)
    llm = _require_llm()

    context = await build_project_context(db, project)
    if context_is_thin(context):
        raise HTTPException(
            status_code=422,
            detail="Not enough recorded yet to advise on. Add a weekly update, a meeting or an impact entry first.",
        )

    data = await llm.ajson(
        system=(
            "You are an experienced programme reviewer for student-led agri-tech projects. "
            "You are given a project's real record as JSON. Assess it through three lenses: "
            "innovation (is the product/idea itself advancing, is it differentiated, what should be "
            "built or tested next), operations (is the team running well - cadence, follow-through on "
            "action items, meeting discipline, tooling), and delight (are the farmers/beneficiaries this "
            "project serves measurably better off, and how would they describe the experience).\n\n"
            "Return STRICT JSON: {health_score: int 0-100, health_summary: string (2-3 sentences), "
            "pillars: [{key: one of innovation|operations|delight, score: int 0-100, headline: string "
            "(one sentence), findings: [string] (2-4 observations, each citing something concrete from "
            "the record), recommendations: [{title: string, why: string, first_step: string (a concrete "
            "next action someone could do this week), effort: one of low|medium|high, impact: one of "
            "low|medium|high}] (2-3 per pillar)}]}\n\n"
            "Rules: never invent numbers - use only the counts provided. If a stage of the results chain "
            "is empty, say so rather than guessing what is in it. Be specific and practical; avoid "
            "generic advice that would apply to any project."
        ),
        user=json.dumps(context, default=str),
        max_tokens=2200,
    )
    if not data or not isinstance(data.get("pillars"), list):
        raise HTTPException(status_code=502, detail="The model did not return a usable review. Try again.")

    by_key = {p.get("key"): p for p in data["pillars"] if isinstance(p, dict)}
    pillars: list[Pillar] = []
    for key, label in PILLARS:
        raw = by_key.get(key, {})
        recs = []
        for item in raw.get("recommendations", []) or []:
            if not isinstance(item, dict) or not item.get("title"):
                continue
            recs.append(
                Recommendation(
                    title=str(item["title"]),
                    why=str(item.get("why", "")),
                    first_step=str(item.get("first_step", "")),
                    effort=str(item.get("effort", "medium")).lower(),
                    impact=str(item.get("impact", "medium")).lower(),
                )
            )
        pillars.append(
            Pillar(
                key=key,
                label=label,
                score=_score(raw.get("score")),
                headline=str(raw.get("headline", "")),
                findings=[str(f) for f in (raw.get("findings") or []) if f],
                recommendations=recs,
            )
        )

    # Derive health from the pillar scores rather than trusting a separate
    # number, so the headline figure can never contradict the three below it.
    health = round(sum(p.score for p in pillars) / len(pillars)) if pillars else 0

    return AdvisorReport(
        project_id=project_id,
        project_title=project.title,
        generated_at=datetime.now(),
        model=llm.model,
        health_score=health,
        health_summary=str(data.get("health_summary", "")),
        pillars=pillars,
        evidence=context["facts"],
    )


@router.post("/projects/{project_id}/weekly-draft", response_model=WeeklyDraft)
async def weekly_draft(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Draft this week's status record from what actually happened.

    Writing the weekly update is the chore that makes teams skip reporting, so
    this composes it from meetings held, action items closed or slipped, and
    movement on the results chain. The user reviews and files it.
    """
    project = await _project_for_ai(db, project_id, current_user)
    llm = _require_llm()

    context = await build_project_context(db, project)
    if context_is_thin(context):
        raise HTTPException(
            status_code=422,
            detail="There is no recorded activity to draft from yet.",
        )

    data = await llm.ajson(
        system=(
            "You draft a project's weekly status record from its activity log. "
            "Return STRICT JSON: {status: one of on_track|at_risk|blocked|completed, "
            "headline: string (max 140 chars, what actually moved this week), "
            "progress_note: string (2-4 sentences), blockers: string or null, "
            "next_steps: string or null, completion_percent: number 0-100 or null}.\n\n"
            "Base the status on evidence: overdue action items or repeated blockers mean at_risk; "
            "nothing moving plus hard blockers means blocked. Write in plain past tense, as the team "
            "would. Do not invent work that is not in the record. If the previous week already reported "
            "a completion percent, only move it if there is evidence of progress."
        ),
        user=json.dumps(context, default=str),
        max_tokens=800,
    )
    if not data or not data.get("headline"):
        raise HTTPException(status_code=502, detail="The model did not return a usable draft. Try again.")

    allowed = {"on_track", "at_risk", "blocked", "completed"}
    status = str(data.get("status", "on_track")).lower()
    completion = data.get("completion_percent")
    try:
        completion = None if completion is None else max(0.0, min(100.0, float(completion)))
    except (TypeError, ValueError):
        completion = None

    ops = context["facts"]["operations"]
    return WeeklyDraft(
        status=status if status in allowed else "on_track",
        headline=str(data["headline"])[:200],
        progress_note=str(data.get("progress_note", "")),
        blockers=str(data["blockers"]) if data.get("blockers") else None,
        next_steps=str(data["next_steps"]) if data.get("next_steps") else None,
        completion_percent=completion,
        grounded_in={
            "meetings_last_28_days": ops["meetings_last_28_days"],
            "actions_open": ops["actions_open"],
            "actions_overdue": ops["actions_overdue"],
            "actions_completed": ops["actions_completed"],
        },
    )
