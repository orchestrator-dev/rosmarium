# Rosmarium CMS — Current Development Phase

## Active Phase: Phase 2 — AI Layer
**Target release:** v0.2.0
**Duration:** Months 5–8

## Completed Phases
- ✅ Phase 1 — CMS Foundation (v0.1.0 released)

## Active Milestone
Month 5 — Python AI Worker Foundation + Embedding Pipeline ✅

## Checklist
- [x] rosmarium-ai-worker bootstrap (FastAPI, pyproject.toml, uv, Ruff, mypy)
- [x] Pydantic Settings config with all env vars
- [x] asyncpg connection pool (shared PostgreSQL)
- [x] BullMQ Redis queue consumer
- [x] EmbeddingProvider abstract base class
- [x] Ollama adapter (local, default for dev)
- [x] OpenAI adapter (production option)
- [x] Cohere adapter
- [x] pgvector index manager (ensure_table, upsert, delete, search)
- [x] embedding_worker job processor
- [x] Docker service added to compose.yml
- [x] GET /health + GET /ready endpoints
- [x] All tests passing, mypy clean

## Notes
Phase 1 shipped as v0.1.0. Full REST + GraphQL API, Auth + RBAC,
Asset Engine, Admin UI scaffold all complete.
Month 5 shipped — rosmarium-ai-worker bootstrapped with full embedding pipeline,
3 provider adapters, pgvector index manager, and BullMQ consumer.