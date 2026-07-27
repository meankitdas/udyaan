"""The Udyaan Digital Maturity Index: framework definition and scoring engine.

Design intent
-------------
Most maturity models are questionnaires. People fill them in optimistically,
scores drift upward, and nothing is comparable between organisations. This one
is scored from what an organisation has actually *done* in the platform, so a
score cannot be talked up — it has to be earned by changing behaviour.

Every dimension is scored 0-100 from named signals, and every signal is a plain
ratio over records the organisation can see for itself. The score is therefore
explainable: an admin can always ask "why 42?" and get counts back.

Extending to other organisations
--------------------------------
* The framework is versioned. Every org is scored by the same ruler, which is
  what makes the cohort benchmark meaningful.
* An org with no data yet is not scored 0 and shamed — dimensions with no
  evidence are flagged `applicable=False` and excluded from the weighted mean,
  so a young org is measured only on what it has actually started doing.
* Adding a dimension means adding an entry here plus a scorer; stored snapshots
  keep their original version and stay readable.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Callable, Optional

FRAMEWORK_VERSION = "dmi-1.0"

# Level bands over the 0-100 score. Five levels is the convention operators
# already know from CMMI-style models, so the vocabulary needs no explaining.
LEVELS = [
    (0, 20, 1, "Initial", "Work happens, but little of it is defined or visible."),
    (20, 40, 2, "Emerging", "Some practices exist, applied unevenly across projects."),
    (40, 60, 3, "Established", "Consistent practice on most projects, still manual."),
    (60, 80, 4, "Advanced", "Managed and measured; decisions use evidence."),
    (80, 101, 5, "Optimising", "Measured, benchmarked, and actively improved."),
]


def level_for(score: float) -> tuple[int, str, str]:
    for low, high, level, label, blurb in LEVELS:
        if low <= score < high:
            return level, label, blurb
    return 1, "Initial", LEVELS[0][4]


@dataclass(frozen=True)
class Dimension:
    key: str
    label: str
    weight: float
    question: str
    why: str
    # Returns (score 0-100, signals dict) or None when there is no evidence.
    scorer: Callable[["OrgFacts"], Optional[tuple[float, dict]]]


@dataclass
class OrgFacts:
    """Everything the index reads, gathered once per assessment."""

    projects: list
    weekly_by_project: dict
    meetings: list
    actions: list
    impact: list
    tools: list
    role_keys: set
    user_count: int
    contributor_ids: set


def _pct(numerator: float, denominator: float) -> float:
    if not denominator:
        return 0.0
    return max(0.0, min(100.0, numerator / denominator * 100))


def _mean(values: list[float]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


# --------------------------------------------------------------------------
# Scorers. Each returns None when the organisation has nothing to be judged on
# for that dimension, so "not started" never reads the same as "doing it badly".
# --------------------------------------------------------------------------


def score_governance(f: OrgFacts):
    if not f.projects:
        return None
    total = len(f.projects)
    briefed = sum(1 for p in f.projects if (p.description or "").strip() and (p.deliverables or "").strip())
    dated = sum(1 for p in f.projects if p.deadline)
    staffed = sum(1 for p in f.projects if (p.target_assignee or "").strip())
    signals = {
        "projects": total,
        "with_full_brief": briefed,
        "with_deadline": dated,
        "with_team_assigned": staffed,
    }
    return _mean([_pct(briefed, total), _pct(dated, total), _pct(staffed, total)]), signals


def score_process(f: OrgFacts):
    if not f.projects:
        return None
    today = date.today()
    this_monday = today - timedelta(days=today.weekday())
    # Reporting is judged on the last 8 closed weeks, so a project started
    # yesterday isn't penalised for eight weeks of "missing" history.
    windows, reported = 0, 0
    for project in f.projects:
        started = project.created_at.date() if project.created_at else today
        for i in range(1, 9):
            week = this_monday - timedelta(weeks=i)
            if week < started - timedelta(days=7):
                continue
            windows += 1
            if week in f.weekly_by_project.get(project.id, set()):
                reported += 1

    closed = sum(1 for a in f.actions if a.status == "Completed")
    overdue = sum(
        1 for a in f.actions if a.status != "Completed" and a.due_date and a.due_date < today
    )
    open_items = len(f.actions) - closed

    parts = []
    signals = {"expected_weekly_reports": windows, "weekly_reports_filed": reported}
    if windows:
        parts.append(_pct(reported, windows))
    if f.actions:
        parts.append(_pct(closed, len(f.actions)))
        signals["actions_total"] = len(f.actions)
        signals["actions_closed"] = closed
        signals["actions_overdue"] = overdue
        # An overdue backlog is a discipline problem, not just a slow one.
        parts.append(100 - _pct(overdue, open_items) if open_items else 100.0)
    if not parts:
        return None
    return _mean(parts), signals


def score_collaboration(f: OrgFacts):
    if not f.projects:
        return None
    total = len(f.projects)
    tooled = {t.project_id for t in f.tools}
    met = {m.project_id for m in f.meetings}
    with_minutes = sum(1 for m in f.meetings if (m.mom_content or "").strip())
    signals = {
        "projects": total,
        "projects_with_approved_tool": len(tooled),
        "projects_with_meetings": len(met),
        "meetings": len(f.meetings),
        "meetings_with_minutes": with_minutes,
    }
    parts = [_pct(len(tooled), total), _pct(len(met), total)]
    if f.meetings:
        parts.append(_pct(with_minutes, len(f.meetings)))
    return _mean(parts), signals


def score_measurement(f: OrgFacts):
    if not f.impact:
        return None
    quantified = [e for e in f.impact if e.metric_value is not None]
    targeted = [e for e in quantified if e.target_value is not None]
    projects_measuring = {e.project_id for e in quantified}
    signals = {
        "impact_entries": len(f.impact),
        "entries_with_a_value": len(quantified),
        "entries_with_a_target": len(targeted),
        "projects_measuring": len(projects_measuring),
        "projects": len(f.projects),
    }
    parts = [
        _pct(len(quantified), len(f.impact)),
        _pct(len(targeted), len(f.impact)),
    ]
    if f.projects:
        parts.append(_pct(len(projects_measuring), len(f.projects)))
    return _mean(parts), signals


def score_outcomes(f: OrgFacts):
    if not f.projects:
        return None
    stages = ("inputs", "process", "outputs", "outcomes", "impact")
    by_project: dict[str, set] = {}
    for entry in f.impact:
        by_project.setdefault(entry.project_id, set()).add(entry.stage)

    if not by_project:
        return None

    completeness = [len(found & set(stages)) / len(stages) * 100 for found in by_project.values()]
    # Outputs are easy; outcomes and impact are where projects usually stop.
    beyond_output = sum(1 for found in by_project.values() if found & {"outcomes", "impact"})
    signals = {
        "projects_with_a_results_chain": len(by_project),
        "projects": len(f.projects),
        "projects_reaching_outcomes_or_impact": beyond_output,
        "average_chain_completeness": round(_mean(completeness), 1),
    }
    return _mean([_mean(completeness), _pct(beyond_output, len(f.projects))]), signals


def score_capability(f: OrgFacts):
    if not f.user_count:
        return None
    # A functioning unit needs someone running it, someone guiding, someone doing.
    expected_roles = [{"ADMIN"}, {"FACULTY", "PROJECT_HEAD"}, {"STUDENT"}]
    covered = sum(1 for group in expected_roles if f.role_keys & group)
    signals = {
        "users": f.user_count,
        "role_groups_covered": covered,
        "role_groups_expected": len(expected_roles),
        "active_contributors": len(f.contributor_ids),
    }
    return _mean([
        _pct(covered, len(expected_roles)),
        _pct(len(f.contributor_ids), f.user_count),
    ]), signals


DIMENSIONS: list[Dimension] = [
    Dimension(
        key="governance",
        label="Strategy & Governance",
        weight=0.20,
        question="Is work defined, owned and time-bound before it starts?",
        why="Projects without a brief, an owner or a deadline cannot be managed, only observed.",
        scorer=score_governance,
    ),
    Dimension(
        key="process",
        label="Process Discipline",
        weight=0.20,
        question="Does work run on a dependable rhythm?",
        why="Reporting cadence and follow-through on commitments are the clearest signs of an operating system that works.",
        scorer=score_process,
    ),
    Dimension(
        key="collaboration",
        label="Collaboration & Tooling",
        weight=0.15,
        question="Do teams work in shared systems rather than private files?",
        why="Shared workspaces and recorded minutes are what let work survive a person leaving.",
        scorer=score_collaboration,
    ),
    Dimension(
        key="measurement",
        label="Data & Measurement",
        weight=0.20,
        question="Is anything actually quantified against a target?",
        why="An organisation that cannot state a baseline and a target cannot prove it improved.",
        scorer=score_measurement,
    ),
    Dimension(
        key="outcomes",
        label="Outcome Orientation",
        weight=0.15,
        question="Does measurement go past deliverables to real change?",
        why="Counting outputs is activity reporting. Outcomes and impact are what the work was for.",
        scorer=score_outcomes,
    ),
    Dimension(
        key="capability",
        label="People & Capability",
        weight=0.10,
        question="Are the right roles present and genuinely participating?",
        why="Tools and process fail without staffing across leadership, mentorship and delivery.",
        scorer=score_capability,
    ),
]


def framework_definition() -> dict:
    """Serialisable description of the model, for clients and documentation."""
    return {
        "version": FRAMEWORK_VERSION,
        "name": "Udyaan Digital Maturity Index",
        "summary": (
            "Scores an organisation 0-100 across six dimensions using evidence already "
            "present in the platform, rather than a self-assessment questionnaire."
        ),
        "levels": [
            {"level": lvl, "label": label, "from": low, "to": high - 1, "description": blurb}
            for low, high, lvl, label, blurb in LEVELS
        ],
        "dimensions": [
            {
                "key": d.key,
                "label": d.label,
                "weight": d.weight,
                "question": d.question,
                "why": d.why,
            }
            for d in DIMENSIONS
        ],
    }


def assess(facts: OrgFacts) -> dict:
    """Score one organisation. Pure function of the facts handed in."""
    results = []
    for dimension in DIMENSIONS:
        outcome = dimension.scorer(facts)
        if outcome is None:
            results.append(
                {
                    "key": dimension.key,
                    "label": dimension.label,
                    "weight": dimension.weight,
                    "applicable": False,
                    "score": None,
                    "level": None,
                    "level_label": None,
                    "signals": {},
                }
            )
            continue
        score, signals = outcome
        score = round(max(0.0, min(100.0, score)), 1)
        lvl, lvl_label, _ = level_for(score)
        results.append(
            {
                "key": dimension.key,
                "label": dimension.label,
                "weight": dimension.weight,
                "applicable": True,
                "score": score,
                "level": lvl,
                "level_label": lvl_label,
                "signals": signals,
            }
        )

    scored = [r for r in results if r["applicable"]]
    # Re-normalise across scored dimensions only, so an org that hasn't started
    # measuring impact isn't dragged down for a dimension it can't answer yet.
    weight_total = sum(r["weight"] for r in scored)
    composite = (
        round(sum(r["score"] * r["weight"] for r in scored) / weight_total, 1) if weight_total else 0.0
    )
    lvl, lvl_label, lvl_blurb = level_for(composite)

    return {
        "framework_version": FRAMEWORK_VERSION,
        "composite_score": composite,
        "level": lvl,
        "level_label": lvl_label,
        "level_description": lvl_blurb,
        "coverage": round(weight_total * 100, 1),
        "dimensions": results,
    }
