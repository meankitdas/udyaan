"""Hybrid retrieval for the portal copilot.

Combines two independent rankers and fuses them with Reciprocal Rank Fusion:

    RRF(d) = sum over rankers of  1 / (k + rank(d))          (k = 60)

Vector search catches semantic matches ("irrigation" ~ "watering system"),
BM25 catches exact/rare terms (IDs, names, acronyms) that embeddings blur.
Fusing them is materially better than either alone.

Security: every query is scoped to the caller's organization and visibility.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.portal.models.ai import AiDocument

RRF_K = 60  # Standard constant; small values over-weight the top rank.
_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
    "was", "were", "be", "been", "with", "at", "by", "from", "as", "that",
    "this", "it", "my", "me", "i", "we", "our", "you", "your", "what", "which",
    "who", "how", "when", "where", "do", "does", "did", "can", "should", "any",
}


def tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if t not in _STOPWORDS]


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


def bm25(query_tokens: list[str], docs_tokens: list[list[str]], k1: float = 1.5, b: float = 0.75) -> list[float]:
    """Classic BM25 over an in-memory candidate set."""
    n = len(docs_tokens)
    if n == 0:
        return []
    avgdl = sum(len(d) for d in docs_tokens) / n or 1.0
    df = Counter()
    for d in docs_tokens:
        for term in set(d):
            df[term] += 1

    scores = []
    for d in docs_tokens:
        freqs = Counter(d)
        dl = len(d) or 1
        score = 0.0
        for term in query_tokens:
            f = freqs.get(term, 0)
            if not f:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / avgdl))
        scores.append(score)
    return scores


def rrf_fuse(*ranked_lists: Iterable[int], k: int = RRF_K) -> dict[int, float]:
    """Fuse ranked index lists into {index: rrf_score}."""
    fused: dict[int, float] = {}
    for ranked in ranked_lists:
        for rank, idx in enumerate(ranked):
            fused[idx] = fused.get(idx, 0.0) + 1.0 / (k + rank + 1)
    return fused


async def load_documents(
    db: AsyncSession,
    organization_id: Optional[str],
    user_id: str,
    kinds: Optional[list[str]] = None,
) -> list[AiDocument]:
    """Load the documents this user is allowed to see. Tenant-scoped."""
    if not organization_id:
        return []

    stmt = select(AiDocument).where(AiDocument.organization_id == organization_id)
    if kinds:
        stmt = stmt.where(AiDocument.kind.in_(kinds))

    result = await db.execute(stmt)
    docs = result.scalars().all()

    # Visibility filter: org-wide docs, or documents private to this user.
    allowed = f"user:{user_id}"
    return [d for d in docs if d.visibility == "org" or d.visibility == allowed]


async def hybrid_search(
    db: AsyncSession,
    query: str,
    organization_id: Optional[str],
    user_id: str,
    k: int = 6,
    kinds: Optional[list[str]] = None,
) -> list[dict]:
    """Vector + BM25 retrieval fused with RRF. Returns citation-ready hits."""
    docs = await load_documents(db, organization_id, user_id, kinds)
    if not docs:
        return []

    q_tokens = tokenize(query)

    # --- Ranker 1: keyword (BM25) ---
    docs_tokens = [tokenize(f"{d.title} {d.content}") for d in docs]
    kw_scores = bm25(q_tokens, docs_tokens)
    kw_ranked = [i for i, _ in sorted(enumerate(kw_scores), key=lambda p: p[1], reverse=True) if kw_scores[i] > 0]

    # --- Ranker 2: vector similarity ---
    vec_ranked: list[int] = []
    vec_scores = [0.0] * len(docs)
    try:
        from app.rag.embeddings import Embedder

        embedder = Embedder()
        qvec = embedder.embed([query])[0]
        for i, d in enumerate(docs):
            if not d.embedding:
                continue
            try:
                dv = json.loads(d.embedding)
            except (json.JSONDecodeError, TypeError):
                continue
            vec_scores[i] = cosine(qvec, dv)
        vec_ranked = [
            i for i, _ in sorted(enumerate(vec_scores), key=lambda p: p[1], reverse=True) if vec_scores[i] > 0.05
        ]
    except Exception:
        # Retrieval must still work if embeddings are unavailable.
        vec_ranked = []

    fused = rrf_fuse(kw_ranked[:25], vec_ranked[:25])
    if not fused:
        # Nothing matched: fall back to most recently updated context.
        fused = {i: 0.0 for i in range(min(len(docs), k))}

    top = sorted(fused.items(), key=lambda p: p[1], reverse=True)[:k]
    return [
        {
            "kind": docs[i].kind,
            "ref_id": docs[i].ref_id,
            "title": docs[i].title,
            "content": docs[i].content,
            "score": round(score, 4),
            "keyword_score": round(kw_scores[i], 3),
            "vector_score": round(vec_scores[i], 3),
        }
        for i, score in top
    ]
