#!/usr/bin/env bash
#
# Step 3. Copy RDS into Neon. Runs pg_dump/pg_restore as a one-off Fargate task
# inside the VPC, because RDS is not reachable from outside it.
#
# The live API is scaled to 0 first so nothing is written to RDS after the copy.
# The site API is down from here until ./deploy.sh and the DNS switch are done.
# Rollback: aws ecs update-service --cluster udyaan --service udyaan-api --desired-count 1
#
source "$(dirname "$0")/common.sh"
require_account

FAMILY="udyaan-db-migrate"
LOG_GROUP="/ecs/udyaan-api"

SERVICE_JSON="$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" --query 'services[0]' --output json)"
TD_ARN="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["taskDefinition"])' <<<"$SERVICE_JSON")"
NETWORK="$(python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["networkConfiguration"]))' <<<"$SERVICE_JSON")"
TD="$(aws ecs describe-task-definition --task-definition "$TD_ARN" --query taskDefinition --output json)"
EXEC_ROLE_ARN="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["executionRoleArn"])' <<<"$TD")"
EXEC_ROLE="${EXEC_ROLE_ARN##*/}"
SRC_REF="$(python3 -c '
import json,sys
s = [x["valueFrom"] for x in json.load(sys.stdin)["containerDefinitions"][0].get("secrets", []) if x["name"] == "DATABASE_URL"]
print(s[0] if s else "")' <<<"$TD")"
[[ -n "$SRC_REF" ]] || { echo "Live task definition has no DATABASE_URL secret." >&2; exit 1; }
DST_REF="arn:aws:ssm:${AWS_REGION}:${ACCOUNT_ID}:parameter${CONFIG_PATH}/DATABASE_URL"
aws ssm get-parameter --name "$CONFIG_PATH/DATABASE_URL" >/dev/null || { echo "Run ./set-external-urls.sh first." >&2; exit 1; }

confirm "Stop the live API (ECS $ECS_SERVICE -> 0 tasks) and copy RDS to Neon?" || exit 1
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --desired-count 0 >/dev/null
aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE"

echo "==> Granting $EXEC_ROLE temporary read on the Neon URL"
aws iam put-role-policy --role-name "$EXEC_ROLE" --policy-name udyaan-db-migrate --policy-document "$(cat <<EOF
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["ssm:GetParameters","ssm:GetParameter"],"Resource":"$DST_REF"},
 {"Effect":"Allow","Action":"kms:Decrypt","Resource":"*","Condition":{"StringEquals":{"kms:ViaService":"ssm.${AWS_REGION}.amazonaws.com"}}}
]}
EOF
)"
trap 'aws iam delete-role-policy --role-name "$EXEC_ROLE" --policy-name udyaan-db-migrate 2>/dev/null || true' EXIT
sleep 10  # IAM propagation

# The script never prints either URL; libpq error messages omit the password.
MIGRATE_SH="$(cat <<'EOF'
set -eu
to_libpq() { printf '%s' "$1" | sed -E -e 's#^postgres(ql)?(\+[a-z]+)?://#postgresql://#' -e 's#([?&])ssl=(require|true|1)#\1sslmode=require#'; }
SRC="$(to_libpq "$SRC_URL")"; DST="$(to_libpq "$DST_URL")"
TABLES_SQL="select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"
if [ -n "$(psql "$DST" -At -c "$TABLES_SQL")" ]; then echo "Neon database is not empty; aborting."; exit 3; fi
echo "dumping"; pg_dump "$SRC" --no-owner --no-acl --format=custom -f /tmp/db.dump
echo "restoring"; pg_restore --no-owner --no-acl -d "$DST" /tmp/db.dump || echo "pg_restore reported errors above (extension comments are harmless)"
FAIL=0
for t in $(psql "$SRC" -At -c "$TABLES_SQL"); do
  a="$(psql "$SRC" -At -c "select count(*) from public.\"$t\"")"
  b="$(psql "$DST" -At -c "select count(*) from public.\"$t\"" 2>/dev/null || echo missing)"
  [ "$a" = "$b" ] && echo "ok   $t $a" || { echo "DIFF $t rds=$a neon=$b"; FAIL=1; }
done
exit $FAIL
EOF
)"

echo "==> Registering $FAMILY"
CONTAINER="$(python3 - "$SRC_REF" "$DST_REF" "$LOG_GROUP" "$AWS_REGION" "$MIGRATE_SH" <<'PY'
import json, sys
src, dst, group, region, script = sys.argv[1:]
print(json.dumps([{
    "name": "migrate",
    "image": "public.ecr.aws/docker/library/postgres:17-alpine",
    "essential": True,
    "entryPoint": ["sh", "-c"],
    "command": [script],
    "secrets": [{"name": "SRC_URL", "valueFrom": src}, {"name": "DST_URL", "valueFrom": dst}],
    "logConfiguration": {"logDriver": "awslogs", "options": {
        "awslogs-group": group, "awslogs-region": region, "awslogs-stream-prefix": "migrate"}},
}]))
PY
)"
MIGRATE_TD="$(aws ecs register-task-definition --family "$FAMILY" --requires-compatibilities FARGATE \
  --network-mode awsvpc --cpu 512 --memory 1024 --execution-role-arn "$EXEC_ROLE_ARN" \
  --container-definitions "$CONTAINER" --query taskDefinition.taskDefinitionArn --output text)"

echo "==> Running copy"
TASK_ARN="$(aws ecs run-task --cluster "$ECS_CLUSTER" --launch-type FARGATE --task-definition "$MIGRATE_TD" \
  --network-configuration "$NETWORK" --query 'tasks[0].taskArn' --output text)"
aws ecs wait tasks-stopped --cluster "$ECS_CLUSTER" --tasks "$TASK_ARN"

aws logs get-log-events --log-group-name "$LOG_GROUP" \
  --log-stream-name "migrate/migrate/${TASK_ARN##*/}" --query 'events[].message' --output text | tr '\t' '\n' || true
EXIT_CODE="$(aws ecs describe-tasks --cluster "$ECS_CLUSTER" --tasks "$TASK_ARN" --query 'tasks[0].containers[0].exitCode' --output text)"
aws ecs describe-tasks --cluster "$ECS_CLUSTER" --tasks "$TASK_ARN" --query 'tasks[0].stoppedReason' --output text
aws ecs deregister-task-definition --task-definition "$MIGRATE_TD" >/dev/null

if [[ "$EXIT_CODE" != "0" ]]; then
  echo "Copy failed (exit $EXIT_CODE). To bring the old API back:" >&2
  echo "  aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --desired-count 1" >&2
  exit 1
fi
echo "All row counts match. Next: ./deploy.sh"
