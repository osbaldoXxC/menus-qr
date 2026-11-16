#!/usr/bin/env bash
set -euo pipefail

: "${COMPOSE_PROJECT_NAME:?Definir un proyecto de pruebas aislado}"
case "$COMPOSE_PROJECT_NAME" in
  ci-persistence-*) ;;
  *) echo 'Proyecto de persistencia inválido' >&2; exit 2 ;;
esac
compose=(docker compose -f ci/compose.persistence.yaml)
"${compose[@]}" up -d --wait --wait-timeout 180
"${compose[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U ci_test -d ci_persistence_test -c "CREATE TABLE ci_persistence_probe (value text PRIMARY KEY); INSERT INTO ci_persistence_probe VALUES ('synthetic-only');"
"${compose[@]}" exec -T redis redis-cli SET ci:persistence:probe synthetic-only
"${compose[@]}" restart postgres redis
"${compose[@]}" up -d --wait --wait-timeout 180
db_value=$("${compose[@]}" exec -T postgres psql -U ci_test -d ci_persistence_test -Atc 'SELECT value FROM ci_persistence_probe')
redis_value=$("${compose[@]}" exec -T redis redis-cli --raw GET ci:persistence:probe)
test "$db_value" = synthetic-only
test "$redis_value" = synthetic-only
echo 'PostgreSQL y Redis conservaron datos sintéticos tras reinicio.'
