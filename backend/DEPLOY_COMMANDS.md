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
