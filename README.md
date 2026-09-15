# Udyaan

University-powered problem-to-venture platform with a public challenge board,
student and company journeys, an application assessment and an admissions console.

## Public Website

The public flow follows the two content documents in the repository:
problem discovery, team formation, building, validation and branching outcomes.

- `/problems` provides text, category and capability filters. Each brief has a
  detail route at `/problems/[slug]`.
- `/how-it-works`, `/for-students` and `/for-companies` explain the method and
  role-specific journeys; `/join` routes visitors by intent.
- Selecting a problem carries its ID and title into `/survey?problem=...`.
  The assessment saves it as `answers.problem_interest`, visible to reviewers.
- `/submit-problem` prepares an email draft for `support@udyaan.org`. It does
  not send or persist a company submission. Copy and download are available
  when a mail client cannot handle the draft.
- `/ventures` deliberately has no invented results or case studies. Publish
  verified records before introducing outcome metrics or venture detail pages.
- The existing lab explorer lives at `/living-lab`; games and portal routes
  remain separate from public discovery.

Problem content is maintained in `lib/problems.ts`. The four proposed briefs
are based on existing Udyaan tracks, not confirmed open placements. Confirm
scope, status, resources and ownership arrangements before marking any brief open.
Public styling is isolated in `components/public/PublicSite.module.css` and
`components/Brand.module.css` so portal and survey styles remain independent.

Validation: `npm run typecheck`, `npm run build`, then browser journeys in
`tests/public-site-browser-checks.js` and `tests/living-lab-browser-checks.js`
(async Playwright functions, run against a local page using the browser tool).

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

### `/drone-irrigation` - Field Pilot

A fullscreen onboard drone simulator with FPV and stabilized gimbal cameras,
five irrigation assignments, Rapier flight physics, wind-driven spray, and
keyboard/two-stick controls. No backend is required. See [the flight guide](docs/field-pilot.md) for
controls, simulation details, research sources, and validation commands.

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
