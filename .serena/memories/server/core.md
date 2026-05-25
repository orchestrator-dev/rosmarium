# rosmarium-server — Core

Package: `@rosmarium-cms/server`  
Path: `apps/rosmarium-server/`  
Framework: Fastify 4, ESM TypeScript, Node 22

## Entry points
- `src/index.ts` — process entry (starts server)
- `src/app.ts` — Fastify app factory
- `src/config.ts` — Zod env schema; import as `import { config } from '../../config.js'`
- `src/routes/index.ts` — registers all route modules

## Config env vars (Zod schema)
NODE_ENV, PORT(3000), HOST, DATABASE_URL, REDIS_URL,  
STORAGE_PROVIDER/ENDPOINT/BUCKET/REGION/ACCESS_KEY/SECRET_KEY,  
SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD,  
AI_WORKER_URL (default http://localhost:8001),  
AI_WORKER_SECRET, EMBEDDING_PROVIDER, EMBEDDING_MODEL, OLLAMA_BASE_URL

## Routes registered (src/routes/index.ts)
- `/api/auth/*` — session, API keys
- `/api/content/*` — entries, types
- `/api/search`, `/api/search/suggest` — hybrid search
- `/api/rag/retrieve` — RAG retrieval + SSE stream
- `/api/intelligence/*` — tag, NER, summarize, duplicates
- `/api/admin/queue-stats` — BullMQ stats
- `/api/webhooks` — webhooks
- `/health` — health check
- `/graphql` — GraphQL endpoint (graphql-yoga)

## DB (Drizzle ORM)
- Config: `drizzle.config.ts`
- Schema dir: `src/db/schema/`
- Migrations dir: `src/db/migrations/` (at migration 0006)
- Important tables: `users`, `sessions`, `content_types`, `content_entries`, `api_keys`, `webhooks`
- `content_entries` has: `data jsonb`, `metadata jsonb`, `search_vector tsvector` (generated, GIN indexed), `status`, `locale`, `content_type_id`
- Vector embeddings: per-type tables `rosmarium_{contentType}_embeddings`

## Key modules
- `src/modules/rbac/rbac.service.ts` — `rbacService.canAccessEntry()`
- `src/modules/search/search.service.ts` — hybrid search orchestrator
- `src/modules/search/ai-worker.client.ts` — HTTP to ai-worker (`embedQuery`, `healthCheck`)
- `src/modules/rag/rag.client.ts` — HTTP to ai-worker RAG endpoint
- `src/modules/intelligence/intelligence.client.ts` — HTTP to ai-worker intelligence
- `src/modules/intelligence/intelligence.service.ts` — metadata persistence (JSONB merge)
- `src/modules/jobs/intelligence.jobs.ts` — BullMQ job dispatch
