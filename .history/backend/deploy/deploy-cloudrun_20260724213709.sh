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

gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --project "${PROJECT_ID}" \
  --service-account "${RUN_SA}" \
  --set-env-vars "GCP_PROJECT=${PROJECT_ID},FIRESTORE_DATABASE=${FIRESTORE_DATABASE},CORS_ORIGINS=${CORS_ORIGINS},AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT:?Set AZURE_OPENAI_ENDPOINT},AZURE_OPENAI_CHAT_DEPLOYMENT=${AZURE_OPENAI_CHAT_DEPLOYMENT:-gpt-4o},AZURE_OPENAI_EMBEDDING_DEPLOYMENT=${AZURE_OPENAI_EMBEDDING_DEPLOYMENT:-text-embedding-3-small},ADMIN_EMAIL=${ADMIN_EMAIL:-admin@udyaan.edu}${PORTAL_ENV}" \
  --update-secrets "AZURE_OPENAI_API_KEY=azure-openai-api-key:latest,JWT_SECRET=udyaan-jwt-secret:latest,ADMIN_PASSWORD=udyaan-admin-password:latest${PORTAL_SECRETS}"

URL=$(gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')
echo
echo "==> Deployed: ${URL}"
echo "    Set NEXT_PUBLIC_UDYAAN_API=${URL} in the frontend environment."
