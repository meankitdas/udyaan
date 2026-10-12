import json
from contextlib import contextmanager
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from ..auth import require_admin
from ..problem_storage import ProblemStore, SubmissionConflict, SubmissionLimit, SubmissionNotFound, get_problem_store
from ..problem_submissions import ProblemBrief, ProblemPage, ProblemReceipt, ProblemReview, ProblemStatus, ProblemSubmission

router = APIRouter(prefix="/problem-submissions", tags=["problem submissions"])


@contextmanager
def storage_errors():
    try:
        yield
    except SubmissionNotFound as exc:
        raise HTTPException(status_code=404, detail="Problem submission not found") from exc
    except SubmissionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except SubmissionLimit as exc:
        raise HTTPException(status_code=429, detail="Too many submissions. Please try again later.", headers={"Retry-After": str(exc.retry_after)}) from exc
    except (SQLAlchemyError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Submission storage is temporarily unavailable. Please try again later.") from exc


def store() -> ProblemStore:
    with storage_errors():
        return get_problem_store()


async def parse_brief(request: Request) -> ProblemBrief:
    if request.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
        raise HTTPException(status_code=415, detail="A JSON problem brief is required")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 16384:
            raise HTTPException(status_code=413, detail="Problem brief is too large")
    try:
        return ProblemBrief.model_validate(json.loads(body))
    except ValidationError as exc:
        errors = [{"loc": error["loc"], "msg": error["msg"], "type": error["type"]} for error in exc.errors()]
        raise HTTPException(status_code=422, detail=errors) from exc
    except (ValueError, UnicodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON problem brief") from exc


@router.post("", response_model=ProblemReceipt, status_code=201, openapi_extra={
    "requestBody": {"required": True, "content": {"application/json": {"schema": ProblemBrief.model_json_schema(by_alias=True)}}},
})
def submit_problem(response: Response, brief: ProblemBrief = Depends(parse_brief), database: ProblemStore = Depends(store)) -> ProblemReceipt:
    response.headers["Cache-Control"] = "no-store"
    with storage_errors():
        return database.submit(brief)


@router.get("", response_model=ProblemPage)
def list_problems(
    response: Response,
    _admin: str = Depends(require_admin),
    page: int = Query(default=1, ge=1, le=100000),
    page_size: int = Query(default=25, alias="pageSize", ge=1, le=100),
    status: ProblemStatus | None = None,
    query: str = Query(default="", alias="q", max_length=120),
    database: ProblemStore = Depends(store),
) -> ProblemPage:
    response.headers["Cache-Control"] = "no-store"
    with storage_errors():
        return database.list(page, page_size, status, query.strip())


@router.get("/{submission_id}", response_model=ProblemSubmission)
def get_problem(submission_id: UUID, response: Response, _admin: str = Depends(require_admin), database: ProblemStore = Depends(store)) -> ProblemSubmission:
    response.headers["Cache-Control"] = "no-store"
    with storage_errors():
        return database.get(submission_id)


@router.patch("/{submission_id}", response_model=ProblemSubmission)
def review_problem(submission_id: UUID, review: ProblemReview, response: Response, admin: str = Depends(require_admin), database: ProblemStore = Depends(store)) -> ProblemSubmission:
    response.headers["Cache-Control"] = "no-store"
    with storage_errors():
        return database.review(submission_id, review, admin)