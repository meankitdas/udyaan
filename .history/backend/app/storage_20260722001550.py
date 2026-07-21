"""Storage abstraction: Google Cloud Firestore when configured, local JSON otherwise."""

import json
import os
import threading
from abc import ABC, abstractmethod
from typing import Optional

from .config import get_settings
from .models import SurveyForm, SurveyResponse

FORMS_COLLECTION = "udyaan_forms"
RESPONSES_COLLECTION = "udyaan_responses"
ACTIVE_FORM_ID = "farm-logic-test"


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


class FirestoreStorage(Storage):
    """Persists forms and responses in GCP Firestore."""

    def __init__(self) -> None:
        from google.cloud import firestore  # imported lazily so local mode needs no GCP deps

        settings = get_settings()
        self._db = firestore.Client(project=settings.gcp_project, database=settings.firestore_database)

    def get_active_form(self) -> Optional[SurveyForm]:
        # Sort client-side to avoid needing a Firestore composite index.
        docs = self._db.collection(FORMS_COLLECTION).where("published", "==", True).stream()
        rows = [doc.to_dict() for doc in docs]
        if rows:
            rows.sort(key=lambda r: r.get("updatedAt", 0), reverse=True)
            return SurveyForm.model_validate(rows[0])
        doc = self._db.collection(FORMS_COLLECTION).document(ACTIVE_FORM_ID).get()
        if doc.exists:
            return SurveyForm.model_validate(doc.to_dict())
        return None

    def save_form(self, form: SurveyForm) -> SurveyForm:
        self._db.collection(FORMS_COLLECTION).document(form.id).set(form.model_dump(by_alias=True))
        return form

    def add_response(self, response: SurveyResponse) -> SurveyResponse:
        self._db.collection(RESPONSES_COLLECTION).document(response.id).set(response.model_dump(by_alias=True))
        return response

    def list_responses(self) -> list[SurveyResponse]:
        docs = self._db.collection(RESPONSES_COLLECTION).order_by("submittedAt").stream()
        return [SurveyResponse.model_validate(d.to_dict()) for d in docs]

    def get_response(self, response_id: str) -> Optional[SurveyResponse]:
        doc = self._db.collection(RESPONSES_COLLECTION).document(response_id).get()
        return SurveyResponse.model_validate(doc.to_dict()) if doc.exists else None

    def update_response(self, response: SurveyResponse) -> SurveyResponse:
        self._db.collection(RESPONSES_COLLECTION).document(response.id).set(response.model_dump(by_alias=True))
        return response

    def update_responses(self, responses: list[SurveyResponse]) -> list[SurveyResponse]:
        # Firestore batches allow at most 500 writes; leave headroom for safety.
        for start in range(0, len(responses), 450):
            batch = self._db.batch()
            for response in responses[start : start + 450]:
                ref = self._db.collection(RESPONSES_COLLECTION).document(response.id)
                batch.set(ref, response.model_dump(by_alias=True))
            batch.commit()
        return responses


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


_storage: Optional[Storage] = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = FirestoreStorage() if get_settings().use_firestore else LocalStorage()
    return _storage
