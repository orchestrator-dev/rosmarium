# Rosmarium CMS — Core

**Repo root:** `/home/manu/lab/rosmarium`  
**Type:** pnpm monorepo + Turborepo  
**Phase:** Phase 3 — Developer Experience & Ecosystem (v0.6.0+)  
Phase 2 (AI Layer, v0.5.0) is fully shipped.

## Apps
| App | Path | Lang | Port | Purpose |
|---|---|---|---|---|
| rosmarium-server | `apps/rosmarium-server` | TS/Fastify | 3000 | CMS API, GraphQL, auth, assets |
| rosmarium-admin | `apps/rosmarium-admin` | React/Vite | (served by server in prod) | Admin SPA |
| rosmarium-ai-worker | `apps/rosmarium-ai-worker` | Python/FastAPI | 8001 | AI pipeline only, never public |
| rosmarium-cli | `apps/rosmarium-cli` | TS | — | Developer CLI tool |

## Infra
- PostgreSQL 16 + pgvector
- Redis 7 (BullMQ queues)
- S3-compatible storage
- Infra via `compose.yml` (Docker or Podman auto-detected)

## Key Invariants
- rosmarium-server → rosmarium-ai-worker: internal HTTP calls (sync) + BullMQ (async)
- AI worker never exposed to external clients
- All env vars loaded from root `.env` (rosmarium-server) or `apps/rosmarium-ai-worker/.env`
- DB migrations in `apps/rosmarium-server/src/db/migrations/` (Drizzle ORM), currently at 0006

## Module Map (rosmarium-server)
- `src/modules/auth/` — auth, sessions, API keys (Lucia)
- `src/modules/content/` — content type registry, CRUD, query builder
- `src/modules/rbac/` — RBAC middleware + service (CONTENT_READ_ANY / CONTENT_READ_OWN)
- `src/modules/search/` — BM25 + pgvector + RRF hybrid search
- `src/modules/rag/` — RAG pipeline client + service
- `src/modules/intelligence/` — AI metadata (tags, NER, summaries, duplicates)
- `src/modules/jobs/` — BullMQ job dispatch (intelligence-jobs)
- `src/modules/webhooks/` — webhook service + queue

## Module Map (rosmarium-ai-worker)
- `rosmarium_ai_worker/embedding/` — base, ollama, openai, cohere adapters + registry
- `rosmarium_ai_worker/vector/` — pgvector index manager
- `rosmarium_ai_worker/chunking/` — fixed, sentence, section chunkers + registry
- `rosmarium_ai_worker/rag/` — RAG pipeline, retriever, formatter
- `rosmarium_ai_worker/intelligence/` — tagger, NER, summarizer, duplicate_detector
- `rosmarium_ai_worker/workers/` — embedding_worker, intelligence_worker, consumer
- `rosmarium_ai_worker/api/routes/` — health, search, rag, intelligence

## Per-app memories
- Server details: `mem:server/core`
- AI worker details: `mem:ai-worker/core`
- Tech stack + tools: `mem:tech_stack`
- Dev commands: `mem:suggested_commands`
- Code conventions: `mem:conventions`
- Task completion checklist: `mem:task_completion`
