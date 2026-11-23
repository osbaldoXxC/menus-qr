#!/usr/bin/env bash
set -Eeuo pipefail
: "${GITHUB_SHA:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}" "${RUNNER_TEMP:?}"
: "${RELEASE_BUCKET:?}" "${DINER_BUCKET:?}" "${DINER_DISTRIBUTION:?}" "${DINER_URL:?}"
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]]
release="$GITHUB_SHA/$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
image_file="$RUNNER_TEMP/images.tar.gz"
image_hash=$(sha256sum "$image_file" | cut -d ' ' -f 1)
[[ "$image_hash" =~ ^[a-f0-9]{64}$ ]]
prefix="s3://$RELEASE_BUCKET/mexxicanmx/releases/$release"
backup="$RUNNER_TEMP/mexxicanmx-backup"
mkdir -p "$backup"
apps=(frontend-comensales frontend-restaurantes admin)
buckets=("$DINER_BUCKET" "$RESTAURANT_BUCKET" "$ADMIN_BUCKET")
distributions=("$DINER_DISTRIBUTION" "$RESTAURANT_DISTRIBUTION" "$ADMIN_DISTRIBUTION")
urls=("$DINER_URL" "$RESTAURANT_URL" "$ADMIN_URL")
run_ssm() {
  local operation=$1 command status
  command=$(aws ssm send-command --region "$AWS_REGION" --instance-ids i-000928567783f36af \
    --document-name MexxicanMX-DeployRelease --parameters "$(jq -cn --arg r "$release" --arg h "$image_hash" --arg o "$operation" '{ReleaseId:[$r],ImageSha256:[$h],Operation:[$o]}')" \
    --query 'Command.CommandId' --output text)
  for _ in $(seq 1 210); do
    status=$(aws ssm get-command-invocation --region "$AWS_REGION" --command-id "$command" --instance-id i-000928567783f36af --query Status --output text 2>/dev/null || true)
    case "$status" in
      Success) return 0 ;;
      Failed|Cancelled|TimedOut|Cancelling) echo "SSM $operation failed: $status ($command)" >&2; return 1 ;;
    esac
    sleep 10
  done
  echo "SSM operation is not confirmed finished; inspect command $command before retrying." >&2
  return 2
}
invalidate() {
  local distribution=$1 id
  id=$(aws cloudfront create-invalidation --distribution-id "$distribution" --paths '/index.html' '/' --query 'Invalidation.Id' --output text)
  aws cloudfront wait invalidation-completed --distribution-id "$distribution" --id "$id"
}
# Back up every live entrypoint before changing any live entrypoint or service.
for i in 0 1 2; do
  aws s3 cp "s3://${buckets[$i]}/index.html" "$backup/${apps[$i]}.html"
  test -s "$backup/${apps[$i]}.html"
  aws s3 cp "$backup/${apps[$i]}.html" "$prefix/backup/${apps[$i]}-index.html" --content-type 'text/html' --cache-control 'no-cache'
done
aws s3 cp "$image_file" "$prefix/images.tar.gz"
# Publish assets under an immutable release prefix before touching live entrypoints.
for i in 0 1 2; do
  aws s3 cp "${apps[$i]}/dist/" "s3://${buckets[$i]}/releases/$release/" --recursive --cache-control 'public,max-age=31536000,immutable'
done
run_ssm deploy
backend_deployed=1
rollback() {
  local code=$1 failed=0
  trap - ERR
  set +e
  echo 'Release failed: restoring prior entrypoints and application images.' >&2
  for i in 0 1 2; do
    aws s3 cp "$backup/${apps[$i]}.html" "s3://${buckets[$i]}/index.html" --content-type 'text/html' --cache-control 'no-cache' || failed=1
    invalidate "${distributions[$i]}" || failed=1
  done
  if [[ "$backend_deployed" == 1 ]]; then run_ssm rollback || failed=1; fi
  [[ "$failed" == 0 ]] || echo 'Automatic rollback incomplete; manual investigation required.' >&2
  exit "$code"
}
trap 'rollback $?' ERR
for i in 0 1 2; do
  aws s3 cp "${apps[$i]}/dist/index.html" "s3://${buckets[$i]}/index.html" --content-type 'text/html' --cache-control 'no-cache'
  invalidate "${distributions[$i]}"
  curl --fail --silent --show-error --location --max-time 30 "${urls[$i]%/}/index.html" -o "$backup/${apps[$i]}-live.html"
  cmp "${apps[$i]}/dist/index.html" "$backup/${apps[$i]}-live.html"
done
curl --fail --silent --show-error --max-time 30 "$API_URL/health" | jq -e '.status == "UP" and .database == "connected"' >/dev/null
trap - ERR
echo "Verified release $release; backup objects at $prefix/backup and database backup on EC2."
