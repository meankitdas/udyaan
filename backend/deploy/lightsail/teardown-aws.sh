#!/usr/bin/env bash
#
# Step 6. After api.udyaan.org is served by Lightsail, delete the AWS resources
# that made up the old stack. Every deletion asks first. RDS gets a final
# snapshot. S3 buckets, SES, SSM and IAM are kept: the new host still uses them.
#
source "$(dirname "$0")/common.sh"
require_account

echo "==> Checking that $API_DOMAIN is already served by Lightsail"
HOST="$(static_ip)"
RESOLVED="$(python3 -c 'import socket,sys; print(socket.gethostbyname(sys.argv[1]))' "$API_DOMAIN")"
if [[ "$RESOLVED" != "$HOST" ]] || ! curl -fsS --max-time 20 "https://$API_DOMAIN/health" >/dev/null; then
  echo "$API_DOMAIN resolves to $RESOLVED (Lightsail is $HOST) or is unhealthy. Finish the cutover first." >&2
  [[ "${FORCE:-0}" == "1" ]] || exit 1
fi

# --- ECS -------------------------------------------------------------------
for svc in $(aws ecs list-services --cluster "$ECS_CLUSTER" --query 'serviceArns[]' --output text 2>/dev/null); do
  if confirm "Delete ECS service ${svc##*/}?"; then
    aws ecs delete-service --cluster "$ECS_CLUSTER" --service "$svc" --force >/dev/null
    aws ecs wait services-inactive --cluster "$ECS_CLUSTER" --services "$svc"
  fi
done
if aws ecs describe-clusters --clusters "$ECS_CLUSTER" --query 'clusters[?status==`ACTIVE`]' --output text | grep -q . \
   && confirm "Delete ECS cluster $ECS_CLUSTER?"; then
  aws ecs delete-cluster --cluster "$ECS_CLUSTER" >/dev/null || echo "    cluster still has services/tasks; skipped"
fi

# --- Load balancers + WAF --------------------------------------------------
for lb in $(aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn' --output text); do
  name="$(cut -d/ -f3 <<<"$lb")"
  if confirm "Delete load balancer $name?"; then
    for acl in $(aws wafv2 get-web-acl-for-resource --resource-arn "$lb" --query 'WebACL.ARN' --output text 2>/dev/null | grep -v None); do
      aws wafv2 disassociate-web-acl --resource-arn "$lb"
    done
    tgs="$(aws elbv2 describe-target-groups --load-balancer-arn "$lb" --query 'TargetGroups[].TargetGroupArn' --output text)"
    aws elbv2 delete-load-balancer --load-balancer-arn "$lb"
    aws elbv2 wait load-balancers-deleted --load-balancer-arns "$lb"
    for tg in $tgs; do aws elbv2 delete-target-group --target-group-arn "$tg" || true; done
  fi
done
aws wafv2 list-web-acls --scope REGIONAL --query 'WebACLs[].[Name,Id,LockToken]' --output text | while read -r name id token; do
  [[ -z "$name" ]] && continue
  if confirm "Delete WAF web ACL $name?" </dev/tty; then
    aws wafv2 delete-web-acl --scope REGIONAL --name "$name" --id "$id" --lock-token "$token" || true
  fi
done

# --- ElastiCache (replaced by Upstash) -------------------------------------
for rg in $(aws elasticache describe-replication-groups --query 'ReplicationGroups[].ReplicationGroupId' --output text); do
  confirm "Delete ElastiCache replication group $rg?" && \
    aws elasticache delete-replication-group --replication-group-id "$rg" --no-retain-primary-cluster >/dev/null
done
for cc in $(aws elasticache describe-cache-clusters --query 'CacheClusters[?ReplicationGroupId==`null`].CacheClusterId' --output text); do
  confirm "Delete ElastiCache cluster $cc?" && aws elasticache delete-cache-cluster --cache-cluster-id "$cc" >/dev/null
done
for sc in $(aws elasticache describe-serverless-caches --query 'ServerlessCaches[].ServerlessCacheName' --output text 2>/dev/null); do
  confirm "Delete ElastiCache serverless cache $sc?" && aws elasticache delete-serverless-cache --serverless-cache-name "$sc" >/dev/null
done

# --- RDS (replaced by Neon) ------------------------------------------------
for db in $(aws rds describe-db-instances --query 'DBInstances[].DBInstanceIdentifier' --output text); do
  if confirm "Delete RDS instance $db (a final snapshot is kept)?"; then
    aws rds modify-db-instance --db-instance-identifier "$db" --no-deletion-protection --apply-immediately >/dev/null
    aws rds wait db-instance-available --db-instance-identifier "$db"
    aws rds delete-db-instance --db-instance-identifier "$db" \
      --final-db-snapshot-identifier "$db-final-$(date -u +%Y%m%d)" --delete-automated-backups >/dev/null
    echo "    final snapshot $db-final-$(date -u +%Y%m%d) (about \$0.10/GB-month; delete it once Neon is trusted)"
  fi
done

# --- VPC extras: NAT, interface endpoints, idle Elastic IPs ----------------
for nat in $(aws ec2 describe-nat-gateways --filter Name=state,Values=available --query 'NatGateways[].NatGatewayId' --output text); do
  if confirm "Delete NAT gateway $nat?"; then
    aws ec2 delete-nat-gateway --nat-gateway-id "$nat" >/dev/null
    aws ec2 wait nat-gateway-deleted --nat-gateway-ids "$nat"
  fi
done
for ep in $(aws ec2 describe-vpc-endpoints --filters Name=vpc-endpoint-type,Values=Interface --query 'VpcEndpoints[].VpcEndpointId' --output text); do
  confirm "Delete interface VPC endpoint $ep?" && aws ec2 delete-vpc-endpoints --vpc-endpoint-ids "$ep" >/dev/null
done
for alloc in $(aws ec2 describe-addresses --query 'Addresses[?AssociationId==`null`].AllocationId' --output text); do
  confirm "Release unattached Elastic IP $alloc?" && aws ec2 release-address --allocation-id "$alloc"
done

# --- EventBridge backfill (now a cron on the host) -------------------------
if aws events describe-rule --name udyaan-embedding-backfill >/dev/null 2>&1 \
   && confirm "Delete EventBridge rule udyaan-embedding-backfill and its API destination?"; then
  ids="$(aws events list-targets-by-rule --rule udyaan-embedding-backfill --query 'Targets[].Id' --output text)"
  [[ -n "$ids" ]] && aws events remove-targets --rule udyaan-embedding-backfill --ids $ids >/dev/null
  aws events delete-rule --name udyaan-embedding-backfill
  conn="$(aws events describe-api-destination --name udyaan-backfill --query ConnectionArn --output text 2>/dev/null || true)"
  aws events delete-api-destination --name udyaan-backfill 2>/dev/null || true
  [[ -n "$conn" ]] && aws events delete-connection --name "${conn##*/}" >/dev/null 2>&1 || true
fi

# --- ECR + logs ------------------------------------------------------------
if aws ecr describe-repositories --repository-names udyaan-api >/dev/null 2>&1 \
   && confirm "Delete ECR repository udyaan-api and its images (no longer used)?"; then
  aws ecr delete-repository --repository-name udyaan-api --force >/dev/null
fi
for lg in $(aws logs describe-log-groups --query 'logGroups[?retentionInDays==`null`].logGroupName' --output text); do
  aws logs put-retention-policy --log-group-name "$lg" --retention-in-days 14
  echo "    $lg retention -> 14 days"
done

echo
echo "==> Left running (review manually)"
aws ec2 describe-instances --filters Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].[InstanceId,InstanceType]' --output text
aws ec2 describe-volumes --filters Name=status,Values=available --query 'Volumes[].[VolumeId,Size]' --output text
aws ec2 describe-network-interfaces --query 'NetworkInterfaces[?Association.PublicIp].[NetworkInterfaceId,Description]' --output text
echo "Done. The bill drops from the next full day; check Cost Explorer in 2-3 days."
