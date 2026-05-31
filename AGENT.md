# Rosmarium COS — AI Agent Context

## Overview
Rosmarium is an open-source, AI-native headless **Content Orchestration System (COS)**.
Apache 2.0 license. Monorepo managed with pnpm workspaces + Turborepo.

## Architecture
| App | Stack | Port | Purpose |
|-----|-------|------|---------|
| `apps/rosmarium-server` | TypeScript / Node.js 22 / Fastify 4 | 3000 | Core API (REST + GraphQL), auth, RBAC, webhooks |
| `apps/rosmarium-admin` | TypeScript / React 19 / Vite / MUI v9 | 5173 | Admin dashboard |
| `apps/rosmarium-ai-worker` | Python 3.12 / FastAPI | 8001 | AI pipeline (embeddings, RAG, NER, graph analytics) |

| Package | Name | Purpose |
|---------|------|---------|
| `packages/types` | `@orchestrator.dev/types` | Shared TypeScript types |
| `packages/sdk` | `@orchestrator.dev/rosmarium-sdk` | API client SDK |
| `packages/config` | `@orchestrator.dev/config` | Shared configuration |

## Infrastructure
- **Database**: PostgreSQL 16 + pgvector (primary + vector store)
- **Cache/Queue**: Redis 7 + BullMQ (3 queues: embedding-jobs, intelligence-jobs, webhook-deliveries)
- **Storage**: S3-compatible (MinIO for dev)
- **Observability**: OpenTelemetry + Prometheus + Grafana

## Service Communication
- Server → AI Worker: BullMQ Redis queues (async) + HTTP on port 8001 (sync search/RAG)
- Both services share the same PostgreSQL and Redis instances
- GraphQL subscriptions via graphql-ws WebSocket

## Development Commands
```bash
pnpm infra:up          # Start PostgreSQL, Redis, MinIO via Docker/Podman
pnpm infra:init        # Initialize pgvector extension + MinIO bucket (first run)
pnpm db:migrate        # Run Drizzle migrations
pnpm db:seed           # Seed initial data
pnpm demo:seed         # Seed demo dataset ("Rosmarium Discovery")
pnpm dev               # Start all apps (Turborepo)
pnpm typecheck         # TypeScript type checking (all workspaces)
pnpm lint              # ESLint (TS) + Ruff (Python)
pnpm test              # Run all tests
pnpm db:generate       # Generate Drizzle migration after schema change
```

## Key Conventions
- **TypeScript imports**: Always use `.js` extensions for ESM (`from "./config.js"`)
- **IDs**: `@paralleldrive/cuid2` via `createId()` — all tables use `text("id")`
- **Column naming**: camelCase in TypeScript ↔ snake_case in SQL
- **Services**: Object literal pattern (`export const fooService = { async method() {} }`)
- **Config validation**: Zod (TypeScript) / Pydantic Settings (Python)
- **Auth**: Lucia v3 session cookies + Bearer API key auth
- **GraphQL**: graphql-yoga v5 + Pothos v4 schema builder (NOT Mercurius)
- **Admin UI**: React 19, MUI v9 (`size={{ xs: 12 }}` for Grid), react-router-dom v7
- **Multi-tenancy**: `X-Tenant-Id` header → AsyncLocalStorage → PostgreSQL `search_path`

## Guidelines for AI Agents
1. **Read `PHASE.md`** before starting any task — know the current phase.
2. **Read `roadmapV2.md`** for V2 planned features and architecture.
3. **Database changes**: Update Drizzle schema in `apps/rosmarium-server/src/db/schema/`, then `pnpm db:generate`. Show migration diff before applying.
4. **Check `.agent/skills/`** for domain-specific patterns before modifying database, GraphQL, search, graph, or AI pipeline code.
5. **Testing**: Co-locate tests as `*.test.ts` (Vitest) or `test_*.py` (pytest). Run `pnpm typecheck && pnpm lint && pnpm test` before committing.
6. **Documentation**: Update docs in `apps/rosmarium-www/src/content/docs/` for API changes. Screenshots via Chrome DevTools MCP only — no synthetic images.
7. **Verify after every change**: `pnpm typecheck && pnpm lint && pnpm test`

## Custom Agent Skills
Check `.agent/skills/` for detailed patterns on: content-engine, drizzle-schema, pothos-graphql, pgvector-search, rag-pipeline, knowledge-graph, fastify-server, admin-ui, ai-intelligence, block-editor, workflow-engine, plugin-system.
