# Tech Stack

## Monorepo
- Package manager: **pnpm 9+** (`pnpm-workspace.yaml`)
- Build orchestration: **Turborepo** (`turbo.json`)
- Node requirement: >=22.0.0

## rosmarium-server (TypeScript)
- Runtime: Node 22, ESM (`"type": "module"`)
- Framework: **Fastify 4** with plugins: @fastify/cors, helmet, rate-limit, sensible, swagger, cookie
- ORM: **Drizzle ORM** (`drizzle-kit` for migrations/generate)
- Auth: **Lucia v3** + @lucia-auth/adapter-drizzle
- DB driver: `postgres` (npm package)
- Queue: **BullMQ 5** + ioredis
- GraphQL: **graphql-yoga 5** + Pothos (schema builder: core, relay, validation, with-input)
- Validation: **Zod 3**
- Logger: **pino 9**
- Type-check: `tsc --noEmit`
- Test runner: **vitest 1**
- Dev runner: `tsx watch` with `--env-file=../../.env`

## rosmarium-admin (React/Vite)
- Framework: **React + Vite**
- Router: **TanStack Router**
- Test: vitest

## rosmarium-ai-worker (Python)
- Python: **3.12** (`.python-version` pin)
- Package manager / runner: **uv** (not pip)
- Framework: **FastAPI** + uvicorn
- Settings: **pydantic-settings 2.6**
- DB: **asyncpg**
- HTTP client: **httpx**
- Queue: **redis-py 5** (BullMQ consumer)
- Logger: **structlog**
- Linter: **Ruff** (line-length=100, strict rule set)
- Type checker: **mypy** (strict=true)
- Test runner: **pytest** + pytest-asyncio (asyncio_mode=auto)
- Optional deps groups: `embeddings`, `rag` (install with `uv sync --extra embeddings --extra rag`)

## Infra
- PostgreSQL 16 + pgvector extension
- Redis 7
- S3-compatible storage
- Container runtime: Podman preferred, falls back to Docker (auto-detected in scripts)
