"""AI advisor: reads a project's real record and returns concrete guidance.

The point of this module is that the user supplies *nothing*. Every other AI
feature in the portal takes pasted text (an idea, raw meeting notes); this one
assembles the project's actual history -- weekly records, meetings, action
items, the results chain, connected tools -- and asks the model to reason over
it across three lenses:

    innovation  -- is the product/idea itself moving forward?
    operations  -- is the team running well?
    delight     -- are the people this project serves better off?

Numbers are computed here in Python and handed to the model as facts. The model
is asked to interpret and recommend, never to count, because a model that is
allowed to count will eventually get it wrong and the whole report loses trust.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.models.project import Project
from app.portal.models.project_compliance import ActionItem, ProjectMeeting
from app.portal.models.project_impact import ProjectImpactEntry
from app.portal.models.project_tool import ProjectTool, ToolStatus
from app.portal.models.project_update import ProjectWeeklyUpdate

# Caps keep the prompt bounded on long-running projects. Recent history is what
# drives a recommendation; a meeting from eight months ago is noise.
MAX_WEEKLY = 6
MAX_MEETINGS = 8
MAX_ACTIONS = 15
MAX_IMPACT = 12

STAGE_ORDER = ["inputs", "process", "outputs", "outcomes", "impact"]


def _clip(text: Optional[str], limit: int = 320) -> str:
    if not text:
        return ""
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


async def build_project_context(db: AsyncSession, project: Project) -> dict:
    """Assemble everything known about a project into one grounded fact sheet."""
    today = date.today()
    now = datetime.now()

    weekly = (
        (
            await db.execute(
                select(ProjectWeeklyUpdate)
                .where(ProjectWeeklyUpdate.project_id == project.id)
                .order_by(ProjectWeeklyUpdate.period_start.desc())
                .limit(MAX_WEEKLY)
            )
        )
        .scalars()
        .all()
    )
    meetings = (
        (
            await db.execute(
                select(ProjectMeeting)
                .where(ProjectMeeting.project_id == project.id)
                .order_by(ProjectMeeting.meeting_date.desc())
                .limit(MAX_MEETINGS)
            )
        )
        .scalars()
        .all()
    )
    actions = (
        (await db.execute(select(ActionItem).where(ActionItem.project_id == project.id)))
        .scalars()
        .all()
    )
    impact = (
        (
            await db.execute(
                select(ProjectImpactEntry)
                .where(ProjectImpactEntry.project_id == project.id)
                .order_by(ProjectImpactEntry.created_at.desc())
                .limit(MAX_IMPACT)
            )
        )
        .scalars()
        .all()
    )
    tools = (
        (
            await db.execute(
                select(ProjectTool).where(
                    ProjectTool.project_id == project.id,
                    ProjectTool.status == ToolStatus.APPROVED.value,
                )
            )
        )
        .scalars()
        .all()
    )

    completed = [a for a in actions if a.status == "Completed"]
    overdue = [
        a for a in actions if a.status != "Completed" and a.due_date and a.due_date < today
    ]
    meetings_recent = [m for m in meetings if m.meeting_date and m.meeting_date >= now - timedelta(days=28)]
    mom_recorded = [m for m in meetings if (m.mom_content or "").strip()]

    stage_counts = {stage: 0 for stage in STAGE_ORDER}
    for entry in impact:
        if entry.stage in stage_counts:
            stage_counts[entry.stage] += 1
    measured = [e for e in impact if e.metric_value is not None and e.target_value is not None]

    # Reporting discipline over the last 8 weeks.
    this_monday = today - timedelta(days=today.weekday())
    expected = [this_monday - timedelta(weeks=i) for i in range(8)]
    filed = {u.period_start for u in weekly}
    missed = [w.isoformat() for w in expected[1:] if w not in filed]

    return {
        "facts": {
            "project": {
                "title": project.title,
                "category": project.category,
                "status": project.status,
                "description": _clip(project.description, 500),
                "deliverables": _clip(project.deliverables, 300),
                "deadline": project.deadline.isoformat() if project.deadline else None,
                "days_to_deadline": (project.deadline - today).days if project.deadline else None,
            },
            "cadence": {
                "weeks_reported_last_8": len(filed),
                "missed_weeks": missed,
                "latest_status": weekly[0].status if weekly else None,
                "latest_completion_percent": weekly[0].completion_percent if weekly else None,
            },
            "operations": {
                "meetings_total": len(meetings),
                "meetings_last_28_days": len(meetings_recent),
                "meetings_with_minutes_recorded": len(mom_recorded),
                "actions_total": len(actions),
                "actions_completed": len(completed),
                "actions_open": len(actions) - len(completed),
                "actions_overdue": len(overdue),
                "completion_rate_percent": round(len(completed) / len(actions) * 100, 1) if actions else 0.0,
                "tools_connected": [t.name for t in tools],
            },
            "results_chain": {
                "entries_by_stage": stage_counts,
                "stages_empty": [s for s, c in stage_counts.items() if c == 0],
                "measured_metrics": len(measured),
            },
        },
        "records": {
            "weekly_updates": [
                {
                    "week": u.period_start.isoformat(),
                    "status": u.status,
                    "headline": _clip(u.headline, 200),
                    "progress": _clip(u.progress_note),
                    "blockers": _clip(u.blockers),
                    "next_steps": _clip(u.next_steps),
                    "completion_percent": u.completion_percent,
                }
                for u in weekly
            ],
            "meetings": [
                {
                    "title": _clip(m.title, 150),
                    "date": m.meeting_date.isoformat() if m.meeting_date else None,
                    "agenda": _clip(m.agenda, 200),
                    "minutes": _clip(m.mom_content, 400),
                }
                for m in meetings
            ],
            "open_actions": [
                {
                    "title": _clip(a.title, 150),
                    "due": a.due_date.isoformat() if a.due_date else None,
                    "urgency": a.urgency,
                    "status": a.status,
                    "overdue": a in overdue,
                }
                for a in actions
                if a.status != "Completed"
            ][:MAX_ACTIONS],
            "impact_entries": [
                {
                    "stage": e.stage,
                    "title": _clip(e.title, 150),
                    "metric": e.metric_name,
                    "baseline": e.baseline_value,
                    "current": e.metric_value,
                    "target": e.target_value,
                }
                for e in impact
            ],
        },
    }


def context_is_thin(context: dict) -> bool:
    """True when there is too little on record for advice to mean anything."""
    facts = context["facts"]
    signals = (
        facts["operations"]["meetings_total"]
        + facts["operations"]["actions_total"]
        + sum(facts["results_chain"]["entries_by_stage"].values())
        + facts["cadence"]["weeks_reported_last_8"]
    )
    return signals < 2
