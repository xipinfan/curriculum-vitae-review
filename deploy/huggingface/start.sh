#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required. Set it from your Supabase Postgres connection string in Hugging Face Spaces secrets.}"
: "${ADMIN_KEY:?ADMIN_KEY is required. Set a long random value in Hugging Face Spaces secrets.}"

export PORT="${PORT:-3001}"

case "$DATABASE_URL" in
  *pooler.supabase.com:6543*)
    db_user="$(printf '%s' "$DATABASE_URL" | sed -n 's#^postgresql://\([^:@/]*\).*#\1#p')"
    if [ "$db_user" = "postgres" ]; then
      cat >&2 <<'EOF'
DATABASE_URL points to the Supabase pooler on port 6543, but the username is "postgres".
For Supabase pooler URLs, use "postgres.<project-ref>" as the username.
Example:
postgresql://postgres.<project-ref>:<url-encoded-db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
EOF
      exit 1
    fi
    ;;
esac

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
