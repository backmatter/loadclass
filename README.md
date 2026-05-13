# loadclass

Self-hostable LaTeX template registry.

## What It Does

- Browse, search, star, and download LaTeX templates
- Publish versioned template archives with API keys
- Store archives in S3-compatible storage such as MinIO or HiDrive S3
- Use PostgreSQL, Better Auth, Hono, TanStack Start, and Bun
- Expose OpenAPI at `/openapi.json` and API docs at `/docs`

## Local Development

Requirements:

- Bun 1.3+
- Docker + Docker Compose

```bash
bun install
cp .env.example .env
```

The example env contains dev-only local secrets so the app can start without extra setup.
Replace them before deploying anywhere public.

Start dependencies:

```bash
docker compose up postgres minio minio-init -d
bun db:migrate
bun run --cwd packages/db src/seed.ts
```

Run API and web in separate terminals:

```bash
bun dev:api
```

```bash
bun dev
```

Open:

- Web: http://localhost:3001
- API docs: http://localhost:8080/docs

## Self-Hosting

```bash
cp .env.example .env
# Fill in secrets and public URLs.
docker compose up -d
```

Important production env vars:

```env
DATABASE_URL=
LOADCLASS_RUNTIME_ENV=production
BETTER_AUTH_SECRET=
LOADCLASS_AUTH_COOKIE_DOMAIN=
LOADCLASS_PUBLIC_API_URL=
LOADCLASS_SITE_URL=
LOADCLASS_INTERNAL_API_URL=
TRUSTED_ORIGINS=
CORS_ORIGINS=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
POSTGRES_PASSWORD=
MINIO_ROOT_PASSWORD=
PREVIEW_WORKER_TOKEN=
RATE_LIMIT_STORE=postgres
LOADCLASS_SMTP_HOST=
LOADCLASS_SMTP_PORT=
LOADCLASS_SMTP_USER=
LOADCLASS_SMTP_PASS=
LOADCLASS_EMAIL_FROM=
LOADCLASS_GOOGLE_CLIENT_ID=
LOADCLASS_GOOGLE_CLIENT_SECRET=
LOADCLASS_GITHUB_CLIENT_ID=
LOADCLASS_GITHUB_CLIENT_SECRET=
```

Generate `PREVIEW_WORKER_TOKEN` with `openssl rand -base64 32`. Publishing requires the
preview worker: uploaded templates must compile in the sandbox and produce a PNG thumbnail
before the API writes the package to storage.

Rate limits are enabled by default for auth, API reads, mutations, downloads, and publishing.
They use the existing PostgreSQL database by default, so no Redis/Valkey service is required.
Keep `TRUST_PROXY_HEADERS=false` unless the API is behind a trusted proxy that overwrites
client IP headers.

Optional hosted-instance controls:

```env
ALLOW_REGISTRATION=true
ALLOW_PUBLISHING=true
MAX_ARCHIVE_BYTES=26214400
MAX_PUBLISH_BODY_BYTES=
MAX_TEMPLATES_PER_USER=5
MAX_VERSIONS_PER_TEMPLATE=10
LOADCLASS_AUTH_PROVIDERS=
LOADCLASS_EMAIL_PASSWORD_AUTH_ENABLED=true
LOADCLASS_CITET_URL=
TRUST_PROXY_HEADERS=false
RATE_LIMIT_AUTH_PER_MINUTE=20
RATE_LIMIT_API_PER_MINUTE=600
RATE_LIMIT_MUTATION_PER_MINUTE=120
RATE_LIMIT_DOWNLOAD_PER_MINUTE=120
RATE_LIMIT_PUBLISH_PER_HOUR=5
RATE_LIMIT_PUBLISH_IP_PER_HOUR=20
```

## License

MIT
