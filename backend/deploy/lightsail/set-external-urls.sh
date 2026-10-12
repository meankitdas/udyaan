#!/usr/bin/env bash
#
# Step 2. Store the Neon Postgres and Upstash Redis connection strings in SSM.
# Input is hidden and never echoed.
#
#   Neon:    create a project (Postgres 16 or 17, region AWS Asia Pacific
#            Singapore), copy the *direct* connection string — not the
#            "-pooler" host: PgBouncer transaction mode breaks asyncpg.
#   Upstash: create a Redis database in AWS ap-south-1 (Mumbai) with TLS on,
#            copy the rediss:// URL.
#
source "$(dirname "$0")/common.sh"
require_account

read -r -s -p "Neon connection string: " NEON_URL; echo
read -r -s -p "Upstash Redis URL (rediss://...): " UPSTASH_URL; echo

if [[ "$NEON_URL" == *"-pooler."* ]]; then
  echo "That is the pooled endpoint; use the direct one (no -pooler in the host)." >&2
  exit 1
fi
# Accept a bare URL or the whole `redis-cli --tls -u redis://...` line from the console.
UPSTASH_URL="$(grep -oE 'rediss?://[^[:space:]"'\'']+' <<<"$UPSTASH_URL" | head -1 || true)"
# Upstash only accepts TLS even when its console shows redis://.
UPSTASH_URL="${UPSTASH_URL/#redis:\/\//rediss://}"
if [[ "$UPSTASH_URL" != rediss://* ]]; then
  echo "No redis:// or rediss:// URL found in what was pasted." >&2
  exit 1
fi

# asyncpg rejects libpq-only query params such as channel_binding.
NEON_URL="$(python3 -c '
import sys
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
p = urlsplit(sys.stdin.read().strip())
q = {k: v for k, v in parse_qsl(p.query) if k != "channel_binding"}
q.setdefault("sslmode", "require")
print(urlunsplit((p.scheme, p.netloc, p.path, urlencode(q), "")))
' <<<"$NEON_URL")"

printf '%s' "$NEON_URL" | put_secret DATABASE_URL
printf '%s' "$UPSTASH_URL" | put_secret REDIS_URL
unset NEON_URL UPSTASH_URL

echo "Stored $CONFIG_PATH/DATABASE_URL and $CONFIG_PATH/REDIS_URL. Next: ./migrate-db.sh"
