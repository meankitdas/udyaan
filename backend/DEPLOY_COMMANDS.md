# Deploy runbook — AWS

The backend runs on **App Runner** in `ap-south-1` (account `209483892786`),
from an image in **ECR**, against **RDS Postgres**, with configuration in
**SSM Parameter Store** under `/udyaan/*`.

```bash
export AWS_PROFILE=new-profile-name
export AWS_REGION=ap-south-1
export SERVICE_ARN="$(aws apprunner list-services --region "$AWS_REGION" \
  --query "ServiceSummaryList[?ServiceName=='udyaan-api'].ServiceArn | [0]" --output text)"
export API_URL="https://$(aws apprunner describe-service --service-arn "$SERVICE_ARN" \
  --region "$AWS_REGION" --query 'Service.ServiceUrl' --output text)"
```

## Deploy

Normally you do not. Pushing to `main` with changes under `backend/` runs
`.github/workflows/deploy-backend.yml`, which assumes `udyaan-github-deploy`
via GitHub OIDC, builds, pushes to ECR, and updates the service.

To ship from a laptop (uncommitted debug builds, or CI outage):

```bash
./deploy/deploy-apprunner.sh
```

Note the `--platform linux/amd64` in that script. App Runner is x86 only; an
image built natively on an arm Mac pushes without complaint and then fails to
start.

## Status and logs

```bash
aws apprunner describe-service --service-arn "$SERVICE_ARN" --region "$AWS_REGION" \
  --query '{status:Service.Status,image:Service.SourceConfiguration.ImageRepository.ImageIdentifier,updated:Service.UpdatedAt}'

aws apprunner list-operations --service-arn "$SERVICE_ARN" --region "$AWS_REGION" \
  --max-results 5 --query 'OperationSummaryList[].{type:Type,status:Status,started:StartedAt}'

# Application stdout/stderr (uvicorn access logs live here).
aws logs tail "/aws/apprunner/udyaan-api/${SERVICE_ARN##*/}/application" \
  --region "$AWS_REGION" --since 30m --follow

# Deployment/health-check machinery, when a rollout fails before the app logs.
aws logs tail "/aws/apprunner/udyaan-api/${SERVICE_ARN##*/}/service" \
  --region "$AWS_REGION" --since 30m
```

## Smoke checks

```bash
curl -fsS "$API_URL/health"
curl -fsS "$API_URL/openapi.json" \
  | python3 -c 'import json,sys; print("\n".join(sorted(json.load(sys.stdin)["paths"])))'

curl -i -X OPTIONS "$API_URL/portal/auth/login" \
  -H "Origin: https://udyaan.vercel.app" \
  -H "Access-Control-Request-Method: POST"
```

App Runner services are public by default — there is no per-service IAM
invoker binding to add, unlike Cloud Run.

## Configuration and secrets

Every runtime value is an SSM SecureString under `/udyaan/`, bound to the
service as a secret environment variable.

```bash
aws ssm get-parameters-by-path --path /udyaan --region "$AWS_REGION" \
  --query 'Parameters[].Name' --output text

aws ssm get-parameter --name /udyaan/DATABASE_URL --with-decryption \
  --region "$AWS_REGION" --query Parameter.Value --output text
```

Rotating a value is just a new version — App Runner reads the parameter at
instance start, so it takes effect on the next deployment:

```bash
aws ssm put-parameter --name /udyaan/SOME_KEY --type SecureString \
  --value "$NEW" --overwrite --region "$AWS_REGION"
aws apprunner start-deployment --service-arn "$SERVICE_ARN" --region "$AWS_REGION"
```

Adding a *new* variable additionally needs it listed in the service's
`RuntimeEnvironmentSecrets`. Send the **whole** map when you do:
`update-service` replaces each configuration block it receives, so omitting an
existing key unsets it.

## Community embeddings

Which ranking mode the service came up in — `embeddings` needs pgvector, which
is probed at startup against whatever database the instance points at, so it
cannot be read from config:

```bash
curl -fsS "$API_URL/health"   # -> "community_ranking":"embeddings" | "tags-only"
```

Embedding writes are best-effort `BackgroundTasks`, and App Runner throttles
CPU once a response is sent, so some are lost. An **EventBridge** rule
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
