#!/usr/bin/env bash
# Executed only by the fixed SSM document with validated parameters.
set -Eeuo pipefail
umask 077
release='{{ ReleaseId }}'
expected='{{ ImageSha256 }}'
operation='{{ Operation }}'
base=/home/ubuntu/app
backup=/mnt/ebs/mexxicanmx-backups
bucket=oamdevsol-cfn-templates-256663926988
[[ "$release" =~ ^[a-f0-9]{40}/[0-9]+-[0-9]+$ ]]
[[ "$expected" =~ ^[a-f0-9]{64}$ ]]
[[ "$operation" == deploy || "$operation" == rollback ]]
cd "$base"
mkdir -p "$backup/$release"
previous="$backup/$release/previous.yml"
if [[ "$operation" == rollback ]]; then
  test -s "$previous"
  docker compose -f compose.prod.yml -f "$previous" up -d --no-deps backend ml-service ai-engine
  exit
fi
test ! -e "$previous"
inspect_format=$(printf '\173\173.Image\175\175')
for service in backend ml-service ai-engine; do
  id=$(docker compose -f compose.prod.yml ps -q "$service")
  test -n "$id"
  docker inspect --format "$inspect_format" "$id" >/dev/null
done
{
  echo 'services:'
  for service in backend ml-service ai-engine; do
    id=$(docker compose -f compose.prod.yml ps -q "$service")
    image=$(docker inspect --format "$inspect_format" "$id")
    printf '  %s:\n    image: %s\n' "$service" "$image"
  done
} > "$previous"
docker exec mexxicanmx_db_prod sh -c 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$backup/$release/postgres.sql.gz"
gzip -t "$backup/$release/postgres.sql.gz"
gzip -dc "$backup/$release/postgres.sql.gz" | docker exec -i mexxicanmx_db_prod pg_restore --list >/dev/null
file="$backup/$release/images.tar.gz"
/snap/bin/aws s3 cp "s3://$bucket/mexxicanmx/releases/$release/images.tar.gz" "$file"
printf '%s  %s\n' "$expected" "$file" | sha256sum -c -
gzip -dc "$file" | docker load
sha=${release%%/*}
new="$backup/$release/current.yml"
printf 'services:\n  backend:\n    image: mexxicanmx/backend:%s\n  ml-service:\n    image: mexxicanmx/ml:%s\n  ai-engine:\n    image: mexxicanmx/ai:%s\n' "$sha" "$sha" "$sha" > "$new"
rollback() {
  echo 'Deployment failed; restoring previous application images.' >&2
  docker compose -f compose.prod.yml -f "$previous" up -d --no-deps backend ml-service ai-engine || true
}
trap rollback ERR
trap 'rollback; exit 1' INT TERM
docker compose -f compose.prod.yml -f "$new" up -d --no-deps backend ml-service ai-engine
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:4000/health >/dev/null; then
    trap - ERR INT TERM
    echo "Release $release passed local health check; database backup: $backup/$release/postgres.sql.gz"
    exit 0
  fi
  sleep 4
done
echo 'Backend health check failed.' >&2
false
