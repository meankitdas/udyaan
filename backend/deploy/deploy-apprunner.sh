#!/usr/bin/env bash
#
# Build the API image, push it to ECR, and roll App Runner onto it.
#
# This is the manual equivalent of .github/workflows/deploy-backend.yml. Prefer
# the workflow: it authenticates with OIDC rather than whatever credentials
# happen to be in your shell. Use this when CI is unavailable or when you need
# to ship an uncommitted build to debug something.
#
# Usage:
#   AWS_PROFILE=my-profile ./deploy/deploy-apprunner.sh
#
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
ACCOUNT_ID="${ACCOUNT_ID:-209483892786}"
ECR_REPOSITORY="${ECR_REPOSITORY:-udyaan-api}"
SERVICE_NAME="${SERVICE_NAME:-udyaan-api}"

REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
TAG="${TAG:-manual-$(date -u +%Y%m%d-%H%M%S)}"
IMAGE="${REGISTRY}/${ECR_REPOSITORY}:${TAG}"

cd "$(dirname "$0")/.."

echo "==> Resolving service ARN"
SERVICE_ARN="$(aws apprunner list-services --region "$AWS_REGION" \
  --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn | [0]" \
  --output text)"
if [ -z "$SERVICE_ARN" ] || [ "$SERVICE_ARN" = "None" ]; then
  echo "No App Runner service named '${SERVICE_NAME}' in ${AWS_REGION}." >&2
  echo "See DEPLOY_COMMANDS.md for first-time service creation." >&2
  exit 1
fi

echo "==> Logging in to ECR"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

# App Runner runs x86. Building on an arm Mac without this flag produces an
# image that pushes fine and then fails to start.
echo "==> Building ${IMAGE}"
docker build --platform linux/amd64 -t "$IMAGE" -t "${REGISTRY}/${ECR_REPOSITORY}:latest" .

echo "==> Pushing"
docker push "$IMAGE"
docker push "${REGISTRY}/${ECR_REPOSITORY}:latest"

# Only the image identifier is sent. update-service replaces whichever
# configuration blocks it receives, so passing environment or secret settings
# here would silently drop anything not listed.
echo "==> Deploying"
aws apprunner update-service \
  --service-arn "$SERVICE_ARN" \
  --region "$AWS_REGION" \
  --source-configuration "ImageRepository={ImageIdentifier=${IMAGE},ImageRepositoryType=ECR}" \
  >/dev/null

echo "==> Waiting for RUNNING"
for _ in $(seq 1 60); do
  STATUS="$(aws apprunner describe-service --service-arn "$SERVICE_ARN" \
    --region "$AWS_REGION" --query 'Service.Status' --output text)"
  echo "    $STATUS"
  [ "$STATUS" = "RUNNING" ] && break
  sleep 15
done

URL="https://$(aws apprunner describe-service --service-arn "$SERVICE_ARN" \
  --region "$AWS_REGION" --query 'Service.ServiceUrl' --output text)"
echo "==> Health"
curl -fsS --max-time 30 "${URL}/health" && echo
echo "==> Deployed ${TAG} to ${URL}"
