# Udyaan

Immersive farmland internship program site with a Typeform-style application
survey and an AI-powered admissions console.

## What's inside

| Path         | What it is                                                              |
| ------------ | ----------------------------------------------------------------------- |
| `app/`       | Next.js site (marketing pages, `/survey`, `/admin`)                     |
| `components/`| UI components (survey flow, admin console, shared site chrome)          |
| `lib/`       | Survey types, default form, API client with offline fallback            |
| `backend/`   | FastAPI service — Firestore storage, Azure OpenAI RAG screening, Docker |

### `/survey` — Farm Logic Test

Typeform-style, one-thing-at-a-time survey (Framer Motion transitions, GSAP
sidebar/celebration animations) that captures **per-question active time,
visits, and answer changes** alongside the answers. Quiz sections are scored
server-side.

### `/admin` — Survey console

- **Questions tab** — add/edit/delete/duplicate questions, drag ≡ to reorder,
  set option lists, mark correct answers + points, edit section copy, publish.
- **Candidates tab** — every submission with quiz score, duration, per-answer
  correctness and dwell time; run **AI screening** per candidate or in bulk,
  then filter by verdict (shortlist / review / reject).

Demo login (no backend): `admin@udyaan.edu` / `udyaan-admin`.

### AI screening (Azure OpenAI + RAG)

The backend grounds an Azure OpenAI chat completion in a retrieval index built
from the program rubric — quiz-accuracy weighting, **timing-credibility
guidelines** (rush/guess/paste detection), reflection criteria, and a fairness
policy — and returns a structured verdict with score, strengths, concerns, and
timing analysis. No Azure credentials? A transparent heuristic with the same
rubric keeps everything working locally.

## Run it

```bash
# Frontend (works standalone with browser-local storage)
npm install
npm run dev                # http://localhost:3000

# Backend (optional, enables shared storage + real screening)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

# Wire them together
NEXT_PUBLIC_UDYAAN_API=http://localhost:8080 npm run dev
```

## Deploy

- **Backend → Google Cloud Run** (Dockerized): `backend/deploy/deploy-cloudrun.sh`
  provisions Artifact Registry, Firestore, Secret Manager and deploys via
  Cloud Build. See `backend/README.md`.
- **Frontend**: any Next.js host; set `NEXT_PUBLIC_UDYAAN_API` to the Cloud
  Run URL and add your domain to the backend's `CORS_ORIGINS`.
