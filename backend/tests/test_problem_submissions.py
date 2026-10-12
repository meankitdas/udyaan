import json
import os
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.engine import make_url
from sqlalchemy.schema import CreateSchema, DropSchema

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.problem_storage import ProblemStore, submissions
from app.routers.problems import router, store


class ProblemSubmissionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        database_url = os.getenv("TEST_PROBLEM_DATABASE_URL", "")
        self.schema = None
        if database_url:
            parsed = make_url(database_url)
            if parsed.host not in {"127.0.0.1", "localhost"} or parsed.database != "udyaan_problem_test":
                raise ValueError("PostgreSQL tests require the isolated local udyaan_problem_test database")
            self.raw_engine = create_engine(database_url)
            self.schema = f"test_{uuid4().hex}"
            with self.raw_engine.begin() as connection:
                connection.execute(CreateSchema(self.schema))
            self.engine = self.raw_engine.execution_options(schema_translate_map={None: self.schema})
        else:
            self.engine = create_engine(f"sqlite:///{self.directory.name}/problems.db", connect_args={"check_same_thread": False})
        self.database = ProblemStore(self.engine, "test-quota-key")
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[store] = lambda: self.database
        self.client = TestClient(app)
        self.auth_settings = patch("app.auth.get_settings", return_value=SimpleNamespace(jwt_secret="test-only-signing-key-at-least-32-chars"))
        self.auth_settings.start()
        self.admin = {"Authorization": "Bearer " + jwt.encode({"sub": "reviewer@example.com", "role": "admin"}, "test-only-signing-key-at-least-32-chars", algorithm="HS256")}
        self.brief = {
            "requestId": str(uuid4()), "name": "Example Person", "email": "person@example.com",
            "organisation": "Example Ltd", "title": "Reduce material waste",
            "context": "Operators need a reliable way to measure and reduce material waste.",
            "success": "Compare material losses before and after a controlled trial.",
            "constraints": "Non-confidential example only", "consent": True,
        }

    def tearDown(self):
        self.client.close()
        self.auth_settings.stop()
        if self.schema:
            with self.raw_engine.begin() as connection:
                connection.execute(DropSchema(self.schema, cascade=True))
        self.engine.dispose()
        self.directory.cleanup()

    def test_submission_is_private_and_survives_reopening(self):
        response = self.client.post("/problem-submissions", json=self.brief)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(set(response.json()), {"id", "submittedAt"})
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.engine.dispose()
        self.database = ProblemStore(self.engine, "test-quota-key")
        listed = self.client.get("/problem-submissions", headers=self.admin).json()
        self.assertEqual(listed["total"], 1)
        self.assertEqual(listed["items"][0]["email"], self.brief["email"])
        self.assertEqual(listed["items"][0]["status"], "new")

    def test_list_detail_and_review_require_admin(self):
        receipt = self.client.post("/problem-submissions", json=self.brief).json()
        for headers, expected in (({}, 401), ({"Authorization": "Bearer invalid"}, 401), ({"Authorization": "Bearer " + jwt.encode({"sub": "student", "role": "student"}, "test-only-signing-key-at-least-32-chars", algorithm="HS256")}, 403)):
            for path in ("/problem-submissions", f"/problem-submissions/{receipt['id']}"):
                self.assertEqual(self.client.get(path, headers=headers).status_code, expected)
            self.assertEqual(self.client.patch(f"/problem-submissions/{receipt['id']}", headers=headers, json={"status": "reviewing", "version": 1}).status_code, expected)

    def test_idempotency_and_payload_conflict(self):
        original = self.client.post("/problem-submissions", json=self.brief)
        for _attempt in range(6):
            duplicate = self.client.post("/problem-submissions", json=self.brief)
            self.assertEqual(duplicate.json(), original.json())
        changed = self.client.post("/problem-submissions", json={**self.brief, "title": "A different problem"})
        self.assertEqual(changed.status_code, 409)
        self.assertEqual(self.client.get("/problem-submissions", headers=self.admin).json()["total"], 1)

    def test_concurrent_retries_create_one_record(self):
        with ThreadPoolExecutor(max_workers=4) as executor:
            responses = list(executor.map(lambda _attempt: self.client.post("/problem-submissions", json=self.brief), range(4)))
        self.assertTrue(all(response.status_code == 201 for response in responses))
        self.assertEqual(len({response.json()["id"] for response in responses}), 1)
        self.assertEqual(self.client.get("/problem-submissions", headers=self.admin).json()["total"], 1)

    def test_invalid_data_is_rejected_without_echoing_contact_details(self):
        for changes in ({"consent": False}, {"email": "invalid"}, {"title": "     "}, {"context": "short"}, {"status": "accepted"}, {"requestId": "invalid"}, {"context": "x" * 1801}):
            response = self.client.post("/problem-submissions", json={**self.brief, **changes})
            self.assertEqual(response.status_code, 422)
            self.assertNotIn(self.brief["email"], response.text)
        self.assertEqual(self.client.post("/problem-submissions", content="{", headers={"Content-Type": "application/json"}).status_code, 400)
        self.assertEqual(self.client.post("/problem-submissions", content="x" * 17000, headers={"Content-Type": "application/json"}).status_code, 413)
        self.assertEqual(self.client.post("/problem-submissions", content=json.dumps(self.brief)).status_code, 415)

    def test_review_is_audited_and_stale_updates_rejected(self):
        receipt = self.client.post("/problem-submissions", json=self.brief).json()
        path = f"/problem-submissions/{receipt['id']}"
        response = self.client.patch(path, headers=self.admin, json={"status": "reviewing", "notes": "Arrange a scoping call", "version": 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reviewedBy"], "reviewer@example.com")
        self.assertEqual(response.json()["version"], 2)
        self.assertTrue(response.json()["reviewedAt"])
        self.assertEqual(self.client.get(path, headers=self.admin).json()["notes"], "Arrange a scoping call")
        self.assertEqual(self.client.patch(path, headers=self.admin, json={"status": "declined", "version": 1}).status_code, 409)
        self.assertEqual(self.client.patch(path, headers=self.admin, json={"status": "published", "version": 2}).status_code, 422)

    def test_filter_pagination_and_missing_record(self):
        receipt = self.client.post("/problem-submissions", json=self.brief).json()
        self.client.patch(f"/problem-submissions/{receipt['id']}", headers=self.admin, json={"status": "contacted", "version": 1})
        self.assertEqual(self.client.get("/problem-submissions?q=material&status=contacted&pageSize=1", headers=self.admin).json()["total"], 1)
        self.assertEqual(self.client.get("/problem-submissions?status=new", headers=self.admin).json()["total"], 0)
        self.assertEqual(self.client.get("/problem-submissions?page=2&pageSize=1", headers=self.admin).json()["items"], [])
        self.assertEqual(self.client.get("/problem-submissions?q=%25", headers=self.admin).json()["total"], 0)
        self.assertEqual(self.client.get(f"/problem-submissions/{uuid4()}", headers=self.admin).status_code, 404)
        self.assertEqual(self.client.get("/problem-submissions?pageSize=10000", headers=self.admin).status_code, 422)

    def test_shared_sender_quota_rolls_back_the_rejected_record(self):
        for _attempt in range(5):
            response = self.client.post("/problem-submissions", json={**self.brief, "requestId": str(uuid4())})
            self.assertEqual(response.status_code, 201)
        self.database = ProblemStore(self.engine, "test-quota-key")
        response = self.client.post("/problem-submissions", json={**self.brief, "requestId": str(uuid4())})
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response.headers["retry-after"]), 0)
        with self.engine.connect() as connection:
            self.assertEqual(connection.execute(select(func.count()).select_from(submissions)).scalar_one(), 5)

    def test_unavailable_storage_never_returns_a_success(self):
        with patch.object(self.database, "submit", side_effect=RuntimeError("secret database error")):
            response = self.client.post("/problem-submissions", json=self.brief)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret database error", response.text)


if __name__ == "__main__":
    unittest.main()