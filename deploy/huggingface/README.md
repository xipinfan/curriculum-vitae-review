# Hugging Face Spaces deployment

This project can run on Hugging Face Spaces as a Docker Space with one public port.

## Required Space metadata

The root `README.md` includes:

```yaml
---
title: Curriculum Vitae Review
emoji: 🧭
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 7860
---
```

## Required secrets

Configure these in Hugging Face Spaces `Settings -> Variables and secrets`.

| Name | Type | Example |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Supabase PostgreSQL connection string |
| `ADMIN_KEY` | Secret | Long random admin key |

Use a Supabase Postgres connection string that is valid from Hugging Face's runtime.
Use the database password from Supabase `Project Settings -> Database`; do not use the Supabase dashboard password, anon key, or service role key.
If the password contains special characters such as `@`, `#`, `%`, `:`, `/`, or `?`, URL encode it before putting it in `DATABASE_URL`.

Recommended formats:

```bash
# Supabase pooler / Supavisor, usually best for hosted runtimes.
DATABASE_URL="postgresql://postgres.<project-ref>:<url-encoded-db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct database connection, useful for migrations when Supabase allows direct access.
DATABASE_URL="postgresql://postgres:<url-encoded-db-password>@db.<project-ref>.supabase.co:5432/postgres"
```

If the Hugging Face log says Prisma is connecting as user `postgres` to `*.pooler.supabase.com:6543`, the pooler username is incomplete. Change it to `postgres.<project-ref>`.

## Model provider configuration

Model provider settings are configured in the app UI and persisted in the Supabase database.
Do not put `OPENAI_API_KEY`, `OPENAI_BASE_URL`, or `OPENAI_MODEL` in Hugging Face Space secrets unless you intentionally want server-side fallback defaults for a private deployment.

## Local smoke test

```bash
docker build -t cv-review-hf .
docker run --rm -p 7860:7860 \
  -e DATABASE_URL="postgresql://..." \
  -e ADMIN_KEY="replace_with_long_random_value" \
  cv-review-hf
```

Open `http://localhost:7860/workspace`.
