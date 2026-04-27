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
| `OPENAI_API_KEY` | Secret | Provider API key |
| `OPENAI_BASE_URL` | Variable or Secret | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Variable | `gpt-4.1-mini` |

Use a Supabase Postgres connection string that is valid from Hugging Face's runtime.
For Prisma migrations, prefer Supabase's direct database connection when available.
If you use Supabase's pooler URL, add `?pgbouncer=true&connection_limit=1`.

## Local smoke test

```bash
docker build -t cv-review-hf .
docker run --rm -p 7860:7860 \
  -e DATABASE_URL="postgresql://..." \
  -e ADMIN_KEY="replace_with_long_random_value" \
  -e OPENAI_API_KEY="sk-..." \
  cv-review-hf
```

Open `http://localhost:7860/workspace`.
