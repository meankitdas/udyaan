"""Embeddings + in-memory vector store.

Uses Azure OpenAI embeddings when configured; otherwise falls back to a
deterministic hashed bag-of-words vectorizer so the RAG pipeline (chunk,
embed, retrieve) still works end-to-end in local/demo mode.
"""

import hashlib
import math
import re
from typing import Optional

from ..config import get_settings

_DIM = 512


def _fallback_embed(text: str) -> list[float]:
    vec = [0.0] * _DIM
    for token in re.findall(r"[a-z0-9]+", text.lower()):
        h = int(hashlib.md5(token.encode()).hexdigest(), 16)
        vec[h % _DIM] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


class Embedder:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._client = None
        if self._settings.use_azure_openai:
            from openai import AzureOpenAI

            self._client = AzureOpenAI(
                azure_endpoint=self._settings.azure_openai_endpoint,
                api_key=self._settings.azure_openai_api_key,
                api_version=self._settings.azure_openai_api_version,
            )

    @property
    def is_azure(self) -> bool:
        return self._client is not None

    def embed(self, texts: list[str]) -> list[list[float]]:
        if self._client is not None:
            result = self._client.embeddings.create(
                model=self._settings.azure_embedding_deployment,
                input=texts,
            )
            return [item.embedding for item in result.data]
        return [_fallback_embed(t) for t in texts]


class VectorStore:
    """Tiny in-memory vector index over knowledge chunks."""

    def __init__(self, embedder: Embedder) -> None:
        self._embedder = embedder
        self._chunks: list[dict] = []
        self._vectors: list[list[float]] = []

    def index(self, chunks: list[dict]) -> None:
        self._chunks = chunks
        self._vectors = self._embedder.embed([c["text"] for c in chunks])

    def search(self, query: str, k: int = 4) -> list[dict]:
        if not self._chunks:
            return []
        qvec = self._embedder.embed([query])[0]
        scored = sorted(
            zip(self._chunks, self._vectors),
            key=lambda pair: cosine(qvec, pair[1]),
            reverse=True,
        )
        seen_titles: set[str] = set()
        results: list[dict] = []
        for chunk, vec in scored:
            results.append({**chunk, "similarity": round(cosine(qvec, vec), 4)})
            seen_titles.add(chunk["title"])
            if len(results) >= k:
                break
        return results


_store: Optional[VectorStore] = None
_embedder: Optional[Embedder] = None


def get_embedder() -> Embedder:
    global _embedder
    if _embedder is None:
        _embedder = Embedder()
    return _embedder


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        from .knowledge import chunked_knowledge

        _store = VectorStore(get_embedder())
        _store.index(chunked_knowledge())
    return _store
