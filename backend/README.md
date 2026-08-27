# Udyaan Survey API

FastAPI backend for the Udyaan Typeform-style survey: question management,
response collection, and **Azure OpenAI RAG candidate screening** that uses
per-question timing analytics as first-class evidence.

## Architecture

```
Next.js frontend (/survey, /admin)
        │  NEXT_PUBLIC_UDYAAN_API
        ▼
FastAPI on AWS App Runner (this service, Dockerized)
 ├── RDS Postgres (AWS)      — forms + responses (JSONB), portal + community data
 ├── SSM Parameter Store     — API keys, JWT secret, admin password
 ├── S3 (AWS)                — community post attachments
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

Everything degrades gracefully: without `DATABASE_URL` the API stores JSON
files under `DATA_DIR`; without Azure credentials screening falls back to a
transparent heuristic — so the stack runs fully offline for development.

## Run locally

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # optionally fill Azure/AWS values
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

## Deploy to AWS App Runner

Pushes to `main` that touch `backend/` deploy automatically via
`.github/workflows/deploy-backend.yml`, which authenticates to AWS with GitHub
OIDC (no stored access keys), builds the image, pushes it to ECR, and rolls
App Runner forward.

To deploy by hand:

```bash
cd backend
AWS_PROFILE=... AWS_REGION=ap-south-1 ./deploy/deploy-apprunner.sh
```

Runtime configuration lives in SSM Parameter Store under `/udyaan/*` and is
bound to the service as secret environment variables; see `DEPLOY_COMMANDS.md`
for the full runbook, including how to rotate a secret or add a new one.

## API

| Method | Path                            | Auth  | Purpose                                 |
| ------ | ------------------------------- | ----- | --------------------------------------- |
| POST   | `/auth/login`                   | —     | Admin login → JWT                       |
| GET    | `/forms/active`                 | —     | Active (published) survey form          |
| PUT    | `/forms/{id}`                   | admin | Save form (questions, sections, publish)|
| POST   | `/responses`                    | —     | Submit a candidate response             |
| GET    | `/responses`                    | admin | List responses                          |
| DELETE | `/responses/{id}`               | admin | Delete a candidate and their CV object  |
| GET    | `/responses/{id}/files/{qid}`   | admin | Short-lived signed CV download URL      |
| GET    | `/uploads/status`               | —     | Whether CV uploads are configured       |
| POST   | `/uploads/cv`                   | —     | Presigned POST for a candidate CV       |
| POST   | `/screening/evaluate/{id}`      | admin | RAG-screen one candidate                |
| POST   | `/screening/evaluate-all`       | admin | Screen all unscreened candidates        |
| GET    | `/health` (alias `/healthz`)    | —     | Liveness + active integrations          |

## Candidate CV uploads

Set `SURVEY_CV_BUCKET` (plus `AWS_REGION`) to accept CVs. The browser uploads
straight to S3 with a presigned POST whose policy pins the object key, the
content type and a size cap, so the API never streams the file. Admins download
through `/responses/{id}/files/{qid}`, which mints a short-lived signed GET.

**The CV bucket must be a different bucket from `S3_BUCKET`, not just a
different prefix.** Community attachments are handed out as plain public URLs, so
`udyaan-assets` carries a `PublicReadGetObject` policy; a CV is personal data and
must never be world-readable. `SURVEY_CV_BUCKET` deliberately does **not** fall
back to `S3_BUCKET`: leaving it unset disables CV uploads rather than quietly
publishing every CV. If the two are set to the same bucket the API refuses to
enable uploads, logs an error, and `/health` reports `"uploads": "misconfigured"`.

Current setup (account `209483892786`, `ap-south-1`):

| Bucket | Contents | Access |
| ------ | -------- | ------ |
| `udyaan-assets` | logos, community attachments | public read |
| `udyaan-candidate-cvs` | candidate CVs under `survey-cv/` | **private**, all public access blocked, SSE-S3, 365-day expiry |

The CV bucket needs a CORS rule allowing `POST` from the site origin, otherwise
the browser upload is blocked before it reaches S3:

```json
[{ "AllowedMethods": ["POST"],
   "AllowedOrigins": ["https://udyaan.org", "http://localhost:3000"],
   "AllowedHeaders": ["*"],
   "MaxAgeSeconds": 3000 }]
```

Without a CV bucket the survey still accepts submissions: the CV answer records
the filename only, and the admin console says the file was not stored rather
than offering a broken download.

### Operational requirements

`POST /uploads/cv` is unauthenticated (candidates are anonymous). The presigned
policy bounds a *single* object -- its key, type and size -- but nothing in the
application bounds how many tickets a caller can mint, so the endpoint should be
rate-limited at the edge (WAF/CloudFront) before it is exposed publicly.

Objects can also be orphaned without any request reaching the API: a candidate
who replaces their CV, clears it, or abandons the survey after uploading leaves
bytes in the bucket that no response references. Deleting a candidate removes
only the keys still on their response. The lifecycle rule below is applied to
`udyaan-candidate-cvs` so unclaimed objects expire:

```json
{ "Rules": [{ "ID": "expire-candidate-cvs", "Status": "Enabled",
  "Filter": { "Prefix": "survey-cv/" },
  "Expiration": { "Days": 365 },
  "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 } }] }
```

365 days outlives the review cycle, since the rule cannot distinguish an orphan
from a CV still attached to a candidate under review.

## Environment variables

See `.env.example`. Key ones: `DATABASE_URL` (enables Postgres storage),
`AWS_REGION` + `S3_BUCKET` (community attachments, public bucket),
`SURVEY_CV_BUCKET` (candidate CVs, **private** bucket) plus
`SURVEY_CV_PREFIX`/`MAX_CV_BYTES`,
`AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` +
`AZURE_OPENAI_CHAT_DEPLOYMENT` + `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
(enable RAG screening), `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`JWT_SECRET`.

Locally the API reads AWS credentials from the host session rather than `.env`
(see the `AWS_*` passthrough in `docker-compose.yml`), so bring up the stack with
credentials exported:

```bash
eval "$(aws configure export-credentials --profile <your-profile> --format env)"
docker compose up -d
```

`aws login` issues temporary credentials, so they expire; re-run the `eval` and
`docker compose up -d api` when uploads start returning 403. In production the
variables are unset and botocore uses the App Runner instance role.
