```bash
cd /Users/ankitdas/Desktop/udyaan/backend

gcloud auth list
gcloud config set project nexa-beta-418d6

tag="manual-$(date +%Y%m%d-%H%M%S)"
gcloud builds submit . \
  --config cloudbuild.yaml \
  --project nexa-beta-418d6 \
  --substitutions=_REGION=asia-south1,_SERVICE=udyaan-api,_IMAGE_TAG="$tag"

gcloud builds list \
  --project nexa-beta-418d6 \
  --limit 5 \
  --format="table(id,status,createTime)"

gcloud run services describe udyaan-api \
  --project nexa-beta-418d6 \
  --region asia-south1 \
  --format="value(status.latestReadyRevisionName,status.url)"

API_URL="$(gcloud run services describe udyaan-api \
  --project nexa-beta-418d6 \
  --region asia-south1 \
  --format='value(status.url)')"

gcloud run services describe udyaan-api \
  --project nexa-beta-418d6 \
  --region asia-south1 \
  --format="yaml(spec.template.spec.containers[0].env)"

curl -fsS "$API_URL/health"
curl -fsS "$API_URL/openapi.json" \
  | python3 -c 'import json,sys; print("\n".join(sorted(json.load(sys.stdin)["paths"])))'

curl -i -X OPTIONS "$API_URL/portal/auth/login" \
  -H "Origin: https://udyaan.vercel.app" \
  -H "Access-Control-Request-Method: POST"

gcloud run services add-iam-policy-binding udyaan-api \
  --project nexa-beta-418d6 \
  --region asia-south1 \
  --member=allUsers \
  --role=roles/run.invoker

gcloud run services logs read udyaan-api \
  --project nexa-beta-418d6 \
  --region asia-south1 \
  --limit 100
```

## Community embeddings

Which ranking mode the service came up in — `embeddings` needs pgvector, which
is probed at startup against whatever database the instance points at, so it
cannot be read from config:

```bash
curl -fsS "$API_URL/health"   # -> "community_ranking":"embeddings" | "tags-only"
```

Embedding writes are best-effort `BackgroundTasks`, and Cloud Run throttles CPU
once a response is sent, so some are lost. `udyaan-embedding-backfill` (Cloud
Scheduler, hourly) reconciles them. It authenticates with the
`udyaan-backfill-token` secret, which the service reads as `BACKFILL_TOKEN` —
if that secret is ever rotated, update the job's header too or it will 401.

```bash
gcloud scheduler jobs describe udyaan-embedding-backfill \
  --project nexa-beta-418d6 \
  --location asia-south1 \
  --format="value(state,lastAttemptTime,status)"   # empty status = success

gcloud scheduler jobs run udyaan-embedding-backfill \
  --project nexa-beta-418d6 \
  --location asia-south1

TOKEN="$(gcloud secrets versions access latest \
  --secret=udyaan-backfill-token --project nexa-beta-418d6)"
curl -fsS -X POST "$API_URL/portal/community/embeddings/backfill" \
  -H "X-Internal-Token: $TOKEN"   # repeat until both counts are 0
```
