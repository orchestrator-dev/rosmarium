# Code Conventions

## TypeScript (cortex-server & cortex-admin)
- ESM modules only (`"type": "module"`)
- Strict TypeScript (`tsc --noEmit` must pass with 0 errors)
- Imports use `.js` extension (ESM Node resolution)
- Config always accessed via `import { config } from '../../config.js'`
- Services exported as plain objects with async methods (e.g. `export const searchService = { async search(...) {} }`)
- Fastify routes registered in `src/routes/` and wired in `src/routes/index.ts`
- Module pattern: `src/modules/<feature>/` containing `<feature>.service.ts`, `<feature>.client.ts`, `<feature>.service.test.ts`

## Python (cortex-ai-worker)
- Python 3.12, strict mypy
- Ruff line-length=100; strict rule set (ANN, S, B, etc.)
- Pydantic BaseModel / pydantic-settings for all config and request/response schemas
- FastAPI routes in `api/routes/<module>.py`, registered in app via router
- All log messages use structlog (no f-string PII in log lines — never log user query text)
- async throughout (asyncpg, httpx, FastAPI async routes)
- X-Worker-Secret header validates internal callers (cortex-server → ai-worker)
- Tests: pytest + pytest-asyncio, asyncio_mode=auto; testcontainers for DB/Redis integration

## Database (Drizzle ORM)
- Schema in `apps/cortex-server/src/db/schema/`
- Migrations hand-written SQL in `apps/cortex-server/src/db/migrations/` (named `NNNN_<slug>.sql`)
- `pnpm db:generate` for drizzle-managed migrations; hand-written migrations copied manually
- pgvector embeddings stored in per-content-type tables: `cortex_{contentType}_embeddings`
- RBAC: `CONTENT_READ_ANY` vs `CONTENT_READ_OWN` permissions checked in services

## Naming
- TS files: kebab-case (`search.service.ts`, `ai-worker.client.ts`)
- Python files: snake_case (`index_manager.py`, `embedding_worker.py`)
- Routes: REST `/api/<resource>` pattern
- Queue names: BullMQ named queues (e.g. `embedding-jobs`, `intelligence-jobs`)

## Error handling
- cortex-server → ai-worker: use custom error classes (e.g. `SearchEmbeddingError`), never let raw network errors bubble up; graceful fallback to fulltext-only search when AI worker unreachable
- Python: structured exceptions, never swallow without logging

## Testing
- TS unit tests: vitest, co-located with source (`*.test.ts`)
- Python: `tests/` directory at worker root, file per module (`test_search.py`, `test_rag.py`, etc.)
- Pure functions (like RRF) tested without DB; DB tests use testcontainers
