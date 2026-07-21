from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app.include_router(auth.router)
app.include_router(forms.router)
app.include_router(responses.router)
app.include_router(screening.router)


@app.on_event("startup")
def warm_vector_store() -> None:
    get_vector_store()


@app.get("/health", tags=["ops"])
@app.get("/healthz", include_in_schema=False)  # kept for local/docker; run.app GFE reserves /healthz
def healthz() -> dict:
    return {
        "status": "ok",
        "storage": "firestore" if settings.use_firestore else "local",
        "screening": "azure-openai-rag" if settings.use_azure_openai else "heuristic",
    }
