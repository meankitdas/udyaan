# Deploy runbook — AWS

The backend runs on **ECS Fargate** in `ap-south-1` (account `209483892786`),
behind an ALB at `api.udyaan.org`, from an image in **ECR**, against **RDS
Postgres**, with configuration in **SSM Parameter Store** under `/udyaan/*`.

```bash
export AWS_PROFILE=new-profile-name
export AWS_REGION=ap-south-1
export ECS_CLUSTER=udyaan
export ECS_SERVICE=udyaan-api
export API_URL=https://api.udyaan.org
```

If `aws login` returns a 400 "Bad Request / outdated link" page, check the
region: the sign-in has to happen in the account's own region, so a profile
left on `us-east-1` fails before the browser flow starts.

## Deploy

Normally you do not. Pushing to `main` with changes under `backend/` runs
`.github/workflows/deploy-backend.yml`, which assumes `udyaan-github-deploy`
via GitHub OIDC, builds, pushes to ECR, registers a task definition revision
with the new image, and rolls the service.

To ship from a laptop (uncommitted debug builds, or CI outage):

```bash
./deploy/deploy-ecs.sh
```

Note the `--platform linux/amd64` in that script. The service runs on x86; an
image built natively on an arm Mac pushes without complaint and then fails to
start.

Both paths re-register the *existing* task definition with only the image
swapped. Environment variables and secret bindings are therefore never declared
in the pipeline — change them on the task definition (or in SSM) instead, or
they will be dropped from the running task.

## Status and logs

```bash
aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" \
  --region "$AWS_REGION" \
  --query 'services[0].{taskDef:taskDefinition,desired:desiredCount,running:runningCount}'

aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" \
  --region "$AWS_REGION" \
  --query 'services[0].deployments[].{status:status,taskDef:taskDefinition,running:runningCount,rollout:rolloutState}'

# Application stdout/stderr (uvicorn access logs live here).
aws logs tail /ecs/udyaan-api --region "$AWS_REGION" --since 30m --follow

# Why a task died before the app logged anything (image pull, secret binding).
aws ecs describe-tasks --cluster "$ECS_CLUSTER" --region "$AWS_REGION" \
  --tasks "$(aws ecs list-tasks --cluster "$ECS_CLUSTER" --service-name "$ECS_SERVICE" \
    --desired-status STOPPED --region "$AWS_REGION" --query 'taskArns[0]' --output text)" \
  --query 'tasks[].{stopped:stoppedReason,containers:containers[].reason}'
```

## Buckets

Two, and they must not be conflated:

| Bucket | Contents | Access |
| ------ | -------- | ------ |
| `udyaan-assets` (`S3_BUCKET`) | logos, community attachments | **public read** |
| `udyaan-candidate-cvs` (`SURVEY_CV_BUCKET`) | candidate CVs under `survey-cv/` | private, SSE-S3, 365-day expiry |

`SURVEY_CV_BUCKET` is required for CV uploads and has no fallback: unset means
uploads stay disabled, and setting it equal to `S3_BUCKET` is refused, because a
bucket that serves community attachments over public URLs would make every CV
world-readable. `/health` reports `uploads` as `s3`, `disabled`, or
`misconfigured` so the state is checkable after a deploy.

The task role `udyaan-api-task` grants `s3:PutObject/GetObject/DeleteObject` on
`udyaan-candidate-cvs/survey-cv/*`. Presigned URLs inherit the signer's
permissions, so removing that statement makes every upload 403 at S3 rather
than failing in the API.

## Smoke checks

```bash
curl -fsS "$API_URL/health"
curl -fsS "$API_URL/openapi.json" \
  | python3 -c 'import json,sys; print("\n".join(sorted(json.load(sys.stdin)["paths"])))'

curl -i -X OPTIONS "$API_URL/portal/auth/login" \
  -H "Origin: https://udyaan.vercel.app" \
  -H "Access-Control-Request-Method: POST"
```

The ALB listener is public — there is no per-service IAM invoker binding to
add, unlike Cloud Run.

## Configuration and secrets

Every *secret* runtime value is an SSM SecureString under `/udyaan/`, bound to
the task definition as a secret environment variable. Non-secret settings
(bucket names, CORS origins, deployment names) are plain `environment` entries
on the task definition instead.

```bash
aws ssm get-parameters-by-path --path /udyaan --region "$AWS_REGION" \
  --query 'Parameters[].Name' --output text

aws ssm get-parameter --name /udyaan/DATABASE_URL --with-decryption \
  --region "$AWS_REGION" --query Parameter.Value --output text
```

Rotating a value is just a new version — the task reads the parameter at
container start, so it takes effect on the next deployment:

```bash
aws ssm put-parameter --name /udyaan/SOME_KEY --type SecureString \
  --value "$NEW" --overwrite --region "$AWS_REGION"
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
  --force-new-deployment --region "$AWS_REGION"
```

Adding a *new* variable means registering a task definition revision that
includes it, since the deploy pipeline only swaps the image and carries the
rest forward. Edit the live definition rather than writing one from scratch,
so nothing is dropped:

```bash
aws ecs describe-task-definition --task-definition "$ECS_SERVICE" \
  --region "$AWS_REGION" --query taskDefinition > /tmp/td.json
# ...add to .containerDefinitions[0].environment (or .secrets), strip the
# read-only keys (taskDefinitionArn, revision, status, requiresAttributes,
# compatibilities, registeredAt, registeredBy), then:
aws ecs register-task-definition --cli-input-json file:///tmp/td.json \
  --region "$AWS_REGION" --query 'taskDefinition.taskDefinitionArn' --output text
```

## Community embeddings

Which ranking mode the service came up in — `embeddings` needs pgvector, which
is probed at startup against whatever database the instance points at, so it
cannot be read from config:

```bash
curl -fsS "$API_URL/health"   # -> "community_ranking":"embeddings" | "tags-only"
```

Embedding writes are best-effort `BackgroundTasks`, and the container can be
replaced mid-flight during a rollout, so some are lost. An **EventBridge** rule
(`udyaan-embedding-backfill`, hourly) reconciles them by invoking the
`udyaan-backfill` API destination. The destination's connection holds the
service token as an `X-Internal-Token` API key; the service reads the same
value as `BACKFILL_TOKEN`. **Rotating `/udyaan/BACKFILL_TOKEN` means updating
the connection too, or the job silently 401s.**

```bash
aws events describe-rule --name udyaan-embedding-backfill --region "$AWS_REGION" \
  --query '{sched:ScheduleExpression,state:State}'

# EventBridge has no "run now"; call the endpoint directly instead.
TOKEN="$(aws ssm get-parameter --name /udyaan/BACKFILL_TOKEN --with-decryption \
  --region "$AWS_REGION" --query Parameter.Value --output text | tr -d '\n')"
curl -fsS -X POST "$API_URL/portal/community/embeddings/backfill" \
  -H "X-Internal-Token: $TOKEN"   # repeat until both counts are 0

# Did the schedule actually fire? Failures are only visible as a metric.
aws cloudwatch get-metric-statistics --namespace AWS/Events \
  --metric-name FailedInvocations --region "$AWS_REGION" \
  --dimensions Name=RuleName,Value=udyaan-embedding-backfill \
  --start-time "$(date -u -v-1d +%Y-%m-%dT%H:%M:%S)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" --period 3600 --statistics Sum

# After rotating the token, re-point the connection:
aws events update-connection --name udyaan-backfill --region "$AWS_REGION" \
  --auth-parameters "ApiKeyAuthParameters={ApiKeyName=X-Internal-Token,ApiKeyValue=$TOKEN}"
```

## Survey documents

Forms and responses live in `udyaan_forms` / `udyaan_responses` — one JSONB
`payload` per document, named after the Firestore collections they replaced.
`PostgresStorage._ensure_schema()` creates them on first use, so there is no
migration step for a fresh database.

```bash
curl -fsS "$API_URL/forms/active" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["id"], len(d["sections"]), "sections")'
```
