import math

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .rag.embeddings import get_vector_store
from .routers import auth, forms, responses, screening

settings = get_settings()

app = FastAPI(
    title="Udyaan Survey API",
    description="Question management, response collection, and Azure OpenAI RAG candidate screening.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def json_safe_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Keep unserializable input out of the 422 body.

    A body containing the non-standard JSON literals `NaN`/`Infinity` parses
    fine, then fails validation -- but the default handler echoes the offending
    value back in the error payload, where `json.dumps` cannot encode it. The
    response render then fails and the client sees a 500 instead of the
    validation error. Dropping just the echoed value preserves the 422.
    """
    errors = []
    for error in exc.errors():
        value = error.get("input")
        if isinstance(value, float) and not math.isfinite(value):
            error = {**error, "input": None}
        errors.append(error)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(errors)},
    )


app.include_router(auth.router)
app.include_router(forms.router)
app.include_router(responses.router)
app.include_router(screening.router)

# ---- Portal (role-based platform: orgs, projects, reports) merged from backend_dev ----
# Mounted under /portal so its /auth/* routes never collide with the survey admin auth.
_PORTAL_ENABLED = False
try:
    from .portal.api import (
        admin as portal_admin,
        auth as portal_auth,
        community as portal_community,
        maturity as portal_maturity,
        organizations as portal_organizations,
        project_compliance as portal_compliance,
        project_heads as portal_project_heads,
        project_impact as portal_project_impact,
        project_tools as portal_project_tools,
        project_updates as portal_project_updates,
        projects as portal_projects,
        reports as portal_reports,
    )
    from .portal.ai import router as portal_ai

    for _portal_router in (
        portal_auth.router,
        portal_organizations.router,
        portal_project_heads.router,
        portal_projects.router,
        portal_reports.router,
        portal_admin.router,
        portal_compliance.router,
        portal_project_tools.router,
        portal_project_impact.router,
        portal_project_updates.router,
        portal_maturity.router,
        portal_community.router,
        portal_ai.router,
    ):
        app.include_router(_portal_router, prefix="/portal")
    _PORTAL_ENABLED = True
except Exception as exc:  # pragma: no cover - defensive: never break the survey API
    import logging

    logging.getLogger(__name__).warning("Portal routes not loaded: %s", exc)


@app.on_event("startup")
def warm_vector_store() -> None:
    get_vector_store()


@app.on_event("startup")
async def init_portal_db() -> None:
    """Create portal tables + seed roles when a portal database is configured."""
    import logging
    import os

    if not _PORTAL_ENABLED or not os.getenv("DATABASE_URL"):
        return
    try:
        from .portal.database import init_models

        await init_models()
    except Exception as exc:  # pragma: no cover - don't crash boot if DB is unreachable
        logging.getLogger(__name__).warning("Portal DB init skipped: %s", exc)


@app.get("/health", tags=["ops"])
@app.get("/healthz", include_in_schema=False)  # kept for local/docker; run.app GFE reserves /healthz
def healthz() -> dict:
    return {
        "status": "ok",
        "storage": "firestore" if settings.use_firestore else "local",
        "screening": "azure-openai-rag" if settings.use_azure_openai else "heuristic",
        "portal": "enabled" if _PORTAL_ENABLED else "disabled",
    }
