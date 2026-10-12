#!/usr/bin/env bash
#
# Step 1. Create the Lightsail host that replaces ECS + ALB, an IAM user it can
# use for S3/SES (Lightsail has no instance roles), and copy the live ECS
# configuration into SSM under /udyaan/lightsail/. Safe to re-run.
#
source "$(dirname "$0")/common.sh"
require_account

echo "==> Key pair"
if ! aws lightsail get-key-pair --key-pair-name "$KEY_PAIR_NAME" >/dev/null 2>&1; then
  [[ -e "$SSH_KEY" ]] && { echo "$SSH_KEY exists but key pair $KEY_PAIR_NAME does not; move it aside." >&2; exit 1; }
  mkdir -p "$(dirname "$SSH_KEY")"
  (umask 077; aws lightsail create-key-pair --key-pair-name "$KEY_PAIR_NAME" \
    --query privateKeyBase64 --output text > "$SSH_KEY")
  echo "    saved private key to $SSH_KEY"
fi

echo "==> Instance $INSTANCE_NAME ($BUNDLE_ID)"
if ! aws lightsail get-instance --instance-name "$INSTANCE_NAME" >/dev/null 2>&1; then
  USER_DATA="$(cat <<'EOF'
#!/bin/bash
set -e
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 unattended-upgrades
systemctl enable --now docker
usermod -aG docker ubuntu
mkdir -p /opt/udyaan && chown ubuntu:ubuntu /opt/udyaan
EOF
)"
  aws lightsail create-instances --instance-names "$INSTANCE_NAME" \
    --availability-zone "$AVAILABILITY_ZONE" --blueprint-id ubuntu_24_04 \
    --bundle-id "$BUNDLE_ID" --key-pair-name "$KEY_PAIR_NAME" \
    --user-data "$USER_DATA" >/dev/null
fi
until [[ "$(aws lightsail get-instance-state --instance-name "$INSTANCE_NAME" --query state.name --output text)" == "running" ]]; do
  sleep 5
done

echo "==> Static IP"
if ! aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" >/dev/null 2>&1; then
  aws lightsail allocate-static-ip --static-ip-name "$STATIC_IP_NAME" >/dev/null
fi
if [[ "$(aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" --query staticIp.isAttached --output text)" != "True" ]]; then
  aws lightsail attach-static-ip --static-ip-name "$STATIC_IP_NAME" --instance-name "$INSTANCE_NAME" >/dev/null
fi

echo "==> Firewall (22, 80, 443)"
aws lightsail put-instance-public-ports --instance-name "$INSTANCE_NAME" --port-infos \
  fromPort=22,toPort=22,protocol=tcp fromPort=80,toPort=80,protocol=tcp fromPort=443,toPort=443,protocol=tcp >/dev/null

echo "==> Reading live ECS task definition"
TD_ARN="$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" \
  --query 'services[0].taskDefinition' --output text)"
TD_JSON="$(mktemp)"
aws ecs describe-task-definition --task-definition "$TD_ARN" \
  --query 'taskDefinition.containerDefinitions[0]' > "$TD_JSON"

echo "==> IAM user $IAM_USER (S3 + SES only)"
BUCKETS="$(python3 -c '
import json,sys
env = {e["name"]: e["value"] for e in json.load(open(sys.argv[1])).get("environment", [])}
print(" ".join(b for b in (env.get("S3_BUCKET",""), env.get("SURVEY_CV_BUCKET","")) if b))
' "$TD_JSON")"
POLICY="$(python3 -c '
import json,sys
buckets = sys.argv[1].split()
stmts = [{"Effect":"Allow","Action":["ses:SendEmail","ses:SendRawEmail"],"Resource":"*"}]
if buckets:
    stmts.append({"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],
                  "Resource":[f"arn:aws:s3:::{b}/*" for b in buckets]})
print(json.dumps({"Version":"2012-10-17","Statement":stmts}))
' "$BUCKETS")"
aws iam get-user --user-name "$IAM_USER" >/dev/null 2>&1 || aws iam create-user --user-name "$IAM_USER" >/dev/null
aws iam put-user-policy --user-name "$IAM_USER" --policy-name udyaan-api-runtime --policy-document "$POLICY"
if ! aws ssm get-parameter --name "$CONFIG_PATH/AWS_ACCESS_KEY_ID" >/dev/null 2>&1; then
  KEY_JSON="$(aws iam create-access-key --user-name "$IAM_USER" --output json)"
  python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["AccessKey"]["AccessKeyId"])' <<<"$KEY_JSON" | put_secret AWS_ACCESS_KEY_ID
  python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["AccessKey"]["SecretAccessKey"])' <<<"$KEY_JSON" | put_secret AWS_SECRET_ACCESS_KEY
  unset KEY_JSON
fi

echo "==> Copying ECS environment and secrets to $CONFIG_PATH (values not shown)"
CONFIG_PATH="$CONFIG_PATH" python3 - "$TD_JSON" <<'PY'
import json, os, subprocess, sys, tempfile

container = json.load(open(sys.argv[1]))
# Replaced by Neon/Upstash, or meaningless off ECS.
skip = {"DATABASE_URL", "REDIS_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN", "PROBLEM_SUBMISSIONS_SQLITE_PATH"}

def aws(*args):
    return subprocess.run(["aws", *args, "--output", "text"], check=True,
                          capture_output=True, text=True).stdout.rstrip("\n")

def put(name, value):
    with tempfile.NamedTemporaryFile("w", delete=False) as f:
        json.dump({"Name": f"{os.environ['CONFIG_PATH']}/{name}", "Type": "SecureString",
                   "Overwrite": True, "Value": value}, f)
    try:
        aws("ssm", "put-parameter", "--cli-input-json", f"file://{f.name}")
    finally:
        os.unlink(f.name)
    print(f"    {name}")

for item in container.get("environment", []):
    if item["name"] not in skip:
        put(item["name"], item["value"])

for item in container.get("secrets", []):
    if item["name"] in skip:
        continue
    ref = item["valueFrom"]
    if ":secretsmanager:" in ref:
        # ECS allows arn:...:secret:name:json-key:version-stage:version-id
        parts = ref.split(":")
        value = aws("secretsmanager", "get-secret-value", "--secret-id", ":".join(parts[:7]),
                    "--query", "SecretString")
        if len(parts) > 7 and parts[7]:
            value = str(json.loads(value)[parts[7]])
    else:
        value = aws("ssm", "get-parameter", "--name", ref, "--with-decryption", "--query", "Parameter.Value")
    put(item["name"], value)
PY
rm -f "$TD_JSON"

echo
echo "Host ready at $(static_ip). Next: ./set-external-urls.sh"
