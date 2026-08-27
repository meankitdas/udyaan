"""Storage abstraction: Postgres when DATABASE_URL is set, local JSON otherwise."""

import json
import os
import threading
from abc import ABC, abstractmethod
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .config import get_settings
from .models import SurveyForm, SurveyResponse

# Table names keep the collection names they had in Firestore so the migrated
# rows stay recognisable against the export.
FORMS_TABLE = "udyaan_forms"
RESPONSES_TABLE = "udyaan_responses"
ACTIVE_FORM_ID = "farm-logic-test"


def _sync_pg_url(url: str) -> tuple[str, dict]:
    """Adapt the portal's asyncpg URL for a synchronous psycopg driver.

    DATABASE_URL is shared with the portal, which uses asyncpg, so the scheme
    names a driver that cannot be used from synchronous code. asyncpg also needs
    its SSL setting passed as a connect arg while psycopg wants the libpq
    ``sslmode`` query parameter, so the two have to be translated in opposite
    directions.
    """
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))

    ssl_value = query.pop("ssl", None) or query.pop("sslmode", None)
    if ssl_value:
        # psycopg understands libpq spellings directly; "true"/"1" are asyncpg-isms.
        normalized = {"true": "require", "1": "require", "false": "disable", "0": "disable"}
        query["sslmode"] = normalized.get(ssl_value.lower(), ssl_value)

    scheme = "postgresql+psycopg"
    rebuilt = urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return rebuilt, {"connect_timeout": 10}


class Storage(ABC):
    @abstractmethod
    def get_active_form(self) -> Optional[SurveyForm]: ...

    @abstractmethod
    def save_form(self, form: SurveyForm) -> SurveyForm: ...

    @abstractmethod
    def add_response(self, response: SurveyResponse) -> SurveyResponse: ...

    @abstractmethod
    def list_responses(self) -> list[SurveyResponse]: ...

    @abstractmethod
    def get_response(self, response_id: str) -> Optional[SurveyResponse]: ...

    @abstractmethod
    def update_response(self, response: SurveyResponse) -> SurveyResponse: ...

    @abstractmethod
    def update_responses(self, responses: list[SurveyResponse]) -> list[SurveyResponse]: ...

    @abstractmethod
    def delete_response(self, response_id: str) -> bool: ...


class PostgresStorage(Storage):
    """Persists forms and responses in Postgres, alongside the portal schema.

    This interface is synchronous -- the survey routes are plain ``def`` handlers
    that FastAPI runs in a threadpool -- while the portal uses an async engine on
    the same database. Rather than bridge event loops, this opens its own small
    synchronous engine; the two coexist because they only share the server, not
    connections.

    Documents are stored as a single JSONB ``payload`` rather than being
    normalised into columns. The survey form is a deeply nested, user-authored
    structure whose shape changes whenever the form is edited, so columns would
    have to be migrated every time; JSONB keeps the Pydantic model the single
    source of truth for that shape.
    """

    def __init__(self) -> None:
        from sqlalchemy import create_engine

        settings = get_settings()
        url, connect_args = _sync_pg_url(settings.database_url)
        self._engine = create_engine(
            url, pool_pre_ping=True, pool_size=2, max_overflow=2, connect_args=connect_args
        )
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        from sqlalchemy import text

        with self._engine.begin() as conn:
            for table in (FORMS_TABLE, RESPONSES_TABLE):
                conn.execute(
                    text(
                        f"CREATE TABLE IF NOT EXISTS {table} ("
                        "  id TEXT PRIMARY KEY,"
                        "  payload JSONB NOT NULL,"
                        "  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
                        ")"
                    )
                )
            # get_active_form filters on published and orders by updatedAt; both
            # live inside the JSON, so without this every read is a seq scan.
            conn.execute(
                text(
                    f"CREATE INDEX IF NOT EXISTS {FORMS_TABLE}_published_idx "
                    f"ON {FORMS_TABLE} ((payload->>'published'))"
                )
            )
            conn.execute(
                text(
                    f"CREATE INDEX IF NOT EXISTS {RESPONSES_TABLE}_submitted_idx "
                    f"ON {RESPONSES_TABLE} ((payload->>'submittedAt'))"
                )
            )

    def _upsert(self, table: str, doc_id: str, payload: dict) -> None:
        from sqlalchemy import text

        with self._engine.begin() as conn:
            conn.execute(
                text(
                    f"INSERT INTO {table} (id, payload, updated_at) "
                    "VALUES (:id, CAST(:payload AS jsonb), NOW()) "
                    "ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, "
                    "updated_at = NOW()"
                ),
                {"id": doc_id, "payload": json.dumps(payload, default=str)},
            )

    def get_active_form(self) -> Optional[SurveyForm]:
        from sqlalchemy import text

        with self._engine.connect() as conn:
            row = conn.execute(
                text(
                    f"SELECT payload FROM {FORMS_TABLE} "
                    "WHERE payload->>'published' = 'true' "
                    "ORDER BY payload->>'updatedAt' DESC NULLS LAST LIMIT 1"
                )
            ).scalar()
            if row is None:
                # Mirrors the previous behaviour: fall back to the well-known
                # form id so an unpublished form is still editable in the admin.
                row = conn.execute(
                    text(f"SELECT payload FROM {FORMS_TABLE} WHERE id = :id"),
                    {"id": ACTIVE_FORM_ID},
                ).scalar()
        return SurveyForm.model_validate(row) if row else None

    def save_form(self, form: SurveyForm) -> SurveyForm:
        self._upsert(FORMS_TABLE, form.id, form.model_dump(by_alias=True))
        return form

    def add_response(self, response: SurveyResponse) -> SurveyResponse:
        self._upsert(RESPONSES_TABLE, response.id, response.model_dump(by_alias=True))
        return response

    def list_responses(self) -> list[SurveyResponse]:
        from sqlalchemy import text

        with self._engine.connect() as conn:
            rows = conn.execute(
                text(
                    f"SELECT payload FROM {RESPONSES_TABLE} "
                    "ORDER BY payload->>'submittedAt' ASC NULLS LAST"
                )
            ).scalars().all()
        return [SurveyResponse.model_validate(r) for r in rows]

    def get_response(self, response_id: str) -> Optional[SurveyResponse]:
        from sqlalchemy import text

        with self._engine.connect() as conn:
            row = conn.execute(
                text(f"SELECT payload FROM {RESPONSES_TABLE} WHERE id = :id"),
                {"id": response_id},
            ).scalar()
        return SurveyResponse.model_validate(row) if row else None

    def update_response(self, response: SurveyResponse) -> SurveyResponse:
        return self.add_response(response)

    def update_responses(self, responses: list[SurveyResponse]) -> list[SurveyResponse]:
        from sqlalchemy import text

        # One transaction: the screening recalibration that calls this treats the
        # batch as a unit, and a partial write would leave scores inconsistent.
        with self._engine.begin() as conn:
            for response in responses:
                conn.execute(
                    text(
                        f"INSERT INTO {RESPONSES_TABLE} (id, payload, updated_at) "
                        "VALUES (:id, CAST(:payload AS jsonb), NOW()) "
                        "ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, "
                        "updated_at = NOW()"
                    ),
                    {
                        "id": response.id,
                        "payload": json.dumps(response.model_dump(by_alias=True), default=str),
                    },
                )
        return responses

    def delete_response(self, response_id: str) -> bool:
        from sqlalchemy import text

        with self._engine.begin() as conn:
            result = conn.execute(
                text(f"DELETE FROM {RESPONSES_TABLE} WHERE id = :id"), {"id": response_id}
            )
        return bool(result.rowcount)


class LocalStorage(Storage):
    """JSON-file storage for local development and demos."""

    def __init__(self) -> None:
        settings = get_settings()
        self._dir = os.path.abspath(settings.data_dir)
        os.makedirs(self._dir, exist_ok=True)
        self._lock = threading.Lock()
        self._forms_path = os.path.join(self._dir, "forms.json")
        self._responses_path = os.path.join(self._dir, "responses.json")

    def _read(self, path: str) -> list[dict]:
        if not os.path.exists(path):
            return []
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    def _write(self, path: str, rows: list[dict]) -> None:
        tmp = f"{path}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)

    def get_active_form(self) -> Optional[SurveyForm]:
        with self._lock:
            rows = self._read(self._forms_path)
        published = [r for r in rows if r.get("published")]
        pick = published[-1] if published else (rows[-1] if rows else None)
        return SurveyForm.model_validate(pick) if pick else None

    def save_form(self, form: SurveyForm) -> SurveyForm:
        with self._lock:
            rows = self._read(self._forms_path)
            rows = [r for r in rows if r.get("id") != form.id]
            rows.append(form.model_dump(by_alias=True))
            self._write(self._forms_path, rows)
        return form

    def add_response(self, response: SurveyResponse) -> SurveyResponse:
        with self._lock:
            rows = self._read(self._responses_path)
            rows = [r for r in rows if r.get("id") != response.id]
            rows.append(response.model_dump(by_alias=True))
            self._write(self._responses_path, rows)
        return response

    def list_responses(self) -> list[SurveyResponse]:
        with self._lock:
            rows = self._read(self._responses_path)
        return [SurveyResponse.model_validate(r) for r in rows]

    def get_response(self, response_id: str) -> Optional[SurveyResponse]:
        for r in self.list_responses():
            if r.id == response_id:
                return r
        return None

    def update_response(self, response: SurveyResponse) -> SurveyResponse:
        return self.add_response(response)

    def update_responses(self, responses: list[SurveyResponse]) -> list[SurveyResponse]:
        with self._lock:
            rows = self._read(self._responses_path)
            by_id = {row.get("id"): row for row in rows}
            for response in responses:
                by_id[response.id] = response.model_dump(by_alias=True)
            self._write(self._responses_path, list(by_id.values()))
        return responses

    def delete_response(self, response_id: str) -> bool:
        with self._lock:
            rows = self._read(self._responses_path)
            remaining = [r for r in rows if r.get("id") != response_id]
            if len(remaining) == len(rows):
                return False
            self._write(self._responses_path, remaining)
        return True


_storage: Optional[Storage] = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = PostgresStorage() if get_settings().use_postgres else LocalStorage()
    return _storage
