# Shared settings for the Lightsail scripts. Source, don't execute.
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-new-profile-name}"
export AWS_REGION="${AWS_REGION:-ap-south-1}"
export AWS_PAGER=""

ACCOUNT_ID="209483892786"
INSTANCE_NAME="${INSTANCE_NAME:-udyaan-api}"
STATIC_IP_NAME="${STATIC_IP_NAME:-udyaan-api-ip}"
BUNDLE_ID="${BUNDLE_ID:-micro_3_1}"
AVAILABILITY_ZONE="${AVAILABILITY_ZONE:-${AWS_REGION}a}"
KEY_PAIR_NAME="${KEY_PAIR_NAME:-udyaan-lightsail}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/udyaan-lightsail-ed25519}"
IAM_USER="${IAM_USER:-udyaan-lightsail-api}"
CONFIG_PATH="/udyaan/lightsail"
API_DOMAIN="${API_DOMAIN:-api.udyaan.org}"
ECS_CLUSTER="${ECS_CLUSTER:-udyaan}"
ECS_SERVICE="${ECS_SERVICE:-udyaan-api}"
REMOTE_DIR="/opt/udyaan"

LIGHTSAIL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$LIGHTSAIL_DIR/../.." && pwd)"

require_account() {
  local actual
  actual="$(aws sts get-caller-identity --query Account --output text)" || {
    echo "AWS session invalid. Run: aws login --profile $AWS_PROFILE --region $AWS_REGION" >&2
    exit 1
  }
  if [[ "$actual" != "$ACCOUNT_ID" ]]; then
    echo "Wrong AWS account ($actual); expected $ACCOUNT_ID." >&2
    exit 1
  fi
}

confirm() {
  local reply
  read -r -p "$1 [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]]
}

static_ip() {
  aws lightsail get-static-ip --static-ip-name "$STATIC_IP_NAME" \
    --query staticIp.ipAddress --output text
}

remote() {
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "ubuntu@$(static_ip)" "$@"
}

put_secret() {
  # Value comes from stdin and goes via a 0600 file, never argv or shell history.
  local name="$1" tmp
  tmp="$(mktemp)"
  python3 -c 'import json,sys; json.dump({"Name":sys.argv[1],"Type":"SecureString","Overwrite":True,"Value":sys.stdin.read().rstrip("\n")}, open(sys.argv[2],"w"))' \
    "$CONFIG_PATH/$name" "$tmp"
  aws ssm put-parameter --cli-input-json "file://$tmp" >/dev/null
  rm -f "$tmp"
}
