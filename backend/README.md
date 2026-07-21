# Udyaan Survey API

FastAPI backend for the Udyaan Typeform-style survey: question management,
response collection, and **Azure OpenAI RAG candidate screening** that uses
per-question timing analytics as first-class evidence.

## Architecture

```
Next.js frontend (/survey, /admin)
        │  NEXT_PUBLIC_UDYAAN_API
        ▼
FastAPI on Cloud Run (this service, Dockerized)
 ├── Firestore (GCP)         — forms + responses
 ├── Secret Manager (GCP)    — API keys, JWT secret, admin password
 └── Azure OpenAI            — chat deployment (verdicts) + embeddings (RAG retrieval)
```

Screening pipeline per candidate:

1. **Timing analytics** — avg/fastest quiz dwell, answer changes, rush and
   paste-suspect signals, total duration.
2. **RAG retrieval** — the candidate's answers query an in-memory vector index
   built from the screening rubric, timing guidelines, reflection criteria,
   and fairness policy (`app/rag/knowledge.py`).
3. **Azure OpenAI verdict** — a JSON-constrained chat completion grounded in
   the retrieved rubric returns `shortlist | review | reject`, a 0–100 score,
   strengths, concerns, and a timing analysis.

Everything degrades gracefully: without `GCP_PROJECT` the API stores JSON
files under `DATA_DIR`; without Azure credentials screening falls back to a
transparent heuristic — so the stack runs fully offline for development.

## Run locally

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # optionally fill Azure/GCP values
uvicorn app.main:app --reload --port 8080
```

Point the frontend at it:

```bash
# in the repo root
NEXT_PUBLIC_UDYAAN_API=http://localhost:8080 npm run dev
```

## Run with Docker

```bash
cd backend
cp .env.example .env
docker compose up --build
```

## Deploy to Google Cloud Run

```bash
cd backend
PROJECT_ID=my-gcp-project \
AZURE_OPENAI_ENDPOINT=https://my-resource.openai.azure.com \
AZURE_OPENAI_API_KEY=... \
CORS_ORIGINS=https://udyaan.example \
./deploy/deploy-cloudrun.sh
```

The script enables the required GCP services, creates the Artifact Registry
repo and Firestore database, stores secrets in Secret Manager, builds the
image with Cloud Build, and deploys to Cloud Run. CI/CD deploys can use
`cloudbuild.yaml` instead.

## API

| Method | Path                            | Auth  | Purpose                                 |
| ------ | ------------------------------- | ----- | --------------------------------------- |
| POST   | `/auth/login`                   | —     | Admin login → JWT                       |
| GET    | `/forms/active`                 | —     | Active (published) survey form          |
| PUT    | `/forms/{id}`                   | admin | Save form (questions, sections, publish)|
| POST   | `/responses`                    | —     | Submit a candidate response             |
| GET    | `/responses`                    | admin | List responses                          |
| POST   | `/screening/evaluate/{id}`      | admin | RAG-screen one candidate                |
| POST   | `/screening/evaluate-all`       | admin | Screen all unscreened candidates        |
| GET    | `/health` (alias `/healthz`)    | —     | Liveness + active integrations          |

## Environment variables

See `.env.example`. Key ones: `GCP_PROJECT` (enables Firestore),
`AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` +
`AZURE_OPENAI_CHAT_DEPLOYMENT` + `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
(enable RAG screening), `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`JWT_SECRET`.
