"""Curated knowledge base used as RAG grounding for candidate screening.

Each document is chunked and embedded at startup; the evaluator retrieves the
most relevant chunks for a candidate's answers and injects them into the
Azure OpenAI prompt so verdicts follow the program rubric instead of the
model's imagination.
"""

KNOWLEDGE_DOCS: list[dict] = [
    {
        "id": "program-overview",
        "title": "Udyaan program overview",
        "text": (
            "Udyaan is an immersive farmland internship program run with JAIN Group. Students earn academic "
            "credit by solving measurable, real-world agri-tech problems across precision agriculture "
            "(drone + robot farming), urban food systems (vertical microgreens), hydro-aeroponics, and "
            "circular bioeconomy (Bio-CNG living lab). The program follows three pillars: applied immersion "
            "on live farm projects, an IP pipeline toward patents and publications, and a venture studio "
            "that moves prototypes to market pilots. Ideal candidates show systems thinking, comfort with "
            "field work, and sustained commitment over a semester."
        ),
    },
    {
        "id": "screening-rubric",
        "title": "Screening rubric",
        "text": (
            "Score candidates 0-100 using seven transparent parameters: farm-logic accuracy 30 points, "
            "practical problem solving 20, strategic decision making 15, learning mindset 15, initiative "
            "and program fit 10, engagement and completion 5, and timing credibility 5. The assessment is "
            "intentionally accessible: a student with around 50% quiz accuracy and complete, coherent intent "
            "answers should normally enter human review; around 75% accuracy plus practical judgement should "
            "normally be shortlist quality. Base bands are 68-100 shortlist, 48-67 review, and 0-47 reject. "
            "When a full cohort is screened, rank eligible candidates and target the top 15% for shortlist, "
            "which is 150 from 1,000 and sits inside the program's 10-20% selection range. Never force a "
            "candidate below review quality into the shortlist solely to fill a quota."
        ),
    },
    {
        "id": "timing-guidelines",
        "title": "Timing interpretation guidelines",
        "text": (
            "Timing is supporting evidence worth no more than 5 points, not a proxy for ability. The current "
            "survey uses short multiple-choice questions, so an average quiz dwell of 4-120 seconds is broadly "
            "credible. An average below 3 seconds may indicate rapid guessing or answer sharing; route an "
            "otherwise strong candidate to human review rather than rejecting them. Slow readers must not be "
            "penalised. One or more answer changes can show healthy reconsideration and engagement. Never infer "
            "cheating, disability, language proficiency, or intelligence from timing alone."
        ),
    },
    {
        "id": "reflection-evaluation",
        "title": "Evaluating intent choices",
        "text": (
            "The current intent section uses five structured choice questions. Treat the choices as modest "
            "signals, not proof of personality. Reward completion, a willingness to reflect or correct course, "
            "resourcefulness under constraints, and any stated entrepreneurial direction. A candidate who "
            "honestly has no idea yet can still score reasonably through curiosity, practical judgement, and "
            "quiz performance. Look for consistency across choices and farm scenarios; do not invent depth or "
            "motivation that the structured answers cannot establish."
        ),
    },
    {
        "id": "fairness-policy",
        "title": "Fairness and bias policy",
        "text": (
            "Do not reward or penalise candidates based on campus, department, degree level (UG vs PG), "
            "location, or phrasing fluency in English. Judge only: quiz accuracy, reasoning credibility "
            "from scenario choices, practical resourcefulness, learning mindset, initiative, completion, and "
            "timing as a minor supporting signal. Cross-disciplinary candidates are "
            "explicitly welcome; a management or design student with strong farm logic and a concrete idea "
            "should score as well as an engineering student. Flag, never auto-reject, suspected cheating - "
            "humans make the final call on borderline cases."
        ),
    },
]


def chunked_knowledge() -> list[dict]:
    """Split docs into overlapping sentence chunks sized for embedding."""
    chunks: list[dict] = []
    for doc in KNOWLEDGE_DOCS:
        sentences = [s.strip() for s in doc["text"].split(". ") if s.strip()]
        window, step = 4, 3
        i = 0
        part = 0
        while i < len(sentences):
            text = ". ".join(sentences[i : i + window]).strip()
            if not text.endswith("."):
                text += "."
            chunks.append({"id": f"{doc['id']}#{part}", "title": doc["title"], "text": text})
            if i + window >= len(sentences):
                break
            i += step
            part += 1
    return chunks
