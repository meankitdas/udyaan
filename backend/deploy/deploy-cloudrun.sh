#!/usr/bin/env bash
# One-shot deploy of the Udyaan API to Google Cloud Run.
#
# Prerequisites:
#   - gcloud CLI authenticated (gcloud auth login) with a project selected
#   - Azure OpenAI resource with chat + embedding deployments
#
# Usage:
#   PROJECT_ID=my-project AZURE_OPENAI_ENDPOINT=https://x.openai.azure.com \
#   AZURE_OPENAI_API_KEY=... ./deploy/deploy-cloudrun.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-udyaan-api}"
REPO="${REPO:-udyaan}"
CORS_ORIGINS="${CORS_ORIGINS:-https://your-frontend-domain.example}"
FIRESTORE_DATABASE="${FIRESTORE_DATABASE:-(default)}"
RUN_SA="${RUN_SA:-udyaan-api@${PROJECT_ID}.iam.gserviceaccount.com}"

echo "==> Enabling required services on ${PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  --project "${PROJECT_ID}"

echo "==> Ensuring Artifact Registry repo '${REPO}' exists"
gcloud artifacts repositories describe "${REPO}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker --location "${REGION}" --project "${PROJECT_ID}"

echo "==> Ensuring Firestore database '${FIRESTORE_DATABASE}' exists (native mode)"
gcloud firestore databases describe --database="${FIRESTORE_DATABASE}" --project "${PROJECT_ID}" >/dev/null 2>&1 ||
  gcloud firestore databases create --database="${FIRESTORE_DATABASE}" --location "${REGION}" --project "${PROJECT_ID}"

echo "==> Ensuring runtime service account '${RUN_SA}' exists with required roles"
gcloud iam service-accounts describe "${RUN_SA}" --project "${PROJECT_ID}" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "${RUN_SA%%@*}" --display-name="Udyaan API" --project "${PROJECT_ID}"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUN_SA}" --role="roles/datastore.user" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUN_SA}" --role="roles/secretmanager.secretAccessor" --condition=None >/dev/null

# Community post attachments. Signing an upload URL from Cloud Run has no local
# private key, so it goes through the IAM signBlob API -- which requires the
# service account to be able to impersonate itself.
if [[ -n "${GCS_BUCKET:-}" ]]; then
  echo "==> Ensuring bucket '${GCS_BUCKET}' exists and is writable by ${RUN_SA}"
  gcloud storage buckets describe "gs://${GCS_BUCKET}" --project "${PROJECT_ID}" >/dev/null 2>&1 ||
    gcloud storage buckets create "gs://${GCS_BUCKET}" --project "${PROJECT_ID}" --location "${REGION}"
  gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
    --member="serviceAccount:${RUN_SA}" --role="roles/storage.objectAdmin" >/dev/null
  # Attachments are rendered directly in the feed, so objects are world-readable.
  gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
    --member="allUsers" --role="roles/storage.objectViewer" >/dev/null
  gcloud iam service-accounts add-iam-policy-binding "${RUN_SA}" \
    --member="serviceAccount:${RUN_SA}" \
    --role="roles/iam.serviceAccountTokenCreator" \
    --project "${PROJECT_ID}" >/dev/null
  # The browser PUTs straight to GCS, so the bucket needs its own CORS rules.
  CORS_TMP="$(mktemp)"
  cat > "${CORS_TMP}" <<CORS
[{"origin": [$(printf '"%s"' "${CORS_ORIGINS//,/\",\"}")],
  "method": ["PUT", "GET", "HEAD"],
  "responseHeader": ["Content-Type", "x-goog-content-length-range"],
  "maxAgeSeconds": 3600}]
CORS
  gcloud storage buckets update "gs://${GCS_BUCKET}" --cors-file="${CORS_TMP}" >/dev/null
  rm -f "${CORS_TMP}"
fi

echo "==> Storing secrets in Secret Manager"
ensure_secret() {
  local name="$1" value="$2"
  if ! gcloud secrets describe "${name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets create "${name}" --data-file=- --project "${PROJECT_ID}"
  else
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --data-file=- --project "${PROJECT_ID}"
  fi
}
ensure_secret azure-openai-api-key "${AZURE_OPENAI_API_KEY:?Set AZURE_OPENAI_API_KEY}"
ensure_secret udyaan-jwt-secret "${JWT_SECRET:-$(openssl rand -hex 32)}"
ensure_secret udyaan-admin-password "${ADMIN_PASSWORD:-$(openssl rand -base64 18)}"

# ---- Portal (role-based platform) secrets — wired only when a portal DB is configured ----
# Values are read from the shell environment (e.g. `set -a; source ../backend_dev/.env`),
# never hard-coded here. Nothing is printed.
PORTAL_SECRETS=""
PORTAL_ENV=""
if [ -n "${DATABASE_URL:-}" ]; then
  ensure_secret udyaan-database-url "${DATABASE_URL}"
  ensure_secret udyaan-secret-key "${SECRET_KEY:-$(openssl rand -hex 32)}"
  PORTAL_SECRETS=",DATABASE_URL=udyaan-database-url:latest,SECRET_KEY=udyaan-secret-key:latest"
  if [ -n "${REDIS_URL:-}" ]; then
    ensure_secret udyaan-redis-url "${REDIS_URL}"
    PORTAL_SECRETS="${PORTAL_SECRETS},REDIS_URL=udyaan-redis-url:latest"
  fi
  if [ -n "${MAIL_USERNAME:-}" ]; then
    ensure_secret udyaan-mail-username "${MAIL_USERNAME}"
    PORTAL_SECRETS="${PORTAL_SECRETS},MAIL_USERNAME=udyaan-mail-username:latest"
  fi
  if [ -n "${MAIL_PASSWORD:-}" ]; then
    ensure_secret udyaan-mail-password "${MAIL_PASSWORD}"
    PORTAL_SECRETS="${PORTAL_SECRETS},MAIL_PASSWORD=udyaan-mail-password:latest"
  fi
  PORTAL_ENV=",FRONTEND_URL=${FRONTEND_URL:-https://udyaan.org},MAIL_FROM=${MAIL_FROM:-info@udyaan.org}"
  echo "==> Portal secrets configured (DATABASE_URL detected)"
else
  echo "==> No DATABASE_URL in env; deploying survey API only (portal routes will 503 until configured)"
fi

echo "==> Building image and deploying to Cloud Run"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:$(date +%Y%m%d-%H%M%S)"
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT_ID}" .

# NOTE: --set-env-vars uses "," to separate KEY=VALUE pairs, which breaks the
# moment any value (e.g. a multi-origin CORS_ORIGINS) itself contains a comma.
# Use gcloud's custom-delimiter syntax ("^|^...") so "|" separates pairs and
# commas are safe inside values.
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --project "${PROJECT_ID}" \
  --service-account "${RUN_SA}" \
  --set-env-vars "^|^GCP_PROJECT=${PROJECT_ID}|FIRESTORE_DATABASE=${FIRESTORE_DATABASE}|CORS_ORIGINS=${CORS_ORIGINS}|AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT:?Set AZURE_OPENAI_ENDPOINT}|AZURE_OPENAI_CHAT_DEPLOYMENT=${AZURE_OPENAI_CHAT_DEPLOYMENT:-gpt-4o}|AZURE_OPENAI_EMBEDDING_DEPLOYMENT=${AZURE_OPENAI_EMBEDDING_DEPLOYMENT:-text-embedding-3-small}|ADMIN_EMAIL=${ADMIN_EMAIL:-admin@udyaan.edu}|GCS_BUCKET=${GCS_BUCKET:-}${PORTAL_ENV}" \
  --update-secrets "AZURE_OPENAI_API_KEY=azure-openai-api-key:latest,JWT_SECRET=udyaan-jwt-secret:latest,ADMIN_PASSWORD=udyaan-admin-password:latest${PORTAL_SECRETS}"

URL=$(gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')
echo
echo "==> Deployed: ${URL}"
echo "    Set NEXT_PUBLIC_UDYAAN_API=${URL} in the frontend environment."
