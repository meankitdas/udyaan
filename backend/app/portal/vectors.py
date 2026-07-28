"""pgvector capability detection and schema management for community ranking.

Three things make this module necessary rather than a couple of lines in
:mod:`app.portal.database`.

**The extension may not exist.** Managed Postgres decides which extensions are
installable, and on RDS ``vector`` only appeared in PostgreSQL 15.2. So the
extension is created opportunistically and the result recorded in
:data:`HAS_PGVECTOR`. Every caller is expected to branch on that flag rather
than assume, exactly as ``app/rag/retrieval.py`` already degrades when
embeddings are unavailable.

**A vector column cannot go through ``Base.metadata.create_all``.** There are no
Alembic migrations here; the schema is created from model metadata at startup.
If a model declared a ``vector`` column on a database without the extension,
``create_all`` would raise on the unknown type and *no* table would be created
-- the app would boot with an empty schema. Declaring these tables in raw DDL,
guarded by the capability flag, contains that failure to the feature that needs
it.

**Embedding tables are a cache, not a source of truth.** Every row is
recomputable from posts and profiles. That is what licenses the otherwise
alarming behaviour in :func:`ensure_vector_schema`: if the configured embedding
width stops matching the column, the table is dropped and rebuilt rather than
migrated. The alternative -- a dimension mismatch -- makes every insert fail
until someone intervenes. Rebuilding costs a backfill; mismatching costs an
outage.

The dimension is not a free constant. Azure ``text-embedding-3-small`` returns
1536 floats, but ``app/rag/embeddings.py`` falls back to a 512-dimension hashed
vectorizer when Azure is unconfigured, so the width genuinely changes with
deployment configuration.
"""

from __future__ import annotations

import logging
from typing import Optional, Sequence

from sqlalchemy import text

from app.config import get_settings

logger = logging.getLogger(__name__)

# Width of an Azure text-embedding-3-small vector.
AZURE_EMBEDDING_DIM = 1536
# Width of the deterministic fallback vectorizer in app/rag/embeddings.py (_DIM).
FALLBACK_EMBEDDING_DIM = 512

# Resolved once at startup by init_models(). None means "not yet checked", which
# is deliberately distinct from False ("checked, unavailable") so a forgotten
# initialisation cannot masquerade as a missing extension.
HAS_PGVECTOR: Optional[bool] = None

POST_EMBEDDING_TABLE = "community_post_embeddings"
USER_EMBEDDING_TABLE = "user_interest_embeddings"


def expected_dim() -> int:
    """Vector width implied by the current embedding configuration."""
    settings = get_settings()
    return AZURE_EMBEDDING_DIM if settings.use_azure_openai else FALLBACK_EMBEDDING_DIM


def vector_literal(values: Sequence[float]) -> str:
    """Render a float sequence in pgvector's text input format.

    Passed as a bind parameter and cast with ``::vector`` at the call site, which
    avoids taking a dependency on the pgvector SQLAlchemy integration for what is
    ultimately a string.
    """
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


async def detect_pgvector(conn) -> bool:
    """Create the extension if permitted and report whether it is usable.

    Creation and detection are deliberately separate steps: the extension may
    already exist without this role having privileges to create it, in which case
    the CREATE raises but the feature is perfectly available.
    """
    global HAS_PGVECTOR
    try:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception as exc:
        logger.info("Could not create the pgvector extension (%s); probing for it anyway.", exc)

    try:
        result = await conn.execute(
            text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
        )
        HAS_PGVECTOR = result.first() is not None
    except Exception as exc:
        logger.warning("pgvector probe failed (%s); disabling embedding ranking.", exc)
        HAS_PGVECTOR = False

    if HAS_PGVECTOR:
        logger.info("pgvector available; embedding-based ranking enabled.")
    else:
        logger.info(
            "pgvector unavailable; community ranking will use tag overlap only. "
            "On Amazon RDS this requires PostgreSQL 15.2 or newer."
        )
    return HAS_PGVECTOR


async def _column_dim(conn, table: str) -> Optional[int]:
    """Dimension of ``table.embedding``, or None if the table does not exist.

    pgvector stores the declared width in ``atttypmod``, so this reads the real
    column rather than trusting a record of what was created.
    """
    result = await conn.execute(
        text(
            """
            SELECT a.atttypmod
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = :table
              AND a.attname = 'embedding'
              AND a.attnum > 0
              AND NOT a.attisdropped
              AND n.nspname = current_schema()
            """
        ),
        {"table": table},
    )
    row = result.first()
    return int(row[0]) if row else None


async def ensure_vector_schema(conn) -> None:
    """Create (or rebuild) the embedding cache tables.

    Called after ``create_all`` so the foreign keys have their targets. Does
    nothing when pgvector is unavailable, leaving the ranker on its tag-overlap
    path.
    """
    if not HAS_PGVECTOR:
        return

    dim = expected_dim()

    for table, owner_ddl in (
        (POST_EMBEDDING_TABLE, "post_id UUID PRIMARY KEY REFERENCES community_posts(id) ON DELETE CASCADE"),
        (USER_EMBEDDING_TABLE, "user_id VARCHAR(10) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE"),
    ):
        current = await _column_dim(conn, table)
        if current is not None and current != dim:
            # Derived data: rebuilding is cheaper than a dimension mismatch that
            # would fail every subsequent insert.
            logger.warning(
                "Embedding width for %s changed from %s to %s; rebuilding the cache.",
                table,
                current,
                dim,
            )
            await conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
            current = None

        if current is None:
            await conn.execute(
                text(
                    f"""
                    CREATE TABLE IF NOT EXISTS {table} (
                        {owner_ddl},
                        embedding vector({dim}) NOT NULL,
                        model VARCHAR(80) NOT NULL,
                        source_hash VARCHAR(64) NOT NULL,
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )

        # HNSW over cosine distance, matching the `<=>` operator used when
        # ranking. Index creation is optional: without it queries still return
        # correct results, just with a sequential scan, so a permission or
        # memory failure here must not take the feature down.
        try:
            await conn.execute(
                text(
                    f"CREATE INDEX IF NOT EXISTS ix_{table}_hnsw "
                    f"ON {table} USING hnsw (embedding vector_cosine_ops)"
                )
            )
        except Exception as exc:
            logger.info("Could not build the HNSW index on %s (%s); scans will be used.", table, exc)
