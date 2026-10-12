import datetime as dt
import hashlib
import hmac
import json
import os
from functools import lru_cache
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, DateTime, Index, Integer, MetaData, String, Table, Text, case, create_engine, delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import JSONB, insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Connection, Engine

from .config import get_settings
from .problem_submissions import ProblemBrief, ProblemPage, ProblemReceipt, ProblemReview, ProblemStatus, ProblemSubmission
from .storage import _sync_pg_url

metadata = MetaData()
submissions = Table(
    "udyaan_problem_submissions", metadata,
    Column("id", String(36), primary_key=True),
    Column("request_id", String(36), unique=True, nullable=False),
    Column("fingerprint", String(64), nullable=False),
    Column("submitted_at", DateTime(timezone=True), nullable=False),
    Column("payload", JSON().with_variant(JSONB, "postgresql"), nullable=False),
    Column("title", String(120), nullable=False),
    Column("organisation", String(140), nullable=False),
    Column("email", String(160), nullable=False),
    Column("status", String(20), nullable=False),
    Column("notes", Text, nullable=False, default=""),
    Column("reviewed_at", DateTime(timezone=True)),
    Column("reviewed_by", String(320)),
    Column("version", Integer, nullable=False, default=1),
)
Index("udyaan_problem_submissions_received_idx", submissions.c.submitted_at, submissions.c.id)
Index("udyaan_problem_submissions_status_idx", submissions.c.status, submissions.c.submitted_at)
limits = Table(
    "udyaan_problem_intake_limits", metadata,
    Column("key", String(64), primary_key=True),
    Column("window", Integer, nullable=False, index=True),
    Column("count", Integer, nullable=False),
)


class SubmissionConflict(Exception):
    pass


class SubmissionNotFound(Exception):
    pass


class SubmissionLimit(Exception):
    def __init__(self, retry_after: int) -> None:
        self.retry_after = retry_after


class ProblemStore:
    def __init__(self, engine: Engine, secret: str) -> None:
        self.engine = engine
        self.secret = secret.encode()
        with engine.begin() as connection:
            if engine.dialect.name == "postgresql":
                connection.exec_driver_sql("SELECT pg_advisory_xact_lock(817245)")
            metadata.create_all(connection)

    def _insert(self, table: Table):
        return postgres_insert(table) if self.engine.dialect.name == "postgresql" else sqlite_insert(table)

    def _receipt(self, row) -> ProblemReceipt:
        timestamp = row["submitted_at"]
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=dt.timezone.utc)
        return ProblemReceipt(id=row["id"], submitted_at=timestamp)

    def _record(self, row) -> ProblemSubmission:
        reviewed_at = row["reviewed_at"]
        if reviewed_at is not None and reviewed_at.tzinfo is None:
            reviewed_at = reviewed_at.replace(tzinfo=dt.timezone.utc)
        return ProblemSubmission(
            **row["payload"],
            **self._receipt(row).model_dump(),
            status=row["status"], notes=row["notes"],
            reviewed_at=reviewed_at, reviewed_by=row["reviewed_by"],
            version=row["version"],
        )

    def _quota(self, connection: Connection, email: str, now: dt.datetime) -> None:
        window = int(now.timestamp()) // 3600
        connection.execute(delete(limits).where(limits.c.window < window - 1))
        sender = hmac.new(self.secret, email.lower().encode(), hashlib.sha256).hexdigest()
        for key, maximum in (("global", 200), (sender, 5)):
            statement = self._insert(limits).values(key=key, window=window, count=1)
            statement = statement.on_conflict_do_update(
                index_elements=[limits.c.key],
                set_={"window": window, "count": case((limits.c.window != window, 1), else_=limits.c.count + 1)},
                where=or_(limits.c.window != window, limits.c.count < maximum),
            )
            if connection.execute(statement.returning(limits.c.key)).scalar_one_or_none() is None:
                raise SubmissionLimit(3600 - int(now.timestamp()) % 3600)

    def submit(self, brief: ProblemBrief) -> ProblemReceipt:
        payload = brief.model_dump(mode="json", exclude={"request_id"})
        fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        now = dt.datetime.now(dt.timezone.utc)
        with self.engine.begin() as connection:
            statement = self._insert(submissions).values(
                id=str(uuid4()), request_id=str(brief.request_id), fingerprint=fingerprint,
                submitted_at=now, payload=payload, title=brief.title,
                organisation=brief.organisation, email=str(brief.email), status=ProblemStatus.NEW.value,
                notes="", version=1,
            ).on_conflict_do_nothing(index_elements=[submissions.c.request_id])
            inserted = connection.execute(statement.returning(submissions.c.id)).scalar_one_or_none() is not None
            row = connection.execute(select(submissions).where(submissions.c.request_id == str(brief.request_id))).mappings().one()
            if row["fingerprint"] != fingerprint:
                raise SubmissionConflict("This submission reference was already used for another brief. Refresh the form before submitting a different brief.")
            if inserted:
                self._quota(connection, str(brief.email), now)
            return self._receipt(row)

    def list(self, page: int, page_size: int, status: ProblemStatus | None, query: str) -> ProblemPage:
        conditions = []
        if status:
            conditions.append(submissions.c.status == status.value)
        if query:
            literal = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{literal}%"
            conditions.append(or_(*(column.ilike(pattern, escape="\\") for column in (submissions.c.title, submissions.c.organisation, submissions.c.email))))
        with self.engine.connect() as connection:
            total = connection.execute(select(func.count()).select_from(submissions).where(*conditions)).scalar_one()
            rows = connection.execute(
                select(submissions).where(*conditions)
                .order_by(submissions.c.submitted_at.desc(), submissions.c.id.desc())
                .offset((page - 1) * page_size).limit(page_size)
            ).mappings().all()
        return ProblemPage(items=[self._record(row) for row in rows], total=total, page=page, pageSize=page_size)

    def get(self, submission_id: UUID) -> ProblemSubmission:
        with self.engine.connect() as connection:
            row = connection.execute(select(submissions).where(submissions.c.id == str(submission_id))).mappings().first()
        if row is None:
            raise SubmissionNotFound()
        return self._record(row)

    def review(self, submission_id: UUID, review: ProblemReview, admin: str) -> ProblemSubmission:
        with self.engine.begin() as connection:
            result = connection.execute(update(submissions).where(
                submissions.c.id == str(submission_id), submissions.c.version == review.version,
            ).values(status=review.status.value, notes=review.notes,
                     reviewed_at=dt.datetime.now(dt.timezone.utc), reviewed_by=admin,
                     version=submissions.c.version + 1))
            if result.rowcount == 0:
                exists = connection.execute(select(submissions.c.id).where(submissions.c.id == str(submission_id))).first()
                if exists is None:
                    raise SubmissionNotFound()
                raise SubmissionConflict("This brief was updated by another reviewer. Reload it before saving again.")
            row = connection.execute(select(submissions).where(submissions.c.id == str(submission_id))).mappings().one()
            return self._record(row)


@lru_cache
def get_problem_store() -> ProblemStore:
    settings = get_settings()
    if settings.database_url:
        url, connect_args = _sync_pg_url(settings.database_url)
        engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True, pool_size=2, max_overflow=2, hide_parameters=True)
    elif settings.problem_submissions_sqlite_path and not os.getenv("AWS_EXECUTION_ENV") and not os.getenv("ECS_CONTAINER_METADATA_URI_V4"):
        path = Path(settings.problem_submissions_sqlite_path).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False}, hide_parameters=True)
    else:
        raise RuntimeError("Problem submission storage is not configured")
    return ProblemStore(engine, settings.jwt_secret)