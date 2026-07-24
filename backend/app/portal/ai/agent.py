"""Agentic RAG copilot for the Udyaan portal.

Implements a ReAct-style loop (reason -> act -> observe -> repeat) where the
model chooses which retriever/tool to call rather than doing one-shot retrieval.
That matters here because portal questions mix semantics with live structured
state: "which of my tasks are overdue and who can help me finish them?" needs
both a task lookup and a skills search.

Every tool is bound to the caller's identity, so retrieval can never cross
organization boundaries.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.ai.llm import get_llm
from app.portal.ai.retrieval import hybrid_search
from app.portal.models.project import Project
from app.portal.models.project_compliance import ActionItem
from app.portal.models.role import Role, UserRole
from app.portal.models.user import User

logger = logging.getLogger(__name__)

MAX_STEPS = 4  # Bounded so a confused model can't loop forever.

SYSTEM_PROMPT = """You are Udyaan Copilot, the assistant inside an agri-entrepreneurship platform.

You help students, faculty, project heads and admins act on their real workspace data.

Rules:
- Always ground answers in tool results. Never invent projects, people, dates or numbers.
- Call tools when the question involves the user's workspace. Prefer several focused
  searches over one vague one.
- If the tools return nothing relevant, say so plainly and suggest what to do next.
- Be concise and practical. Use short paragraphs or bullets. No preamble.
- You are speaking to {role}. Tailor advice to that role.
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_workspace",
            "description": (
                "Hybrid semantic + keyword search across the organization's projects, "
                "action items, meetings and people. Use for any open-ended question."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Focused search query."},
                    "kinds": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["project", "action_item", "meeting", "person"]},
                        "description": "Optional filter to restrict the document types searched.",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_action_items",
            "description": "List action items assigned to the current user, including overdue status.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_org_analytics",
            "description": "Organization-wide counts: people by role, projects by status, task completion, overdue tasks.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_people",
            "description": "Find people in the organization by skill or role, for team building and mentorship.",
            "parameters": {
                "type": "object",
                "properties": {"skill": {"type": "string", "description": "Skill, topic or role to match."}},
                "required": ["skill"],
            },
        },
    },
]


@dataclass
class AgentContext:
    db: AsyncSession
    user: User
    role: str
    citations: list[dict] = field(default_factory=list)
    trace: list[dict] = field(default_factory=list)


# --------------------------------------------------------------------------
# Tool implementations
# --------------------------------------------------------------------------

async def _tool_search(ctx: AgentContext, query: str, kinds: Optional[list[str]] = None) -> str:
    hits = await hybrid_search(
        ctx.db, query, ctx.user.organization_id, ctx.user.id, k=6, kinds=kinds or None
    )
    for h in hits:
        key = (h["kind"], h["ref_id"])
        if key not in {(c["kind"], c["ref_id"]) for c in ctx.citations}:
            ctx.citations.append({"kind": h["kind"], "ref_id": h["ref_id"], "title": h["title"], "score": h["score"]})
    if not hits:
        return "No matching documents found in this organization's workspace."
    return "\n\n".join(f"[{h['kind']}] {h['title']}\n{h['content'][:700]}" for h in hits)


async def _tool_my_actions(ctx: AgentContext) -> str:
    rows = (
        await ctx.db.execute(
            select(ActionItem).where(ActionItem.assigned_to == ctx.user.id).order_by(ActionItem.due_date)
        )
    ).scalars().all()
    if not rows:
        return "The user has no action items assigned."
    today = date.today()
    lines = []
    for a in rows:
        overdue = a.due_date and a.due_date < today and a.status != "Completed"
        lines.append(
            f"- {a.title} | status={a.status} | urgency={a.urgency} | due={a.due_date}"
            f"{' | OVERDUE' if overdue else ''}"
        )
    return "Action items assigned to the user:\n" + "\n".join(lines)


async def _tool_org_analytics(ctx: AgentContext) -> str:
    org = ctx.user.organization_id
    if not org:
        return "The user is not linked to an organization."

    roles = (
        await ctx.db.execute(
            select(Role.role_key, func.count(User.id))
            .join(UserRole, UserRole.role_id == Role.id)
            .join(User, User.id == UserRole.user_id)
            .where(User.organization_id == org)
            .group_by(Role.role_key)
        )
    ).all()
    statuses = (
        await ctx.db.execute(
            select(Project.status, func.count(Project.id))
            .where(Project.organization_id == org)
            .group_by(Project.status)
        )
    ).all()
    totals = (
        await ctx.db.execute(
            select(
                func.count(ActionItem.id),
                func.count(ActionItem.id).filter(ActionItem.status == "Completed"),
                func.count(ActionItem.id).filter(
                    ActionItem.status != "Completed", ActionItem.due_date < date.today()
                ),
            )
            .join(Project, ActionItem.project_id == Project.id)
            .where(Project.organization_id == org)
        )
    ).one()

    return (
        f"People by role: {dict(roles) or 'none'}\n"
        f"Projects by status: {dict(statuses) or 'none'}\n"
        f"Action items: total={totals[0]}, completed={totals[1]}, overdue={totals[2]}"
    )


async def _tool_find_people(ctx: AgentContext, skill: str) -> str:
    return await _tool_search(ctx, skill, kinds=["person"])


TOOL_IMPL = {
    "search_workspace": _tool_search,
    "get_my_action_items": _tool_my_actions,
    "get_org_analytics": _tool_org_analytics,
    "find_people": _tool_find_people,
}


# --------------------------------------------------------------------------
# Agent loop
# --------------------------------------------------------------------------

async def _run_tool(ctx: AgentContext, name: str, args: dict) -> str:
    impl = TOOL_IMPL.get(name)
    if impl is None:
        return f"Unknown tool: {name}"
    try:
        result = await impl(ctx, **args) if args else await impl(ctx)
    except TypeError:
        result = await impl(ctx)
    except Exception as exc:  # pragma: no cover - a failing tool shouldn't kill the chat
        logger.warning("Tool %s failed: %s", name, exc)
        return f"Tool {name} failed."
    ctx.trace.append({"tool": name, "args": args, "chars": len(result)})
    return result


async def _fallback_answer(ctx: AgentContext, question: str) -> str:
    """Extractive answer when no LLM is configured — grounded, never invented."""
    context = await _tool_search(ctx, question)
    if context.startswith("No matching"):
        return (
            "I couldn't find anything matching that in your workspace yet. "
            "Once projects, tasks and meetings are added (and indexed), I can answer from them."
        )
    snippets = [line.strip() for line in context.split("\n") if line.strip()][:8]
    return (
        "AI text generation isn't configured, so here is the most relevant information "
        "retrieved from your workspace:\n\n" + "\n".join(f"• {s}" for s in snippets)
    )


async def run_agent(
    db: AsyncSession,
    user: User,
    role: str,
    question: str,
    history: Optional[list[dict]] = None,
) -> dict:
    """Execute the agentic RAG loop and return answer + citations + trace."""
    ctx = AgentContext(db=db, user=user, role=role)
    llm = get_llm()

    if not llm.available:
        answer = await _fallback_answer(ctx, question)
        return {"answer": answer, "citations": ctx.citations, "trace": ctx.trace, "model": llm.model}

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT.format(role=role)}]
    for turn in (history or [])[-6:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"][:2000]})
    messages.append({"role": "user", "content": question})

    for _ in range(MAX_STEPS):
        message = llm.chat(messages, tools=TOOLS)
        if message is None:
            break

        tool_calls = getattr(message, "tool_calls", None)
        if not tool_calls:
            return {
                "answer": (message.content or "").strip() or "I couldn't produce an answer.",
                "citations": ctx.citations,
                "trace": ctx.trace,
                "model": llm.model,
            }

        messages.append({
            "role": "assistant",
            "content": message.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in tool_calls
            ],
        })

        for tc in tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            output = await _run_tool(ctx, tc.function.name, args)
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": output[:6000]})

    # Ran out of steps: ask for a final grounded answer without more tools.
    final = llm.chat(messages + [{"role": "user", "content": "Answer now using what you found."}])
    answer = (getattr(final, "content", "") or "").strip() if final else ""
    return {
        "answer": answer or await _fallback_answer(ctx, question),
        "citations": ctx.citations,
        "trace": ctx.trace,
        "model": llm.model,
    }
