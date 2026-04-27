#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required. Set it from your Supabase Postgres connection string in Hugging Face Spaces secrets.}"
: "${ADMIN_KEY:?ADMIN_KEY is required. Set a long random value in Hugging Face Spaces secrets.}"

export PORT="${PORT:-3001}"
APP_DATABASE_URL="$DATABASE_URL"

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
    if [ -z "${DIRECT_URL:-}" ]; then
      cat >&2 <<'EOF'
DATABASE_URL uses the Supabase transaction pooler on port 6543.
Prisma migrations should not run through the transaction pooler.
Set DIRECT_URL in Hugging Face Spaces secrets to a Supabase direct connection or session pooler URL.
Examples:
DIRECT_URL=postgresql://postgres:<url-encoded-db-password>@db.<project-ref>.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres.<project-ref>:<url-encoded-db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres
EOF
      exit 1
    fi
    ;;
esac

export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

if [ "$DIRECT_URL" != "$APP_DATABASE_URL" ]; then
  echo "Running Prisma migrations with DIRECT_URL."
  DATABASE_URL="$DIRECT_URL" pnpm --filter @cv-review/api prisma:migrate:deploy
  export DATABASE_URL="$APP_DATABASE_URL"
else
  echo "Running Prisma migrations with DATABASE_URL."
  pnpm --filter @cv-review/api prisma:migrate:deploy
fi

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
