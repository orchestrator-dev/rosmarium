# Cortex CMS — Core

**Repo root:** `/home/manu/lab/cortex`  
**Type:** pnpm monorepo + Turborepo  
**Phase:** Phase 3 — Developer Experience & Ecosystem (v0.6.0+)  
Phase 2 (AI Layer, v0.5.0) is fully shipped.

## Apps
| App | Path | Lang | Port | Purpose |
|---|---|---|---|---|
| cortex-server | `apps/cortex-server` | TS/Fastify | 3000 | CMS API, GraphQL, auth, assets |
| cortex-admin | `apps/cortex-admin` | React/Vite | (served by server in prod) | Admin SPA |
| cortex-ai-worker | `apps/cortex-ai-worker` | Python/FastAPI | 8001 | AI pipeline only, never public |
| cortex-cli | `apps/cortex-cli` | TS | — | Developer CLI tool |

## Infra
- PostgreSQL 16 + pgvector
- Redis 7 (BullMQ queues)
- S3-compatible storage
- Infra via `compose.yml` (Docker or Podman auto-detected)

## Key Invariants
- cortex-server → cortex-ai-worker: internal HTTP calls (sync) + BullMQ (async)
- AI worker never exposed to external clients
- All env vars loaded from root `.env` (cortex-server) or `apps/cortex-ai-worker/.env`
- DB migrations in `apps/cortex-server/src/db/migrations/` (Drizzle ORM), currently at 0006

## Module Map (cortex-server)
- `src/modules/auth/` — auth, sessions, API keys (Lucia)
- `src/modules/content/` — content type registry, CRUD, query builder
- `src/modules/rbac/` — RBAC middleware + service (CONTENT_READ_ANY / CONTENT_READ_OWN)
- `src/modules/search/` — BM25 + pgvector + RRF hybrid search
- `src/modules/rag/` — RAG pipeline client + service
- `src/modules/intelligence/` — AI metadata (tags, NER, summaries, duplicates)
- `src/modules/jobs/` — BullMQ job dispatch (intelligence-jobs)
- `src/modules/webhooks/` — webhook service + queue

## Module Map (cortex-ai-worker)
- `cortex_ai_worker/embedding/` — base, ollama, openai, cohere adapters + registry
- `cortex_ai_worker/vector/` — pgvector index manager
- `cortex_ai_worker/chunking/` — fixed, sentence, section chunkers + registry
- `cortex_ai_worker/rag/` — RAG pipeline, retriever, formatter
- `cortex_ai_worker/intelligence/` — tagger, NER, summarizer, duplicate_detector
- `cortex_ai_worker/workers/` — embedding_worker, intelligence_worker, consumer
- `cortex_ai_worker/api/routes/` — health, search, rag, intelligence

## Per-app memories
- Server details: `mem:server/core`
- AI worker details: `mem:ai-worker/core`
- Tech stack + tools: `mem:tech_stack`
- Dev commands: `mem:suggested_commands`
- Code conventions: `mem:conventions`
- Task completion checklist: `mem:task_completion`
