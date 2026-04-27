#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required. Set it from your Supabase Postgres connection string in Hugging Face Spaces secrets.}"
: "${ADMIN_KEY:?ADMIN_KEY is required. Set a long random value in Hugging Face Spaces secrets.}"

export PORT="${PORT:-3001}"

pnpm --filter @cv-review/api prisma:migrate:deploy

node apps/api/dist/main.js &
api_pid="$!"

nginx -g "daemon off;" &
nginx_pid="$!"

term_handler() {
  kill "$api_pid" "$nginx_pid" 2>/dev/null || true
  wait "$api_pid" "$nginx_pid" 2>/dev/null || true
}

trap term_handler INT TERM

wait -n "$api_pid" "$nginx_pid"
exit_code="$?"
term_handler
exit "$exit_code"
