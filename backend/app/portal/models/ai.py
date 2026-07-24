"""Storage for the portal's retrieval index.

Documents are derived from live portal entities (projects, action items,
meetings, reports, people) and embedded for hybrid retrieval. Embeddings are
stored as JSON so the feature works on any Postgres instance, with or without
the pgvector extension available.
"""

from sqlalchemy import Column, Integer, String, TEXT, TIMESTAMP, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID

from app.portal.models.base import Base


class AiDocument(Base):
    __tablename__ = "ai_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))

    # Multi-tenancy: every retrieval is filtered by this. Never relax it.
    organization_id = Column(String(12), index=True, nullable=True)

    kind = Column(String(32), nullable=False)      # project | action_item | meeting | report | person
    ref_id = Column(String(64), nullable=False)    # id of the source entity
    title = Column(String(255), nullable=False)
    content = Column(TEXT, nullable=False)

    # "org" (visible to the whole organization) or "user:<user_id>" (private).
    visibility = Column(String(64), nullable=False, server_default=text("'org'"))

    embedding = Column(TEXT, nullable=True)        # JSON-encoded list[float]
    dim = Column(Integer, nullable=True)

    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))

    __table_args__ = (UniqueConstraint("kind", "ref_id", name="uq_ai_doc_kind_ref"),)
