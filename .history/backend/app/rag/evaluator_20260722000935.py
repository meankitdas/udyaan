"""Candidate screening engine.

Pipeline:
1. Compute timing analytics (per-question dwell, changes, rush/paste signals).
2. Retrieve rubric grounding from the vector store (RAG) using the candidate's
   own answers as the query.
3. Ask Azure OpenAI for a structured verdict constrained by the retrieved
   rubric. Falls back to a transparent heuristic when Azure isn't configured.
"""

import datetime as dt
import json

from ..config import get_settings
from ..models import Evaluation, Question, SurveyForm, SurveyResponse
from .embeddings import get_embedder, get_vector_store

SHORTLIST_SCORE = 68
REVIEW_SCORE = 48
AI_MAX_ADJUSTMENT = 6

CRITERIA_MAX = {
    "farm_logic_accuracy": 30,
    "practical_problem_solving": 20,
    "strategic_decision_making": 15,
    "learning_mindset": 15,
    "initiative_and_program_fit": 10,
    "engagement_and_completion": 5,
    "timing_credibility": 5,
}


def _utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _question_index(form: SurveyForm) -> dict[str, Question]:
    return {q.id: q for section in form.sections for q in section.questions}


def compute_quiz_score(form: SurveyForm, response: SurveyResponse) -> tuple[int, int]:
    score = 0
    max_score = 0
    for q in _question_index(form).values():
        if q.correct_option is None:
            continue
        points = q.points or 1
        max_score += points
        if response.answers.get(q.id) == q.correct_option:
            score += points
    return score, max_score


def timing_stats(form: SurveyForm, response: SurveyResponse) -> dict:
    questions = _question_index(form)
    quiz = [t for t in response.timings if questions.get(t.question_id) and questions[t.question_id].correct_option is not None]
    reflect = [t for t in response.timings if t.question_id.startswith("reflect")]

    def avg(values: list[float]) -> float:
        return sum(values) / len(values) if values else 0.0

    avg_quiz_s = avg([t.active_ms for t in quiz]) / 1000
    fastest_quiz_s = min([t.active_ms for t in quiz], default=0) / 1000
    slowest_quiz_s = max([t.active_ms for t in quiz], default=0) / 1000
    total_changes = sum(t.changes for t in response.timings)
    avg_reflect_s = avg([t.active_ms for t in reflect]) / 1000
    total_min = response.total_ms / 60000

    required = [q for q in questions.values() if q.required]
    answered_required = sum(1 for q in required if response.answers.get(q.id))
    completion_rate = answered_required / len(required) if required else 1.0
    reflection_answer_count = sum(1 for key, value in response.answers.items() if key.startswith("reflect") and value)
    changed_questions = sum(1 for t in response.timings if t.changes > 0)

    # The current survey uses short choice questions. Keep timing as supporting
    # evidence and only flag implausibly fast averages, never slow readers.
    rushed = 0 < avg_quiz_s < 3
    deliberate = 4 <= avg_quiz_s <= 120

    return {
        "avg_quiz_seconds": round(avg_quiz_s, 1),
        "fastest_quiz_seconds": round(fastest_quiz_s, 1),
        "slowest_quiz_seconds": round(slowest_quiz_s, 1),
        "avg_reflection_seconds": round(avg_reflect_s, 1),
        "reflection_answer_count": reflection_answer_count,
        "total_answer_changes": total_changes,
        "changed_question_count": changed_questions,
        "completion_rate": round(completion_rate, 3),
        "total_minutes": round(total_min, 1),
        "rushed_quiz": rushed,
        "deliberate_pace": deliberate,
    }


def _string_answer(response: SurveyResponse, question_id: str) -> str:
    value = response.answers.get(question_id, "")
    return value if isinstance(value, str) else " ".join(value)


def _section_accuracy(form: SurveyForm, response: SurveyResponse, section_id: str) -> float:
    section = next((item for item in form.sections if item.id == section_id), None)
    if section is None:
        return 0.0
    scored = [q for q in section.questions if q.correct_option is not None]
    if not scored:
        return 0.0
    correct = sum(response.answers.get(q.id) == q.correct_option for q in scored)
    return correct / len(scored)


def _choice_points(value: str, points: dict[str, float], default: float = 0.0) -> float:
    return points.get(value, default)


def assessment_parameters(
    form: SurveyForm,
    response: SurveyResponse,
    stats: dict,
    score: int,
    max_score: int,
) -> dict[str, int]:
    """Build the transparent baseline used by both Azure and fallback modes."""
    accuracy = score / max_score if max_score else 0.0
    level2_accuracy = _section_accuracy(form, response, "level2")
    level3_accuracy = _section_accuracy(form, response, "level3")

    resource_answer = _string_answer(response, "reflect_resource")
    resource_points = _choice_points(
        resource_answer,
        {
            "Working with scarcity": 4.5,
            "Substituting what was available": 5.0,
            "Leveraging people, not just materials": 5.5,
            "Constraint leading to a better outcome": 6.0,
        },
        default=4.0,
    )
    practical = level2_accuracy * 14 + resource_points

    tradeoff_answered = bool(_string_answer(response, "l3_q3"))
    strategic = level3_accuracy * 10 + (5 if tradeoff_answered else 0)

    interest = _string_answer(response, "reflect_interest")
    decision = _string_answer(response, "reflect_decision")
    improve = _string_answer(response, "reflect_improve")
    learning = (4 if interest else 0) + (5 if decision else 0)
    learning += _choice_points(
        improve,
        {
            "Better preparation": 3.0,
            "Slower, clearer problem framing": 5.0,
            "More self-questioning": 5.0,
            "Better use of available resources": 5.0,
        },
        default=3.0,
    )

    idea = _string_answer(response, "reflect_idea")
    initiative = (4 if interest else 0) + _choice_points(
        idea,
        {
            "A clear idea": 6.0,
            "A direction, not a finished idea": 5.0,
            "An early, unvalidated idea": 4.0,
            "Honest, without an idea yet": 3.0,
        },
        default=3.0,
    )

    completion = stats["completion_rate"] * 3
    if stats["changed_question_count"] > 0:
        completion += 2
    elif response.timings:
        completion += 1.5
    else:
        completion += 1

    if not response.timings:
        timing = 3.0
    elif stats["rushed_quiz"]:
        timing = 1.0
    elif stats["deliberate_pace"]:
        timing = 5.0
    else:
        timing = 3.5

    raw = {
        "farm_logic_accuracy": accuracy * 30,
        "practical_problem_solving": practical,
        "strategic_decision_making": strategic,
        "learning_mindset": learning,
        "initiative_and_program_fit": initiative,
        "engagement_and_completion": completion,
        "timing_credibility": timing,
    }
    return {
        name: max(0, min(max_points, round(raw[name])))
        for name, max_points in CRITERIA_MAX.items()
    }


def _criteria_summary(criteria: dict[str, int]) -> str:
    labels = {
        "farm_logic_accuracy": "Farm logic",
        "practical_problem_solving": "Practical problem solving",
        "strategic_decision_making": "Strategic decisions",
        "learning_mindset": "Learning mindset",
        "initiative_and_program_fit": "Initiative and fit",
        "engagement_and_completion": "Engagement",
        "timing_credibility": "Timing credibility",
    }
    return "; ".join(
        f"{labels[name]} {criteria[name]}/{CRITERIA_MAX[name]}" for name in CRITERIA_MAX
    )


def _verdict_for_score(score: int) -> str:
    if score >= SHORTLIST_SCORE:
        return "shortlist"
    if score >= REVIEW_SCORE:
        return "review"
    return "reject"


def _answers_digest(form: SurveyForm, response: SurveyResponse) -> str:
    questions = _question_index(form)
    lines: list[str] = []
    timing_by_q = {t.question_id: t for t in response.timings}
    for section in form.sections:
        for q in section.questions:
            value = response.answers.get(q.id)
            if value is None:
                continue
            rendered = ", ".join(value) if isinstance(value, list) else value
            t = timing_by_q.get(q.id)
            suffix = ""
            if t:
                suffix = f" [dwell {t.active_ms / 1000:.0f}s, {t.changes} changes]"
            if q.correct_option is not None:
                verdict = "CORRECT" if rendered == q.correct_option else f"WRONG (expected: {q.correct_option})"
                suffix += f" [{verdict}]"
            lines.append(f"- ({section.title}) {q.label}\n  Answer: {rendered}{suffix}")
    return "\n".join(lines)


def evaluate_response(form: SurveyForm, response: SurveyResponse) -> Evaluation:
    settings = get_settings()
    stats = timing_stats(form, response)
    score, max_score = compute_quiz_score(form, response)
    criteria = assessment_parameters(form, response, stats, score, max_score)
    baseline = sum(criteria.values())

    reflect_text = " ".join(
        v if isinstance(v, str) else " ".join(v)
        for k, v in response.answers.items()
        if k.startswith("reflect")
    )
    query = f"screening rubric timing quiz accuracy reflections commitment {reflect_text[:600]}"
    retrieved = get_vector_store().search(query, k=4)

    if settings.use_azure_openai:
        try:
            return _azure_evaluate(form, response, stats, score, max_score, criteria, baseline, retrieved)
        except Exception as exc:  # keep screening available even if Azure hiccups
            fallback = _heuristic_evaluate(form, response, stats, score, max_score, criteria, baseline)
            fallback.reasoning = f"Azure OpenAI unavailable ({type(exc).__name__}); heuristic fallback used. " + fallback.reasoning
            return fallback
        return _heuristic_evaluate(form, response, stats, score, max_score, criteria, baseline)


def _azure_evaluate(
    form: SurveyForm,
    response: SurveyResponse,
    stats: dict,
    score: int,
    max_score: int,
    criteria: dict[str, int],
    baseline: int,
    retrieved: list[dict],
) -> Evaluation:
    from openai import AzureOpenAI

    settings = get_settings()
    client = AzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
    )

    rubric_context = "\n\n".join(f"### {c['title']} (relevance {c['similarity']})\n{c['text']}" for c in retrieved)
    system = (
        "You are the admissions screener for Udyaan, a farmland internship program. "
        "Use the supplied seven-parameter scorecard as the primary assessment. You may adjust its total "
        f"by at most {AI_MAX_ADJUSTMENT} points for answer coherence or unusually strong practical judgement. "
        "Do not score campus, department, degree, location, English fluency, or CV presence. Timing is only "
        "supporting evidence: never reject solely because a student was fast or slow. The assessment is "
        f"intentionally accessible: shortlist at {SHORTLIST_SCORE}+, review {REVIEW_SCORE}-{SHORTLIST_SCORE - 1}, "
        f"reject below {REVIEW_SCORE}. Borderline or suspicious cases go to review, not automatic rejection. "
        "Respond with JSON only, matching this schema: "
        '{"verdict": "shortlist"|"review"|"reject", "score": 0-100, "reasoning": str, '
        '"strengths": [str], "concerns": [str], "timing_analysis": str}.'
        f"\n\n## Retrieved rubric context\n{rubric_context}"
    )
    user = (
        f"## Candidate submission (form: {form.title})\n"
        f"Quiz score: {score}/{max_score}\n"
        f"Parameter scorecard: {_criteria_summary(criteria)}\n"
        f"Transparent baseline: {baseline}/100\n"
        f"Timing analytics: {json.dumps(stats)}\n\n"
        f"## Answers with per-question dwell times\n{_answers_digest(form, response)}"
    )

    completion = client.chat.completions.create(
        model=settings.azure_chat_deployment,
        response_format={"type": "json_object"},
        temperature=0.2,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    raw = completion.choices[0].message.content or "{}"
    data = json.loads(raw)

    proposed_score = max(0, min(100, int(data.get("score", baseline))))
    adjustment = max(-AI_MAX_ADJUSTMENT, min(AI_MAX_ADJUSTMENT, proposed_score - baseline))
    final_score = max(0, min(100, baseline + adjustment))
    verdict = _verdict_for_score(final_score)
    if stats["rushed_quiz"] and verdict == "shortlist":
        verdict = "review"

    return Evaluation(
        verdict=verdict,
        score=final_score,
        reasoning=f"{_criteria_summary(criteria)}. " + str(data.get("reasoning", "")).strip(),
        strengths=[str(s) for s in data.get("strengths", [])][:6],
        concerns=[str(s) for s in data.get("concerns", [])][:6],
        timingAnalysis=str(data.get("timing_analysis", "")).strip(),
        evaluatedAt=_utcnow(),
        model=f"azure:{settings.azure_chat_deployment}+rag+multi-factor-v2",
    )


def _heuristic_evaluate(
    form: SurveyForm,
    response: SurveyResponse,
    stats: dict,
    score: int,
    max_score: int,
    criteria: dict[str, int],
    baseline: int,
) -> Evaluation:
    accuracy = score / max_score if max_score else 0.0
    composite = baseline
    verdict = _verdict_for_score(composite)
    if stats["rushed_quiz"] and verdict == "shortlist":
        verdict = "review"

    strengths: list[str] = []
    concerns: list[str] = []
    if accuracy >= 0.75:
        strengths.append(f"Strong farm-logic accuracy ({score}/{max_score}).")
    elif accuracy < 0.375:
        concerns.append(f"Low quiz accuracy ({score}/{max_score}).")
    if criteria["practical_problem_solving"] >= 15:
        strengths.append("Strong practical resourcefulness across workshop and reflection choices.")
    if criteria["learning_mindset"] >= 12:
        strengths.append("Shows a constructive learning and self-correction mindset.")
    if criteria["initiative_and_program_fit"] >= 8:
        strengths.append("Shows clear initiative and alignment with the Udyaan format.")
    if stats["deliberate_pace"]:
        strengths.append("Pacing supports considered responses.")
    if stats["rushed_quiz"]:
        concerns.append(f"Average quiz dwell was {stats['avg_quiz_seconds']}s; route strong scores to human review.")

    return Evaluation(
        verdict=verdict,
        score=composite,
        reasoning=(
            f"Multi-factor screen: {_criteria_summary(criteria)}. Total {composite}/100; "
            f"bands are {SHORTLIST_SCORE}+ shortlist, {REVIEW_SCORE}-{SHORTLIST_SCORE - 1} review, "
            f"below {REVIEW_SCORE} reject. Configure Azure OpenAI for RAG-grounded qualitative analysis."
        ),
        strengths=strengths,
        concerns=concerns,
        timingAnalysis=(
            f"Avg quiz dwell {stats['avg_quiz_seconds']}s (fastest {stats['fastest_quiz_seconds']}s), "
            f"{stats['total_answer_changes']} total answer changes, {stats['total_minutes']} minutes overall. "
            + (
                "Rush pattern detected."
                if stats["rushed_quiz"]
                else "Pacing looks credible."
                if stats["deliberate_pace"]
                else "No strong timing signal."
            )
        ),
        evaluatedAt=_utcnow(),
        model="heuristic-multi-factor-v2" + ("+azure-embeddings" if get_embedder().is_azure else ""),
    )
