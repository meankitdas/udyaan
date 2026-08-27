#!/usr/bin/env bash
#
# Build the API image, push it to ECR, and roll the ECS service onto it.
#
# This is the manual equivalent of .github/workflows/deploy-backend.yml. Prefer
# the workflow: it authenticates with OIDC rather than whatever credentials
# happen to be in your shell, and it tags the image with the commit SHA so a
# running task can be traced back to source. Use this when CI is unavailable or
# when you need to ship an uncommitted build to debug something.
#
# Usage:
#   AWS_PROFILE=my-profile ./deploy/deploy-ecs.sh
#
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-south-1}"
ACCOUNT_ID="${ACCOUNT_ID:-209483892786}"
ECR_REPOSITORY="${ECR_REPOSITORY:-udyaan-api}"
ECS_CLUSTER="${ECS_CLUSTER:-udyaan}"
ECS_SERVICE="${ECS_SERVICE:-udyaan-api}"
TASK_FAMILY="${TASK_FAMILY:-udyaan-api}"
API_URL="${API_URL:-https://api.udyaan.org}"

REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
TAG="${TAG:-manual-$(date -u +%Y%m%d-%H%M%S)}"
IMAGE="${REGISTRY}/${ECR_REPOSITORY}:${TAG}"

cd "$(dirname "$0")/.."

echo "==> Logging in to ECR"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

# Fargate runs x86 here. Building on an arm Mac without this flag produces an
# image that pushes fine and then fails to start.
echo "==> Building ${IMAGE}"
docker build --platform linux/amd64 -t "$IMAGE" -t "${REGISTRY}/${ECR_REPOSITORY}:latest" .

echo "==> Pushing"
docker push "$IMAGE"
docker push "${REGISTRY}/${ECR_REPOSITORY}:latest"

# Re-register the live task definition with only the image swapped. Declaring
# environment and secrets here instead would mean maintaining a second copy of
# them, and anything omitted would be silently dropped from the running task --
# which is how a required variable like SURVEY_CV_BUCKET goes missing.
echo "==> Registering a task definition revision"
aws ecs describe-task-definition --task-definition "$TASK_FAMILY" \
  --region "$AWS_REGION" --query taskDefinition > /tmp/udyaan-td.json
python3 - <<'PY'
import json, os
td = json.load(open('/tmp/udyaan-td.json'))
for key in ('taskDefinitionArn', 'revision', 'status', 'requiresAttributes',
            'compatibilities', 'registeredAt', 'registeredBy', 'deregisteredAt'):
    td.pop(key, None)
td['containerDefinitions'][0]['image'] = os.environ['IMAGE']
json.dump(td, open('/tmp/udyaan-td-new.json', 'w'))
PY
REVISION="$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/udyaan-td-new.json \
  --region "$AWS_REGION" --query 'taskDefinition.taskDefinitionArn' --output text)"
echo "    $REVISION"

echo "==> Deploying"
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
  --task-definition "$REVISION" --region "$AWS_REGION" >/dev/null

echo "==> Waiting for the new revision to serve"
aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" \
  --region "$AWS_REGION"

echo "==> Health"
curl -fsS --max-time 30 "${API_URL}/health" && echo
echo "==> Deployed ${TAG}"
