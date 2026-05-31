# Rosmarium COS — Agent Configuration

## Project
Open-source, AI-native headless Content Orchestration System. Apache 2.0.
TypeScript/Fastify API + React admin + Python/FastAPI AI worker. pnpm monorepo + Turborepo.

## Tech Stack
- TypeScript 5.4, Node.js 22, Fastify 4, Drizzle ORM 0.43, graphql-yoga 5, Pothos 4
- React 19, Vite 5, MUI v9, react-router-dom v7
- Python 3.12, FastAPI, Pydantic v2, spaCy, LlamaIndex, PyTorch
- PostgreSQL 16 + pgvector, Redis 7 + BullMQ, S3 (MinIO)

## Commands
- Install: `pnpm install`
- Dev: `pnpm dev`
- Infra: `pnpm infra:up && pnpm infra:init`
- DB migrate: `pnpm db:migrate`
- DB generate: `pnpm db:generate` (after schema changes)
- Test: `pnpm test`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Python lint: `cd apps/rosmarium-ai-worker && ruff check src/`
- Python types: `cd apps/rosmarium-ai-worker && mypy src/`

## Coding Standards
### TypeScript (apps/rosmarium-server)
- ESM with `.js` import extensions: `import { x } from "./module.js"`
- Strict mode, `noUncheckedIndexedAccess: true`
- Zod for all runtime validation. No `any` — use `unknown` + narrow.
- Services as object literals: `export const fooService = { async bar() {} }`
- Custom error classes with `code` property

### Python (apps/rosmarium-ai-worker)
- Type hints on all functions. Pydantic v2 models for all data boundaries.
- mypy strict mode. Ruff for linting (line-length 100).
- async/await throughout. asyncpg for DB. Never mix sync/async.

### React (apps/rosmarium-admin)
- Functional components, named exports, hooks only
- MUI v9 — Grid uses `size={{ xs: 12 }}` not `xs={12}`
- react-router-dom v7 (BrowserRouter, Routes, Route)
- Plain fetch() for API calls — no axios

### Database
- Drizzle ORM. IDs: `text("id").$defaultFn(() => createId())` (cuid2)
- Column names: snake_case in SQL, camelCase in TypeScript
- Timestamps: `timestamp("x", { withTimezone: true }).notNull().defaultNow()`
- Show migration diff before applying. Never auto-run destructive migrations.

## Architecture Notes
- GraphQL: graphql-yoga v5 + Pothos v4 (NOT Mercurius)
- Auth: Lucia v3 sessions + API key auth
- Events: TypedEventEmitter → bridges to PubSub, Webhooks, Job queues
- Multi-tenancy: X-Tenant-Id header → AsyncLocalStorage → PostgreSQL search_path

## Boundaries
### Always
- Run `pnpm typecheck && pnpm lint && pnpm test` before committing
- Use conventional commits: `feat(server): description`
- Read PHASE.md before starting work
- Show migration SQL diffs before applying

### Never
- Never commit .env files, API keys, or secrets
- Never use raw SQL in application code (use Drizzle ORM)
- Never use `any` type in TypeScript
- Never run destructive DB operations without confirmation
- Never log request bodies containing passwords, tokens, or PII
- Never add dependencies without checking maintenance status
