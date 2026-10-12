#!/usr/bin/env bash
#
# Step 4 (and every later backend deploy). Build the API image locally, ship it
# to the Lightsail host over SSH, render api.env from SSM /udyaan/lightsail/,
# and restart. No registry is involved.
#
#   ./deploy.sh            build + config + restart
#   SKIP_ENV=1 ./deploy.sh image only (CI path; keeps the env file on the host)
#
source "$(dirname "$0")/common.sh"
require_account

HOST="$(static_ip)"
TAG="manual-$(date -u +%Y%m%d-%H%M%S)"

echo "==> Building udyaan-api:$TAG (linux/amd64)"
docker build --platform linux/amd64 -t "udyaan-api:$TAG" -t udyaan-api:current "$BACKEND_DIR"

echo "==> Shipping image to $HOST"
docker save udyaan-api:current | gzip | remote 'gunzip | docker load'

if [[ "${SKIP_ENV:-0}" != "1" ]]; then
  echo "==> Rendering api.env from SSM $CONFIG_PATH (values not shown)"
  ENV_FILE="$(mktemp)"
  trap 'rm -f "$ENV_FILE"' EXIT
  aws ssm get-parameters-by-path --path "$CONFIG_PATH" --recursive --with-decryption \
    --output json | python3 -c '
import json, sys
params = json.load(sys.stdin)["Parameters"]
env = {p["Name"].rsplit("/", 1)[-1]: p["Value"] for p in params}
env.setdefault("AWS_REGION", sys.argv[1])
for required in ("DATABASE_URL", "REDIS_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"):
    if not env.get(required):
        sys.exit(f"missing {required} in SSM")
for k, v in sorted(env.items()):
    if "\n" in v:
        sys.exit(f"{k} contains a newline; env files cannot hold it")
    print(f"{k}={v}")
' "$AWS_REGION" > "$ENV_FILE"
  scp -i "$SSH_KEY" -q "$ENV_FILE" "ubuntu@$HOST:$REMOTE_DIR/api.env"
  remote "chmod 600 $REMOTE_DIR/api.env"
fi

echo "==> Compose files"
scp -i "$SSH_KEY" -q "$LIGHTSAIL_DIR/docker-compose.yml" "$LIGHTSAIL_DIR/Caddyfile" "ubuntu@$HOST:$REMOTE_DIR/"

echo "==> Starting"
remote "cd $REMOTE_DIR && API_DOMAIN=$API_DOMAIN docker compose up -d --remove-orphans && docker image prune -f >/dev/null"

# Replaces the EventBridge embedding-backfill schedule.
remote "sudo tee /etc/cron.d/udyaan-backfill >/dev/null" <<EOF
17 * * * * ubuntu cd $REMOTE_DIR && docker compose exec -T api python -c "import os,urllib.request; t=os.environ.get('BACKFILL_TOKEN'); t and urllib.request.urlopen(urllib.request.Request('http://localhost:8080/portal/community/embeddings/backfill', method='POST', headers={'X-Internal-Token': t}), timeout=300)" >/dev/null 2>&1
EOF

echo "==> Health (inside the host)"
for _ in $(seq 1 20); do
  if remote "cd $REMOTE_DIR && docker compose exec -T api python -c \"import urllib.request; print(urllib.request.urlopen('http://localhost:8080/health').read().decode())\"" 2>/dev/null; then
    echo
    echo "Deployed. If DNS is not switched yet, point $API_DOMAIN (A record) at $HOST."
    exit 0
  fi
  sleep 5
done
echo "API did not become healthy. Logs: ssh -i $SSH_KEY ubuntu@$HOST 'cd $REMOTE_DIR && docker compose logs --tail 100 api'" >&2
exit 1
